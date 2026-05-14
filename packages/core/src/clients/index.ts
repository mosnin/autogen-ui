import type { LLMClient } from "../agent";

/**
 * Thin, dependency-free LLM clients. Each one implements the provider-agnostic
 * `LLMClient` interface using `fetch`, so the core library ships no vendor SDK.
 * Use these on the server only — they require API keys.
 */

export interface AnthropicClientOptions {
  apiKey: string;
  /** Defaults to "claude-sonnet-4-6". */
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
}

export function createAnthropicClient(opts: AnthropicClientOptions): LLMClient {
  const model = opts.model ?? "claude-sonnet-4-6";
  const maxTokens = opts.maxTokens ?? 4096;
  const baseUrl = opts.baseUrl ?? "https://api.anthropic.com";

  return {
    name: `anthropic:${model}`,
    async complete({ system, messages }) {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
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
  };
}

export interface OpenAIClientOptions {
  apiKey: string;
  /** Defaults to "gpt-4o". */
  model?: string;
  baseUrl?: string;
}

export function createOpenAIClient(opts: OpenAIClientOptions): LLMClient {
  const model = opts.model ?? "gpt-4o";
  const baseUrl = opts.baseUrl ?? "https://api.openai.com";

  return {
    name: `openai:${model}`,
    async complete({ system, messages }) {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
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
  };
}
