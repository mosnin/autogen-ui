import type { ChatMessage } from "../schema";
import type { LLMClient } from "../agent";

/**
 * Streaming-capable LLM clients. Like `clients/index.ts` these are thin,
 * dependency-free `fetch` wrappers, but they additionally implement the
 * optional `stream` method so the streaming agent (Phase 2) can emit patches
 * as the model produces them. Server-only — they require API keys.
 */

/* ------------------------------------------------------------------ *
 * SSE line reader — shared by both providers.
 * ------------------------------------------------------------------ */

async function* readSSE(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        yield line;
        newlineIndex = buffer.indexOf("\n");
      }
    }
    if (buffer) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

/* ------------------------------------------------------------------ *
 * Anthropic
 * ------------------------------------------------------------------ */

export interface AnthropicStreamClientOptions {
  apiKey: string;
  /** Defaults to "claude-sonnet-4-6". */
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
}

export function createAnthropicStreamClient(
  opts: AnthropicStreamClientOptions,
): LLMClient {
  const model = opts.model ?? "claude-sonnet-4-6";
  const maxTokens = opts.maxTokens ?? 4096;
  const baseUrl = opts.baseUrl ?? "https://api.anthropic.com";

  const headers = {
    "content-type": "application/json",
    "x-api-key": opts.apiKey,
    "anthropic-version": "2023-06-01",
  };

  function toBody(system: string, messages: ChatMessage[], stream: boolean) {
    return JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      stream,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  }

  return {
    name: `anthropic:${model}`,

    async complete({ system, messages }) {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers,
        body: toBody(system, messages, false),
      });
      if (!res.ok) {
        throw new Error(`[autogen-ui] Anthropic API ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (data.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      if (!text) throw new Error("[autogen-ui] Anthropic returned an empty response");
      return text;
    },

    async *stream({ system, messages }) {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers,
        body: toBody(system, messages, true),
      });
      if (!res.ok) {
        throw new Error(`[autogen-ui] Anthropic API ${res.status}: ${await res.text()}`);
      }
      if (!res.body) throw new Error("[autogen-ui] Anthropic stream has no body");

      for await (const line of readSSE(res.body)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let event: {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta" &&
          event.delta.text
        ) {
          yield event.delta.text;
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * OpenAI
 * ------------------------------------------------------------------ */

export interface OpenAIStreamClientOptions {
  apiKey: string;
  /** Defaults to "gpt-4o". */
  model?: string;
  baseUrl?: string;
}

export function createOpenAIStreamClient(
  opts: OpenAIStreamClientOptions,
): LLMClient {
  const model = opts.model ?? "gpt-4o";
  const baseUrl = opts.baseUrl ?? "https://api.openai.com";

  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${opts.apiKey}`,
  };

  function toBody(system: string, messages: ChatMessage[], stream: boolean) {
    return JSON.stringify({
      model,
      stream,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
  }

  return {
    name: `openai:${model}`,

    async complete({ system, messages }) {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: toBody(system, messages, false),
      });
      if (!res.ok) {
        throw new Error(`[autogen-ui] OpenAI API ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error("[autogen-ui] OpenAI returned an empty response");
      return text;
    },

    async *stream({ system, messages }) {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: toBody(system, messages, true),
      });
      if (!res.ok) {
        throw new Error(`[autogen-ui] OpenAI API ${res.status}: ${await res.text()}`);
      }
      if (!res.body) throw new Error("[autogen-ui] OpenAI stream has no body");

      for await (const line of readSSE(res.body)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let event: {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = event.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}
