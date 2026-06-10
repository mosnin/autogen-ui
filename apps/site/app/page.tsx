"use client";

import { motion } from "framer-motion";
import { BrandSwitcher } from "@/components/BrandSwitcher";
import { CodeBlock } from "@/components/CodeBlock";
import { ScriptedAgent } from "@/components/ScriptedAgent";
import { editScript, revenueScript } from "@/lib/scripts";

const QUICKSTART = `pnpm add @autogen-ui/core framer-motion`;

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
} from "@autogen-ui/core";

export default function Page() {
  const { dashboard, sendMessage } = useStreamingDashboard();
  const { data, state, dispatch } = useRuntime(dashboard);
  return (
    <BrandProvider kit={yourBrandKit}>
      <DashboardRenderer
        dashboard={dashboard}
        context={{ data, state, dispatch }}
      />
    </BrandProvider>
  );
}`;

const PROMISES = [
  {
    title: "Tool-use first",
    body: "The model calls a typed emit_patches tool; the runtime validates with Zod, auto-repairs invalid output, and streams patches as they arrive. No regex JSON parsing.",
  },
  {
    title: "Your design system",
    body: "BrandKit propagates your colors, typography, radius, voice rules. Components read from your CSS variables — drop into a shadcn app and it looks native.",
  },
  {
    title: "Embeddable, not adopting",
    body: "Mount the renderer inside any panel of your existing app. Your nav, your auth, your layout — untouched. Register your components, the agent uses them.",
  },
];

const STATS = [
  { value: "0.3.0", label: "Current release" },
  { value: "246", label: "End-to-end tests" },
  { value: "36+", label: "Built-in components" },
  { value: "4", label: "LLM providers, BYO" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              <span>v0.3.0 — embeddable framework release</span>
            </div>
            <h1 className="font-display text-[56px] leading-[1.02] tracking-[-0.025em] sm:text-[80px]">
              UI you ask for,
              <br />
              <span className="text-foreground/60">in real time.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
              An AI-native framework where the model emits a validated JSON
              spec and the renderer animates it into your design system.
              Drop it into your existing app — your components, your tokens,
              your voice.
            </p>
            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <CodeBlock code={QUICKSTART} language="terminal" />
              <a
                href="https://github.com/mosnin/autogen-ui"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border bg-card px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/30"
              >
                Star on GitHub →
              </a>
            </div>
          </motion.div>

          {/* Live agent demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="mt-16"
          >
            <ScriptedAgent scripts={[revenueScript, editScript]} loop />
            <p className="mt-3 text-center text-[12px] text-muted-foreground/70">
              ↑ pre-recorded patch script — same animation the live agent produces
            </p>
          </motion.div>

          {/* Stats strip */}
          <div className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="bg-background px-6 py-5 text-center"
              >
                <div className="font-display text-[28px] font-semibold tracking-tight text-foreground tabular-nums">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three promises */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            What it is
          </div>
          <h2 className="font-display text-[40px] leading-[1.08] tracking-[-0.02em]">
            A runtime for generated interfaces.
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PROMISES.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.08,
              }}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/15"
            >
              <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="font-display text-[18px] font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Brand switcher */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="lg:pt-6">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Your aesthetic
            </div>
            <h2 className="font-display text-[40px] leading-[1.08] tracking-[-0.02em]">
              Same surface.
              <br />
              <span className="text-foreground/60">Six identities.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              BrandKit declares your colors, typography, radius, and voice
              rules. The renderer wears them; the agent's prompt knows them.
              Six starter kits ship — fork the closest match in a minute.
            </p>
            <div className="mt-6 text-[12px] text-muted-foreground/70">
              ↗ Click a swatch to swap
            </div>
          </div>
          <BrandSwitcher />
        </div>
      </section>

      {/* Integration code */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Integration
          </div>
          <h2 className="font-display text-[40px] leading-[1.08] tracking-[-0.02em]">
            Two files. One mount.
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            One server route to forward the prompt. One client component to
            render the result. Your existing app — header, navigation, auth,
            data — stays exactly as it is.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CodeBlock code={ROUTE} language="ts · route" />
          <CodeBlock code={PAGE} language="tsx · page" />
        </div>
        <div className="mt-6 rounded-xl border border-border bg-card/60 p-5 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">Audit first:</span>{" "}
          <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[12px]">
            npx create-autogen-ui doctor
          </code>{" "}
          scans your repo and reports the few additions (CSS variables,
          Tailwind config) you need to be drop-in ready.
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="overflow-hidden rounded-3xl border border-border bg-card/60 p-10 backdrop-blur sm:p-16">
          <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <h2 className="font-display text-[42px] leading-[1.05] tracking-[-0.02em] sm:text-[56px]">
              The model speaks UI.
              <br />
              <span className="text-foreground/55">Your app understands.</span>
            </h2>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Open source, MIT licensed. v0.3.0 ships dual ESM/CJS, full
              TypeScript, 246 tests, and a CLI that scaffolds a project in
              under a minute.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <CodeBlock code={QUICKSTART} language="terminal" />
              <a
                href="https://github.com/mosnin/autogen-ui"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-rest transition-all hover:shadow-lift"
              >
                GitHub →
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
