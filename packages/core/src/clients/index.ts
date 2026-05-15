import type {
  LLMClient,
  LLMEvent,
  LLMRequest,
  LLMResult,
  LLMSystemSegment,
  LLMTool,
} from "../llm";
import { systemToSegments } from "../llm";

/**
 * Thin, dependency-free LLM clients (Anthropic + OpenAI), implementing the
 * unified `LLMClient` interface — `complete` for non-streaming and `stream`
 * for tool-use streaming. Wire-level only; use server-side.
 */

/* ------------------------------------------------------------------ *
 * Anthropic
 * ------------------------------------------------------------------ */

export interface AnthropicClientOptions {
  apiKey: string;
  /** Defaults to "claude-sonnet-4-6". */
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
}

function buildAnthropicBody(
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

export function createAnthropicClient(opts: AnthropicClientOptions): LLMClient {
  const model = opts.model ?? "claude-sonnet-4-6";
  const maxTokens = opts.maxTokens ?? 4096;
  const baseUrl = opts.baseUrl ?? "https://api.anthropic.com";
  const url = `${baseUrl}/v1/messages`;
  const headers: HeadersInit = {
    "content-type": "application/json",
    "x-api-key": opts.apiKey,
    "anthropic-version": "2023-06-01",
  };

  return {
    name: `anthropic:${model}`,

    async complete(req): Promise<LLMResult> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildAnthropicBody(req, model, maxTokens, false)),
      });
      if (!res.ok) {
        throw new Error(`[autogen-ui] Anthropic ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        content?: Array<AnthropicTextBlock | AnthropicToolUseBlock>;
      };
      let text = "";
      const toolCalls: LLMResult["toolCalls"] = [];
      for (const block of data.content ?? []) {
        if (block.type === "text") text += block.text;
        else if (block.type === "tool_use") {
          toolCalls.push({ id: block.id, name: block.name, input: block.input });
        }
      }
      return { text, toolCalls };
    },

    async *stream(req): AsyncIterable<LLMEvent> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildAnthropicBody(req, model, maxTokens, true)),
      });
      if (!res.ok || !res.body) {
        yield {
          kind: "error",
          error: `[autogen-ui] Anthropic ${res.status}: ${await res.text().catch(() => "")}`,
        };
        return;
      }

      // Track open tool-use blocks by content_block index to assemble inputs.
      const blocks = new Map<number, { id: string; name: string; partial: string }>();

      for await (const event of readAnthropicSse(res.body)) {
        if (event.event === "content_block_start") {
          const idx = event.data.index as number;
          const cb = event.data.content_block as
            | { type: "tool_use"; id: string; name: string }
            | { type: "text" }
            | undefined;
          if (cb && cb.type === "tool_use") {
            blocks.set(idx, { id: cb.id, name: cb.name, partial: "" });
            yield { kind: "tool_start", id: cb.id, name: cb.name };
          }
        } else if (event.event === "content_block_delta") {
          const idx = event.data.index as number;
          const delta = event.data.delta as
            | { type: "text_delta"; text: string }
            | { type: "input_json_delta"; partial_json: string }
            | undefined;
          if (!delta) continue;
          if (delta.type === "text_delta") {
            yield { kind: "text_delta", delta: delta.text };
          } else if (delta.type === "input_json_delta") {
            const block = blocks.get(idx);
            if (block) {
              block.partial += delta.partial_json;
              yield { kind: "tool_input_delta", id: block.id, partialJson: delta.partial_json };
            }
          }
        } else if (event.event === "content_block_stop") {
          const idx = event.data.index as number;
          const block = blocks.get(idx);
          if (block) {
            let parsedInput: unknown = {};
            try {
              parsedInput = block.partial.length > 0 ? JSON.parse(block.partial) : {};
            } catch {
              // tool input couldn't be parsed; leave as raw
              parsedInput = { _raw: block.partial };
            }
            yield { kind: "tool_end", id: block.id, input: parsedInput };
            blocks.delete(idx);
          }
        } else if (event.event === "message_stop") {
          break;
        }
      }
      yield { kind: "done" };
    },
  };
}

/* ------------------------------------------------------------------ *
 * OpenAI
 * ------------------------------------------------------------------ */

export interface OpenAIClientOptions {
  apiKey: string;
  /** Defaults to "gpt-4o". */
  model?: string;
  baseUrl?: string;
}

function buildOpenAIBody(
  req: LLMRequest,
  model: string,
  stream: boolean,
): Record<string, unknown> {
  const systemText = systemToSegments(req.system).map((s) => s.text).join("\n");
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemText },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
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
    ...(stream ? { stream: true } : {}),
  };
}

export function createOpenAIClient(opts: OpenAIClientOptions): LLMClient {
  const model = opts.model ?? "gpt-4o";
  const baseUrl = opts.baseUrl ?? "https://api.openai.com";
  const url = `${baseUrl}/v1/chat/completions`;
  const headers: HeadersInit = {
    "content-type": "application/json",
    authorization: `Bearer ${opts.apiKey}`,
  };

  return {
    name: `openai:${model}`,

    async complete(req): Promise<LLMResult> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildOpenAIBody(req, model, false)),
      });
      if (!res.ok) {
        throw new Error(`[autogen-ui] OpenAI ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
        }>;
      };
      const message = data.choices?.[0]?.message;
      const text = message?.content ?? "";
      const toolCalls: LLMResult["toolCalls"] = (message?.tool_calls ?? []).map((tc) => {
        let input: unknown = {};
        try {
          input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          input = { _raw: tc.function.arguments };
        }
        return { id: tc.id, name: tc.function.name, input };
      });
      return { text, toolCalls };
    },

    async *stream(req): AsyncIterable<LLMEvent> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildOpenAIBody(req, model, true)),
      });
      if (!res.ok || !res.body) {
        yield {
          kind: "error",
          error: `[autogen-ui] OpenAI ${res.status}: ${await res.text().catch(() => "")}`,
        };
        return;
      }

      // Track open tool calls by `index` (the only identifier in subsequent deltas).
      const tools = new Map<number, { id: string; name: string; partial: string }>();

      for await (const line of readOpenAiSse(res.body)) {
        if (line === "[DONE]") break;
        let evt: {
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
        };
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }
        const delta = evt.choices?.[0]?.delta;
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
            yield { kind: "tool_input_delta", id: entry.id, partialJson: args };
          }
        }
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

/* ------------------------------------------------------------------ *
 * Backwards-compatible aliases (the old "stream" client names).
 * ------------------------------------------------------------------ */

export {
  createAnthropicClient as createAnthropicStreamClient,
  createOpenAIClient as createOpenAIStreamClient,
};
export type {
  AnthropicClientOptions as AnthropicStreamClientOptions,
  OpenAIClientOptions as OpenAIStreamClientOptions,
};

/* ------------------------------------------------------------------ *
 * Internal: SSE readers
 * ------------------------------------------------------------------ */

async function* readLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        if (buf.length > 0) yield buf;
        return;
      }
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        yield buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Yields Anthropic SSE events as { event, data } pairs. Each event is an
 * `event:` line followed by a `data:` line, terminated by a blank line.
 */
async function* readAnthropicSse(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<{ event: string; data: Record<string, unknown> }> {
  let event = "";
  let dataLine = "";
  for await (const line of readLines(body)) {
    if (line === "") {
      if (event && dataLine) {
        try {
          yield { event, data: JSON.parse(dataLine) as Record<string, unknown> };
        } catch {
          // skip malformed event
        }
      }
      event = "";
      dataLine = "";
      continue;
    }
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
  }
}

/** Yields the data payloads of OpenAI SSE `data:` lines. */
async function* readOpenAiSse(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  for await (const line of readLines(body)) {
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload) yield payload;
    }
  }
}
