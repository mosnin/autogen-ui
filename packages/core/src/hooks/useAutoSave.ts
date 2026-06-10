"use client";

import { useEffect, useRef } from "react";
import type { Dashboard } from "../schema";

/**
 * Auto-save the dashboard to a persistence endpoint whenever it changes.
 * Pairs with `createPersistenceHandler` on the server. Debounced — a
 * burst of edits within `debounceMs` collapses into a single POST.
 */

export interface UseAutoSaveOptions {
  /** Endpoint URL — POSTed to with `{ id, dashboard }`. */
  endpoint?: string;
  /** Storage id. Defaults to `dashboard.id`. */
  id?: string;
  /** Debounce window in ms (default 750). */
  debounceMs?: number;
  /** Optional fetch override (auth headers etc.). */
  fetcher?: typeof fetch;
  /** Skip the first save (useful when the spec is hydrated from the same endpoint). */
  skipFirst?: boolean;
  /** Called with the response status on each save attempt. */
  onSave?: (ok: boolean, status: number) => void;
}

export function useAutoSave(dashboard: Dashboard, opts: UseAutoSaveOptions = {}): void {
  const {
    endpoint = "/api/autogen-ui/persist",
    debounceMs = 750,
    fetcher,
    skipFirst = false,
    onSave,
  } = opts;
  const id = opts.id ?? dashboard.id;
  const doFetch = fetcher ?? (typeof fetch === "function" ? fetch : undefined);
  const firstRef = useRef(true);
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!doFetch) return;
    if (firstRef.current && skipFirst) {
      firstRef.current = false;
      return;
    }
    firstRef.current = false;

    const t = setTimeout(() => {
      inflightRef.current?.abort();
      const ctrl = new AbortController();
      inflightRef.current = ctrl;
      doFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, dashboard }),
        signal: ctrl.signal,
      })
        .then((res) => onSave?.(res.ok, res.status))
        .catch(() => {
          /* swallow — onSave didn't fire => caller knows save was inflight */
        });
    }, debounceMs);

    return () => clearTimeout(t);
  }, [dashboard, doFetch, endpoint, id, debounceMs, skipFirst, onSave]);

  // Abort on unmount.
  useEffect(() => {
    return () => {
      inflightRef.current?.abort();
    };
  }, []);
}
