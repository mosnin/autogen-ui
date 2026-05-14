import {
  agentRequestSchema,
  agentResponseSchema,
  patchSchema,
  type AgentRequest,
  type StreamFrame,
} from "./schema";
import {
  buildContextMessage,
  extractJson,
  getSystemPrompt,
  type CapabilityModule,
  type LLMClient,
} from "./agent";

/**
 * Streaming counterpart to `UIAgent`. `runStream` emits StreamFrames as the
 * model produces them: a `patch` frame the moment a complete patch object can
 * be parsed, `message` deltas for prose, and a final `done` (or `error`).
 */
export interface StreamingUIAgent {
  runStream(request: AgentRequest): AsyncIterable<StreamFrame>;
}

export interface CreateStreamingUIAgentOptions {
  client: LLMClient;
  capabilities?: CapabilityModule[];
  instructions?: string;
}

/* ------------------------------------------------------------------ *
 * Tolerant incremental JSON scanner
 *
 * The model returns `{ "message": string, "patches": Patch[] }`. We scan the
 * growing text, isolate the `message` string and complete top-level elements
 * of the `patches` array as soon as they close, without needing the whole
 * document to be valid yet.
 * ------------------------------------------------------------------ */

interface ScanState {
  /** Index up to which we have consumed input. */
  pos: number;
  /** Phase of the scan. */
  phase: "seek-patches" | "in-array" | "done";
  /** Characters of the current top-level patch element accumulated so far. */
  current: string;
  /** Brace/bracket depth within the current element. */
  depth: number;
  /** Whether the scanner is currently inside a string literal. */
  inString: boolean;
  /** Whether the previous char was an escape backslash inside a string. */
  escaped: boolean;
  /** Whether we have started accumulating an element (seen its first `{`). */
  started: boolean;
}

function createScanState(): ScanState {
  return {
    pos: 0,
    phase: "seek-patches",
    current: "",
    depth: 0,
    inString: false,
    escaped: false,
    started: false,
  };
}

/**
 * Advance the scanner over any newly appended text. Returns the raw strings of
 * every complete top-level `patches` element discovered in this pass.
 */
function scanPatches(state: ScanState, text: string): string[] {
  const found: string[] = [];

  if (state.phase === "done") return found;

  if (state.phase === "seek-patches") {
    const key = text.indexOf('"patches"', state.pos);
    if (key === -1) {
      // Keep a little overlap so a split `"patches"` token isn't missed.
      state.pos = Math.max(state.pos, text.length - 10);
      return found;
    }
    const bracket = text.indexOf("[", key);
    if (bracket === -1) {
      state.pos = key;
      return found;
    }
    state.pos = bracket + 1;
    state.phase = "in-array";
  }

  while (state.pos < text.length) {
    const ch = text[state.pos];
    state.pos += 1;
    if (ch === undefined) break;

    if (!state.started) {
      if (ch === "{") {
        state.started = true;
        state.depth = 1;
        state.current = "{";
        state.inString = false;
        state.escaped = false;
      } else if (ch === "]") {
        state.phase = "done";
        break;
      }
      // skip whitespace / commas between elements
      continue;
    }

    state.current += ch;

    if (state.inString) {
      if (state.escaped) {
        state.escaped = false;
      } else if (ch === "\\") {
        state.escaped = true;
      } else if (ch === '"') {
        state.inString = false;
      }
      continue;
    }

    if (ch === '"') {
      state.inString = true;
    } else if (ch === "{" || ch === "[") {
      state.depth += 1;
    } else if (ch === "}" || ch === "]") {
      state.depth -= 1;
      if (state.depth === 0) {
        found.push(state.current);
        state.started = false;
        state.current = "";
      }
    }
  }

  return found;
}

/** Best-effort extraction of the `message` string field from partial text. */
function extractMessage(text: string): string | undefined {
  const key = text.indexOf('"message"');
  if (key === -1) return undefined;
  const colon = text.indexOf(":", key);
  if (colon === -1) return undefined;
  let i = colon + 1;
  while (i < text.length && text[i] !== '"') i += 1;
  if (i >= text.length) return undefined;
  i += 1;
  let out = "";
  let escaped = false;
  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === undefined) break;
    if (escaped) {
      out +=
        ch === "n"
          ? "\n"
          : ch === "t"
            ? "\t"
            : ch === "r"
              ? "\r"
              : ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
  }
  // String not yet closed — return what we have so far.
  return out;
}

/**
 * Create a streaming UI agent. Uses `client.stream` when available to emit
 * patches incrementally; otherwise falls back to a single `client.complete`.
 */
export function createStreamingUIAgent({
  client,
  capabilities = [],
  instructions,
}: CreateStreamingUIAgentOptions): StreamingUIAgent {
  const system = getSystemPrompt(capabilities, instructions);

  return {
    async *runStream(request) {
      let parsed: AgentRequest;
      try {
        parsed = agentRequestSchema.parse(request);
      } catch (err) {
        yield {
          kind: "error",
          error: err instanceof Error ? err.message : "Invalid request",
        };
        return;
      }

      const messages = [buildContextMessage(parsed), ...parsed.messages];

      try {
        if (client.stream) {
          const state = createScanState();
          let accumulated = "";
          let emittedMessage = "";

          for await (const chunk of client.stream({ system, messages })) {
            accumulated += chunk;

            for (const raw of scanPatches(state, accumulated)) {
              let candidate: unknown;
              try {
                candidate = JSON.parse(raw);
              } catch {
                continue;
              }
              const result = patchSchema.safeParse(candidate);
              if (result.success) {
                yield { kind: "patch", patch: result.data };
              }
            }

            const message = extractMessage(accumulated);
            if (message !== undefined && message.length > emittedMessage.length) {
              const delta = message.slice(emittedMessage.length);
              emittedMessage = message;
              if (delta) yield { kind: "message", delta };
            }
          }

          // Final reconciliation: in case the scanner missed the tail (e.g. the
          // full document only became parseable at the very end), parse the
          // whole response and emit anything still outstanding.
          const finalMessage = extractMessage(accumulated);
          if (
            finalMessage !== undefined &&
            finalMessage.length > emittedMessage.length
          ) {
            yield { kind: "message", delta: finalMessage.slice(emittedMessage.length) };
          }

          yield { kind: "done" };
          return;
        }

        // Non-streaming fallback.
        const rawText = await client.complete({ system, messages });
        let json: unknown;
        try {
          json = extractJson(rawText);
        } catch {
          yield {
            kind: "error",
            error: `[autogen-ui] ${client.name} did not return valid JSON.`,
          };
          return;
        }

        const response = agentResponseSchema.parse(json);
        for (const patch of response.patches) {
          yield { kind: "patch", patch };
        }
        if (response.message) {
          yield { kind: "message", delta: response.message };
        }
        yield { kind: "done" };
      } catch (err) {
        yield {
          kind: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
  };
}
