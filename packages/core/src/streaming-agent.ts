import { createPatchStreamParser } from "./_patch-stream";
import {
  buildContextMessage,
  buildSystemSegments,
  EMIT_PATCHES_TOOL,
  type CapabilityModule,
} from "./agent";
import type { LLMClient } from "./llm";
import { applyPatch, validatePatchTargets } from "./patch";
import type { ComponentDoc } from "./registry";
import {
  agentRequestSchema,
  agentResponseSchema,
  emptyDashboard,
  patchSchema,
  type AgentRequest,
  type StreamFrame,
} from "./schema";

export interface StreamingUIAgent {
  runStream(request: AgentRequest): AsyncIterable<StreamFrame>;
}

import type { BrandKit } from "./brand";

export interface CreateStreamingUIAgentOptions {
  client: LLMClient;
  capabilities?: CapabilityModule[];
  components?: ComponentDoc[];
  instructions?: string;
  brand?: BrandKit;
}

/**
 * Streaming agent built on tool use. The model is forced to call
 * `emit_patches`; we consume the streamed `input_json_delta` events,
 * incrementally extract complete patch objects + message text, validate
 * each patch, and yield `StreamFrame`s as they materialise.
 *
 * Falls back to the client's non-streaming `complete` when `stream` is
 * unavailable.
 */
export function createStreamingUIAgent({
  client,
  capabilities = [],
  components = [],
  instructions,
  brand,
}: CreateStreamingUIAgentOptions): StreamingUIAgent {
  const system = buildSystemSegments({ capabilities, components, instructions, brand });

  return {
    async *runStream(request: AgentRequest): AsyncIterable<StreamFrame> {
      let parsed: AgentRequest;
      try {
        parsed = agentRequestSchema.parse(request);
      } catch (err) {
        yield { kind: "error", error: err instanceof Error ? err.message : "Invalid request" };
        yield { kind: "done" };
        return;
      }

      const messages = [buildContextMessage(parsed), ...parsed.messages];
      const reqArgs = {
        system,
        messages,
        tools: [EMIT_PATCHES_TOOL],
        toolChoice: { name: EMIT_PATCHES_TOOL.name },
      };

      let currentDashboard = parsed.dashboard ?? emptyDashboard();

      // Streaming path
      if (client.stream) {
        const parser = createPatchStreamParser();
        let toolId: string | undefined;
        let surfacedError: string | null = null;

        try {
          for await (const event of client.stream(reqArgs)) {
            if (event.kind === "tool_start" && event.name === EMIT_PATCHES_TOOL.name) {
              toolId = event.id;
              continue;
            }
            if (event.kind === "tool_input_delta" && event.id === toolId) {
              const { patches, messageDelta } = parser.feed(event.partialJson);
              if (messageDelta) yield { kind: "message", delta: messageDelta };
              for (const raw of patches) {
                let candidate: unknown;
                try {
                  candidate = JSON.parse(raw);
                } catch {
                  yield { kind: "error", error: `Could not parse patch: ${raw.slice(0, 80)}` };
                  continue;
                }
                const result = patchSchema.safeParse(candidate);
                if (result.success) {
                  const warnings = validatePatchTargets(currentDashboard, [result.data]);
                  for (const w of warnings) yield { kind: "warning", warning: w };
                  yield { kind: "patch", patch: result.data };
                  currentDashboard = applyPatch(currentDashboard, result.data);
                } else {
                  yield {
                    kind: "error",
                    error: `Invalid patch dropped: ${result.error.errors[0]?.message ?? "unknown"}`,
                  };
                }
              }
              continue;
            }
            if (event.kind === "error") {
              surfacedError = event.error;
              break;
            }
          }
        } catch (err) {
          surfacedError = err instanceof Error ? err.message : String(err);
        }

        if (surfacedError) yield { kind: "error", error: surfacedError };
        yield { kind: "done" };
        return;
      }

      // Non-streaming fallback
      try {
        const result = await client.complete(reqArgs);
        const call = result.toolCalls.find((c) => c.name === EMIT_PATCHES_TOOL.name);
        if (!call) {
          yield { kind: "error", error: "Model did not call emit_patches" };
          yield { kind: "done" };
          return;
        }
        const validated = agentResponseSchema.safeParse(call.input);
        if (!validated.success) {
          yield { kind: "error", error: validated.error.errors.map((e) => e.message).join("; ") };
          yield { kind: "done" };
          return;
        }
        if (validated.data.message) {
          yield { kind: "message", delta: validated.data.message };
        }
        for (const patch of validated.data.patches) {
          const warnings = validatePatchTargets(currentDashboard, [patch]);
          for (const w of warnings) yield { kind: "warning", warning: w };
          yield { kind: "patch", patch };
          currentDashboard = applyPatch(currentDashboard, patch);
        }
      } catch (err) {
        yield { kind: "error", error: err instanceof Error ? err.message : String(err) };
      }
      yield { kind: "done" };
    },
  };
}
