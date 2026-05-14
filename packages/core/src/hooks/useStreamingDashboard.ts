"use client";

import { useCallback, useRef, useState } from "react";
import { applyPatch } from "../patch";
import { readFrames } from "../stream";
import { emptyDashboard, type ChatMessage, type Dashboard } from "../schema";

export interface UseStreamingDashboardOptions {
  /** POST endpoint backed by `createStreamingRouteHandler`. Defaults to "/api/autogen-ui/stream". */
  endpoint?: string;
  /** Starting dashboard. Defaults to an empty Grid. */
  initialDashboard?: Dashboard;
  /** Optional fetch override (auth headers, testing, ...). */
  fetcher?: typeof fetch;
}

export interface UseStreamingDashboardResult {
  dashboard: Dashboard;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  /** Send a user turn; applies streamed patches to the dashboard as they arrive. */
  sendMessage: (content: string) => Promise<void>;
  /** Replace the dashboard directly (e.g. load a saved spec). */
  setDashboard: (dashboard: Dashboard) => void;
  /** Clear chat history and reset to the initial dashboard. */
  reset: () => void;
}

/**
 * Streaming variant of `useDashboard`. Each `sendMessage` POSTs to the
 * streaming endpoint and consumes NDJSON frames: every `patch` frame is
 * applied immediately so the dashboard assembles itself live, and `message`
 * deltas accumulate into the assistant reply as they stream in.
 */
export function useStreamingDashboard(
  options: UseStreamingDashboardOptions = {},
): UseStreamingDashboardResult {
  const endpoint = options.endpoint ?? "/api/autogen-ui/stream";
  const doFetch = options.fetcher ?? fetch;
  const initial = useRef(options.initialDashboard ?? emptyDashboard());

  const [dashboard, setDashboard] = useState<Dashboard>(initial.current);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

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
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail?.error ?? `Request failed (${res.status})`);
        }

        let assistantContent = "";
        let assistantAdded = false;
        let streamError: string | null = null;

        for await (const frame of readFrames(res)) {
          if (frame.kind === "patch") {
            setDashboard((prev) => applyPatch(prev, frame.patch));
          } else if (frame.kind === "message") {
            assistantContent += frame.delta;
            if (!assistantAdded) {
              assistantAdded = true;
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: assistantContent },
              ]);
            } else {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { ...last, content: assistantContent };
                }
                return next;
              });
            }
          } else if (frame.kind === "error") {
            streamError = frame.error;
          }
          // "done" — nothing to do; the loop ends naturally.
        }

        if (streamError) throw new Error(streamError);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [dashboard, doFetch, endpoint, isLoading, messages],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setDashboard(initial.current);
    setError(null);
  }, []);

  return { dashboard, messages, isLoading, error, sendMessage, setDashboard, reset };
}
