import CodeBlock from "../../components/CodeBlock";

interface ClientRow {
  factory: string;
  provider: string;
  notes: string;
}

const CLIENTS: ClientRow[] = [
  {
    factory: "createAnthropicClient",
    provider: "Anthropic Messages API",
    notes:
      "Default model: claude-sonnet-4-6. Supports prompt caching via system-segment cache_control. SSE-based streaming.",
  },
  {
    factory: "createOpenAIClient",
    provider: "OpenAI Chat Completions",
    notes:
      "Default model: gpt-4o. Supports function-calling tool use with index-based delta assembly.",
  },
  {
    factory: "createOllamaClient",
    provider: "Ollama (local)",
    notes:
      "Default base URL: http://localhost:11434. No API key needed. Great for local dev with codestral, llama, etc.",
  },
  {
    factory: "createGroqClient",
    provider: "Groq (OpenAI-compatible)",
    notes:
      "Hits Groq's OpenAI-compatible endpoint. Fast inference on supported models.",
  },
  {
    factory: "wrapAnthropicSdk",
    provider: "@anthropic-ai/sdk wrapper",
    notes:
      "Adapter for callers who already use the official Anthropic SDK (and its retry/observability). Pass an `Anthropic` instance.",
  },
  {
    factory: "wrapOpenAiSdk",
    provider: "openai (npm) wrapper",
    notes:
      "Adapter for callers who already use the official OpenAI SDK. Pass an `OpenAI` instance.",
  },
];

const anthropicSnippet = `import { createAnthropicClient } from "@autogen-ui/core/clients";

const client = createAnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  // model: "claude-sonnet-4-6",   // default
  // maxTokens: 4096,               // default
});`;

const openaiSnippet = `import { createOpenAIClient } from "@autogen-ui/core/clients";

const client = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
  // model: "gpt-4o",  // default
});`;

const ollamaSnippet = `import { createOllamaClient } from "@autogen-ui/core/clients";

// Talks to a local Ollama server — no API key required.
const client = createOllamaClient({
  model: "llama3.1",
  // baseUrl: "http://localhost:11434",  // default
});`;

const groqSnippet = `import { createGroqClient } from "@autogen-ui/core/clients";

const client = createGroqClient({
  apiKey: process.env.GROQ_API_KEY!,
  model: "llama-3.3-70b-versatile",
});`;

const wrapAnthropicSnippet = `import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropicSdk } from "@autogen-ui/core/clients";

const sdk = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const client = wrapAnthropicSdk(sdk, { model: "claude-sonnet-4-6" });`;

const wrapOpenAiSnippet = `import OpenAI from "openai";
import { wrapOpenAiSdk } from "@autogen-ui/core/clients";

const sdk = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const client = wrapOpenAiSdk(sdk, { model: "gpt-4o" });`;

const byoSnippet = `// Implement LLMClient to bring your own model.
import type { LLMClient } from "@autogen-ui/core";

export const myClient: LLMClient = {
  name: "my-custom-llm",

  async complete(req) {
    // req: { system, messages, tools?, toolChoice?, maxTokens? }
    return {
      text: "",
      toolCalls: [
        { id: "1", name: "emit_patches", input: { patches: [] } },
      ],
    };
  },

  async *stream(req) {
    yield { kind: "tool_start", id: "1", name: "emit_patches" };
    yield { kind: "tool_input_delta", id: "1", partialJson: '{"patches":[]}' };
    yield { kind: "tool_end", id: "1", input: { patches: [] } };
    yield { kind: "done" };
  },
};`;

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">LLM clients</h1>
      <p className="mt-3 text-muted-foreground">
        autogen-ui talks to models through a small{" "}
        <code className="font-mono text-xs">LLMClient</code> interface:{" "}
        <code className="font-mono text-xs">complete()</code> for one-shot tool calls
        and <code className="font-mono text-xs">stream()</code> for incremental
        streaming. Built-in clients cover the common providers; if your provider
        isn&apos;t listed, implement the interface yourself.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Built-in clients</h2>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Factory</th>
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {CLIENTS.map((c) => (
              <tr key={c.factory} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{c.factory}</td>
                <td className="px-3 py-2 text-xs">{c.provider}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{c.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-lg font-semibold">Anthropic</h2>
      <CodeBlock language="ts" code={anthropicSnippet} />

      <h2 className="mt-8 text-lg font-semibold">OpenAI</h2>
      <CodeBlock language="ts" code={openaiSnippet} />

      <h2 className="mt-8 text-lg font-semibold">Ollama (local)</h2>
      <CodeBlock language="ts" code={ollamaSnippet} />

      <h2 className="mt-8 text-lg font-semibold">Groq</h2>
      <CodeBlock language="ts" code={groqSnippet} />

      <h2 className="mt-8 text-lg font-semibold">Wrap the official SDKs</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Already use <code className="font-mono text-xs">@anthropic-ai/sdk</code> or{" "}
        <code className="font-mono text-xs">openai</code> elsewhere in your app
        (retries, observability, batching)? Pass the SDK instance through to keep one
        client, two consumers.
      </p>
      <CodeBlock language="ts" code={wrapAnthropicSnippet} />
      <CodeBlock language="ts" code={wrapOpenAiSnippet} />

      <h2 className="mt-10 text-lg font-semibold">Bring your own client</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Implement the <code className="font-mono text-xs">LLMClient</code> interface.
        The agent only ever asks the client to call a single tool —{" "}
        <code className="font-mono text-xs">emit_patches</code> — so your{" "}
        <code className="font-mono text-xs">complete()</code> needs to return one tool
        call carrying <code className="font-mono text-xs">{"{ patches: Patch[] }"}</code>{" "}
        as <code className="font-mono text-xs">input</code>.
      </p>
      <CodeBlock language="ts" code={byoSnippet} />
    </article>
  );
}
