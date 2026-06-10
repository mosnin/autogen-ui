"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDispatcher } from "../actions";
import { useDataSources } from "../data";
import type { Action, Dashboard, FunctionDef } from "../schema";

/**
 * Composes the data layer (`useDataSources`) and the action layer
 * (`createDispatcher`) into the `{ data, dispatch }` pair that
 * `DashboardRenderer` expects as its `context` prop.
 *
 * Local reactive state is seeded from `dashboard.state` so interactions work
 * immediately, before the agent ever persists them. `onState` lets the host
 * mirror `setState` patches back into the spec.
 *
 * `callFunction` actions hit an agent-declared `FunctionDef` over HTTP; the
 * result lands in `data[into ?? name]` and triggers the `onSuccess`/`onError`
 * action lists. Routed through `proxyUrl` when provided.
 */

export interface UseRuntimeOptions {
  fetcher?: typeof fetch;
  /** Notified on every `setState`, so the host can persist the patch. */
  onState?: (path: string, value: unknown) => void;
  /** Route REST sources and callFunction calls through this proxy URL. */
  proxyUrl?: string;
}

export interface UseRuntimeResult {
  data: Record<string, unknown>;
  state: Record<string, unknown>;
  /** Per-source loading flags from `useDataSources`. */
  loading: Record<string, boolean>;
  /** Per-source error messages (null/undefined when ok). */
  errors: Record<string, string | null>;
  dispatch: (actions: Action[], eventPayload?: Record<string, unknown>) => void;
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

function readPath(obj: unknown, path: string): unknown {
  const keys = path.split(".").filter(Boolean);
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Substitute `{{<root>.X}}` tokens in any value tree using the `vars` map. */
function substituteTokens(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const whole = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(value);
    if (whole) {
      const path = whole[1]!.trim();
      const head = path.split(".")[0]!;
      if (head in vars) {
        const rest = path.slice(head.length).replace(/^\./, "");
        const root = vars[head];
        return rest === "" ? root : readPath(root, rest);
      }
      return value;
    }
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, raw: string) => {
      const path = raw.trim();
      const head = path.split(".")[0]!;
      if (!(head in vars)) return m;
      const rest = path.slice(head.length).replace(/^\./, "");
      const root = vars[head];
      const resolved = rest === "" ? root : readPath(root, rest);
      return resolved == null ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((v) => substituteTokens(v, vars));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteTokens(v, vars);
    return out;
  }
  return value;
}

/** Call an HTTP-backed function with optional proxy routing. */
async function fireHttpFunction(
  def: FunctionDef,
  resolvedArgs: unknown,
  opts: { fetcher: typeof fetch; proxyUrl?: string },
): Promise<unknown> {
  const argsVars = { args: resolvedArgs };
  const url = substituteTokens(def.url, argsVars) as string;
  const headers = def.headers
    ? (substituteTokens(def.headers, argsVars) as Record<string, string>)
    : undefined;
  const body =
    def.body !== undefined ? substituteTokens(def.body, argsVars) : undefined;

  if (opts.proxyUrl) {
    const res = await opts.fetcher(opts.proxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, method: def.method, headers, body }),
    });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    const wrapped = (await res.json()) as { ok?: boolean; status?: number; data?: unknown; error?: string };
    if (wrapped.ok === false) throw new Error(`Upstream ${wrapped.status ?? "?"}`);
    return def.select ? readPath(wrapped.data, def.select) : wrapped.data;
  }

  const init: RequestInit = { method: def.method };
  if (headers) init.headers = headers;
  if (body !== undefined && def.method !== "GET" && def.method !== "DELETE") {
    init.headers = { "content-type": "application/json", ...(headers ?? {}) };
    init.body = JSON.stringify(body);
  }
  const res = await opts.fetcher(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return def.select ? readPath(parsed, def.select) : parsed;
}

export function useRuntime(
  dashboard: Dashboard,
  opts: UseRuntimeOptions = {},
): UseRuntimeResult {
  const { fetcher, onState, proxyUrl } = opts;
  const doFetch = fetcher ?? fetch;
  const { data: sourceData, loading, errors, refetch } = useDataSources(dashboard, { fetcher, proxyUrl });

  const [state, setStateMap] = useState<Record<string, unknown>>(
    () => ({ ...(dashboard.state ?? {}) }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  // Function results live alongside data sources in the data map exposed to
  // bindings. Kept in a separate state so we don't fight useDataSources.
  const [functionResults, setFunctionResults] = useState<Record<string, unknown>>({});

  // Sync agent-driven state patches into the local reactive copy.
  const lastSpecStateRef = useRef(dashboard.state);
  useEffect(() => {
    if (dashboard.state !== lastSpecStateRef.current) {
      lastSpecStateRef.current = dashboard.state;
      setStateMap({ ...(dashboard.state ?? {}) });
    }
  }, [dashboard.state]);

  const setState = useCallback(
    (path: string, value: unknown) => {
      setStateMap((prev) => setPath(prev, path, value));
      onState?.(path, value);
    },
    [onState],
  );

  const functionsRef = useRef(dashboard.functions);
  functionsRef.current = dashboard.functions;

  // Forward-declare dispatch so callFunction can dispatch follow-ups.
  const dispatchRef = useRef<((actions: Action[], payload?: Record<string, unknown>) => void) | null>(null);

  const callFunction = useCallback(
    (
      name: string,
      argsRaw: unknown,
      callbacks: { into?: string; onSuccess?: unknown[]; onError?: unknown[] },
      eventPayload?: Record<string, unknown>,
    ) => {
      const def = functionsRef.current?.[name];
      if (!def) {
        // eslint-disable-next-line no-console
        console.warn(`[autogen-ui] callFunction: unknown function "${name}"`);
        return;
      }

      // Resolve `args` against current state + event payload, then call.
      const resolvedArgs = substituteTokens(argsRaw, {
        state: stateRef.current,
        event: eventPayload ?? {},
      });

      const key = callbacks.into ?? name;
      void fireHttpFunction(def, resolvedArgs, { fetcher: doFetch, proxyUrl })
        .then((result) => {
          setFunctionResults((prev) => ({ ...prev, [key]: result }));
          if (callbacks.onSuccess && callbacks.onSuccess.length > 0) {
            dispatchRef.current?.(callbacks.onSuccess as Action[], { result });
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Function call failed";
          if (callbacks.onError && callbacks.onError.length > 0) {
            dispatchRef.current?.(callbacks.onError as Action[], { error: message });
          }
        });
    },
    [doFetch, proxyUrl],
  );

  const dispatch = useMemo(
    () =>
      createDispatcher({
        getState: () => stateRef.current,
        setState,
        refetch,
        callFunction,
      }),
    [setState, refetch, callFunction],
  );
  dispatchRef.current = dispatch;

  const data = useMemo(
    () => ({ ...sourceData, ...functionResults }),
    [sourceData, functionResults],
  );

  return { data, state, loading, errors, dispatch };
}
