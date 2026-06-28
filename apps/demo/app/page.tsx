"use client";

import {
  BrandProvider,
  DashboardRenderer,
  brandPresets,
  cn,
  useRuntime,
  useStreamingDashboard,
  type BrandPresetName,
} from "@autogen-ui/core";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { seeds } from "@/lib/presets";
import type { Dashboard } from "@autogen-ui/core";

const SLOW = [0.22, 1, 0.36, 1] as const;

const SUGGESTIONS = [
  {
    label: "SaaS revenue dashboard",
    prompt: "Build a SaaS revenue dashboard with MRR, churn rate, and active users. Use a bento layout with a hero metric and a 6-month area chart.",
    seedId: "revenue",
  },
  {
    label: "Fitness tracker",
    prompt: "Build a fitness tracker with steps, sleep score, and heart rate. Include a weekly activity timeline and ring progress for daily goals.",
    seedId: "fitness",
  },
  {
    label: "Content analytics",
    prompt: "Build a content analytics dashboard with views, CTR, watch time, and top posts. Include a multi-series chart comparing this month vs last month.",
    seedId: "content",
  },
  {
    label: "Sales pipeline",
    prompt: "Build a sales pipeline dashboard with deals by stage, monthly close rate, quota attainment, and a table of top opportunities.",
    seedId: "revenue",
  },
  {
    label: "Team performance",
    prompt: "Build a team performance dashboard showing individual contributor stats, sprint velocity, and a completion stepper for the current quarter.",
    seedId: "content",
  },
  {
    label: "Personal finance",
    prompt: "Build a personal finance dashboard with budget categories, net savings rate, spending by category as a donut chart, and a monthly trend line.",
    seedId: "fitness",
  },
];

const PLACEHOLDERS = [
  "Build a SaaS metrics dashboard with MRR and churn…",
  "Show team performance with individual contributor stats…",
  "Create a personal finance view with budget categories…",
  "Design a product analytics dashboard with conversion funnel…",
];

const STATUS_MESSAGES = [
  "Thinking…",
  "Designing the layout…",
  "Selecting components…",
  "Building the structure…",
  "Placing the data…",
  "Fine-tuning details…",
];

// Walk the dashboard tree and collect component types used
function collectTypes(node: { type: string; children?: typeof node[] }): Set<string> {
  const types = new Set<string>();
  function walk(n: typeof node) {
    types.add(n.type);
    for (const child of n.children ?? []) walk(child);
  }
  walk(node);
  return types;
}

function getFollowUpChips(root: { type: string; children?: typeof root[] }) {
  const types = collectTypes(root);
  const chips: Array<{ label: string; prompt: string }> = [];

  if (types.has("Stat") && !types.has("Metric")) {
    chips.push({
      label: "Hero-ify top stat",
      prompt: "Convert the single most important stat into a hero Metric that dominates the top — large, centered, with a trend description below it.",
    });
  }
  if ((types.has("Chart") || types.has("Stat")) && !types.has("Sparkline")) {
    chips.push({
      label: "Add sparklines",
      prompt: "Add a compact sparkline trend line to each stat showing the past 8 periods of data.",
    });
  }
  if (!types.has("Timeline")) {
    chips.push({
      label: "Add activity feed",
      prompt: "Add a recent activity timeline on the right side with 4–5 realistic recent events, each with a timestamp and status (done/current/pending).",
    });
  }
  if (!types.has("Callout")) {
    chips.push({
      label: "Surface key insight",
      prompt: "Add a success or warning Callout highlighting the single most important insight from this data — one sentence, actionable.",
    });
  }
  if (types.has("Table") && !types.has("TagGroup")) {
    chips.push({
      label: "Add category filters",
      prompt: "Add a TagGroup above the table with color-coded category filter chips based on the data in the table.",
    });
  }
  if (!types.has("RingProgress")) {
    chips.push({
      label: "Add ring progress",
      prompt: "Add a RingProgress showing the most important completion rate or percentage metric, sized lg.",
    });
  }

  chips.push({
    label: "Apply dark theme",
    prompt: "Make this dashboard feel more premium — deepen the background, add subtle shadows to every card, increase visual contrast across all elements.",
  });

  return chips.slice(0, 5);
}

export default function Page() {
  const {
    dashboard,
    messages,
    isLoading,
    error,
    sendMessage,
    cancel,
    setDashboard,
    reset,
  } = useStreamingDashboard();
  const { data, state, dispatch } = useRuntime(dashboard);
  const [input, setInput] = useState("");
  const [brandName, setBrandName] = useState<BrandPresetName>("violet");
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Undo stack — up to 8 previous dashboard states
  const undoStack = useRef<Dashboard[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Load shared dashboard from URL param on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const d = params.get("d");
      if (d) {
        const parsed = JSON.parse(atob(d)) as Dashboard;
        setDashboard(parsed);
      }
    } catch {
      /* invalid param — ignore */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  // Cycle animated status message while generating
  useEffect(() => {
    if (!isLoading) { setStatusIdx(0); return; }
    const id = setInterval(() => setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") {
        e.preventDefault();
        if (!sidebarOpen) setSidebarOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (helpOpen) { setHelpOpen(false); return; }
        if (menuOpen) { setMenuOpen(false); return; }
        if (exportOpen) { setExportOpen(false); return; }
        if (document.activeElement === inputRef.current) {
          setInput("");
          inputRef.current?.blur();
        }
      }
      // ⌘Z undo
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.current.length > 0) {
          const prev = undoStack.current.pop()!;
          setDashboard(prev);
          setCanUndo(undoStack.current.length > 0);
        }
      }
      // ? opens help overlay (when not typing)
      if (e.key === "?" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        setHelpOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen, setDashboard, helpOpen, menuOpen, exportOpen]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Cycle placeholder while input is empty and unfocused
  useEffect(() => {
    if (inputFocused || input) return;
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(id);
  }, [inputFocused, input]);

  const submit = async (text: string) => {
    // Snapshot current dashboard for undo
    undoStack.current = [...undoStack.current.slice(-7), dashboard];
    setCanUndo(false); // disable during load, re-enable on success

    setInput("");
    await sendMessage(text);

    setCanUndo(undoStack.current.length > 0);
  };

  const handleUndo = () => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setDashboard(prev);
    setCanUndo(undoStack.current.length > 0);
  };

  const useSeed = (prompt: string, seedId: string) => {
    const seed = seeds.find((s) => s.id === seedId);
    if (seed) {
      undoStack.current = [...undoStack.current.slice(-7), dashboard];
      setDashboard(seed.dashboard);
    }
    void sendMessage(`${prompt}. The current layout is a starting point — make it excellent.`);
  };

  const share = async () => {
    try {
      const encoded = btoa(JSON.stringify(dashboard));
      const url = `${window.location.origin}${window.location.pathname}?d=${encoded}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  };

  const isEmpty = (dashboard.root.children?.length ?? 0) === 0;
  const brand = brandPresets[brandName];
  const followUpChips = !isEmpty && !isLoading ? getFollowUpChips(dashboard.root) : [];

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

  const [exporting, setExporting] = useState(false);
  const downloadPng = async () => {
    if (!canvasRef.current || exporting) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const bg = getComputedStyle(canvasRef.current).backgroundColor;
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: bg || "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: canvasRef.current.scrollWidth,
        windowHeight: canvasRef.current.scrollHeight,
      });
      const link = document.createElement("a");
      link.download = `${dashboard.title ?? "dashboard"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      /* export failed — silently no-op */
    } finally {
      setExporting(false);
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
            <>
              <button
                onClick={share}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {shareCopied ? "✓ Copied" : "Share"}
              </button>
              {canUndo && (
                <button
                  onClick={handleUndo}
                  title="Undo last change (⌘Z)"
                  className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => {
                  undoStack.current = [];
                  setCanUndo(false);
                  reset();
                }}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Start over
              </button>
            </>
          )}
          <button
            type="button"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setDark((d) => !d)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            {dark ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
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
        {/* Conversation sidebar */}
        <aside className={cn(
          "flex flex-col transition-all duration-300",
          sidebarOpen ? "w-[440px] min-w-[280px]" : "w-0 overflow-hidden",
          "md:flex",
        )}>
          <div
            ref={scrollRef}
            className="flex-1 space-y-6 overflow-y-auto px-8 pb-6"
          >
            {messages.length === 0 && isEmpty && (
              <p className="mt-8 max-w-[28ch] text-[13.5px] leading-relaxed text-muted-foreground">
                Describe what you want, and the canvas on the right takes
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

            <AnimatePresence mode="popLayout">
              {isLoading && (
                <motion.div
                  key="status"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {/* Animated dots */}
                    <span className="flex gap-[3px]">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="block h-1 w-1 rounded-full bg-muted-foreground/50"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.2,
                            delay: i * 0.2,
                            ease: "easeInOut",
                          }}
                        />
                      ))}
                    </span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={statusIdx}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.3 }}
                        className="text-[13px] text-muted-foreground/60 italic"
                      >
                        {STATUS_MESSAGES[statusIdx]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={cancel}
                    className="text-[11px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Post-generation contextual chips */}
            <AnimatePresence>
              {followUpChips.length > 0 && (
                <motion.div
                  key="followup"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: SLOW as never }}
                  className="flex flex-wrap gap-2 pt-1"
                >
                  {followUpChips.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => submit(chip.prompt)}
                      disabled={isLoading}
                      className={cn(
                        "rounded-full border border-border/60 px-3 py-1 text-[12px] font-medium text-muted-foreground",
                        "transition-all hover:border-foreground/25 hover:text-foreground hover:bg-foreground/[0.03]",
                        "disabled:opacity-40 disabled:pointer-events-none",
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg bg-danger/5 px-3 py-2 text-[13px] leading-relaxed text-danger"
              >
                {error}
              </motion.p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) void submit(input);
            }}
            className="px-8 pb-8 pt-2"
          >
            <div className="flex items-end gap-3 border-b border-border/80 pb-3 transition-colors focus-within:border-foreground/40">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) void submit(input);
                  }
                }}
                rows={1}
                placeholder={PLACEHOLDERS[phIdx]}
                className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/40 placeholder:transition-all"
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
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/40">
              <span>↵ send · ⌘K focus · Esc clear</span>
              {canUndo && !isLoading && (
                <span>⌘Z undo</span>
              )}
            </div>
          </form>
        </aside>

        {/* Canvas */}
        <section className="relative min-w-0 flex-1 overflow-y-auto">
          <AnimatePresence>
            {isLoading && (
              <motion.div
                key="loading-bar"
                className="absolute inset-x-0 top-0 z-20 h-[2px] origin-left bg-primary/60"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 0.85 }}
                exit={{ scaleX: 1, opacity: 0 }}
                transition={{
                  scaleX: { duration: 8, ease: [0.1, 0.4, 0.6, 1] },
                  opacity: { duration: 0.3 },
                }}
              />
            )}
          </AnimatePresence>
          <button
            type="button"
            aria-label={sidebarOpen ? "Hide conversation" : "Show conversation"}
            onClick={() => setSidebarOpen((o) => !o)}
            className="absolute left-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {sidebarOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              ) : (
                <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
              )}
            </svg>
          </button>
          <div
            ref={canvasRef}
            className={cn(
              "relative px-12 pb-16 pt-8",
              isEmpty && "min-h-full",
            )}
          >
            {/* Dot grid — visible when canvas is empty */}
            {isEmpty && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.035]"
                style={{
                  backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
            )}
            <AnimatePresence mode="wait">
              {isEmpty ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: SLOW as never }}
                  className="relative mx-auto max-w-2xl pt-20"
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
                    transition={{ duration: 0.7, ease: SLOW as never, delay: 0.08 }}
                    className="mt-5 max-w-sm text-[16px] leading-relaxed text-muted-foreground"
                  >
                    Describe a dashboard. Watch it appear — every follow-up
                    edits it in place.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, ease: SLOW as never, delay: 0.2 }}
                    className="mt-12 space-y-3"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                      Start with
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => useSeed(s.prompt, s.seedId)}
                          className={cn(
                            "rounded-full border border-border/60 px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground",
                            "transition-all hover:border-foreground/25 hover:text-foreground hover:bg-foreground/[0.03]",
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
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
                  <div className="mt-4 space-y-1">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setExportOpen(true);
                      }}
                      className="flex w-full items-center justify-between text-[13px] text-foreground/70 transition-colors hover:text-foreground"
                    >
                      <span>Export spec</span>
                      <span className="text-foreground/30">→</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        void downloadPng();
                      }}
                      disabled={exporting}
                      className="flex w-full items-center justify-between text-[13px] text-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      <span>{exporting ? "Exporting…" : "Download PNG"}</span>
                      <span className="text-foreground/30">↓</span>
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Keyboard shortcut help overlay */}
      <AnimatePresence>
        {helpOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              onClick={() => setHelpOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-background/50 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-label="Keyboard shortcuts"
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 4 }}
              transition={{ duration: 0.25, ease: SLOW as never }}
              className="fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 w-80 rounded-2xl border border-border/60 bg-card p-6 shadow-lift"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-[14px] font-medium tracking-tight">Keyboard shortcuts</span>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  Esc
                </button>
              </div>
              <div className="space-y-2.5">
                {[
                  { keys: "↵", desc: "Send message" },
                  { keys: "⇧↵", desc: "New line in input" },
                  { keys: "⌘K", desc: "Focus input" },
                  { keys: "Esc", desc: "Clear input" },
                  { keys: "⌘Z", desc: "Undo last generation" },
                  { keys: "?", desc: "Toggle this help" },
                ].map(({ keys, desc }) => (
                  <div key={keys} className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">{desc}</span>
                    <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{keys}</kbd>
                  </div>
                ))}
              </div>
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
                    Export spec
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Paste into your app as{" "}
                    <code className="font-mono text-[11px]">&lt;DashboardRenderer dashboard={"{spec}"} /&gt;</code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyExport}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {copied ? "✓ Copied" : "Copy"}
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
