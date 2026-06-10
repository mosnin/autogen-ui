"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { EASE_EXIT, EASE_OUT, ENTRANCE_DURATION, STAGGER_MS } from "./_easing";
import { useShallowMemo } from "./_shallow";
import { NodeErrorBoundary } from "./components/error-boundary";
import type { ComponentRegistry } from "./components/types";
import { evaluateBinding } from "./data";
import { defaultExtensions } from "./extensions";
import { defaultRegistry } from "./registry";
import {
  noopExtensions,
  withScope,
  type RendererExtensions,
  type RuntimeContext,
} from "./runtime";
import { RuntimeReactContext, useRuntimeContext } from "./runtime-context";
import type { Dashboard, UINode } from "./schema";
import { cn } from "./utils";

export { useRuntimeContext };
export { NodeErrorBoundary } from "./components/error-boundary";

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
  Box: 12,
  Input: 6,
  Textarea: 12,
  Select: 6,
  Checkbox: 6,
  Switch: 6,
  Form: 12,
  Tabs: 12,
  Accordion: 12,
  Link: 4,
  Breadcrumb: 12,
  Modal: 12,
  Tooltip: 3,
  Avatar: 2,
  Skeleton: 6,
  CodeBlock: 12,
  Quote: 12,
  Kbd: 2,
  ForEach: 12,
};

/** The grid-span wrapper class is structural and owned by the renderer. */
function spanClass(node: UINode): string {
  const raw = node.style?.span ?? node.props?.span;
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

const MAX_RESOLVE_PASSES = 12;

/** Run `resolveNode` until the node stabilises (component instantiation, bindings). */
function resolve(node: UINode, ext: Required<RendererExtensions>, ctx: RuntimeContext): UINode {
  let current = node;
  for (let i = 0; i < MAX_RESOLVE_PASSES; i++) {
    const next = ext.resolveNode(current, ctx);
    if (next === current) break;
    current = next;
  }
  return current;
}

interface RenderNodeProps {
  node: UINode;
  registry: ComponentRegistry;
  ext: Required<RendererExtensions>;
  ctx: RuntimeContext;
  isRoot?: boolean;
  /** Sibling index within the parent, used for stagger. */
  siblingIndex?: number;
}

function RenderNode({
  node: rawNode,
  registry,
  ext,
  ctx,
  isRoot,
  siblingIndex = 0,
}: RenderNodeProps) {
  // Iteration scope: ForEach expansion writes `_scope` into the cloned
  // child's props; push it into ctx before binding resolution + render.
  const scopeProp = rawNode.props?._scope;
  const scopedCtx =
    scopeProp && typeof scopeProp === "object" && !Array.isArray(scopeProp)
      ? withScope(ctx, scopeProp as Record<string, unknown>)
      : ctx;

  const node = resolve(rawNode, ext, scopedCtx);

  // `when` gate — evaluate against the same scope. Falsy → render nothing.
  if (node.when !== undefined && node.when !== "") {
    const visible = evaluateBinding(node.when, scopedCtx);
    if (!visible) return null;
  }

  const Comp = registry[node.type];

  const renderedChildren =
    node.children && node.children.length > 0 ? (
      <AnimatePresence mode="popLayout" initial={false}>
        {node.children.map((child, i) => (
          <RenderNode
            key={child.id}
            node={child}
            registry={registry}
            ext={ext}
            ctx={scopedCtx}
            siblingIndex={i}
          />
        ))}
      </AnimatePresence>
    ) : undefined;

  const inner = Comp ? (
    <Comp node={node} {...(node.props ?? {})}>
      {renderedChildren}
    </Comp>
  ) : (
    <UnknownNode type={node.type} />
  );
  const content = <NodeErrorBoundary nodeId={node.id}>{inner}</NodeErrorBoundary>;

  if (isRoot) return content;

  const compiledStyle = node.style ? ext.compileStyle(node.style, node) : {};
  const compiledMotion = node.motion ? ext.compileMotion(node.motion) : {};
  const handlers = node.events ? ext.compileEvents(node.events, scopedCtx) : {};

  return (
    <motion.div
      layout
      layoutId={node.id}
      className={cn(spanClass(node), "min-w-0", compiledStyle.className)}
      style={compiledStyle.style}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.18, ease: EASE_EXIT },
      }}
      transition={{
        duration: ENTRANCE_DURATION,
        ease: EASE_OUT,
        delay: (siblingIndex * STAGGER_MS) / 1000,
        layout: { duration: 0.32, ease: EASE_OUT },
      }}
      {...compiledMotion}
      {...handlers}
    >
      {content}
    </motion.div>
  );
}

export interface DashboardRendererProps {
  dashboard: Dashboard;
  /** Defaults to the built-in registry; pass a merged registry for custom components. */
  registry?: ComponentRegistry;
  /** Pluggable runtime extensions; merged over the wired-in defaults. */
  extensions?: RendererExtensions;
  /**
   * Replace (rather than extend) the default extensions entirely. When
   * omitted, `extensions` is layered over `defaultExtensions`.
   */
  baseExtensions?: RendererExtensions;
  /** Resolved data, live state, dispatch, and per-source loading flags. */
  context?: Partial<Pick<RuntimeContext, "data" | "dispatch" | "state" | "loading">>;
  className?: string;
}

/**
 * Renders a Dashboard spec tree. Every node is a Framer Motion `layout`
 * element keyed by its stable id, so patches animate into place. Styling,
 * motion, component instantiation, data binding and events are all handled
 * through pluggable `extensions`.
 */
export function DashboardRenderer({
  dashboard,
  registry = defaultRegistry,
  extensions,
  baseExtensions = defaultExtensions,
  context,
  className,
}: DashboardRendererProps) {
  // Stabilise inline-literal props (`extensions={{}}`, `context={{...}}`) by
  // collapsing shallow-equal values to a single reference. Without this, an
  // inline-literal from the parent busts the `useMemo`s below every render
  // and forces a new merged `ext`/`ctx` object on every pass.
  const stableBase = useShallowMemo(baseExtensions);
  const stableExt = useShallowMemo(extensions);
  const stableCtxIn = useShallowMemo(context);

  const ext = useMemo<Required<RendererExtensions>>(
    () => ({ ...noopExtensions, ...stableBase, ...stableExt }),
    [stableBase, stableExt],
  );

  const ctx = useMemo<RuntimeContext>(
    () => ({
      dashboard,
      data: stableCtxIn?.data ?? {},
      state: stableCtxIn?.state ?? dashboard.state ?? {},
      loading: stableCtxIn?.loading ?? {},
      scope: {},
      dispatch: stableCtxIn?.dispatch ?? (() => {}),
    }),
    [dashboard, stableCtxIn],
  );

  // Routing: pick a screen if state.currentScreen names one, else the root.
  const activeRoot: UINode = useMemo(() => {
    const screenKey = ctx.state?.currentScreen;
    if (typeof screenKey === "string" && dashboard.screens?.[screenKey]) {
      return dashboard.screens[screenKey]!;
    }
    return dashboard.root;
  }, [ctx.state?.currentScreen, dashboard.root, dashboard.screens]);

  return (
    <RuntimeReactContext.Provider value={ctx}>
      <div className={cn("w-full", className)}>
        {dashboard.title && (
          <motion.h1 layout className="mb-6 text-2xl font-bold tracking-tight text-foreground">
            {dashboard.title}
          </motion.h1>
        )}
        <RenderNode node={activeRoot} registry={registry} ext={ext} ctx={ctx} isRoot />
      </div>
    </RuntimeReactContext.Provider>
  );
}
