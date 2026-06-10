import { CodeBlock } from "@/components/CodeBlock";

const INSTALL = `pnpm add @autogen-ui/core framer-motion`;

const TAILWIND = `// tailwind.config.ts
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

const GLOBALS = `/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "@autogen-ui/core/styles.css";`;

const ROUTE = `// app/api/autogen-ui/stream/route.ts
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

const PAGE = `// app/page.tsx
"use client";
import {
  BrandProvider,
  DashboardRenderer,
  useRuntime,
  useStreamingDashboard,
  violetKit,
} from "@autogen-ui/core";

export default function Page() {
  const { dashboard, sendMessage } = useStreamingDashboard();
  const { data, state, dispatch } = useRuntime(dashboard);
  return (
    <BrandProvider kit={violetKit}>
      <DashboardRenderer
        dashboard={dashboard}
        context={{ data, state, dispatch }}
      />
      <button onClick={() => sendMessage("build a sales dashboard")}>
        Go
      </button>
    </BrandProvider>
  );
}`;

const BRAND = `import { createUIAgent, voicePresets } from "@autogen-ui/core/server";

const agent = createUIAgent({
  client,
  brand: {
    name: "Acme",
    colors: {
      primary: "248 65% 50%",
      primarySoft: "248 80% 96%",
    },
    radius: "lg",
    voice: {
      ...voicePresets["engineer-minimal"],
      examples: [
        "Set up your workspace",
        "Connect a data source",
      ],
    },
  },
  prefer: ["AcmeCard", "AcmeStat"],
  strict: true,
});`;

const REGISTRY = `import {
  createComponentAdapter,
  createRegistry,
  DashboardRenderer,
} from "@autogen-ui/core";
import { Card } from "@/components/ui/card";

const registry = createRegistry({
  Card: createComponentAdapter({
    Component: Card,
    mapProps: { title: "heading", description: "subhead" },
  }),
});

<DashboardRenderer dashboard={dashboard} registry={registry} ... />`;

const DOCTOR = `npx create-autogen-ui doctor`;

const SECTIONS = [
  {
    id: "install",
    title: "Install",
    body: "Add the framework and its peer dependency. The library is dual-published ESM + CJS so it works in Next, Vite, Remix, plain Node, or anywhere with a bundler.",
    code: INSTALL,
    lang: "terminal",
  },
  {
    id: "tailwind",
    title: "Tailwind",
    body: "Extend your existing tailwind config with the framework's preset. The preset only declares utility classes — colors come from your own CSS variables via hsl(var(--token)).",
    code: TAILWIND,
    lang: "ts · tailwind.config",
  },
  {
    id: "globals",
    title: "Tokens",
    body: "Either @import the framework's defaults (recommended) or supply your own --primary, --foreground, --card, etc. in :root. shadcn/ui projects already have most.",
    code: GLOBALS,
    lang: "css · globals",
  },
  {
    id: "route",
    title: "Server route",
    body: "One framework-agnostic Web Request handler. Forwards the prompt + dashboard JSON to the model via tool use. Auto-repair, prompt caching, streaming patches.",
    code: ROUTE,
    lang: "ts · route",
  },
  {
    id: "page",
    title: "Client page",
    body: "Mount the renderer anywhere in your existing UI. Conversation, brand, state, dispatch — all in one hook.",
    code: PAGE,
    lang: "tsx · page",
  },
  {
    id: "brand",
    title: "Brand & voice",
    body: "BrandKit propagates colors, fonts, radius to the renderer AND voice rules to the prompt. Six starter kits ship; voicePresets covers six tone profiles you can drop in.",
    code: BRAND,
    lang: "ts · brand",
  },
  {
    id: "registry",
    title: "Your components",
    body: "Bridge your existing component library into the registry. mapProps renames agent prop names to your prop names. computeProps gives full control.",
    code: REGISTRY,
    lang: "tsx · registry",
  },
  {
    id: "doctor",
    title: "Audit existing repos",
    body: "Run this in your project root. Reports what's wired, what's missing, and copy-paste snippets to fix each gap.",
    code: DOCTOR,
    lang: "terminal",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-[200px_1fr]">
      <nav className="text-[13px]">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          On this page
        </div>
        <ul className="space-y-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-8 border-t border-border/40 pt-4 text-[11px] text-muted-foreground">
          Looking for the API reference? It lives in the README and JSDoc on
          npm.
        </div>
      </nav>
      <div>
        <div className="mb-12">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Quickstart
          </div>
          <h1 className="font-display text-[44px] leading-[1.05] tracking-[-0.025em]">
            Ten minutes to first patch.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Eight steps, mostly copy-paste. Tailwind + Anthropic, but every
            piece is swappable: CSS-in-JS via inline-style compiler, OpenAI
            or Ollama or your own LLMClient, your own components via the
            registry.
          </p>
        </div>
        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className="border-t border-border/40 py-10 first:border-t-0 first:pt-0"
          >
            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span>{s.title}</span>
            </div>
            <h2 className="font-display text-[24px] font-semibold tracking-tight">
              {s.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
              {s.body}
            </p>
            <div className="mt-5 max-w-3xl">
              <CodeBlock code={s.code} language={s.lang} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
