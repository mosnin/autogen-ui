"use client";

import {
  BrandProvider,
  DashboardRenderer,
  brandPresets,
  useRuntime,
  useStreamingDashboard,
  type BrandPresetName,
} from "@autogen-ui/core";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { seeds } from "@/lib/presets";

const SLOW = [0.22, 1, 0.36, 1] as const;

const SUGGESTIONS = [
  {
    label: "a SaaS revenue dashboard",
    prompt: "Build a SaaS revenue dashboard with MRR, churn, and active users",
    seedId: "revenue",
  },
  {
    label: "a fitness tracker",
    prompt: "Build a fitness tracker dashboard with steps, sleep and heart rate",
    seedId: "fitness",
  },
  {
    label: "a content analytics view",
    prompt: "Build a content analytics dashboard with views, CTR, and watch time",
    seedId: "content",
  },
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
  const [brandName, setBrandName] = useState<BrandPresetName>("violet");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const submit = async (text: string) => {
    setInput("");
    await sendMessage(text);
  };

  const useSeed = (label: string, prompt: string, seedId: string) => {
    const seed = seeds.find((s) => s.id === seedId);
    if (seed) setDashboard(seed.dashboard);
    void sendMessage(
      `${prompt}. The current dashboard is already a starting point — refine it.`,
    );
    void label;
  };

  const isEmpty = (dashboard.root.children?.length ?? 0) === 0;
  const brand = brandPresets[brandName];

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

  return (
    <BrandProvider
      kit={brand}
      className="flex h-screen flex-col bg-background text-foreground"
    >
      <header className="flex items-center justify-between px-8 py-5">
        <div className="font-display text-[15px] font-medium tracking-tight">
          autogen<span className="text-foreground/35">/ui</span>
        </div>
        <div className="flex items-center gap-1">
          {!isEmpty && (
            <button
              onClick={reset}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Start over
            </button>
          )}
          <button
            type="button"
            aria-label="Options"
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Conversation */}
        <aside className="flex w-[440px] flex-col">
          <div
            ref={scrollRef}
            className="flex-1 space-y-6 overflow-y-auto px-8 pb-6"
          >
            {messages.length === 0 && !isEmpty && null}

            {messages.length === 0 && isEmpty && (
              <p className="mt-8 max-w-[28ch] text-[13.5px] leading-relaxed text-muted-foreground">
                Describe what you want, and the surface on the right takes
                shape. Every follow-up edits it in place.
              </p>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: SLOW as never }}
                  className="ml-auto w-fit max-w-[88%] rounded-2xl bg-foreground/[0.04] px-4 py-2.5 text-[14px] leading-relaxed text-foreground"
                >
                  {m.content}
                </motion.div>
              ) : (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: SLOW as never }}
                  className="text-[14px] leading-relaxed text-muted-foreground"
                >
                  {m.content}
                </motion.div>
              ),
            )}

            {isLoading && (
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1 w-1 rounded-full bg-foreground/30 animate-thinking"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </div>
            )}

            {error && (
              <p className="text-[13px] leading-relaxed text-danger">{error}</p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) submit(input);
            }}
            className="px-8 pb-8 pt-2"
          >
            <div className="flex items-end gap-3 border-b border-border/80 pb-3 transition-colors focus-within:border-foreground/40">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) submit(input);
                  }
                }}
                rows={1}
                placeholder="What should it show?"
                className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send"
                className="text-[13px] font-medium text-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/30"
              >
                Send
              </button>
            </div>
          </form>
        </aside>

        {/* Canvas */}
        <section className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="relative px-12 pb-16 pt-8">
            <AnimatePresence mode="wait">
              {isEmpty ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: SLOW as never }}
                  className="mx-auto max-w-2xl pt-20"
                >
                  <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: SLOW as never }}
                    className="font-display text-[56px] font-semibold leading-[1.0] tracking-[-0.035em] text-foreground sm:text-[64px]"
                  >
                    What should it
                    <br />
                    look like?
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.7,
                      ease: SLOW as never,
                      delay: 0.1,
                    }}
                    className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground"
                  >
                    Describe what you want.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.6,
                      ease: SLOW as never,
                      delay: 0.25,
                    }}
                    className="mt-12 space-y-3 text-[14px]"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                      Or start with
                    </div>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => useSeed(s.label, s.prompt, s.seedId)}
                        className="block text-left text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="text-foreground/40">→</span> {s.label}
                      </button>
                    ))}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, ease: SLOW as never }}
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

      {/* Options menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-background/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.28, ease: SLOW as never }}
              className="fixed right-6 top-16 z-40 w-[280px] rounded-2xl border border-border/60 bg-card p-5 shadow-lift"
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                Theme
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(Object.keys(brandPresets) as BrandPresetName[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => setBrandName(n)}
                    className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all ${
                      brandName === n
                        ? "border-foreground/25 bg-foreground/[0.02]"
                        : "border-border/60 hover:border-foreground/15"
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        background: `hsl(${brandPresets[n].colors?.primary ?? "0 0% 50%"})`,
                      }}
                    />
                    <span className="text-[11px] font-medium capitalize text-foreground/80">
                      {n}
                    </span>
                  </button>
                ))}
              </div>
              {!isEmpty && (
                <>
                  <div className="mt-5 h-px bg-border/60" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setExportOpen(true);
                    }}
                    className="mt-4 flex w-full items-center justify-between text-[13px] text-foreground/70 transition-colors hover:text-foreground"
                  >
                    <span>Export spec</span>
                    <span className="text-foreground/30">→</span>
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.32, ease: SLOW as never }}
              className="fixed left-1/2 top-20 z-50 -translate-x-1/2 w-[min(720px,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-card shadow-lift"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div>
                  <div className="font-display text-[15px] font-medium tracking-tight">
                    Export
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Paste into your app or version it.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyExport}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => setExportOpen(false)}
                    aria-label="Close"
                    className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Done
                  </button>
                </div>
              </div>
              <pre className="max-h-[60vh] overflow-auto px-5 py-4 text-[11.5px] leading-relaxed text-muted-foreground">
                <code className="font-mono">{exportJson}</code>
              </pre>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </BrandProvider>
  );
}
