/**
 * Server-side data proxy.
 *
 * `useDataSources` runs in the browser, which means REST sources are
 * subject to CORS, can't carry secret tokens, and expose the upstream URL
 * to the client bundle. Mount this handler at e.g. `/api/autogen-ui/proxy`
 * and pass that URL as `proxyUrl` to the hook (or to `fetchDataSource`).
 * The browser POSTs `{url, method, headers, body}`; this handler enforces
 * an allowlist, injects auth headers, and forwards the request server-side.
 *
 * SECURITY MODEL
 * --------------
 * The URL in the request body is untrusted (it originates from an
 * LLM-generated spec and/or the browser). Left unchecked, a data proxy is a
 * textbook SSRF primitive — an attacker points it at `http://169.254.169.254/`
 * (cloud metadata), `http://localhost:…`, or an internal service. This handler
 * therefore, by default:
 *   - rejects any non-http(s) scheme;
 *   - rejects private, loopback, and link-local hosts (opt out with
 *     `allowPrivateHosts: true` for trusted internal deployments);
 *   - re-validates every redirect hop against the same rules (an allowed public
 *     host that 302s to `169.254.169.254` does NOT bypass the guard);
 *   - forwards only a safe subset of client-supplied headers unless
 *     `forwardClientHeaders` is enabled.
 * An explicit `allow` list remains the strongest control and is recommended
 * for production. Note: hostname-based blocking is defense-in-depth, not a
 * substitute for network egress controls — a hostname that resolves to a
 * private IP via DNS is only caught if it matches a private pattern textually.
 */

export interface DataProxyOptions {
  /**
   * Hosts the proxy is willing to call. Each entry is either a URL prefix
   * (matched with `startsWith`) or a `RegExp` against the rewritten URL.
   * When omitted, any *public* http(s) URL is allowed (private/loopback/
   * link-local hosts are still blocked unless `allowPrivateHosts` is set).
   * Providing an allowlist is strongly recommended in production.
   */
  allow?: (string | RegExp)[];
  /**
   * Allow private/loopback/link-local hosts (e.g. `localhost`, `10.x`,
   * `169.254.x`). Default `false`. Only enable for trusted internal-only
   * deployments where SSRF to internal services is an accepted risk.
   */
  allowPrivateHosts?: boolean;
  /**
   * Forward ALL client-provided headers (minus a small denylist of dangerous
   * ones) to the upstream. Default `false` — only a safe subset (`accept`,
   * `accept-language`, `content-type`) plus server-injected headers are sent,
   * which prevents the browser from injecting arbitrary upstream headers.
   */
  forwardClientHeaders?: boolean;
  /**
   * Inject headers per incoming request — useful for adding a server-only
   * upstream Bearer token. Merged OVER the client-provided headers, so the
   * client cannot override server-injected entries with the same key.
   */
  headers?: (
    incoming: Request,
  ) => Record<string, string> | Promise<Record<string, string>>;
  /** Optional URL rewrite hook (e.g. map `/api/internal/x` → upstream). */
  rewrite?: (url: string) => string;
  /** Request timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Maximum redirect hops to follow (each re-validated). Default 3. */
  maxRedirects?: number;
}

interface ProxyBody {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
}

/** Client headers that are always safe to forward. */
const SAFE_CLIENT_HEADERS = new Set(["accept", "accept-language", "content-type"]);
/** Client headers that are never forwarded even with `forwardClientHeaders`. */
const DENIED_CLIENT_HEADERS = new Set([
  "host",
  "cookie",
  "authorization",
  "proxy-authorization",
  "content-length",
  "connection",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-real-ip",
  "forwarded",
]);

function isAllowed(url: string, allow: DataProxyOptions["allow"]): boolean {
  if (!allow || allow.length === 0) return true;
  return allow.some((pat) => (typeof pat === "string" ? url.startsWith(pat) : pat.test(url)));
}

/**
 * Detect private, loopback, and link-local hosts by pattern. Covers the
 * common SSRF targets: localhost, IPv4 RFC-1918 + loopback + link-local +
 * CGNAT, and IPv6 loopback/ULA/link-local. Defense-in-depth, not a DNS check.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  // IPv6 loopback / unspecified
  if (host === "::1" || host === "::") return true;
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return true;
  // IPv4-mapped IPv6 (e.g. ::ffff:169.254.169.254) — fall through to the v4 test
  const v4mapped = host.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  const v4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : v4mapped?.[1];
  if (v4) {
    const parts = v4.split(".").map(Number);
    if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
      const [a, b] = parts as [number, number, number, number];
      if (a === 127 || a === 10 || a === 0) return true; // loopback, private, this-host
      if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
      if (a === 172 && b >= 16 && b <= 31) return true; // private
      if (a === 192 && b === 168) return true; // private
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    }
  }
  return false;
}

/**
 * Validate a URL against the SSRF policy. Returns an error string, or null if
 * the URL is permitted.
 */
function validateUrl(raw: string, opts: DataProxyOptions): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return `Invalid URL: ${raw}`;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `Blocked scheme: ${parsed.protocol}`;
  }
  if (!opts.allowPrivateHosts && isPrivateHost(parsed.hostname)) {
    return `Blocked private/loopback host: ${parsed.hostname}`;
  }
  if (!isAllowed(raw, opts.allow)) {
    return `URL not allowed: ${raw}`;
  }
  return null;
}

/**
 * Build a framework-agnostic POST handler (Web Request -> Web Response).
 * Works directly as a Next.js App Router route export.
 */
export function createDataProxyHandler(opts: DataProxyOptions = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxRedirects = opts.maxRedirects ?? 3;

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

    const startUrl = opts.rewrite ? opts.rewrite(body.url) : body.url;
    const validationError = validateUrl(startUrl, opts);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 403 });
    }

    const injected = opts.headers ? await opts.headers(request) : {};
    // Build the client-header subset. By default only a safe allowlist passes;
    // with forwardClientHeaders, everything except a hard denylist passes.
    const clientHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.headers ?? {})) {
      const key = k.toLowerCase();
      if (DENIED_CLIENT_HEADERS.has(key)) continue;
      if (opts.forwardClientHeaders || SAFE_CLIENT_HEADERS.has(key)) {
        clientHeaders[k] = v;
      }
    }
    // Server-injected headers win over client-provided ones (security: the
    // browser cannot strip or overwrite an auth header the server set).
    const headers: Record<string, string> = { ...clientHeaders, ...injected };

    const method = body.method === "POST" ? "POST" : "GET";
    const init: RequestInit = { method, headers, redirect: "manual" };
    if (method === "POST" && body.body !== undefined) {
      init.headers = { "content-type": "application/json", ...headers };
      init.body = JSON.stringify(body.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    init.signal = controller.signal;

    try {
      // Follow redirects manually so every hop is re-validated against the
      // SSRF policy. An allowed public host that 302s to a private/metadata
      // address is rejected instead of silently followed.
      let currentUrl = startUrl;
      let upstream: Response | null = null;
      for (let hop = 0; hop <= maxRedirects; hop++) {
        upstream = await fetch(currentUrl, init);
        const status = upstream.status;
        const isRedirect = status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
        if (!isRedirect) break;
        const location = upstream.headers.get("location");
        if (!location) break;
        if (hop === maxRedirects) {
          return Response.json(
            { ok: false, error: `Too many redirects (>${maxRedirects})` },
            { status: 502 },
          );
        }
        const nextUrl = new URL(location, currentUrl).toString();
        const hopError = validateUrl(nextUrl, opts);
        if (hopError) {
          return Response.json(
            { ok: false, error: `Blocked redirect: ${hopError}` },
            { status: 403 },
          );
        }
        currentUrl = nextUrl;
        // A 303 (and commonly 301/302) downgrades to GET without a body.
        if (status === 303) {
          init.method = "GET";
          delete (init as { body?: unknown }).body;
        }
      }

      if (!upstream) {
        return Response.json({ ok: false, error: "No upstream response" }, { status: 502 });
      }
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
