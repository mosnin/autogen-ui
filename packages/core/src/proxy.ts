/**
 * Server-side data proxy.
 *
 * `useDataSources` runs in the browser, which means REST sources are
 * subject to CORS, can't carry secret tokens, and expose the upstream URL
 * to the client bundle. Mount this handler at e.g. `/api/autogen-ui/proxy`
 * and pass that URL as `proxyUrl` to the hook (or to `fetchDataSource`).
 * The browser POSTs `{url, method, headers, body}`; this handler enforces
 * an allowlist, injects auth headers, and forwards the request server-side.
 */

export interface DataProxyOptions {
  /**
   * Hosts the proxy is willing to call. Each entry is either a URL prefix
   * (matched with `startsWith`) or a `RegExp` against the rewritten URL.
   * When omitted, the proxy allows any URL — only do that in trusted contexts.
   */
  allow?: (string | RegExp)[];
  /**
   * Inject headers per incoming request — useful for adding a server-only
   * upstream Bearer token. Merged under the client-provided headers, so the
   * client cannot override server-injected entries with the same key.
   */
  headers?: (
    incoming: Request,
  ) => Record<string, string> | Promise<Record<string, string>>;
  /** Optional URL rewrite hook (e.g. map `/api/internal/x` → upstream). */
  rewrite?: (url: string) => string;
  /** Request timeout in ms. Default 15000. */
  timeoutMs?: number;
}

interface ProxyBody {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
}

function isAllowed(url: string, allow: DataProxyOptions["allow"]): boolean {
  if (!allow || allow.length === 0) return true;
  return allow.some((pat) => (typeof pat === "string" ? url.startsWith(pat) : pat.test(url)));
}

/**
 * Build a framework-agnostic POST handler (Web Request -> Web Response).
 * Works directly as a Next.js App Router route export.
 */
export function createDataProxyHandler(opts: DataProxyOptions = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;

  return async function POST(request: Request): Promise<Response> {
    let body: ProxyBody;
    try {
      body = (await request.json()) as ProxyBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body.url !== "string") {
      return Response.json({ error: "Missing `url`" }, { status: 400 });
    }

    const url = opts.rewrite ? opts.rewrite(body.url) : body.url;
    if (!isAllowed(url, opts.allow)) {
      return Response.json({ error: `URL not allowed: ${url}` }, { status: 403 });
    }

    const injected = opts.headers ? await opts.headers(request) : {};
    // Server-injected headers win over client-provided ones (security: the
    // browser cannot strip or overwrite an auth header the server set).
    const headers = { ...(body.headers ?? {}), ...injected };

    const method = body.method === "POST" ? "POST" : "GET";
    const init: RequestInit = { method, headers };
    if (method === "POST" && body.body !== undefined) {
      init.headers = { "content-type": "application/json", ...headers };
      init.body = JSON.stringify(body.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    init.signal = controller.signal;

    try {
      const upstream = await fetch(url, init);
      const text = await upstream.text();
      let data: unknown = text;
      try {
        data = text.length > 0 ? JSON.parse(text) : null;
      } catch {
        // not JSON — return as text
      }
      return Response.json({ ok: upstream.ok, status: upstream.status, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      const aborted = err instanceof Error && err.name === "AbortError";
      return Response.json(
        { ok: false, error: aborted ? `Upstream timed out after ${timeoutMs}ms` : message },
        { status: 502 },
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
