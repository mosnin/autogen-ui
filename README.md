# autogen-ui

**Talk to an AI and watch your dashboard build and edit itself.**

`autogen-ui` is a Next.js library built on Tailwind, shadcn-style components and
Framer Motion. Instead of generating throwaway code, the model emits a
**validated JSON spec tree** that a runtime renderer turns into real, responsive
components — and every follow-up message is a *patch* against that tree, so the
UI edits itself in place with animated layout transitions.

```
You: "Build a SaaS revenue dashboard"        -> model emits a spec
You: "make the revenue card full width"      -> model emits a patch
You: "add a churn chart next to it"          -> model emits a patch
```

## Why a spec, not code?

- **Safe** — the model can only use components from a known registry; no
  arbitrary code execution.
- **Patchable** — edits target nodes by stable `id`, so "make that bigger" is a
  3-line patch, not a full re-render.
- **Animated** — every node is a Framer Motion `layout` element keyed by id, so
  patches animate into place instead of snapping.
- **Provider-agnostic** — the agent only depends on a tiny `LLMClient`
  interface. Anthropic and OpenAI clients ship in the box; bring your own for
  anything else.

## Repository layout

```
packages/core   @autogen-ui/core — schema, renderer, registry, agent, hook
apps/demo       Next.js demo app: chat sidebar + live dashboard canvas
```

## Quick start

```bash
pnpm install
cp apps/demo/.env.example apps/demo/.env.local   # add an API key
pnpm build                                       # build @autogen-ui/core
pnpm dev                                         # run the demo on :3000
```

The demo's API route auto-detects whether `ANTHROPIC_API_KEY` or
`OPENAI_API_KEY` is set.

## Using the library

**Server** — wire an agent to a route:

```ts
// app/api/autogen-ui/route.ts
import { createUIAgent, createRouteHandler } from "@autogen-ui/core";
import { createAnthropicClient } from "@autogen-ui/core/clients";

const agent = createUIAgent({
  client: createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
});

export const POST = createRouteHandler({ agent });
```

**Client** — the chat-to-UI loop is one hook:

```tsx
"use client";
import { useDashboard, DashboardRenderer } from "@autogen-ui/core";

export default function Page() {
  const { dashboard, sendMessage, isLoading } = useDashboard();
  return (
    <>
      <DashboardRenderer dashboard={dashboard} />
      <button onClick={() => sendMessage("build a sales dashboard")}>
        Generate
      </button>
    </>
  );
}
```

**Styling** — add the preset and import the tokens:

```ts
// tailwind.config.ts
import preset from "@autogen-ui/core/tailwind.preset";
export default {
  presets: [preset],
  content: ["./app/**/*.{ts,tsx}", "./node_modules/@autogen-ui/core/dist/**/*.js"],
};
```

```css
/* globals.css */
@import "@autogen-ui/core/styles.css";
```

## How it works

1. **Schema** (`schema.ts`) — `UINode` / `Dashboard` / `Patch`, validated with Zod.
2. **Registry** (`registry.ts`) — the catalog of allowed components. The same
   catalog is rendered into the model's system prompt, so the contract can't
   drift.
3. **Agent** (`agent.ts`) — turns a chat turn into an `AgentResponse` of patches.
4. **Patch** (`patch.ts`) — applies patches immutably to the spec tree.
5. **Renderer** (`renderer.tsx`) — recursively renders the tree; each node is a
   Framer Motion `layout` element so edits animate.

## Custom components

```ts
import { createRegistry, DashboardRenderer } from "@autogen-ui/core";

const registry = createRegistry({ KpiSparkline: MySparkline });
<DashboardRenderer dashboard={dashboard} registry={registry} />;
```

(Extend `componentCatalog` too so the model knows the component exists.)

## Status

Early — the core runtime, agent, renderer and demo are in place. The full
chat-to-dashboard loop requires an LLM API key to exercise end to end.

## License

MIT
