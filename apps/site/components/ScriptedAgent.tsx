"use client";

import {
  DashboardRenderer,
  applyPatch,
  emptyDashboard,
  useRuntime,
  type Dashboard,
} from "@autogen-ui/core";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentScript } from "@/lib/scripts";

interface ScriptedAgentProps {
  scripts: AgentScript[];
  /** Auto-start when scrolled into view. */
  autoStart?: boolean;
  /** Loop the scripts forever. */
  loop?: boolean;
  className?: string;
}

/**
 * Plays a sequence of pre-recorded patches against a `DashboardRenderer`.
 * No API key required — this is the agent transcript replayed locally so
 * the marketing page can show the "stream patches arrive in real time"
 * magic that defines the framework.
 */
export function ScriptedAgent({
  scripts,
  autoStart = true,
  loop = true,
  className,
}: ScriptedAgentProps) {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard("hero"));
  const [scriptIdx, setScriptIdx] = useState(0);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const { data, state, dispatch } = useRuntime(dashboard);
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: false, amount: 0.3 });
  const startedRef = useRef(false);

  const runOne = useCallback(
    async (script: AgentScript): Promise<void> => {
      setMessages((prev) => [...prev, { role: "user", text: script.prompt }]);
      await wait(700);
      for (const step of script.steps) {
        await wait(step.delay);
        setDashboard((prev) => applyPatch(prev, step.patch));
      }
      if (script.message) {
        await wait(400);
        setMessages((prev) => [...prev, { role: "assistant", text: script.message! }]);
      }
    },
    [],
  );

  const runAll = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    while (true) {
      for (let i = 0; i < scripts.length; i++) {
        setScriptIdx(i);
        await runOne(scripts[i]!);
        await wait(2400);
      }
      if (!loop) break;
      // Reset and replay.
      await wait(1200);
      setDashboard(emptyDashboard("hero"));
      setMessages([]);
      await wait(600);
    }
  }, [isPlaying, scripts, loop, runOne]);

  useEffect(() => {
    if (autoStart && inView && !startedRef.current) {
      startedRef.current = true;
      void runAll();
    }
  }, [inView, autoStart, runAll]);

  const isEmpty = (dashboard.root.children?.length ?? 0) === 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div ref={containerRef} className={className}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-border/60 bg-card/80 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            agent · live
          </div>
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
        </div>

        {/* Conversation strip */}
        <div className="space-y-2 border-b border-border/60 px-5 py-4">
          <AnimatePresence mode="popLayout">
            {messages.slice(-2).map((m, i) =>
              m.role === "user" ? (
                <motion.div
                  key={`${scriptIdx}-${i}-u`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="ml-auto w-fit max-w-[80%] rounded-2xl bg-foreground/[0.06] px-3.5 py-2 text-[13px] text-foreground"
                >
                  {m.text}
                </motion.div>
              ) : (
                <motion.div
                  key={`${scriptIdx}-${i}-a`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="text-[13px] text-muted-foreground"
                >
                  {m.text}
                </motion.div>
              ),
            )}
            {messages.length === 0 && (
              <motion.div
                key="placeholder"
                className="text-[13px] text-muted-foreground/60"
              >
                Watch the agent compose →
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dashboard canvas */}
        <div className="min-h-[420px] bg-background p-6">
          {isEmpty ? (
            <div className="flex h-[420px] flex-col items-center justify-center text-center">
              <div className="font-display text-[28px] font-medium tracking-[-0.02em] text-foreground/60">
                {lastAssistant ? "Done." : "Waiting…"}
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground/70">
                {lastAssistant
                  ? "Resetting for the next take."
                  : "Scroll into view to start the agent."}
              </p>
            </div>
          ) : (
            <DashboardRenderer
              dashboard={dashboard}
              context={{ data, state, dispatch }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
