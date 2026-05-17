import type {
  LLMClient,
  LLMEvent,
  LLMRequest,
  LLMResult,
  LLMTool,
  ToolCall,
} from "../llm";
import { systemToString } from "../llm";

/**
 * Ollama client — talks to a local Ollama server's `/api/chat` endpoint with
 * OpenAI-style tools. Defaults to `http://localhost:11434` and `llama3.2`.
 *
 * Ollama's streaming format is NDJSON (one JSON object per line). Tool-call
 * argument streaming is loosely defined in Ollama; many versions send the
 * full `arguments` object in a single chunk rather than streaming JSON
 * fragments. We handle both: each appearance of a `tool_call` emits a
 * `tool_start` (once) then a single `tool_input_delta` carrying the JSON
 * fragment and finally a `tool_end` at stream completion.
 */

export interface OllamaClientOptions {
  /** Defaults to `http://localhost:11434`. */
  baseUrl?: string;
  /** Defaults to `llama3.2`. */
  model?: string;
  maxTokens?: number;
}

interface OllamaToolCall {
  function?: {
    name?: string;
    arguments?: unknown;
  };
}

interface OllamaChatChunk {
  model?: string;
  done?: boolean;
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
}

function buildOllamaBody(
  req: LLMRequest,
  model: string,
  maxTokens: number,
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

  const body: Record<string, unknown> = {
    model,
    messages,
    stream,
    options: { num_predict: req.maxTokens ?? maxTokens },
  };
  if (tools && tools.length > 0) body.tools = tools;
  // Note: Ollama supports `tool_choice` only on newer builds; passing it
  // through when the user forced a tool gives best-effort enforcement.
  if (req.toolChoice) {
    body.tool_choice = {
      type: "function",
      function: { name: req.toolChoice.name },
    };
  }
  return body;
}

function normalizeToolCalls(raw: OllamaToolCall[] | undefined): ToolCall[] {
  const out: ToolCall[] = [];
  if (!raw) return out;
  for (let i = 0; i < raw.length; i++) {
    const tc = raw[i];
    if (!tc) continue;
    const name = tc.function?.name;
    if (!name) continue;
    const args = tc.function?.arguments;
    let input: unknown;
    if (typeof args === "string") {
      try {
        input = args.length > 0 ? JSON.parse(args) : {};
      } catch {
        input = { _raw: args };
      }
    } else {
      input = args ?? {};
    }
    out.push({ id: `call_${i}`, name, input });
  }
  return out;
}

export function createOllamaClient(opts: OllamaClientOptions = {}): LLMClient {
  const baseUrl = opts.baseUrl ?? "http://localhost:11434";
  const model = opts.model ?? "llama3.2";
  const maxTokens = opts.maxTokens ?? 4096;
  const url = `${baseUrl}/api/chat`;
  const headers: HeadersInit = {
    "content-type": "application/json",
  };

  return {
    name: `ollama:${model}`,

    async complete(req): Promise<LLMResult> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildOllamaBody(req, model, maxTokens, false)),
      });
      if (!res.ok) {
        throw new Error(
          `[autogen-ui] Ollama ${res.status}: ${await res.text()}`,
        );
      }
      const data = (await res.json()) as OllamaChatChunk;
      const text = data.message?.content ?? "";
      const toolCalls = normalizeToolCalls(data.message?.tool_calls);
      return { text, toolCalls };
    },

    async *stream(req): AsyncIterable<LLMEvent> {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildOllamaBody(req, model, maxTokens, true)),
      });
      if (!res.ok || !res.body) {
        yield {
          kind: "error",
          error: `[autogen-ui] Ollama ${res.status}: ${await res
            .text()
            .catch(() => "")}`,
        };
        return;
      }

      // Track open tool calls by index (Ollama doesn't issue stable ids).
      const opened = new Map<number, { id: string; input: unknown }>();

      for await (const line of readNdjson(res.body)) {
        let chunk: OllamaChatChunk;
        try {
          chunk = JSON.parse(line) as OllamaChatChunk;
        } catch {
          continue;
        }

        const content = chunk.message?.content;
        if (content) yield { kind: "text_delta", delta: content };

        const toolCalls = chunk.message?.tool_calls;
        if (toolCalls) {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            if (!tc) continue;
            const name = tc.function?.name;
            if (!name) continue;
            let entry = opened.get(i);
            if (!entry) {
              const id = `call_${i}`;
              entry = { id, input: {} };
              opened.set(i, entry);
              yield { kind: "tool_start", id, name };
            }
            const args = tc.function?.arguments;
            if (args !== undefined) {
              const partialJson =
                typeof args === "string" ? args : JSON.stringify(args);
              entry.input =
                typeof args === "string"
                  ? safeParse(args)
                  : (args as unknown);
              yield {
                kind: "tool_input_delta",
                id: entry.id,
                partialJson,
              };
            }
          }
        }

        if (chunk.done) break;
      }

      for (const entry of opened.values()) {
        yield { kind: "tool_end", id: entry.id, input: entry.input };
      }
      yield { kind: "done" };
    },
  };
}

function safeParse(s: string): unknown {
  try {
    return s.length > 0 ? JSON.parse(s) : {};
  } catch {
    return { _raw: s };
  }
}

async function* readNdjson(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        const tail = buf.trim();
        if (tail.length > 0) yield tail;
        return;
      }
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, "").trim();
        buf = buf.slice(idx + 1);
        if (line.length > 0) yield line;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
