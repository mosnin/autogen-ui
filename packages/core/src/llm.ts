import type { ChatMessage } from "./schema";

/**
 * Provider-agnostic LLM contract — designed around tool use + prompt caching,
 * not free-text JSON extraction. Implementations live in `./clients` and
 * speak this shape via plain `fetch` (no vendor SDK).
 */

/** A single chunk of the system prompt, optionally cacheable. */
export interface LLMSystemSegment {
  text: string;
  /**
   * Mark this segment as a cache breakpoint (Anthropic ephemeral cache).
   * Clients that don't support caching simply ignore it.
   */
  cache?: boolean;
}

/** A tool definition exposed to the model. */
export interface LLMTool {
  name: string;
  description: string;
  /** JSON Schema for the tool input. Kept intentionally loose; Zod validates afterwards. */
  inputSchema: Record<string, unknown>;
}

export interface LLMRequest {
  system: string | LLMSystemSegment[];
  messages: ChatMessage[];
  tools?: LLMTool[];
  /** Force the model to call this specific tool. */
  toolChoice?: { name: string };
  maxTokens?: number;
  /**
   * Optional abort signal. When it fires, the in-flight provider request is
   * cancelled and the client throws `LLMAbortError` (no further retries).
   */
  signal?: AbortSignal;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface LLMResult {
  /** Any plain-text reply from the model (often empty when a tool was forced). */
  text: string;
  toolCalls: ToolCall[];
}

/** Streaming event union — granular enough to render partial tool input. */
export type LLMEvent =
  | { kind: "text_delta"; delta: string }
  | { kind: "tool_start"; id: string; name: string }
  | { kind: "tool_input_delta"; id: string; partialJson: string }
  | { kind: "tool_end"; id: string; input: unknown }
  | { kind: "done" }
  | { kind: "error"; error: string };

export interface LLMClient {
  readonly name: string;
  complete(req: LLMRequest): Promise<LLMResult>;
  stream?(req: LLMRequest): AsyncIterable<LLMEvent>;
}

/** Normalize `system` into segments. */
export function systemToSegments(
  system: string | LLMSystemSegment[],
): LLMSystemSegment[] {
  return typeof system === "string" ? [{ text: system }] : system;
}

/** Flatten segments to a single string for clients that don't support structured system. */
export function systemToString(system: string | LLMSystemSegment[]): string {
  return systemToSegments(system).map((s) => s.text).join("\n");
}
