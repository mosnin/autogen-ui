import { afterEach, describe, expect, it, vi } from "vitest";
import { createDataProxyHandler } from "./proxy";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function post(handler: (r: Request) => Promise<Response>, body: unknown): Promise<Response> {
  return handler(new Request("http://localhost/proxy", { method: "POST", body: JSON.stringify(body) }));
}

describe("data proxy — SSRF hardening", () => {
  it("blocks private / loopback / link-local / metadata hosts by default", async () => {
    const handler = createDataProxyHandler();
    const targets = [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:8080/",
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "http://192.168.0.1/",
      "http://172.16.0.1/",
      "http://[::1]/",
    ];
    for (const url of targets) {
      const res = await post(handler, { url });
      expect(res.status, url).toBe(403);
    }
  });

  it("blocks non-http(s) schemes", async () => {
    const handler = createDataProxyHandler();
    for (const url of ["file:///etc/passwd", "gopher://x/", "ftp://h/"]) {
      expect((await post(handler, { url })).status).toBe(403);
    }
  });

  it("enforces an explicit allowlist", async () => {
    const handler = createDataProxyHandler({ allow: ["https://api.example.com/"] });
    expect((await post(handler, { url: "https://evil.com/x" })).status).toBe(403);
  });

  it("allows public hosts through the default proxy", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: 1 }), { headers: { "content-type": "application/json" } }),
    ) as typeof fetch;
    const handler = createDataProxyHandler();
    const res = await post(handler, { url: "https://api.example.com/data" });
    expect(res.status).toBe(200);
  });

  it("re-validates redirects and blocks a hop to a metadata host", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "https://api.example.com/r") {
        return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
      }
      throw new Error("should not fetch the redirected private URL");
    }) as typeof fetch;
    const handler = createDataProxyHandler();
    const res = await post(handler, { url: "https://api.example.com/r" });
    expect(res.status).toBe(403);
  });

  it("strips dangerous client headers and only forwards a safe subset", async () => {
    let received: Record<string, string> = {};
    globalThis.fetch = vi.fn(async (_i: RequestInfo | URL, init?: RequestInit) => {
      received = {};
      const h = init?.headers as Record<string, string> | undefined;
      if (h) for (const [k, v] of Object.entries(h)) received[k.toLowerCase()] = v;
      return new Response("{}", { headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const handler = createDataProxyHandler({
      allow: ["https://api.example.com/"],
      headers: () => ({ authorization: "Bearer SERVER" }),
    });
    await post(handler, {
      url: "https://api.example.com/x",
      headers: { authorization: "Bearer CLIENT", "x-forwarded-for": "1.2.3.4", accept: "application/json" },
    });
    expect(received["authorization"]).toBe("Bearer SERVER"); // server wins, client dropped
    expect(received["x-forwarded-for"]).toBeUndefined(); // dangerous, stripped
    expect(received["accept"]).toBe("application/json"); // safe, forwarded
  });

  it("allowPrivateHosts opt-in permits internal targets", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })) as typeof fetch;
    const handler = createDataProxyHandler({ allowPrivateHosts: true, allow: ["http://10.0.0.5/"] });
    expect((await post(handler, { url: "http://10.0.0.5/internal" })).status).toBe(200);
  });

  it("rejects a malformed body", async () => {
    const handler = createDataProxyHandler();
    const res = await handler(new Request("http://localhost/proxy", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });
});
