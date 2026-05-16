# autogen-ui

**Talk to an AI and watch your dashboard build, edit, and respond to your users — live.**

`autogen-ui` is a Next.js library built on Tailwind, shadcn-style components,
and Framer Motion. The model doesn't write code — it emits a **validated JSON
spec tree**, and every follow-up message is a **patch** against that tree. The
runtime renderer turns it into real components, animates the layout
transitions, and wires data sources, bindings, and interactive forms.

```
You: "Build a SaaS revenue dashboard"
You: "Add a search Input bound to state.q and a Stat that shows it"
You: "Make the revenue card full width and recolor the accent indigo"
```

## What's in the box

| | |
|---|---|
| **Composable spec** | `UINode` tree validated by Zod; every mutation is one of ~17 patch ops |
| **Tool-use agent** | Anthropic + OpenAI clients with prompt caching; the model is forced to call a single `emit_patches` tool |
| **Auto-repair loop** | Invalid tool input is fed back as a correction; bounded retry |
| **Real-time streaming** | NDJSON transport; patches render as the model thinks them |
| **Runtime components** | The agent can `defineComponent` reusable parameterized templates |
| **Style engine** | Token-based `StyleSpec` → Tailwind; live theming; motion presets |
| **Dynamic data** | `DataSource`s + safe `{{path \| filter:arg}}` bindings; built-in formatters (currency, date, percent, ...) |
| **Server-side data proxy** | `createDataProxyHandler` for CORS-bypassed, auth-injected fetches |
| **Forms + interactivity** | `Input`/`Select`/`Form` + `{{event.value}}` action substitution |
| **Allowlisted actions** | `setState`, `toggleState`, `refetch`, `openUrl`, `scrollTo`, `emitEvent` |
| **Custom components** | Register your own React components and tell the agent they exist |
| **Pluggable LLM clients** | Bring your own model — implement `LLMClient` |
| **Tested without an API key** | 52-case end-to-end suite via a fake client |

## Repo layout

```
packages/core     @autogen-ui/core
apps/demo         Next.js demo: chat sidebar + live animated dashboard
```

## Five-minute quickstart in your Next.js app

1. **Install** (once published):

   ```bash
   pnpm add @autogen-ui/core framer-motion
   ```

2. **Tailwind preset + design tokens.** In `tailwind.config.ts`:

   ```ts
   import preset from "@autogen-ui/core/tailwind.preset";
   import { STATIC_SAFELIST } from "@autogen-ui/core/style";

   export default {
     presets: [preset],
     content: [
       "./app/**/*.{ts,tsx}",
       "./node_modules/@autogen-ui/core/dist/**/*.js",
     ],
     safelist: STATIC_SAFELIST.split(/\s+/).filter(Boolean),
   };
   ```

   In `app/globals.css`:

   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   @import "@autogen-ui/core/styles.css";
   ```

3. **Agent route** — `app/api/autogen-ui/route.ts`:

   ```ts
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
   export const POST = createRouteHandler({ agent });
   ```

   For streaming, add `app/api/autogen-ui/stream/route.ts`:

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

4. **Client page** — `app/page.tsx`:

   ```tsx
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
         <DashboardRenderer dashboard={dashboard} context={{ data, state, dispatch }} />
         <button onClick={() => sendMessage("build a sales dashboard")}>Generate</button>
       </>
     );
   }
   ```

5. **`ANTHROPIC_API_KEY=...` in `.env.local`** and `pnpm dev`.

## Custom components — make the agent use *your* components

Two steps: register the React component, then tell the agent it exists.

```tsx
// app/page.tsx
import { createRegistry, DashboardRenderer } from "@autogen-ui/core";
import { UserAvatar } from "@/components/UserAvatar";

const registry = createRegistry({ UserAvatar });
<DashboardRenderer dashboard={dashboard} registry={registry} ... />
```

```ts
// app/api/autogen-ui/route.ts
createUIAgent({
  client,
  capabilities: defaultCapabilities,
  components: [
    {
      type: "UserAvatar",
      description: "Round avatar with optional online indicator.",
      props: "userId: string, size?: 'sm'|'md'|'lg', online?: boolean",
      acceptsChildren: false,
    },
  ],
});
```

The agent's system prompt now includes `UserAvatar`; it will use it on its own.

## Dynamic data — proxy through your backend

Browser fetches are subject to CORS and can't carry secrets. Route REST data
sources through `createDataProxyHandler`:

```ts
// app/api/autogen-ui/proxy/route.ts
import { createDataProxyHandler } from "@autogen-ui/core/server";

export const POST = createDataProxyHandler({
  allow: ["https://api.yourcompany.com/"],
  headers: () => ({ authorization: `Bearer ${process.env.UPSTREAM_TOKEN}` }),
});
```

```tsx
const { data } = useRuntime(dashboard, {
  // ...passed through to useDataSources
});
// or explicitly:
useDataSources(dashboard, { proxyUrl: "/api/autogen-ui/proxy" });
```

Server-injected headers override anything the client sends — auth tokens stay
server-side.

## Binding pipes — format values inline

```json
{ "id": "rev", "type": "Stat",
  "bindings": {
    "label": "Revenue",
    "value": "{{data.sales.total | currency:EUR}}",
    "delta": "{{data.sales.growth | percent:1}}"
  }
}
```

Built-in filters: `currency`, `number`, `percent`, `date`, `time`, `upper`,
`lower`, `truncate`, `default`, `json`. Unknown filters are a no-op.

## Use it without Next.js — plain Node http

The handlers are framework-agnostic `Request`/`Response` functions. A
one-liner adapter brings them to Node's built-in http server (or anywhere
else):

```ts
import { createServer } from "node:http";
import {
  createRouteHandler,
  createUIAgent,
  defaultCapabilities,
} from "@autogen-ui/core/server";
import { toNodeHandler } from "@autogen-ui/core/node";
import { createAnthropicClient } from "@autogen-ui/core/clients";

const agent = createUIAgent({
  client: createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
  capabilities: defaultCapabilities,
});
const handler = toNodeHandler(createRouteHandler({ agent }));

createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/autogen-ui") return handler(req, res);
  res.statusCode = 404;
  res.end();
}).listen(3000);
```

A runnable version of this (with a fake client so it works without an API
key) ships in the repo:

```
pnpm --filter @autogen-ui/core example:node
curl -sX POST localhost:3000/api/autogen-ui \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

## The controlled-input loop (forms)

Wire `bindings.value` and `events.onChange` to the same `state.` path. The
substitution `{{event.value}}` pulls the live input value into the action.

```json
{ "id": "search", "type": "Input",
  "bindings": { "value": "{{state.q}}" },
  "events": { "onChange": [
    { "type": "setState", "path": "q", "value": "{{event.value}}" }
  ]}
}
```

## How it works

1. **Schema** (`schema.ts`) — `UINode`/`Dashboard`/`Patch` validated with Zod.
2. **Registry** (`registry.ts`) — catalog of allowed components. The same
   catalog is rendered into the model's system prompt, so the model can't
   invent components the runtime doesn't know about.
3. **Agent** (`agent.ts`) — turns a chat turn into patches via tool use.
   Auto-repair loop catches Zod failures and retries with feedback.
4. **Renderer** (`renderer.tsx`) — recursive, every node is a Framer Motion
   `layout` element keyed by id so patches animate. Extensions pipeline
   composes style/motion/event/binding/component-instantiation resolvers.
5. **Streaming agent** — incrementally parses `tool_input_delta` events to
   emit `patch` frames as soon as each one closes.

## Test it

Without an API key — full coverage against a fake client:

```bash
pnpm --filter @autogen-ui/core test
```

Runs 52 end-to-end tests: tool-use happy path, auto-repair, repair
exhaustion, custom-component prompt injection, true streaming with
incremental parsing, invalid-patch rejection, event-payload substitution,
binding pipe filters, patch-target warnings, data proxy allowlist + header
precedence, and registry presence of every component.

With an API key — real-LLM smoke (build → edit → question turns):

```bash
ANTHROPIC_API_KEY=sk-... pnpm --filter @autogen-ui/core smoke:llm
# or
OPENAI_API_KEY=sk-... pnpm --filter @autogen-ui/core smoke:llm
```

Exits 2 (skip) when no key is set, so CI can treat it as conditional.

## Status

The architecture and runtime are in place; every layer is exercised by the
test suite. Remaining work is mostly polish: npm publication, multi-framework
docs, a Vite example, and stress-testing prompt adherence with real models.

## License

MIT
