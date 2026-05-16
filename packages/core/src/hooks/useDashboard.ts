"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyPatches } from "../patch";
import {
  agentResponseSchema,
  emptyDashboard,
  type ChatMessage,
  type Dashboard,
} from "../schema";

export interface UseDashboardOptions {
  /** POST endpoint backed by `createRouteHandler`. Defaults to "/api/autogen-ui". */
  endpoint?: string;
  /** Starting dashboard. Defaults to an empty Grid. */
  initialDashboard?: Dashboard;
  /** Optional fetch override (auth headers, testing, ...). */
  fetcher?: typeof fetch;
}

export interface UseDashboardResult {
  dashboard: Dashboard;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  /** Send a user turn; applies the returned patches to the dashboard. */
  sendMessage: (content: string) => Promise<void>;
  /** Abort an in-flight request, if any. */
  cancel: () => void;
  /** Replace the dashboard directly (e.g. load a saved spec). */
  setDashboard: (dashboard: Dashboard) => void;
  /** Clear chat history and reset to the initial dashboard. */
  reset: () => void;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * The chat-to-UI loop, as a hook. Each `sendMessage` round-trips through the
 * agent endpoint and applies the returned patches so the UI edits itself.
 * A new send aborts an in-flight previous send, and the hook aborts on
 * unmount so we never apply a stale response.
 */
export function useDashboard(options: UseDashboardOptions = {}): UseDashboardResult {
  const endpoint = options.endpoint ?? "/api/autogen-ui";
  const doFetch = options.fetcher ?? fetch;
  const initial = useRef(options.initialDashboard ?? emptyDashboard());

  const [dashboard, setDashboard] = useState<Dashboard>(initial.current);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsLoading(true);
      setError(null);

      try {
        const res = await doFetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: nextMessages, dashboard }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail?.error ?? `Request failed (${res.status})`);
        }

        const parsed = agentResponseSchema.parse(await res.json());
        if (controller.signal.aborted) return;

        setDashboard((prev) => applyPatches(prev, parsed.patches));
        if (parsed.message) {
          setMessages((prev) => [...prev, { role: "assistant", content: parsed.message! }]);
        }
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsLoading(false);
      }
    },
    [dashboard, doFetch, endpoint, messages],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setDashboard(initial.current);
    setError(null);
  }, []);

  return {
    dashboard,
    messages,
    isLoading,
    error,
    sendMessage,
    cancel,
    setDashboard,
    reset,
  };
}
