"use client";

import { DashboardRenderer, useDashboard } from "@autogen-ui/core";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Build a SaaS revenue dashboard with MRR, churn and active users",
  "Add a bar chart of signups by month and a recent customers table",
  "Make the revenue card span the full width and add a trend line",
  "Turn this into a fitness tracker dashboard instead",
];

export default function Page() {
  const { dashboard, messages, isLoading, error, sendMessage, reset } = useDashboard();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const submit = async (text: string) => {
    setInput("");
    await sendMessage(text);
  };

  const isEmpty = (dashboard.root.children?.length ?? 0) === 0;

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">autogen-ui</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            demo
          </span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          Reset
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Chat sidebar */}
        <aside className="flex w-[380px] flex-col border-r border-border">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Describe a dashboard and watch it build itself. Then keep talking — every
                  message edits the live UI in place.
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="block w-full rounded-lg border border-border p-2.5 text-left text-foreground transition-colors hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                    : "w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-secondary-foreground"
                }
              >
                {m.content}
              </div>
            ))}

            {isLoading && (
              <div className="flex w-fit gap-1 rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-500">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) submit(input);
            }}
            className="border-t border-border p-3"
          >
            <div className="flex items-end gap-2">
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
                placeholder="Describe or edit your dashboard…"
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </aside>

        {/* Dashboard canvas */}
        <section className="min-w-0 flex-1 overflow-y-auto bg-muted/30 p-6">
          <AnimatePresence mode="wait">
            {isEmpty ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col items-center justify-center text-center text-muted-foreground"
              >
                <div className="text-5xl">✦</div>
                <p className="mt-4 max-w-sm text-sm">
                  Your dashboard is empty. Send a message and autogen-ui will generate it —
                  responsive components, animated edits, no code.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mx-auto max-w-6xl"
              >
                <DashboardRenderer dashboard={dashboard} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
