"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RuntimeContext } from "./runtime";
import type { Dashboard, DataSource, UINode } from "./schema";

/**
 * Data sourcing + binding resolution (Phase 4).
 *
 * Bindings are safe dot-path lookups only — never `eval`. A binding string is
 * either a whole-string `{{...}}` (yields the raw typed value), an embedded
 * `{{...}}` interpolation (yields a string), or a plain literal.
 */

/* ------------------------------------------------------------------ *
 * Path access
 * ------------------------------------------------------------------ */

/** Safe dot-path read. Unknown paths resolve to `null`. */
export function getPath(obj: unknown, path: string): unknown {
  const keys = path.split(".").filter(Boolean);
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current === undefined ? null : current;
}

/** Apply a DataSource.rest `select` dot-path to a fetched payload. */
export function selectPath(value: unknown, path?: string): unknown {
  if (!path) return value;
  return getPath(value, path);
}

/* ------------------------------------------------------------------ *
 * Binding evaluation
 * ------------------------------------------------------------------ */

const WHOLE_RE = /^\{\{\s*([^}]+?)\s*\}\}$/;
const EMBED_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Resolve a single binding token (`state.x.y`, `data.src.path`, `src.path`). */
function resolveToken(token: string, ctx: RuntimeContext): unknown {
  if (token === "state" || token.startsWith("state.")) {
    return getPath(ctx.state, token.slice("state.".length));
  }
  const dataPath = token.startsWith("data.") ? token.slice("data.".length) : token;
  return getPath(ctx.data, dataPath);
}

/** Evaluate a binding expression to a typed value or interpolated string. */
function evalBinding(expr: string, ctx: RuntimeContext): unknown {
  const whole = expr.match(WHOLE_RE);
  if (whole?.[1]) return resolveToken(whole[1].trim(), ctx);
  if (!expr.includes("{{")) return expr;
  return expr.replace(EMBED_RE, (_m, token: string) => {
    const value = resolveToken(token.trim(), ctx);
    return value == null ? "" : String(value);
  });
}

/**
 * `RendererExtensions.resolveNode` implementation. Returns `node` unchanged
 * (same reference) when there are no bindings, so the renderer's resolve loop
 * terminates. Composes cleanly with other `resolveNode` transforms.
 */
export function resolveBindings(node: UINode, ctx: RuntimeContext): UINode {
  const bindings = node.bindings;
  if (!bindings) return node;
  const keys = Object.keys(bindings);
  if (keys.length === 0) return node;

  const props: Record<string, unknown> = { ...node.props };
  for (const key of keys) {
    const expr = bindings[key];
    if (expr === undefined) continue;
    props[key] = evalBinding(expr, ctx);
  }
  return { ...node, props: props as UINode["props"] };
}

/* ------------------------------------------------------------------ *
 * Fetching
 * ------------------------------------------------------------------ */

/** Resolve a DataSource to its payload. `static` returns inline data. */
export async function fetchDataSource(
  source: DataSource,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  if (source.kind === "static") return source.data;

  const init: RequestInit = { method: source.method };
  if (source.headers) init.headers = source.headers;
  if (source.method === "POST" && source.body !== undefined) {
    init.headers = { "content-type": "application/json", ...(source.headers ?? {}) };
    init.body = JSON.stringify(source.body);
  }

  const res = await fetcher(source.url, init);
  if (!res.ok) throw new Error(`[autogen-ui] fetch ${source.url} failed (${res.status})`);
  const json: unknown = await res.json();
  return selectPath(json, source.select);
}

/* ------------------------------------------------------------------ *
 * useDataSources
 * ------------------------------------------------------------------ */

export interface UseDataSourcesResult {
  data: Record<string, unknown>;
  loading: Record<string, boolean>;
  refetch: (id: string) => void;
}

/**
 * Fetch every source in `dashboard.dataSources`, polling `rest` sources that
 * declare `pollMs`. Keyed by a stable serialization so it does not re-loop.
 */
export function useDataSources(
  dashboard: Dashboard,
  opts: { fetcher?: typeof fetch } = {},
): UseDataSourcesResult {
  const fetcher = opts.fetcher ?? fetch;
  const sources = dashboard.dataSources ?? {};
  const sourcesKey = useMemo(() => JSON.stringify(sources), [sources]);

  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(
    (id: string, source: DataSource) => {
      setLoading((prev) => ({ ...prev, [id]: true }));
      fetchDataSource(source, fetcher)
        .then((value) => setData((prev) => ({ ...prev, [id]: value })))
        .catch(() => setData((prev) => ({ ...prev, [id]: null })))
        .finally(() => setLoading((prev) => ({ ...prev, [id]: false })));
    },
    [fetcher],
  );

  useEffect(() => {
    const current: Record<string, DataSource> = JSON.parse(sourcesKey);
    const timers: ReturnType<typeof setInterval>[] = [];
    for (const id of Object.keys(current)) {
      const source = current[id];
      if (!source) continue;
      load(id, source);
      if (source.kind === "rest" && source.pollMs) {
        timers.push(setInterval(() => load(id, source), source.pollMs));
      }
    }
    return () => {
      for (const timer of timers) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, load]);

  const refetch = useCallback(
    (id: string) => {
      const source = (dashboard.dataSources ?? {})[id];
      if (source) load(id, source);
    },
    [dashboard.dataSources, load],
  );

  return { data, loading, refetch };
}
