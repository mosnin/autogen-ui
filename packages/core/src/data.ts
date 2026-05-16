"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RuntimeContext } from "./runtime";
import type { Dashboard, DataSource, UINode } from "./schema";

/**
 * Data sourcing + binding resolution (Phase 4).
 *
 * Bindings are safe dot-path lookups, optionally piped through formatting
 * filters — never `eval`. A binding string is either a whole-string
 * `{{path | filter:arg | filter2}}` (yields the formatted value), an
 * embedded `{{...}}` interpolation (stringified), or a plain literal.
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
 * Filters — pure formatters applied via the `|` pipe syntax.
 * ------------------------------------------------------------------ */

export type FilterFn = (value: unknown, arg?: string) => unknown;

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const builtinFilters: Record<string, FilterFn> = {
  currency: (v, arg) => {
    const n = toNumber(v);
    if (Number.isNaN(n)) return v;
    const currency = arg && arg.length > 0 ? arg : "USD";
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  },
  number: (v, arg) => {
    const n = toNumber(v);
    if (Number.isNaN(n)) return v;
    const digits = arg ? Number(arg) : undefined;
    return new Intl.NumberFormat(undefined, {
      ...(Number.isFinite(digits) ? { minimumFractionDigits: digits, maximumFractionDigits: digits } : {}),
    }).format(n);
  },
  percent: (v, arg) => {
    const n = toNumber(v);
    if (Number.isNaN(n)) return v;
    const digits = arg ? Number(arg) : 0;
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  },
  date: (v, arg) => {
    const d = toDate(v);
    if (!d) return v;
    const style = (arg as "short" | "medium" | "long" | "full" | undefined) ?? "medium";
    return new Intl.DateTimeFormat(undefined, { dateStyle: style }).format(d);
  },
  time: (v, arg) => {
    const d = toDate(v);
    if (!d) return v;
    const style = (arg as "short" | "medium" | "long" | "full" | undefined) ?? "short";
    return new Intl.DateTimeFormat(undefined, { timeStyle: style }).format(d);
  },
  upper: (v) => (v == null ? "" : String(v).toUpperCase()),
  lower: (v) => (v == null ? "" : String(v).toLowerCase()),
  truncate: (v, arg) => {
    const s = v == null ? "" : String(v);
    const n = arg ? Number(arg) : 50;
    return s.length > n ? s.slice(0, n) + "…" : s;
  },
  json: (v) => JSON.stringify(v),
  default: (v, arg) => (v == null || v === "" ? (arg ?? "") : v),
};

/* ------------------------------------------------------------------ *
 * Binding evaluation
 * ------------------------------------------------------------------ */

const WHOLE_RE = /^\{\{\s*([^}]+?)\s*\}\}$/;
const EMBED_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

interface ParsedToken {
  path: string;
  filters: { name: string; arg?: string }[];
}

/** Split a token like `state.x.y | currency:USD | upper` into its pieces. */
function parseToken(raw: string): ParsedToken {
  const parts = raw.split("|").map((p) => p.trim()).filter((p) => p.length > 0);
  const path = parts[0] ?? "";
  const filters = parts.slice(1).map((f) => {
    const colon = f.indexOf(":");
    if (colon === -1) return { name: f };
    return { name: f.slice(0, colon).trim(), arg: f.slice(colon + 1).trim() };
  });
  return { path, filters };
}

function resolveValue(path: string, ctx: RuntimeContext): unknown {
  if (path === "state" || path.startsWith("state.")) {
    return getPath(ctx.state, path.slice("state.".length));
  }
  const dataPath = path.startsWith("data.") ? path.slice("data.".length) : path;
  return getPath(ctx.data, dataPath);
}

function applyFilters(
  value: unknown,
  filters: ParsedToken["filters"],
  table: Record<string, FilterFn>,
): unknown {
  let current = value;
  for (const f of filters) {
    const fn = table[f.name];
    if (!fn) continue; // unknown filter is a no-op
    current = fn(current, f.arg);
  }
  return current;
}

/** Evaluate a binding expression to a typed value or interpolated string. */
function evalBinding(
  expr: string,
  ctx: RuntimeContext,
  filters: Record<string, FilterFn>,
): unknown {
  const whole = expr.match(WHOLE_RE);
  if (whole?.[1]) {
    const parsed = parseToken(whole[1]);
    return applyFilters(resolveValue(parsed.path, ctx), parsed.filters, filters);
  }
  if (!expr.includes("{{")) return expr;
  return expr.replace(EMBED_RE, (_m, raw: string) => {
    const parsed = parseToken(raw.trim());
    const value = applyFilters(resolveValue(parsed.path, ctx), parsed.filters, filters);
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
    props[key] = evalBinding(expr, ctx, builtinFilters);
  }
  return { ...node, props: props as UINode["props"] };
}

/* ------------------------------------------------------------------ *
 * Fetching
 * ------------------------------------------------------------------ */

export interface FetchDataSourceOptions {
  fetcher?: typeof fetch;
  /**
   * If set, REST sources are fetched through this URL (a route mounted with
   * `createDataProxyHandler`) instead of hit directly from the browser.
   * Solves CORS and keeps auth headers server-side.
   */
  proxyUrl?: string;
}

/** Resolve a DataSource to its payload. `static` returns inline data. */
export async function fetchDataSource(
  source: DataSource,
  opts: FetchDataSourceOptions | typeof fetch = {},
): Promise<unknown> {
  // Back-compat: a bare `fetch` may be passed instead of an options object.
  const options: FetchDataSourceOptions =
    typeof opts === "function" ? { fetcher: opts } : opts;
  const fetcher = options.fetcher ?? fetch;

  if (source.kind === "static") return source.data;

  if (options.proxyUrl) {
    const res = await fetcher(options.proxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: source.url,
        method: source.method,
        headers: source.headers,
        body: source.body,
      }),
    });
    if (!res.ok) {
      throw new Error(`[autogen-ui] proxy ${options.proxyUrl} returned ${res.status}`);
    }
    const wrapped = (await res.json()) as { ok?: boolean; status?: number; data?: unknown; error?: string };
    if (wrapped.ok === false) {
      throw new Error(`[autogen-ui] proxied ${source.url} failed (${wrapped.status ?? "?"})`);
    }
    return selectPath(wrapped.data, source.select);
  }

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

export interface UseDataSourcesOptions {
  fetcher?: typeof fetch;
  /** Route REST sources through this proxy URL. See `createDataProxyHandler`. */
  proxyUrl?: string;
}

/**
 * Fetch every source in `dashboard.dataSources`, polling `rest` sources that
 * declare `pollMs`. Keyed by a stable serialization so it does not re-loop.
 */
export function useDataSources(
  dashboard: Dashboard,
  opts: UseDataSourcesOptions = {},
): UseDataSourcesResult {
  const fetcher = opts.fetcher ?? fetch;
  const proxyUrl = opts.proxyUrl;
  const sources = dashboard.dataSources ?? {};
  const sourcesKey = useMemo(() => JSON.stringify(sources), [sources]);

  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(
    (id: string, source: DataSource) => {
      setLoading((prev) => ({ ...prev, [id]: true }));
      fetchDataSource(source, { fetcher, proxyUrl })
        .then((value) => setData((prev) => ({ ...prev, [id]: value })))
        .catch(() => setData((prev) => ({ ...prev, [id]: null })))
        .finally(() => setLoading((prev) => ({ ...prev, [id]: false })));
    },
    [fetcher, proxyUrl],
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
