import CodeBlock from "../../components/CodeBlock";

const ndjsonSample = `{"kind":"message","delta":"Sure — building "}
{"kind":"message","delta":"a sales dashboard."}
{"kind":"patch","patch":{"op":"setTitle","title":"Sales"}}
{"kind":"patch","patch":{"op":"append","parentId":"root","node":{"id":"mrr","type":"Stat","props":{"label":"MRR","value":"$0"}}}}
{"kind":"warning","warning":"patch targets unknown id 'rev'"}
{"kind":"done"}`;

const frameVariants = `// One frame per line in the NDJSON stream
type StreamFrame =
  | { kind: "patch";   patch: Patch }
  | { kind: "message"; delta: string }
  | { kind: "warning"; warning: string }
  | { kind: "error";   error: string }
  | { kind: "done" };`;

const routeSnippet = `// app/api/autogen-ui/stream/route.ts
import {
  createStreamingRouteHandler,
  createStreamingUIAgent,
  streamingCapabilities,
} from "@autogen-ui/core/server";
import { createAnthropicClient } from "@autogen-ui/core/clients";

const agent = createStreamingUIAgent({
  client: createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
  capabilities: streamingCapabilities,
});
export const POST = createStreamingRouteHandler({ agent });`;

const hookSnippet = `// app/page.tsx
"use client";
import {
  DashboardRenderer,
  useRuntime,
  useStreamingDashboard,
} from "@autogen-ui/core";

export default function Page() {
  const { dashboard, messages, isLoading, error, sendMessage, reset } =
    useStreamingDashboard({
      // Defaults to "/api/autogen-ui/stream"
      endpoint: "/api/autogen-ui/stream",
    });
  const { data, state, dispatch } = useRuntime(dashboard);

  return (
    <>
      <DashboardRenderer
        dashboard={dashboard}
        context={{ data, state, dispatch }}
      />
      <button onClick={() => sendMessage("build a sales dashboard")}>
        Generate
      </button>
    </>
  );
}`;

const manualReadSnippet = `// Lower-level: read frames yourself
import { readFrames } from "@autogen-ui/core";

const res = await fetch("/api/autogen-ui/stream", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
});

for await (const frame of readFrames(res)) {
  switch (frame.kind) {
    case "patch":   /* apply patch */ break;
    case "message": /* append to assistant message */ break;
    case "warning": /* show inline */ break;
    case "error":   /* surface */ break;
    case "done":    /* finalize */ break;
  }
}`;

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Streaming</h1>
      <p className="mt-3 text-muted-foreground">
        Streaming lets the client apply patches as the model emits them — the
        dashboard literally fills in as the model thinks. The transport is plain
        NDJSON: one JSON object per line, with a discriminated{" "}
        <code className="font-mono text-xs">kind</code> field.
      </p>

      <h2 className="mt-8 text-lg font-semibold">The NDJSON wire format</h2>
      <CodeBlock language="text" code={ndjsonSample} />

      <h2 className="mt-8 text-lg font-semibold">StreamFrame variants</h2>
      <CodeBlock language="ts" code={frameVariants} />

      <h2 className="mt-8 text-lg font-semibold">Server route</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The streaming agent incrementally parses the tool-input JSON deltas from
        Anthropic/OpenAI SSE and emits one <code className="font-mono text-xs">patch</code>{" "}
        frame the moment each patch closes — no waiting for the full tool call.
      </p>
      <CodeBlock language="ts" code={routeSnippet} />

      <h2 className="mt-8 text-lg font-semibold">Client hook</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <code className="font-mono text-xs">useStreamingDashboard</code> handles the
        connection, frame parsing, patch application, and abort-on-unmount /
        abort-on-new-send for you.
      </p>
      <CodeBlock language="tsx" code={hookSnippet} />

      <h2 className="mt-8 text-lg font-semibold">Reading frames manually</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        If you need to bypass the hook (custom UI, custom state shape), iterate the
        frames yourself with <code className="font-mono text-xs">readFrames</code>.
      </p>
      <CodeBlock language="ts" code={manualReadSnippet} />
    </article>
  );
}
