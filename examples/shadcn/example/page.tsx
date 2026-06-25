"use client";

/**
 * Reference client wiring. Copy into e.g. `app/page.tsx` of your shadcn app.
 *
 * The only autogen-ui-specific line is `registry={createShadcnRegistry()}` —
 * that's what swaps the framework's built-in look for shadcn/ui + lucide.
 */

import {
  DashboardRenderer,
  useRuntime,
  useStreamingDashboard,
} from "@autogen-ui/core";
import { createShadcnRegistry } from "@/autogen-shadcn";

const registry = createShadcnRegistry();

const PROMPTS = [
  "Build a SaaS revenue dashboard with MRR, churn rate, active users and a revenue-over-time chart",
  "Build an admin app with a sidebar (Home, Analytics, Settings) using a persistent layout, with a lucide icon next to each nav item",
  "Build a contact form with a validated email field, a message textarea and a subscribe switch",
];

export default function Page() {
  const { dashboard, sendMessage, isLoading } = useStreamingDashboard();
  const { data, state, dispatch } = useRuntime(dashboard);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            disabled={isLoading}
            onClick={() => void sendMessage(p)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {p.slice(0, 32)}…
          </button>
        ))}
      </div>

      <DashboardRenderer
        dashboard={dashboard}
        registry={registry}
        context={{ data, state, dispatch }}
      />
    </main>
  );
}
