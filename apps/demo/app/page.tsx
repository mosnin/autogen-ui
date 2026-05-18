"use client";

import { DashboardRenderer, useRuntime, useStreamingDashboard } from "@autogen-ui/core";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Build a SaaS revenue dashboard with MRR, churn and active users",
  "Add a search Input bound to state.q and an echo Text showing what's typed",
  "Restyle it with a tighter spacing and an indigo glow on the cards",
  "Define a reusable MetricCard component and use it for 4 KPIs",
];

const EMPTY_PROMPTS = [
  "An empty canvas.",
  "Nothing here yet.",
  "A blank slate.",
  "A waiting room.",
];

export default function Page() {
  const { dashboard, messages, isLoading, error, sendMessage, reset } =
    useStreamingDashboard();
  const { data, state, dispatch } = useRuntime(dashboard);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [emptyIdx, setEmptyIdx] = useState(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const i = setInterval(() => setEmptyIdx((n) => (n + 1) % EMPTY_PROMPTS.length), 3200);
    return () => clearInterval(i);
  }, []);

  const submit = async (text: string) => {
    setInput("");
    await sendMessage(text);
  };

  const isEmpty = (dashboard.root.children?.length ?? 0) === 0;

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 rounded-md bg-primary shadow-[0_0_18px_-2px_hsl(var(--primary))]" />
          <span className="font-display text-base font-semibold tracking-tight">autogen-ui</span>
          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground">
            preview
          </span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/20 hover:text-foreground"
        >
          Reset
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Chat sidebar */}
        <aside className="flex w-[400px] flex-col border-r border-border/60 bg-background">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            {messages.length === 0 && (
              <div className="space-y-5">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Describe a dashboard. Then keep talking — every message edits the
                  live UI in place.
                </p>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Try
                  </div>
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        ease: [0.16, 1, 0.3, 1],
                        delay: 0.05 + i * 0.05,
                      }}
                      whileHover={{ x: 2 }}
                      className="group block w-full rounded-lg border border-border/70 bg-card p-3 text-left text-[13px] leading-snug text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
                    >
                      <span className="text-muted-foreground/60 group-hover:text-primary">→ </span>
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-rest"
                >
                  {m.content}
                </motion.div>
              ) : (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="text-[13.5px] leading-relaxed text-foreground"
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    Composer
                  </div>
                  {m.content}
                </motion.div>
              ),
            )}

            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1 w-1 rounded-full bg-primary animate-thinking"
                      style={{ animationDelay: `${i * 0.16}s` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">composing</span>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) submit(input);
            }}
            className="border-t border-border/60 bg-background px-4 py-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 transition-colors focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) submit(input);
                  }
                }}
                rows={2}
                placeholder="Describe or edit…"
                className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send"
                className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-rest transition-all hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground/60">
              <span>Enter to send · Shift+Enter for newline</span>
              <span className="font-mono">⌘K</span>
            </div>
          </form>
        </aside>

        {/* Dashboard canvas */}
        <section className="relative min-w-0 flex-1 overflow-y-auto">
          {/* Subtle ambient backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.06),_transparent_60%)]"
          />
          <div className="relative p-8">
            <AnimatePresence mode="wait">
              {isEmpty ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], rotate: [0, 180, 360] }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 shadow-[0_0_60px_-10px_hsl(var(--primary))] backdrop-blur"
                  />
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={emptyIdx}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.35 }}
                      className="font-display text-2xl font-semibold tracking-tight text-foreground"
                    >
                      {EMPTY_PROMPTS[emptyIdx]}
                    </motion.h2>
                  </AnimatePresence>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Send a message and watch the dashboard compose itself,
                    component by component.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mx-auto max-w-6xl"
                >
                  <DashboardRenderer
                    dashboard={dashboard}
                    context={{ data, state, dispatch }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </main>
  );
}
