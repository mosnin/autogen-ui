"use client";

import { useCallback, useRef, useState } from "react";
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
  /** Replace the dashboard directly (e.g. load a saved spec). */
  setDashboard: (dashboard: Dashboard) => void;
  /** Clear chat history and reset to the initial dashboard. */
  reset: () => void;
}

/**
 * The chat-to-UI loop, as a hook. Holds the conversation and the live
 * dashboard spec; each `sendMessage` round-trips through the agent endpoint
 * and applies the returned patches so the rendered UI edits itself.
 */
export function useDashboard(options: UseDashboardOptions = {}): UseDashboardResult {
  const endpoint = options.endpoint ?? "/api/autogen-ui";
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

        const parsed = agentResponseSchema.parse(await res.json());
        setDashboard((prev) => applyPatches(prev, parsed.patches));
        if (parsed.message) {
          setMessages((prev) => [...prev, { role: "assistant", content: parsed.message! }]);
        }
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
