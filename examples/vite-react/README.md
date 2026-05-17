# `@autogen-ui/core` — Vite + React example

A minimal Vite + React app that exercises the autogen-ui agent loop end to end
without Next.js. The Vite dev server hosts both the React client *and* the
agent's `POST /api/autogen-ui` endpoint via a tiny `configureServer` hook, so
one `pnpm dev` boots the whole thing.

It uses the library's built-in **fake client** so it runs with **zero API
keys** — perfect for a quick smoke test of the framework-agnostic surface.

## Run it

From the monorepo root:

```bash
pnpm install
pnpm --filter @autogen-ui/core build      # core must be built first
pnpm --filter vite-react-example dev      # then start the example
```

Open <http://localhost:5173>. Click any suggestion to watch the dashboard
build itself.

You can also hit the API directly:

```bash
curl -sX POST localhost:5173/api/autogen-ui \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

## Swap in a real Claude / OpenAI client

Open `vite.config.ts`. Replace `createFakeClient(...)` with one of the real
clients from `@autogen-ui/core/clients`:

```ts
import { createAnthropicClient } from "@autogen-ui/core/clients";
// or: import { createOpenAIClient } from "@autogen-ui/core/clients";

const client = createAnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const agent = createUIAgent({ client, capabilities: defaultCapabilities });
```

Put `ANTHROPIC_API_KEY=sk-...` (or `OPENAI_API_KEY=...`) in a local `.env`
file or your shell — never commit it. Vite loads variables prefixed with
`VITE_` into the client bundle; everything else (including these API keys)
stays server-side because `vite.config.ts` runs in Node.

For streaming, swap `createRouteHandler` / `createUIAgent` for
`createStreamingRouteHandler` / `createStreamingUIAgent` and pair with
`useStreamingDashboard` on the client.

## What this example proves

- `@autogen-ui/core` is **framework-agnostic**. The route handlers are
  standard `Request`/`Response` functions; `toNodeHandler` adapts them to
  Node's `http` (and therefore Vite, Express, raw `createServer`, etc.).
- The React surface (`DashboardRenderer`, `useDashboard`, `useRuntime`)
  works in a plain Vite project with no Next.js dependency.
- The Tailwind preset + `styles.css` import + `STATIC_SAFELIST` setup
  documented in the root README is sufficient for the runtime classes to
  survive a non-Next build.
