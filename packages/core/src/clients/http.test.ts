import { afterEach, describe, expect, it, vi } from "vitest";
import { LLMAbortError, LLMHttpError, parseRetryAfter, resilientFetch } from "./http";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body = "{}", headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

const fastPolicy = { baseDelayMs: 1, maxDelayMs: 2, timeoutMs: 1000 };

describe("parseRetryAfter", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfter("2", 0)).toBe(2000);
  });
  it("parses an HTTP date relative to now", () => {
    const now = 1_000_000;
    const future = new Date(now + 5000).toUTCString();
    const ms = parseRetryAfter(future, now)!;
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });
  it("returns null for missing/garbage", () => {
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter("soon", 0)).toBeNull();
  });
});

describe("resilientFetch — retry behavior", () => {
  it("returns immediately on a 2xx", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(200)) as typeof fetch;
    const res = await resilientFetch("https://x/y", {}, "Test", fastPolicy);
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a 503 and then succeeds", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      return n < 3 ? jsonResponse(503, "busy") : jsonResponse(200, "ok");
    }) as typeof fetch;
    const res = await resilientFetch("https://x/y", {}, "Test", fastPolicy);
    expect(res.status).toBe(200);
    expect(n).toBe(3);
  });

  it("retries a 429 honoring a (small) Retry-After header", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      return n === 1 ? jsonResponse(429, "slow", { "retry-after": "0" }) : jsonResponse(200);
    }) as typeof fetch;
    const res = await resilientFetch("https://x/y", {}, "Test", fastPolicy);
    expect(res.status).toBe(200);
    expect(n).toBe(2);
  });

  it("throws a structured LLMHttpError after exhausting retries", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(500, "boom")) as typeof fetch;
    await expect(
      resilientFetch("https://x/y", {}, "Test", { ...fastPolicy, maxRetries: 2 }),
    ).rejects.toMatchObject({ name: "LLMHttpError", status: 500, attempts: 3 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a non-retryable 400", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(400, "bad request")) as typeof fetch;
    await expect(resilientFetch("https://x/y", {}, "Test", fastPolicy)).rejects.toBeInstanceOf(LLMHttpError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a transient network error then succeeds", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      if (n === 1) throw new TypeError("network down");
      return jsonResponse(200);
    }) as typeof fetch;
    const res = await resilientFetch("https://x/y", {}, "Test", fastPolicy);
    expect(res.status).toBe(200);
    expect(n).toBe(2);
  });

  it("aborts promptly and does not retry when the caller signal fires", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn(async () => {
      controller.abort(); // simulate cancel mid-flight
      return jsonResponse(503);
    }) as typeof fetch;
    await expect(
      resilientFetch("https://x/y", {}, "Test", fastPolicy, controller.signal),
    ).rejects.toBeInstanceOf(LLMAbortError);
  });

  it("fires onRetry with attempt + reason", async () => {
    const onRetry = vi.fn();
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      return n < 2 ? jsonResponse(502) : jsonResponse(200);
    }) as typeof fetch;
    await resilientFetch("https://x/y", {}, "Test", { ...fastPolicy, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]![0]).toMatchObject({ attempt: 1, status: 502 });
  });
});
