"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ComponentRegistry } from "./components/types";
import { defaultRegistry } from "./registry";
import type { Dashboard, UINode } from "./schema";
import { cn } from "./utils";

/* Static, literal class strings so Tailwind's scanner can see them. */
const SPAN_MAP: Record<number, string> = {
  1: "col-span-1 sm:col-span-1 lg:col-span-1",
  2: "col-span-1 sm:col-span-1 lg:col-span-2",
  3: "col-span-1 sm:col-span-2 lg:col-span-3",
  4: "col-span-1 sm:col-span-2 lg:col-span-4",
  5: "col-span-1 sm:col-span-3 lg:col-span-5",
  6: "col-span-1 sm:col-span-3 lg:col-span-6",
  7: "col-span-1 sm:col-span-3 lg:col-span-7",
  8: "col-span-1 sm:col-span-4 lg:col-span-8",
  9: "col-span-1 sm:col-span-4 lg:col-span-9",
  10: "col-span-1 sm:col-span-5 lg:col-span-10",
  11: "col-span-1 sm:col-span-6 lg:col-span-11",
  12: "col-span-1 sm:col-span-6 lg:col-span-12",
};

const DEFAULT_SPAN: Record<string, number> = {
  Stat: 3,
  Card: 4,
  Chart: 6,
  Table: 12,
  Section: 12,
  Divider: 12,
  Heading: 12,
  Text: 12,
  Grid: 12,
  Stack: 12,
};

function spanClass(node: UINode): string {
  const raw = node.props?.span;
  const span =
    typeof raw === "number" && raw >= 1 && raw <= 12
      ? Math.round(raw)
      : (DEFAULT_SPAN[node.type] ?? 4);
  return SPAN_MAP[span] ?? SPAN_MAP[4]!;
}

function UnknownNode({ type }: { type: string }) {
  return (
    <div className="rounded-lg border border-dashed border-rose-400/60 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-400">
      Unknown component: <code className="font-mono">{type}</code>
    </div>
  );
}

interface RenderNodeProps {
  node: UINode;
  registry: ComponentRegistry;
  isRoot?: boolean;
}

function RenderNode({ node, registry, isRoot }: RenderNodeProps) {
  const Comp = registry[node.type];

  const renderedChildren =
    node.children && node.children.length > 0 ? (
      <AnimatePresence mode="popLayout" initial={false}>
        {node.children.map((child) => (
          <RenderNode key={child.id} node={child} registry={registry} />
        ))}
      </AnimatePresence>
    ) : undefined;

  const content = Comp ? (
    <Comp node={node} {...(node.props ?? {})}>
      {renderedChildren}
    </Comp>
  ) : (
    <UnknownNode type={node.type} />
  );

  // The root is the surface itself, not a grid item — render it bare.
  if (isRoot) return content;

  return (
    <motion.div
      layout
      layoutId={node.id}
      className={cn(spanClass(node), "min-w-0")}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
    >
      {content}
    </motion.div>
  );
}

export interface DashboardRendererProps {
  dashboard: Dashboard;
  /** Defaults to the built-in registry; pass a merged registry for custom components. */
  registry?: ComponentRegistry;
  className?: string;
}

/**
 * Renders a Dashboard spec tree. Every node is wrapped in a Framer Motion
 * `layout` element keyed by its stable id, so when the model patches the
 * tree, nodes animate into their new positions instead of snapping.
 */
export function DashboardRenderer({
  dashboard,
  registry = defaultRegistry,
  className,
}: DashboardRendererProps) {
  return (
    <div className={cn("w-full", className)}>
      {dashboard.title && (
        <motion.h1
          layout
          className="mb-6 text-2xl font-bold tracking-tight text-foreground"
        >
          {dashboard.title}
        </motion.h1>
      )}
      <RenderNode node={dashboard.root} registry={registry} isRoot />
    </div>
  );
}
