/**
 * Shared HTTP resilience for the LLM clients.
 *
 * The raw provider clients previously did a single bare `fetch` with no
 * timeout, no retry, and no rate-limit handling — a single provider hiccup
 * (a 429, a 503, a dropped connection) failed the user's turn outright. This
 * module centralizes:
 *   - a bounded timeout per attempt (AbortController),
 *   - honoring an external caller `AbortSignal` (cancel a turn cleanly),
 *   - retry with exponential backoff + jitter on transient failures,
 *   - `Retry-After` header handling for 429 / 503,
 *   - a structured `LLMHttpError` so callers can branch on status/retryability.
 *
 * Retries apply to establishing the response (including for streaming, where
 * only the initial connection is retried — never a partially-consumed stream).
 */

/** Structured error thrown when an LLM HTTP request ultimately fails. */
export class LLMHttpError extends Error {
  readonly provider: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly body: string;
  readonly attempts: number;
  constructor(args: {
    provider: string;
    status: number;
    retryable: boolean;
    body: string;
    attempts: number;
  }) {
    super(`[autogen-ui] ${args.provider} ${args.status}: ${args.body.slice(0, 500)}`);
    this.name = "LLMHttpError";
    this.provider = args.provider;
    this.status = args.status;
    this.retryable = args.retryable;
    this.body = args.body;
    this.attempts = args.attempts;
  }
}

/** Error thrown when a request is aborted by the caller's signal. */
export class LLMAbortError extends Error {
  constructor(provider: string) {
    super(`[autogen-ui] ${provider} request aborted`);
    this.name = "LLMAbortError";
  }
}

export interface RetryPolicy {
  /** Max retries after the first attempt. Default 2 (3 attempts total). */
  maxRetries?: number;
  /** Per-attempt timeout in ms. Default 60000. */
  timeoutMs?: number;
  /** Base backoff delay in ms. Default 500. */
  baseDelayMs?: number;
  /** Max backoff delay in ms (before Retry-After). Default 8000. */
  maxDelayMs?: number;
  /** HTTP statuses that trigger a retry. Default 408/409/425/429/500/502/503/504. */
  retryStatuses?: number[];
  /** Observability hook fired before each retry sleep. */
  onRetry?: (info: {
    attempt: number;
    status?: number;
    delayMs: number;
    reason: string;
  }) => void;
}

const DEFAULT_RETRY_STATUSES = [408, 409, 425, 429, 500, 502, 503, 504];

function isRetryableStatus(status: number, statuses: number[]): boolean {
  return statuses.includes(status);
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) to ms, or null. */
export function parseRetryAfter(header: string | null, nowMs: number): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) return Math.max(0, date - nowMs);
  return null;
}

/** Sleep that rejects promptly if the external signal aborts. */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMAbortError("client"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new LLMAbortError("client"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Full jitter exponential backoff. */
function backoffDelay(attempt: number, base: number, max: number): number {
  const ceil = Math.min(max, base * 2 ** attempt);
  return Math.round(Math.random() * ceil);
}

/**
 * Fetch with timeout + retry + Retry-After. On success returns the `Response`
 * (which may itself be a non-2xx that the caller treats as terminal only if it
 * is not a retryable status — but we retry retryable statuses internally and
 * return the last response's error via `LLMHttpError` when retries exhaust).
 */
export async function resilientFetch(
  url: string,
  init: RequestInit,
  provider: string,
  policy: RetryPolicy = {},
  externalSignal?: AbortSignal,
): Promise<Response> {
  const maxRetries = policy.maxRetries ?? 2;
  const timeoutMs = policy.timeoutMs ?? 60_000;
  const baseDelayMs = policy.baseDelayMs ?? 500;
  const maxDelayMs = policy.maxDelayMs ?? 8_000;
  const retryStatuses = policy.retryStatuses ?? DEFAULT_RETRY_STATUSES;

  let lastErrBody = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (externalSignal?.aborted) throw new LLMAbortError(provider);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const relayAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", relayAbort, { once: true });

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.ok) return res;

      // Non-2xx. Decide retry vs terminal.
      lastStatus = res.status;
      const retryable = isRetryableStatus(res.status, retryStatuses);
      if (!retryable || attempt === maxRetries) {
        lastErrBody = await res.text().catch(() => "");
        throw new LLMHttpError({
          provider,
          status: res.status,
          retryable,
          body: lastErrBody,
          attempts: attempt + 1,
        });
      }
      // Drain the body so the socket can be reused, capture for diagnostics.
      lastErrBody = await res.text().catch(() => "");
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"), Date.now());
      const delay = retryAfter ?? backoffDelay(attempt, baseDelayMs, maxDelayMs);
      policy.onRetry?.({
        attempt: attempt + 1,
        status: res.status,
        delayMs: delay,
        reason: `HTTP ${res.status}`,
      });
      await abortableSleep(delay, externalSignal);
      continue;
    } catch (err) {
      if (err instanceof LLMHttpError) throw err;
      if (err instanceof LLMAbortError) throw err;
      // Distinguish an external abort from our own timeout abort.
      if (externalSignal?.aborted) throw new LLMAbortError(provider);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const reason = timedOut ? `timeout after ${timeoutMs}ms` : (err instanceof Error ? err.message : "network error");
      if (attempt === maxRetries) {
        throw new LLMHttpError({
          provider,
          status: isAbort && timedOut ? 408 : 0,
          retryable: true,
          body: reason,
          attempts: attempt + 1,
        });
      }
      const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs);
      policy.onRetry?.({ attempt: attempt + 1, delayMs: delay, reason });
      await abortableSleep(delay, externalSignal);
      continue;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", relayAbort);
    }
  }

  // Unreachable in practice — the loop either returns or throws.
  throw new LLMHttpError({
    provider,
    status: lastStatus,
    retryable: false,
    body: lastErrBody || "retries exhausted",
    attempts: maxRetries + 1,
  });
}
