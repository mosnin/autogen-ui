"use client";

import {
  DashboardRenderer,
  applyPatch,
  emptyDashboard,
  useRuntime,
  type Dashboard,
} from "@autogen-ui/core";
import { useInView } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentScript } from "@/lib/scripts";

interface ScriptedAgentProps {
  scripts: AgentScript[];
  /** Auto-start when scrolled into view. */
  autoStart?: boolean;
  /** Loop the scripts forever. */
  loop?: boolean;
  /** Initial dashboard before any scripts run. */
  initial?: Dashboard;
  /** Pause before the first script starts (ms). Apple-style settle. */
  startDelay?: number;
  className?: string;
}

/**
 * Plays a sequence of pre-recorded patches against a `DashboardRenderer`.
 * No window chrome, no conversation strip — the dashboard itself is the
 * subject. The frame around it is the host page.
 */
export function ScriptedAgent({
  scripts,
  autoStart = true,
  loop = true,
  initial,
  startDelay = 600,
  className,
}: ScriptedAgentProps) {
  const [dashboard, setDashboard] = useState<Dashboard>(
    initial ?? emptyDashboard("hero"),
  );
  const { data, state, dispatch } = useRuntime(dashboard);
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: false, amount: 0.25 });
  const startedRef = useRef(false);
  const playingRef = useRef(false);

  const runOne = useCallback(async (script: AgentScript): Promise<void> => {
    for (const step of script.steps) {
      await wait(step.delay);
      setDashboard((prev) => applyPatch(prev, step.patch));
    }
  }, []);

  const runAll = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    await wait(startDelay);
    while (true) {
      for (let i = 0; i < scripts.length; i++) {
        await runOne(scripts[i]!);
        await wait(2200);
      }
      if (!loop) break;
      await wait(1400);
      setDashboard(initial ?? emptyDashboard("hero"));
      await wait(600);
    }
  }, [scripts, loop, runOne, startDelay, initial]);

  useEffect(() => {
    if (autoStart && inView && !startedRef.current) {
      startedRef.current = true;
      void runAll();
    }
  }, [inView, autoStart, runAll]);

  return (
    <div ref={containerRef} className={className}>
      <DashboardRenderer
        dashboard={dashboard}
        context={{ data, state, dispatch }}
      />
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
