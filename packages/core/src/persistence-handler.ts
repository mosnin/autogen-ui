import {
  migrateDashboard,
  parseDashboard,
  type Dashboard,
} from "./schema";

/**
 * Server-side persistence — a framework-agnostic Web Request handler that
 * exposes a get/set/list contract for storing `Dashboard` JSON. Use it
 * behind any backend store (Postgres, KV, filesystem); the handler only
 * cares about the four async functions you provide.
 *
 *   GET    {endpoint}?id=...    → load
 *   POST   {endpoint}           → save (body: { id, dashboard })
 *   DELETE {endpoint}?id=...    → remove
 *   GET    {endpoint}?list=1    → list ids
 *
 * Wire from a Next.js route, Node http, Vite middleware — same shape.
 */

export interface PersistenceStore {
  get(id: string): Promise<Dashboard | null>;
  set(id: string, dashboard: Dashboard): Promise<void>;
  remove?(id: string): Promise<void>;
  list?(): Promise<string[]>;
}

export interface PersistenceHandlerOptions {
  store: PersistenceStore;
  /**
   * Optional authorization gate — return falsy to reject. Receives the
   * incoming request and the parsed op so consumers can scope by tenant.
   */
  authorize?: (
    request: Request,
    op: { kind: "get" | "set" | "remove" | "list"; id?: string },
  ) => boolean | Promise<boolean>;
  /** Max accepted body size in bytes. Default 256 KB. */
  maxBodyBytes?: number;
}

const DEFAULT_MAX = 256 * 1024;

export function createPersistenceHandler(opts: PersistenceHandlerOptions) {
  const max = opts.maxBodyBytes ?? DEFAULT_MAX;

  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "GET") {
      if (url.searchParams.has("list")) {
        if (!opts.store.list) {
          return Response.json({ error: "list not supported" }, { status: 501 });
        }
        if (opts.authorize && !(await opts.authorize(request, { kind: "list" }))) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        try {
          return Response.json({ ids: await opts.store.list() });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "list failed" },
            { status: 500 },
          );
        }
      }
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "missing ?id" }, { status: 400 });
      if (opts.authorize && !(await opts.authorize(request, { kind: "get", id }))) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      try {
        const dashboard = await opts.store.get(id);
        if (!dashboard) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json({ dashboard });
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "get failed" },
          { status: 500 },
        );
      }
    }

    if (method === "POST") {
      // Reject oversized bodies early.
      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > max) {
        return Response.json({ error: "payload too large" }, { status: 413 });
      }
      let payload: { id?: unknown; dashboard?: unknown };
      try {
        payload = (await request.json()) as { id?: unknown; dashboard?: unknown };
      } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      if (typeof payload.id !== "string" || payload.id.length === 0) {
        return Response.json({ error: "missing id" }, { status: 400 });
      }
      if (opts.authorize && !(await opts.authorize(request, { kind: "set", id: payload.id }))) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      let dashboard: Dashboard;
      try {
        // Accept any prior-version JSON; migrate forward before storing.
        dashboard = migrateDashboard(payload.dashboard);
      } catch (err) {
        try {
          dashboard = parseDashboard(payload.dashboard);
        } catch {
          return Response.json(
            {
              error: err instanceof Error ? err.message : "invalid dashboard",
            },
            { status: 422 },
          );
        }
      }
      try {
        await opts.store.set(payload.id, dashboard);
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "set failed" },
          { status: 500 },
        );
      }
    }

    if (method === "DELETE") {
      if (!opts.store.remove) {
        return Response.json({ error: "remove not supported" }, { status: 501 });
      }
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "missing ?id" }, { status: 400 });
      if (opts.authorize && !(await opts.authorize(request, { kind: "remove", id }))) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      try {
        await opts.store.remove(id);
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "remove failed" },
          { status: 500 },
        );
      }
    }

    return Response.json({ error: "method not allowed" }, { status: 405 });
  };
}

/** In-memory store — useful for tests and quick demos. */
export function createMemoryStore(initial: Record<string, Dashboard> = {}): PersistenceStore {
  const map = new Map<string, Dashboard>(Object.entries(initial));
  return {
    async get(id) {
      return map.get(id) ?? null;
    },
    async set(id, d) {
      map.set(id, d);
    },
    async remove(id) {
      map.delete(id);
    },
    async list() {
      return Array.from(map.keys());
    },
  };
}
