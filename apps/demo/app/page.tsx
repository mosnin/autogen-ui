"use client";

import { DashboardRenderer, useRuntime, useStreamingDashboard } from "@autogen-ui/core";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { seeds } from "@/lib/presets";
import { useVoice } from "@/lib/voice";

const EMPTY_PROMPTS = [
  "An empty canvas.",
  "Nothing here yet.",
  "A blank slate.",
  "A waiting room.",
];

export default function Page() {
  const {
    dashboard,
    messages,
    isLoading,
    error,
    sendMessage,
    setDashboard,
    reset,
  } = useStreamingDashboard();
  const { data, state, dispatch } = useRuntime(dashboard);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [emptyIdx, setEmptyIdx] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const i = setInterval(() => setEmptyIdx((n) => (n + 1) % EMPTY_PROMPTS.length), 3200);
    return () => clearInterval(i);
  }, []);

  const submit = async (text: string) => {
    setInput("");
    setSidebarOpen(false);
    await sendMessage(text);
  };

  const voice = useVoice((final) => {
    if (final.trim()) submit(final);
  });

  // Instant seed: render a pre-baked dashboard in zero ms, then optionally
  // ask the agent to personalize it in the background.
  const useSeed = (label: string, prompt: string, seedDash: typeof dashboard) => {
    setDashboard(seedDash);
    setSidebarOpen(false);
    // Fire-and-forget refinement; ignored if no API key configured.
    void sendMessage(`${prompt}. The current dashboard is already a starting point — refine it.`);
    void label;
  };

  const isEmpty = (dashboard.root.children?.length ?? 0) === 0;

  const exportJson = JSON.stringify(dashboard, null, 2);
  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  };
  const downloadExport = () => {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dashboard.id || "dashboard"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle chat"
            className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="h-5 w-5 rounded-md bg-primary shadow-[0_0_18px_-2px_hsl(var(--primary))]" />
          <span className="font-display text-base font-semibold tracking-tight">autogen-ui</span>
          <span className="hidden rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground sm:inline">
            preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={isEmpty}
            className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/20 hover:text-foreground disabled:opacity-40 sm:inline-flex"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/20 hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Chat sidebar — collapsible on mobile */}
        <aside
          className={`absolute inset-y-12 left-0 z-20 flex w-full flex-col border-r border-border/60 bg-background transition-transform duration-300 md:relative md:inset-y-0 md:w-[400px] md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            {messages.length === 0 && (
              <div className="space-y-5">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Describe a dashboard. Then keep talking — every message edits the
                  live UI in place.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Instant
                    </div>
                    <div className="text-[10px] text-muted-foreground/50">
                      zero wait · click to render
                    </div>
                  </div>
                  {seeds.map((s, i) => (
                    <motion.button
                      key={s.id}
                      type="button"
                      onClick={() => useSeed(s.label, s.prompt, s.dashboard)}
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
                      <div className="flex items-center justify-between">
                        <span>
                          <span className="text-muted-foreground/60 group-hover:text-primary">⚡ </span>
                          {s.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground">
                          instant
                        </span>
                      </div>
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
                value={voice.listening ? voice.transcript : input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) submit(input);
                  }
                }}
                rows={2}
                placeholder={voice.listening ? "Listening…" : "Describe or edit…"}
                disabled={voice.listening}
                className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {voice.supported && (
                <button
                  type="button"
                  onClick={() => (voice.listening ? voice.stop() : voice.start())}
                  aria-label={voice.listening ? "Stop listening" : "Speak"}
                  className={`grid h-8 w-8 place-items-center rounded-lg border transition-all ${
                    voice.listening
                      ? "border-danger/60 bg-danger/10 text-danger shadow-[0_0_0_3px_hsl(var(--danger)/0.18)]"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {voice.listening ? (
                    <motion.span
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="block h-2 w-2 rounded-full bg-danger"
                    />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !voice.listening)}
                aria-label="Send"
                className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-rest transition-all hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground/60">
              <span>{voice.supported ? "Voice or text · Enter to send" : "Enter to send · Shift+Enter newline"}</span>
              <span className="font-mono">⌘K</span>
            </div>
          </form>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-10 bg-background/40 backdrop-blur-sm md:hidden"
          />
        )}

        {/* Dashboard canvas */}
        <section className="relative min-w-0 flex-1 overflow-y-auto">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.06),_transparent_60%)]"
          />
          <div className="relative p-4 sm:p-8">
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
                    Click an instant template, type a description, or hold the mic
                    and talk.
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

      {/* Export sheet */}
      <AnimatePresence>
        {exportOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              onClick={() => setExportOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-4 top-12 z-40 mx-auto max-w-2xl rounded-xl border border-border bg-card shadow-lift sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h3 className="font-display text-sm font-semibold">Export dashboard</h3>
                  <p className="text-[11px] text-muted-foreground">
                    JSON spec — paste into your app or version it.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyExport}
                    className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={downloadExport}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    Download .json
                  </button>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setExportOpen(false)}
                    className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <pre className="max-h-[60vh] overflow-auto bg-background p-4 text-[11px] leading-relaxed text-muted-foreground">
                <code className="font-mono">{exportJson}</code>
              </pre>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
