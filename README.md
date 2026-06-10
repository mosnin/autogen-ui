# autogen-ui

**Talk to an AI and watch your dashboard build, edit, and respond to your users — live.**

`autogen-ui` is a framework that lets language models generate and edit real
software interfaces. The model never writes code. It emits a **validated JSON
spec tree** and every follow-up message is a **patch** against it. The runtime
renders the spec to React components, animates layout transitions, wires data
sources, evaluates bindings, dispatches actions, and routes between screens.

```
You: "Build a SaaS revenue dashboard"
You: "Add a search Input bound to state.q and a Stat that echoes it"
You: "Make the revenue card full width and recolor the accent indigo"
You: "Add a settings screen with a sidebar that persists across navigation"
```

It's framework-agnostic, brand-agnostic, and component-library-agnostic. Drop
it into any React app — Next.js, Vite, Remix, plain Node — match it to your
design system, and the agent generates UI that looks **native to your app**.

## Status: actually importable

| | |
|---|---|
| Schema | UINode tree, 19 patch ops, `screens` + `layout` + `Outlet`, `when` prop, `ForEach` loops, `bindings`/`events`, `functions`, `state` |
| Agent | Tool-use over Anthropic + OpenAI + Ollama + Groq + SDK wrappers; prompt caching; auto-repair on schema or warning failures; `onTurn` telemetry |
| Renderer | Recursive, Framer Motion `layout` per node with id-keyed stagger; pluggable extensions for style/motion/resolution/events |
| Style | Token-based `StyleSpec` with responsive + state variants, compiled to Tailwind OR inline CSS; live theming + brand kits |
| Components | 36 built-ins — layout, data viz, forms with validation, navigation, overlays, media — plus `ForEach`, `Outlet`, agent-defined types |
| Data | static + REST (with polling) + WebSocket + agent-defined HTTP functions; safe `{{path \| filter:arg}}` bindings; loading + error states |
| Actions | 9-verb allowlist (state, refetch, navigate, navigateBack, openUrl, scrollTo, emitEvent, callFunction, toggleState) + `{{event.X}}` substitution |
| Brand | `BrandKit` → CSS vars + system-prompt section. Six starter kits (violet/linear/warm/sharp/mono/forest) |
| Integration | `createComponentAdapter` (prop bridge to host components), `createInlineStyleCompiler` (non-Tailwind hosts) |
| Persistence | `createPersistenceHandler` route + `useAutoSave` hook |
| Tests | **208 end-to-end tests** running without an API key, via fake clients + mocked fetch |

## Five-minute Next.js quickstart

```bash
pnpm add @autogen-ui/core framer-motion
```

**Tailwind** (`tailwind.config.ts`):

```ts
import preset from "@autogen-ui/core/tailwind.preset";
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

export default {
  presets: [preset],
  content: ["./app/**/*.{ts,tsx}", "./node_modules/@autogen-ui/core/dist/**/*.js"],
  safelist: STATIC_SAFELIST.split(/\s+/).filter(Boolean),
};
```

`app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "@autogen-ui/core/styles.css";
```

**Server route** (`app/api/autogen-ui/stream/route.ts`):

```ts
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
export const POST = createStreamingRouteHandler({ agent });
```

**Client page** (`app/page.tsx`):

```tsx
"use client";
import {
  BrandProvider,
  DashboardRenderer,
  useRuntime,
  useStreamingDashboard,
  linearKit,
} from "@autogen-ui/core";

export default function Page() {
  const { dashboard, sendMessage } = useStreamingDashboard();
  const { data, state, dispatch } = useRuntime(dashboard);
  return (
    <BrandProvider kit={linearKit}>
      <DashboardRenderer
        dashboard={dashboard}
        context={{ data, state, dispatch }}
      />
      <button onClick={() => sendMessage("build a sales dashboard")}>Go</button>
    </BrandProvider>
  );
}
```

`ANTHROPIC_API_KEY` in `.env.local`, `pnpm dev`, done.

## Make it your brand

```ts
const acmeBrand: BrandKit = {
  name: "Acme",
  colors: { primary: "230 90% 60%", primarySoft: "230 90% 96%" },
  typography: { sans: "Inter Variable" },
  radius: "lg",
  voice: {
    tone: "minimal, technical",
    rules: ["Sentence case headings", "No exclamation marks"],
  },
};

// Renderer wears it
<BrandProvider kit={acmeBrand}>...</BrandProvider>

// Agent learns it (system prompt picks up voice + tone)
createUIAgent({ ..., brand: acmeBrand });
```

The kit compiles to **CSS variables** (writing `--primary`, `--font-sans`,
`--radius`) AND a **prompt section** (`## BRAND` block in the system
prompt). One source of truth.

Six starters ship: `violetKit` (default), `linearKit`, `warmKit`,
`sharpKit`, `monoKit`, `forestKit`.

## Use your own components

```tsx
import {
  createRegistry,
  createComponentAdapter,
  mapComponent,
} from "@autogen-ui/core";
import { Card as AcmeCard } from "@/components/ui/card";

const registry = createRegistry({
  // Rename agent's `title`/`description` to your Card's `heading`/`subhead`:
  Card: mapComponent(AcmeCard, { title: "heading", description: "subhead" }),
  // Or full control:
  Stat: createComponentAdapter({
    Component: AcmeStat,
    mapProps: { label: "name", value: "amount" },
    defaults: { variant: "elevated" },
    computeProps: (agent) => ({ delta: Number(agent.delta) || 0 }),
  }),
});

<DashboardRenderer dashboard={dash} registry={registry} ... />
```

The agent emits its standard prop names; your component receives its
native props. No rewrite.

## Use your own styling

Don't use Tailwind? Swap the style compiler for one that emits inline
`CSSProperties`:

```tsx
import { createInlineStyleCompiler } from "@autogen-ui/core";

<DashboardRenderer
  dashboard={dash}
  extensions={{ compileStyle: createInlineStyleCompiler() }}
/>
```

Same `StyleSpec` vocabulary; different transport. Plays nicely with
styled-components, Emotion, Tamagui, vanilla CSS Modules.

## Use any LLM

Built-in clients:

```ts
import {
  createAnthropicClient,
  createOpenAIClient,
  createOllamaClient,        // local
  createGroqClient,
  wrapAnthropicSdk,          // bring your own SDK instance
  wrapOpenAiSdk,
} from "@autogen-ui/core/clients";
```

Or implement the 3-method `LLMClient` interface yourself — non-streaming and
streaming over `fetch`. No vendor SDK required.

## Routing, layouts, history

```json
{
  "id": "dash",
  "screens": {
    "home":     { "id": "home_root",     "type": "Grid", "children": [...] },
    "settings": { "id": "settings_root", "type": "Grid", "children": [...] }
  },
  "layout": {
    "id": "shell", "type": "Grid",
    "children": [
      { "id": "sidebar", "type": "Box", "children": [
        { "id": "nav_home",  "type": "Link", "props": { "text": "Home" },     "events": { "onClick": [{ "type": "navigate", "to": "home" }] } },
        { "id": "nav_set",   "type": "Link", "props": { "text": "Settings" }, "events": { "onClick": [{ "type": "navigate", "to": "settings" }] } }
      ]},
      { "id": "main", "type": "Box", "children": [{ "id": "slot", "type": "Outlet" }] }
    ]
  }
}
```

The sidebar persists across navigation; `Outlet` is replaced by the
currently-selected screen. `navigate` pushes onto `state.screenHistory`;
`navigateBack` pops.

## Functions — agent-defined HTTP actions

The model can declare its own callable functions:

```json
{ "op": "defineFunction", "def": {
    "name": "saveContact",
    "url": "https://api.example.com/contacts",
    "method": "POST",
    "body": { "email": "{{args.email}}" },
    "select": "data.id"
} }
```

Then call them from any event:

```json
{ "type": "callFunction", "name": "saveContact",
  "args": { "email": "{{event.value}}" },
  "onSuccess": [{ "type": "navigate", "to": "thanks" }],
  "onError":   [{ "type": "setState", "path": "errorMsg", "value": "{{event.error}}" }]
}
```

Result lands in `data[into ?? name]` automatically.

## Persistence — load/save dashboards from a backend

```ts
// app/api/autogen-ui/persist/route.ts
import { createPersistenceHandler, createMemoryStore } from "@autogen-ui/core/server";

const handler = createPersistenceHandler({ store: createMemoryStore() });
export const GET = handler;
export const POST = handler;
export const DELETE = handler;

// In your client
import { useAutoSave } from "@autogen-ui/core";
useAutoSave(dashboard, { endpoint: "/api/autogen-ui/persist" });
```

`createMemoryStore` is for demos; swap in a Postgres/KV-backed
`PersistenceStore` for production. Spec migration is automatic on save.

## Without Next.js

The handlers are pure `(Request) => Response`. Run them anywhere:

```ts
// Node http
import { createServer } from "node:http";
import { toNodeHandler } from "@autogen-ui/core/node";
createServer(toNodeHandler(createRouteHandler({ agent }))).listen(3000);
```

Working examples in `examples/vite-react/` (Vite middleware) and
`packages/core/scripts/node-server-example.ts` (Node http + fake client,
runs without an API key).

## Test without an API key

```bash
pnpm --filter @autogen-ui/core test
# → 208 passed, 0 failed
```

Smokes the entire framework via a scripted `createFakeClient`: tool-use
adherence, auto-repair, custom-component injection, streaming with
incremental JSON parsing, event payload substitution, binding pipes,
patch validation, data proxy, repair-on-warnings, ForEach expansion,
when gate, screens + Outlet, function calls, brand kit prompt
injection, persistence round-trips, screen history.

Real-LLM smoke:

```bash
ANTHROPIC_API_KEY=sk-... pnpm --filter @autogen-ui/core smoke:llm
```

Exits 2 (skip) when no key is set.

## Design philosophy

1. **Schema is the contract.** Every model-emitted change passes Zod
   validation before it reaches the renderer.
2. **Patches, not replays.** Edits are small `op` records, not full re-emits.
   The agent learns to reuse ids; the renderer animates in place.
3. **Generation is the easy part. Identity is the hard part.** BrandKit
   gives the host one place to express their design language and have
   both axes — render + prompt — respect it.
4. **Operational rules over runtime cleverness.** Allowlisted actions,
   capped repair attempts, simulated patch validation, telemetry hooks.

## License

MIT
