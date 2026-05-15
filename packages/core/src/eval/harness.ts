import type { UIAgent } from "../agent";
import type { LLMClient, LLMRequest, LLMResult } from "../llm";
import {
  agentResponseSchema,
  patchSchema,
  type AgentResponse,
  type ChatMessage,
  type Dashboard,
} from "../schema";

/**
 * Tiny eval harness for generation quality. `createFakeClient` gives the
 * agent deterministic scripted tool calls, and `runEval` runs a list of
 * `EvalCase`s and reports pass/fail.
 */

export type FakeReply =
  | AgentResponse
  | { toolName: string; input: unknown }
  | { text: string };

type ScriptEntry = FakeReply | ((req: LLMRequest) => FakeReply);

/**
 * An `LLMClient` that replays a fixed script of fake tool calls. Each
 * `complete` call consumes the next entry. If the entry is an
 * `AgentResponse`, it's returned as if the model called `emit_patches` with
 * that input. Running off the end of the script throws.
 */
export function createFakeClient(script: ScriptEntry[]): LLMClient {
  let cursor = 0;
  return {
    name: "fake",
    async complete(req: LLMRequest): Promise<LLMResult> {
      if (cursor >= script.length) {
        throw new Error(
          `[autogen-ui] fake client script exhausted after ${script.length} call(s)`,
        );
      }
      const entryRaw = script[cursor++]!;
      const entry = typeof entryRaw === "function" ? entryRaw(req) : entryRaw;
      if ("patches" in entry) {
        return {
          text: "",
          toolCalls: [{ id: `call_${cursor}`, name: "emit_patches", input: entry }],
        };
      }
      if ("toolName" in entry) {
        return {
          text: "",
          toolCalls: [{ id: `call_${cursor}`, name: entry.toolName, input: entry.input }],
        };
      }
      return { text: entry.text, toolCalls: [] };
    },
  };
}

export interface EvalCase {
  name: string;
  messages: ChatMessage[];
  dashboard?: Dashboard;
  /** Return an error string to fail the case, or null to pass. */
  expect: (result: AgentResponse) => string | null;
}

export interface EvalResult {
  name: string;
  ok: boolean;
  error?: string;
}

/** Run each case through the agent and apply its `expect` assertion. */
export async function runEval(agent: UIAgent, cases: EvalCase[]): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const c of cases) {
    try {
      const result = await agent.run({
        messages: c.messages,
        dashboard: c.dashboard ?? null,
      });
      const error = c.expect(result);
      results.push(
        error === null
          ? { name: c.name, ok: true }
          : { name: c.name, ok: false, error },
      );
    } catch (err) {
      results.push({
        name: c.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

const ID_REF_OPS = new Set([
  "replace",
  "update",
  "remove",
  "move",
  "append",
  "setStyle",
  "setMotion",
  "setBindings",
  "setEvents",
]);

/**
 * Reusable check: every patch parses against the schema, and id-referencing
 * ops carry a plausible (non-empty) id. Returns an error string or null.
 */
export function assertValidPatches(result: AgentResponse): string | null {
  const parsed = agentResponseSchema.safeParse(result);
  if (!parsed.success) {
    return `response failed schema: ${parsed.error.issues[0]?.message ?? "unknown"}`;
  }
  for (let i = 0; i < result.patches.length; i++) {
    const patch = result.patches[i]!;
    const check = patchSchema.safeParse(patch);
    if (!check.success) {
      return `patch[${i}] (${String((patch as { op?: unknown }).op)}) invalid: ${
        check.error.issues[0]?.message ?? "unknown"
      }`;
    }
    if (ID_REF_OPS.has(patch.op)) {
      const ref =
        "id" in patch ? patch.id : "parentId" in patch ? patch.parentId : undefined;
      if (!ref || ref.trim() === "") {
        return `patch[${i}] (${patch.op}) references an empty id`;
      }
    }
  }
  return null;
}
