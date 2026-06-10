import type { Dashboard, UINode } from "./schema";

/**
 * Server-side dashboard helpers. Pure functions — safe in Server Components,
 * Edge runtimes, and `app/api` routes. The actual React render still uses
 * `<DashboardRenderer>` on the client because of motion + ctx — but these
 * helpers let the host **server-render a placeholder structure** and ship
 * the resolved spec to the client, eliminating any cold-start flicker.
 */

/** Same shape as `<DashboardRenderer dashboard={...}>` would receive. */
export interface ServerSpec {
  dashboard: Dashboard;
  /** A flat list of top-level node ids in render order — useful for placeholders. */
  topLevelIds: string[];
  /** Approximate row count once rendered — useful for layout reservations. */
  estimatedHeight: number;
}

/** Walk root + children counting nodes; rough heuristic for SSR height reserve. */
function estimateHeight(node: UINode | undefined): number {
  if (!node) return 0;
  const own =
    node.type === "Stat"
      ? 108
      : node.type === "Chart"
        ? 220
        : node.type === "Card"
          ? 160
          : node.type === "Table"
            ? 240
            : 80;
  const children =
    node.children?.reduce((acc, c) => acc + estimateHeight(c), 0) ?? 0;
  return own + children * 0.4;
}

/**
 * Prepare a dashboard for SSR + client hydration. Pass the result to a
 * client component that consumes `useStreamingDashboard({ initialDashboard })`.
 *
 *   // Server Component
 *   const initial = await loadSavedDashboard(userId);
 *   const spec = prepareServerSpec(initial ?? emptyDashboard());
 *   return <DashboardClient initialDashboard={spec.dashboard} />;
 */
export function prepareServerSpec(dashboard: Dashboard): ServerSpec {
  const root = dashboard.root;
  const topLevelIds = (root.children ?? []).map((c) => c.id);
  return {
    dashboard,
    topLevelIds,
    estimatedHeight: estimateHeight(root),
  };
}

/**
 * Tiny SSR fallback: returns an HTML string with a sized placeholder
 * div per top-level node. Use in `dangerouslySetInnerHTML` next to the
 * client renderer so the first paint reserves the right amount of space
 * (no layout shift) and shows skeleton blocks before hydration.
 *
 *   <div dangerouslySetInnerHTML={{ __html: renderDashboardPlaceholder(d) }} />
 *   <DashboardRenderer dashboard={d} ... />
 */
export function renderDashboardPlaceholder(dashboard: Dashboard): string {
  const blocks = (dashboard.root.children ?? [])
    .map((node) => {
      const h = Math.round(estimateHeight(node));
      const span = typeof node.style?.span === "number" ? node.style.span : 4;
      const widthPct = Math.round((span / 12) * 100);
      return `<div data-id="${node.id}" style="width:${widthPct}%;height:${h}px;background:hsl(var(--muted));border-radius:var(--radius);opacity:0.5"></div>`;
    })
    .join("");
  return `<div style="display:flex;flex-wrap:wrap;gap:1.5rem">${blocks}</div>`;
}
