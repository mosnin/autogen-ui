import CodeBlock from "../../components/CodeBlock";

const installSnippet = `pnpm add @autogen-ui/core framer-motion`;

const tailwindSnippet = `// tailwind.config.ts
import preset from "@autogen-ui/core/tailwind.preset";
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

export default {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./node_modules/@autogen-ui/core/dist/**/*.js",
  ],
  safelist: STATIC_SAFELIST.split(/\\s+/).filter(Boolean),
};`;

const cssSnippet = `/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "@autogen-ui/core/styles.css";`;

const agentRouteSnippet = `// app/api/autogen-ui/route.ts
import {
  createRouteHandler,
  createUIAgent,
  defaultCapabilities,
} from "@autogen-ui/core/server";
import { createAnthropicClient } from "@autogen-ui/core/clients";

const agent = createUIAgent({
  client: createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
  capabilities: defaultCapabilities,
});
export const POST = createRouteHandler({ agent });`;

const streamingRouteSnippet = `// app/api/autogen-ui/stream/route.ts
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

const pageSnippet = `// app/page.tsx
"use client";
import {
  DashboardRenderer,
  useRuntime,
  useStreamingDashboard,
} from "@autogen-ui/core";

export default function Page() {
  const { dashboard, sendMessage } = useStreamingDashboard();
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

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Quickstart</h1>
      <p className="mt-3 text-muted-foreground">
        Five minutes from <code className="font-mono text-xs">pnpm add</code> to a working
        agent-driven dashboard inside an existing Next.js (App Router) app.
      </p>

      <h2 className="mt-8 text-lg font-semibold">1. Install</h2>
      <CodeBlock language="bash" code={installSnippet} />

      <h2 className="mt-8 text-lg font-semibold">2. Tailwind preset + design tokens</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The preset wires in the design tokens; the safelist preserves token-driven
        classes that Tailwind&apos;s scanner can&apos;t see as literals.
      </p>
      <CodeBlock language="ts" code={tailwindSnippet} />
      <CodeBlock language="css" code={cssSnippet} />

      <h2 className="mt-8 text-lg font-semibold">3. Agent route</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Non-streaming first (a single response with a complete patch list):
      </p>
      <CodeBlock language="ts" code={agentRouteSnippet} />
      <p className="mt-2 text-sm text-muted-foreground">For streaming, add:</p>
      <CodeBlock language="ts" code={streamingRouteSnippet} />

      <h2 className="mt-8 text-lg font-semibold">4. Client page</h2>
      <CodeBlock language="tsx" code={pageSnippet} />

      <h2 className="mt-8 text-lg font-semibold">5. Set your API key</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Put <code className="font-mono text-xs">ANTHROPIC_API_KEY=...</code> in{" "}
        <code className="font-mono text-xs">.env.local</code>, then{" "}
        <code className="font-mono text-xs">pnpm dev</code> and start typing.
      </p>
    </article>
  );
}
