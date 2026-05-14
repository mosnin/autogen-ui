"use client";

import { useCallback, useRef, useState } from "react";
import type { Dashboard } from "./schema";

/**
 * Undo/redo for dashboards. Because every edit produces a discrete, immutable
 * `Dashboard`, a snapshot stack is all that's needed — no diffing or inverse
 * patches.
 */

const DEFAULT_LIMIT = 50;

export interface DashboardHistory {
  /** The current dashboard. */
  present: Dashboard;
  /** Record a new snapshot, clearing the redo stack. */
  push(next: Dashboard): void;
  /** Step back; returns the new present, or null if nothing to undo. */
  undo(): Dashboard | null;
  /** Step forward; returns the new present, or null if nothing to redo. */
  redo(): Dashboard | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Drop all past/future, keeping only the present. */
  clear(): void;
}

/** Create a snapshot-stack history rooted at `initial`. */
export function createHistory(
  initial: Dashboard,
  opts?: { limit?: number },
): DashboardHistory {
  const limit = Math.max(1, opts?.limit ?? DEFAULT_LIMIT);
  let past: Dashboard[] = [];
  let present = initial;
  let future: Dashboard[] = [];

  return {
    get present() {
      return present;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    push(next) {
      if (next === present) return;
      past.push(present);
      if (past.length > limit) past = past.slice(past.length - limit);
      present = next;
      future = [];
    },
    undo() {
      const prev = past.pop();
      if (prev === undefined) return null;
      future.unshift(present);
      present = prev;
      return present;
    },
    redo() {
      const next = future.shift();
      if (next === undefined) return null;
      past.push(present);
      present = next;
      return present;
    },
    clear() {
      past = [];
      future = [];
    },
  };
}

export interface UseHistoryResult {
  dashboard: Dashboard;
  /** Push a new snapshot and make it the present. */
  set: (next: Dashboard) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Reset to the initial dashboard, dropping all history. */
  reset: () => void;
}

/**
 * React wrapper around `createHistory`. The history object is held in a ref;
 * a render counter forces re-renders when the stacks change.
 */
export function useHistory(
  initial: Dashboard,
  opts?: { limit?: number },
): UseHistoryResult {
  const initialRef = useRef(initial);
  const historyRef = useRef<DashboardHistory>();
  if (!historyRef.current) {
    historyRef.current = createHistory(initialRef.current, opts);
  }
  const history = historyRef.current;
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);

  const set = useCallback(
    (next: Dashboard) => {
      history.push(next);
      rerender();
    },
    [history, rerender],
  );

  const undo = useCallback(() => {
    if (history.undo() !== null) rerender();
  }, [history, rerender]);

  const redo = useCallback(() => {
    if (history.redo() !== null) rerender();
  }, [history, rerender]);

  const reset = useCallback(() => {
    history.clear();
    history.push(initialRef.current);
    history.clear();
    rerender();
  }, [history, rerender]);

  return {
    dashboard: history.present,
    set,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    reset,
  };
}
