"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createDispatcher } from "../actions";
import { useDataSources } from "../data";
import type { Action, Dashboard } from "../schema";

/**
 * Composes the data layer (`useDataSources`) and the action layer
 * (`createDispatcher`) into the `{ data, dispatch }` pair that
 * `DashboardRenderer` expects as its `context` prop.
 *
 * Local reactive state is seeded from `dashboard.state` so interactions work
 * immediately, before the agent ever persists them. `onState` lets the host
 * mirror `setState` patches back into the spec.
 */

export interface UseRuntimeOptions {
  fetcher?: typeof fetch;
  /** Notified on every `setState`, so the host can persist the patch. */
  onState?: (path: string, value: unknown) => void;
}

export interface UseRuntimeResult {
  data: Record<string, unknown>;
  dispatch: (actions: Action[]) => void;
}

/** Immutably set a value at a dot-path inside an object. */
function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split(".").filter(Boolean);
  if (keys.length === 0) return obj;
  const [head, ...rest] = keys as [string, ...string[]];
  if (rest.length === 0) return { ...obj, [head]: value };
  const child =
    typeof obj[head] === "object" && obj[head] !== null
      ? (obj[head] as Record<string, unknown>)
      : {};
  return { ...obj, [head]: setPath(child, rest.join("."), value) };
}

export function useRuntime(
  dashboard: Dashboard,
  opts: UseRuntimeOptions = {},
): UseRuntimeResult {
  const { fetcher, onState } = opts;
  const { data, refetch } = useDataSources(dashboard, { fetcher });

  const [state, setStateMap] = useState<Record<string, unknown>>(
    () => ({ ...(dashboard.state ?? {}) }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback(
    (path: string, value: unknown) => {
      setStateMap((prev) => setPath(prev, path, value));
      onState?.(path, value);
    },
    [onState],
  );

  const dispatch = useMemo(
    () =>
      createDispatcher({
        getState: () => stateRef.current,
        setState,
        refetch,
      }),
    [setState, refetch],
  );

  return { data, dispatch };
}
