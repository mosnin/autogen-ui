import type {
  LLMClient,
  LLMEvent,
  LLMRequest,
  LLMResult,
  LLMSystemSegment,
  LLMTool,
  ToolCall,
} from "../llm";
import { systemToSegments, systemToString } from "../llm";

/**
 * Wrappers around pre-instantiated official vendor SDKs (`@anthropic-ai/sdk`
 * and `openai`). Useful when the consumer is already using those SDKs in
 * their app — they can pass the SDK instance directly without us pulling in
 * a fresh copy as a dependency.
 *
 * The SDK shapes are intentionally typed as `unknown`-ish structural types
 * so consumers' SDK versions don't matter at compile time.
 */

/* ------------------------------------------------------------------ *
 * Anthropic SDK wrapper
 * ------------------------------------------------------------------ */

/** Minimum surface of the `@anthropic-ai/sdk` client we use. */
export interface AnthropicSdkLike {
  messages: {
    create(body: Record<string, unknown>): Promise<unknown>;
    stream(body: Record<string, unknown>): AnthropicSdkStream;
  };
}

/** The structural shape of `client.messages.stream(...)`. */
export interface AnthropicSdkStream
  extends AsyncIterable<AnthropicSdkStreamEvent> {
  // some SDK versions also expose .on / .finalMessage — we don't rely on them.
}

interface AnthropicSdkStreamEvent {
  type: string;
  index?: number;
  content_block?: {
    type: string;
    id?: string;
    name?: string;
  };
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
}

interface AnthropicTextBlock {
  type: "text";
  text: string;
}
interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicSdkOptions {
  /** Defaults to "claude-sonnet-4-6". */
  model?: string;
  /** Defaults to 4096. */
  maxTokens?: number;
}

function buildAnthropicSdkBody(
  req: LLMRequest,
  model: string,
  maxTokens: number,
  stream: boolean,
): Record<string, unknown> {
  const segments: LLMSystemSegment[] = systemToSegments(req.system);
  const system = segments.map((s) =>
    s.cache
      ? { type: "text", text: s.text, cache_control: { type: "ephemeral" } }
      : { type: "text", text: s.text },
  );
  const tools = req.tools?.map((t: LLMTool) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
  const toolChoice = req.toolChoice
    ? { type: "tool", name: req.toolChoice.name }
    : undefined;
  return {
    model,
    max_tokens: req.maxTokens ?? maxTokens,
    system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(tools && tools.length > 0 ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(stream ? { stream: true } : {}),
  };
}

export function wrapAnthropicSdk(
  client: AnthropicSdkLike,
  opts: AnthropicSdkOptions = {},
): LLMClient {
  const model = opts.model ?? "claude-sonnet-4-6";
  const maxTokens = opts.maxTokens ?? 4096;

  return {
    name: `anthropic-sdk:${model}`,

    async complete(req): Promise<LLMResult> {
      const raw = await client.messages.create(
        buildAnthropicSdkBody(req, model, maxTokens, false),
      );
      const data = raw as {
        content?: Array<AnthropicTextBlock | AnthropicToolUseBlock>;
      };
      let text = "";
      const toolCalls: ToolCall[] = [];
      for (const block of data.content ?? []) {
        if (block.type === "text") text += block.text;
        else if (block.type === "tool_use") {
          toolCalls.push({ id: block.id, name: block.name, input: block.input });
        }
      }
      return { text, toolCalls };
    },

    async *stream(req): AsyncIterable<LLMEvent> {
      let streamObj: AnthropicSdkStream;
      try {
        streamObj = client.messages.stream(
          buildAnthropicSdkBody(req, model, maxTokens, true),
        );
      } catch (e) {
        yield { kind: "error", error: String(e) };
        return;
      }

      const blocks = new Map<
        number,
        { id: string; name: string; partial: string }
      >();

      try {
        for await (const event of streamObj) {
          if (event.type === "content_block_start") {
            const idx = event.index ?? 0;
            const cb = event.content_block;
            if (cb && cb.type === "tool_use" && cb.id && cb.name) {
              blocks.set(idx, { id: cb.id, name: cb.name, partial: "" });
              yield { kind: "tool_start", id: cb.id, name: cb.name };
            }
          } else if (event.type === "content_block_delta") {
            const idx = event.index ?? 0;
            const delta = event.delta;
            if (!delta) continue;
            if (delta.type === "text_delta" && typeof delta.text === "string") {
              yield { kind: "text_delta", delta: delta.text };
            } else if (
              delta.type === "input_json_delta" &&
              typeof delta.partial_json === "string"
            ) {
              const block = blocks.get(idx);
              if (block) {
                block.partial += delta.partial_json;
                yield {
                  kind: "tool_input_delta",
                  id: block.id,
                  partialJson: delta.partial_json,
                };
              }
            }
          } else if (event.type === "content_block_stop") {
            const idx = event.index ?? 0;
            const block = blocks.get(idx);
            if (block) {
              let parsed: unknown = {};
              try {
                parsed = block.partial.length > 0 ? JSON.parse(block.partial) : {};
              } catch {
                parsed = { _raw: block.partial };
              }
              yield { kind: "tool_end", id: block.id, input: parsed };
              blocks.delete(idx);
            }
          } else if (event.type === "message_stop") {
            break;
          }
        }
      } catch (e) {
        yield { kind: "error", error: String(e) };
        return;
      }
      yield { kind: "done" };
    },
  };
}

/* ------------------------------------------------------------------ *
 * OpenAI SDK wrapper
 * ------------------------------------------------------------------ */

/** Minimum surface of the `openai` SDK client we use. */
export interface OpenAiSdkLike {
  chat: {
    completions: {
      create(body: Record<string, unknown>): Promise<unknown>;
    };
  };
}

interface OpenAiSdkOptions {
  /** Defaults to "gpt-4o". */
  model?: string;
}

interface OpenAiNonStreamResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
}

function buildOpenAiSdkBody(
  req: LLMRequest,
  model: string,
  stream: boolean,
): Record<string, unknown> {
  const systemText = systemToString(req.system);
  const messages: Array<{ role: string; content: string }> = [];
  if (systemText) messages.push({ role: "system", content: systemText });
  for (const m of req.messages) {
    messages.push({ role: m.role, content: m.content });
  }
  const tools = req.tools?.map((t: LLMTool) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
  const toolChoice = req.toolChoice
    ? { type: "function", function: { name: req.toolChoice.name } }
    : undefined;
  return {
    model,
    messages,
    ...(tools && tools.length > 0 ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    ...(stream ? { stream: true } : {}),
  };
}

export function wrapOpenAiSdk(
  client: OpenAiSdkLike,
  opts: OpenAiSdkOptions = {},
): LLMClient {
  const model = opts.model ?? "gpt-4o";

  return {
    name: `openai-sdk:${model}`,

    async complete(req): Promise<LLMResult> {
      const raw = await client.chat.completions.create(
        buildOpenAiSdkBody(req, model, false),
      );
      const data = raw as OpenAiNonStreamResponse;
      const message = data.choices?.[0]?.message;
      const text = message?.content ?? "";
      const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((tc) => {
        let input: unknown = {};
        try {
          input = tc.function.arguments
            ? JSON.parse(tc.function.arguments)
            : {};
        } catch {
          input = { _raw: tc.function.arguments };
        }
        return { id: tc.id, name: tc.function.name, input };
      });
      return { text, toolCalls };
    },

    async *stream(req): AsyncIterable<LLMEvent> {
      let raw: unknown;
      try {
        raw = await client.chat.completions.create(
          buildOpenAiSdkBody(req, model, true),
        );
      } catch (e) {
        yield { kind: "error", error: String(e) };
        return;
      }

      const iter = raw as AsyncIterable<OpenAiStreamChunk>;
      const tools = new Map<
        number,
        { id: string; name: string; partial: string }
      >();

      try {
        for await (const chunk of iter) {
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) yield { kind: "text_delta", delta: delta.content };
          for (const tc of delta.tool_calls ?? []) {
            let entry = tools.get(tc.index);
            if (!entry) {
              const id = tc.id ?? `call_${tc.index}`;
              const name = tc.function?.name ?? "";
              entry = { id, name, partial: "" };
              tools.set(tc.index, entry);
              yield { kind: "tool_start", id, name };
            }
            const args = tc.function?.arguments;
            if (args) {
              entry.partial += args;
              yield {
                kind: "tool_input_delta",
                id: entry.id,
                partialJson: args,
              };
            }
          }
        }
      } catch (e) {
        yield { kind: "error", error: String(e) };
        return;
      }

      for (const entry of tools.values()) {
        let parsed: unknown = {};
        try {
          parsed = entry.partial ? JSON.parse(entry.partial) : {};
        } catch {
          parsed = { _raw: entry.partial };
        }
        yield { kind: "tool_end", id: entry.id, input: parsed };
      }
      yield { kind: "done" };
    },
  };
}
