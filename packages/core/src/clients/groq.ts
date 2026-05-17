import type {
  LLMClient,
  LLMEvent,
  LLMRequest,
  LLMResult,
  LLMTool,
} from "../llm";
import { systemToString } from "../llm";

/**
 * Groq client — Groq exposes an OpenAI-compatible chat completions endpoint
 * at `/openai/v1/chat/completions`. We reimplement the small body builder
 * and SSE reader here (rather than reusing the OpenAI client) so consumers
 * can treat Groq as a first-class provider.
 *
 * Defaults to `llama-3.3-70b-versatile` — large, tool-use-capable.
 */

export interface GroqClientOptions {
  apiKey: string;
  /** Defaults to `llama-3.3-70b-versatile`. */
  model?: string;
  /** Defaults to `https://api.groq.com`. */
  baseUrl?: string;
}

function buildGroqBody(
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

export function createGroqClient(opts: GroqClientOptions): LLMClient {
  const model = opts.model ?? "llama-3.3-70b-versatile";
  const baseUrl = opts.baseUrl ?? "https://api.groq.com";
  const url = `${baseUrl}/openai/v1/chat/completions`;
  const headers: HeadersInit = {
    "content-type": "application/json",
    authorization: `Bearer ${opts.apiKey}`,
  };

  return {
    name: `groq:${model}`,

    async complete(req): Promise<LLMResult> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildGroqBody(req, model, false)),
      });
      if (!res.ok) {
        throw new Error(
          `[autogen-ui] Groq ${res.status}: ${await res.text()}`,
        );
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
      const toolCalls: LLMResult["toolCalls"] = (message?.tool_calls ?? []).map(
        (tc) => {
          let input: unknown = {};
          try {
            input = tc.function.arguments
              ? JSON.parse(tc.function.arguments)
              : {};
          } catch {
            input = { _raw: tc.function.arguments };
          }
          return { id: tc.id, name: tc.function.name, input };
        },
      );
      return { text, toolCalls };
    },

    async *stream(req): AsyncIterable<LLMEvent> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildGroqBody(req, model, true)),
      });
      if (!res.ok || !res.body) {
        yield {
          kind: "error",
          error: `[autogen-ui] Groq ${res.status}: ${await res
            .text()
            .catch(() => "")}`,
        };
        return;
      }

      const tools = new Map<
        number,
        { id: string; name: string; partial: string }
      >();

      for await (const line of readSseData(res.body)) {
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
            yield {
              kind: "tool_input_delta",
              id: entry.id,
              partialJson: args,
            };
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

async function* readSseData(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        if (buf.length > 0) {
          const tail = buf.replace(/\r$/, "");
          if (tail.startsWith("data:")) yield tail.slice(5).trim();
        }
        return;
      }
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (payload) yield payload;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
