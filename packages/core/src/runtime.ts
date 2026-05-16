import type { CSSProperties } from "react";
import type { Action, Dashboard, EventMap, MotionSpec, StyleSpec, UINode } from "./schema";

/**
 * Shared runtime contracts. Phase implementations (style engine, component
 * instantiation, data binding, action dispatch) plug into the renderer
 * through these types without any of them importing each other.
 */

/** Everything a node needs to resolve and behave at render time. */
export interface RuntimeContext {
  dashboard: Dashboard;
  /** Resolved data keyed by data-source id (filled by the data layer). */
  data: Record<string, unknown>;
  /** Live reactive state (filters, toggles, form values). */
  state: Record<string, unknown>;
  /** Run a declarative action list (filled by the action layer). */
  dispatch: (actions: Action[], eventPayload?: Record<string, unknown>) => void;
}

export interface CompiledStyle {
  className?: string;
  style?: CSSProperties;
}

/**
 * Pluggable renderer extensions. Each is optional; the foundation ships
 * no-op defaults and the phase modules supply the real implementations,
 * which are wired in as `DashboardRenderer`'s defaults at integration.
 */
export interface RendererExtensions {
  /** Compile a StyleSpec into className + inline style (Phase 1). */
  compileStyle?: (style: StyleSpec, node: UINode) => CompiledStyle;
  /** Turn a MotionSpec into Framer Motion props (Phase 1 motion presets). */
  compileMotion?: (motion: MotionSpec) => Record<string, unknown>;
  /**
   * Transform a node before render — instantiate ComponentDefs (Phase 3),
   * resolve data bindings (Phase 4). Called repeatedly until the node is
   * stable (capped to avoid cycles).
   */
  resolveNode?: (node: UINode, ctx: RuntimeContext) => UINode;
  /** Turn an EventMap into DOM handler props (Phase 4). */
  compileEvents?: (events: EventMap, ctx: RuntimeContext) => Record<string, unknown>;
}

export const noopExtensions: Required<RendererExtensions> = {
  compileStyle: () => ({}),
  compileMotion: () => ({}),
  resolveNode: (node) => node,
  compileEvents: () => ({}),
};
