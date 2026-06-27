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
  Metric: 6,
  Sparkline: 3,
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
  RingProgress: 3,
  CodeBlock: 12,
  Quote: 12,
  Kbd: 2,
  ForEach: 12,
  Outlet: 12,
};

/** Substitute the first `Outlet` node in `layout` with `screen`. */
function replaceOutlet(layout: UINode, screen: UINode): UINode {
  if (layout.type === "Outlet") return screen;
  if (!layout.children || layout.children.length === 0) return layout;
  let changed = false;
  const nextChildren = layout.children.map((child) => {
    const replaced = replaceOutlet(child, screen);
    if (replaced !== child) changed = true;
    return replaced;
  });
  return changed ? { ...layout, children: nextChildren } : layout;
}

/** Compute the col-span for a child node, considering parent layout preset. */
function resolveSpan(
  node: UINode,
  siblingIndex: number,
  _siblingCount: number,
  parentPreset?: string,
): number {
  // Explicit style.span or props.span always wins.
  const raw = node.style?.span ?? node.props?.span;
  if (typeof raw === "number" && raw >= 1 && raw <= 12) return Math.round(raw);

  // Apply archetype distribution if parent has a preset.
  if (parentPreset) {
    switch (parentPreset) {
      case "bento": {
        // First child is hero (8), second is sidebar (4), rest alternate: wide(8)/narrow(4)
        if (siblingIndex === 0) return 8;
        if (siblingIndex === 1) return 4;
        return siblingIndex % 2 === 0 ? 8 : 4;
      }
      case "split": {
        // Alternating 7/5 split — content + detail pane
        return siblingIndex % 2 === 0 ? 7 : 5;
      }
      case "thirds": {
        // Equal thirds
        return 4;
      }
      case "hero": {
        // First child is full-width hero, rest are 4-col cards
        return siblingIndex === 0 ? 12 : 4;
      }
      case "sidebar-detail": {
        // Narrow sidebar (3) + wide detail (9)
        return siblingIndex % 2 === 0 ? 3 : 9;
      }
      case "feed": {
        // Feed: all items full width for legibility
        return 12;
      }
      default:
        break;
    }
  }

  return DEFAULT_SPAN[node.type] ?? 4;
}

/** The grid-span wrapper class is structural and owned by the renderer. */
function spanClass(span: number): string {
  return SPAN_MAP[span] ?? SPAN_MAP[4]!;
}

function UnknownNode({ type }: { type: string }) {
  return (
    <div
      role="presentation"
      aria-hidden
      className="flex items-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/30 px-4 py-3"
      title={`Unknown component type: ${type}`}
    >
      <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3zm2 3h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2.5h4a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z"/>
      </svg>
      <span className="text-xs text-muted-foreground/50 font-mono">{type}</span>
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
  /** Layout preset of the parent node (e.g. "bento", "split"). */
  parentPreset?: string;
  /** Total number of siblings in parent (for context-aware distribution). */
  siblingCount?: number;
}

function RenderNode({
  node: rawNode,
  registry,
  ext,
  ctx,
  isRoot,
  siblingIndex = 0,
  parentPreset,
  siblingCount = 1,
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

  const childPreset =
    typeof node.props?.layoutPreset === "string" ? node.props.layoutPreset : undefined;
  const childCount = node.children?.length ?? 0;

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
            parentPreset={childPreset}
            siblingCount={childCount}
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

  // Choreograph entrances by visual weight: large structural nodes rise
  // slower and further; compact nodes (stats, badges) snap in quickly.
  const span = resolveSpan(node, siblingIndex, siblingCount, parentPreset);
  const isLarge = span >= 8;
  const isCompact = ["Badge", "Button", "Kbd", "Tooltip", "Switch", "Checkbox"].includes(node.type);
  const entranceDuration = isCompact ? 0.28 : isLarge ? ENTRANCE_DURATION * 1.1 : ENTRANCE_DURATION;
  const entranceY = isCompact ? 6 : isLarge ? 20 : 12;
  const entranceScale = isCompact ? 1 : isLarge ? 0.96 : 0.97;

  return (
    <motion.div
      layout
      layoutId={node.id}
      className={cn(
        spanClass(span),
        "min-w-0",
        compiledStyle.className,
      )}
      style={compiledStyle.style}
      initial={{ opacity: 0, y: entranceY, scale: entranceScale }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.18, ease: EASE_EXIT },
      }}
      transition={{
        duration: entranceDuration,
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
  /** Resolved data, live state, dispatch, per-source loading + error flags. */
  context?: Partial<
    Pick<RuntimeContext, "data" | "dispatch" | "state" | "loading" | "errors">
  >;
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
      errors: stableCtxIn?.errors ?? {},
      scope: {},
      dispatch: stableCtxIn?.dispatch ?? (() => {}),
    }),
    [dashboard, stableCtxIn],
  );

  // Routing: pick a screen if state.currentScreen names one, else the root.
  // Then, if a persistent `layout` is set, substitute the Outlet for the
  // chosen screen so navigation doesn't tear down the chrome.
  const activeRoot: UINode = useMemo(() => {
    const screenKey = ctx.state?.currentScreen;
    const screen =
      typeof screenKey === "string" && dashboard.screens?.[screenKey]
        ? dashboard.screens[screenKey]!
        : dashboard.root;
    if (dashboard.layout) {
      return replaceOutlet(dashboard.layout, screen);
    }
    return screen;
  }, [ctx.state?.currentScreen, dashboard.root, dashboard.screens, dashboard.layout]);

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
