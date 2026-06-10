import { z } from "zod";

/**
 * The shared contract for autogen-ui.
 *
 * Everything the agent can do is expressed as data in this file: the spec
 * tree, styling, motion, data binding, events, reusable component
 * definitions, and the patch operations that mutate them. Runtime behaviour
 * (compiling styles, resolving bindings, instantiating components, streaming)
 * is implemented elsewhere, but it all speaks this vocabulary.
 */

/* ------------------------------------------------------------------ *
 * Primitive JSON value
 * ------------------------------------------------------------------ */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

/* ------------------------------------------------------------------ *
 * StyleSpec — a constrained, token-based styling vocabulary.
 * Compiled to Tailwind classes by the style engine (Phase 1). Every
 * field is optional; `sm`/`md`/`lg` carry responsive overrides and
 * `hover`/`focus` carry interaction states.
 * ------------------------------------------------------------------ */

const spacingToken = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
  z.literal(16),
]);

const colorToken = z.enum([
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "transparent",
]);

const styleCoreSchema = z.object({
  // layout
  display: z.enum(["block", "flex", "grid", "inline-flex", "hidden"]).optional(),
  direction: z.enum(["row", "col"]).optional(),
  align: z.enum(["start", "center", "end", "stretch", "baseline"]).optional(),
  justify: z.enum(["start", "center", "end", "between", "around", "evenly"]).optional(),
  wrap: z.boolean().optional(),
  gap: spacingToken.optional(),
  gridCols: z.number().int().min(1).max(12).optional(),
  span: z.number().int().min(1).max(12).optional(),

  // sizing
  width: z.enum(["auto", "full", "fit", "screen", "min", "max"]).optional(),
  height: z.enum(["auto", "full", "fit", "screen"]).optional(),
  grow: z.boolean().optional(),

  // spacing
  p: spacingToken.optional(),
  px: spacingToken.optional(),
  py: spacingToken.optional(),
  pt: spacingToken.optional(),
  pb: spacingToken.optional(),
  m: spacingToken.optional(),
  mx: spacingToken.optional(),
  my: spacingToken.optional(),

  // visual
  bg: colorToken.optional(),
  color: colorToken.optional(),
  borderColor: colorToken.optional(),
  borderWidth: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  rounded: z.enum(["none", "sm", "md", "lg", "xl", "2xl", "full"]).optional(),
  shadow: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
  opacity: z.number().min(0).max(100).optional(),

  // typography
  fontSize: z.enum(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"]).optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  italic: z.boolean().optional(),
  truncate: z.boolean().optional(),
});

export type StyleCore = z.infer<typeof styleCoreSchema>;

export const styleSpecSchema = styleCoreSchema.extend({
  sm: styleCoreSchema.optional(),
  md: styleCoreSchema.optional(),
  lg: styleCoreSchema.optional(),
  hover: styleCoreSchema.optional(),
  focus: styleCoreSchema.optional(),
  /** Escape hatch: raw Tailwind classes, appended last. Use sparingly. */
  className: z.string().optional(),
});
export type StyleSpec = z.infer<typeof styleSpecSchema>;

/* ------------------------------------------------------------------ *
 * MotionSpec — Framer Motion props the agent can attach per node.
 * Loosely typed on purpose; the renderer forwards it to <motion.*>.
 * ------------------------------------------------------------------ */

export const motionSpecSchema = z
  .object({
    initial: jsonValueSchema.optional(),
    animate: jsonValueSchema.optional(),
    exit: jsonValueSchema.optional(),
    whileHover: jsonValueSchema.optional(),
    whileTap: jsonValueSchema.optional(),
    transition: jsonValueSchema.optional(),
    /** Named preset implemented by the motion layer, e.g. "fade", "rise", "pop". */
    preset: z.string().optional(),
  })
  .partial();
export type MotionSpec = z.infer<typeof motionSpecSchema>;

/* ------------------------------------------------------------------ *
 * Actions — declarative, allowlisted behaviour. No arbitrary code.
 * ------------------------------------------------------------------ */

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setState"), path: z.string(), value: jsonValueSchema }),
  z.object({ type: z.literal("toggleState"), path: z.string() }),
  z.object({ type: z.literal("refetch"), sourceId: z.string() }),
  z.object({ type: z.literal("openUrl"), url: z.string(), newTab: z.boolean().optional() }),
  z.object({ type: z.literal("scrollTo"), nodeId: z.string() }),
  z.object({ type: z.literal("emitEvent"), name: z.string(), payload: jsonValueSchema.optional() }),
  /** Navigate to a screen key (sets state.currentScreen). */
  z.object({ type: z.literal("navigate"), to: z.string() }),
]);
export type Action = z.infer<typeof actionSchema>;

/** Event name -> ordered actions. Event names: onClick, onChange, onSubmit, onLoad. */
export const eventMapSchema = z.record(z.array(actionSchema));
export type EventMap = z.infer<typeof eventMapSchema>;

/* ------------------------------------------------------------------ *
 * UINode — one node in the spec tree.
 * ------------------------------------------------------------------ */

export interface UINode {
  id: string;
  type: string;
  props?: Record<string, JsonValue>;
  /** Per-prop data-binding expressions, e.g. { value: "{{sales.total}}" }. */
  bindings?: Record<string, string>;
  style?: StyleSpec;
  motion?: MotionSpec;
  events?: EventMap;
  children?: UINode[];
  /**
   * Optional binding expression. When set, the renderer evaluates it against
   * the runtime context; falsy values cause the node (and its subtree) to be
   * skipped. E.g. `"{{state.detailsOpen}}"` or `"{{data.user.role}}"`.
   */
  when?: string;
}

export const uiNodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: z.record(jsonValueSchema).optional(),
    bindings: z.record(z.string()).optional(),
    style: styleSpecSchema.optional(),
    motion: motionSpecSchema.optional(),
    events: eventMapSchema.optional(),
    children: z.array(uiNodeSchema).optional(),
    when: z.string().optional(),
  }),
);

/* ------------------------------------------------------------------ *
 * ComponentDef — a reusable component the agent defines at runtime.
 * It is a parameterized UINode template; `{{paramName}}` placeholders
 * inside string props/text are substituted at instantiation.
 * ------------------------------------------------------------------ */

export const componentParamSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "json"]).default("string"),
  default: jsonValueSchema.optional(),
  description: z.string().optional(),
});
export type ComponentParam = z.infer<typeof componentParamSchema>;

export const componentDefSchema = z.object({
  /** PascalCase name; becomes a usable node `type`. */
  name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/),
  description: z.string().optional(),
  params: z.array(componentParamSchema).default([]),
  /** The template tree. May reference other defined components. */
  template: uiNodeSchema,
});
export type ComponentDef = z.infer<typeof componentDefSchema>;

/* ------------------------------------------------------------------ *
 * DataSource — where dynamic data comes from.
 * ------------------------------------------------------------------ */

export const dataSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("static"),
    id: z.string().min(1),
    data: jsonValueSchema,
  }),
  z.object({
    kind: z.literal("rest"),
    id: z.string().min(1),
    url: z.string().url(),
    method: z.enum(["GET", "POST"]).default("GET"),
    headers: z.record(z.string()).optional(),
    body: jsonValueSchema.optional(),
    /** Optional dot-path into the response, e.g. "data.results". */
    select: z.string().optional(),
    /** If set, re-fetch on this interval (ms). */
    pollMs: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("ws"),
    id: z.string().min(1),
    /** ws:// or wss:// endpoint */
    url: z.string().url(),
    /** Optional dot-path into each received message before storing. */
    select: z.string().optional(),
    /** Optional initial message sent on connect (string/JSON). */
    onConnect: jsonValueSchema.optional(),
  }),
]);
export type DataSource = z.infer<typeof dataSourceSchema>;

/* ------------------------------------------------------------------ *
 * Theme — design tokens the agent can mutate live.
 * ------------------------------------------------------------------ */

export const themeSchema = z
  .object({
    /** HSL triplets without the hsl() wrapper, matching styles.css vars. */
    colors: z.record(z.string()).optional(),
    radius: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
    font: z.string().optional(),
    mode: z.enum(["light", "dark"]).optional(),
  })
  .partial();
export type Theme = z.infer<typeof themeSchema>;

/* ------------------------------------------------------------------ *
 * Dashboard — the full surface state.
 * ------------------------------------------------------------------ */

export const SPEC_VERSION = 2 as const;

export const dashboardSchema = z.object({
  version: z.literal(SPEC_VERSION).default(SPEC_VERSION),
  id: z.string().min(1),
  title: z.string().optional(),
  root: uiNodeSchema,
  theme: themeSchema.optional(),
  /** Agent-defined reusable components, keyed by name. */
  components: z.record(componentDefSchema).default({}),
  /** Data sources, keyed by id. */
  dataSources: z.record(dataSourceSchema).default({}),
  /** Client-side reactive state (filters, toggles, form values, ...). */
  state: z.record(jsonValueSchema).default({}),
  /**
   * Alternate root trees keyed by screen name (e.g. "settings", "details").
   * The renderer picks `screens[state.currentScreen]` when present, else
   * falls back to `root`. Use the `navigate` action to switch screens.
   */
  screens: z.record(uiNodeSchema).optional(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

/* ------------------------------------------------------------------ *
 * Patch — every mutation the agent can emit.
 * ------------------------------------------------------------------ */

export const patchSchema = z.discriminatedUnion("op", [
  // tree structure
  z.object({ op: z.literal("setRoot"), node: uiNodeSchema }),
  z.object({ op: z.literal("setTitle"), title: z.string() }),
  z.object({ op: z.literal("replace"), id: z.string(), node: uiNodeSchema }),
  z.object({ op: z.literal("update"), id: z.string(), props: z.record(jsonValueSchema) }),
  z.object({
    op: z.literal("append"),
    parentId: z.string(),
    node: uiNodeSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ op: z.literal("remove"), id: z.string() }),
  z.object({
    op: z.literal("move"),
    id: z.string(),
    parentId: z.string(),
    index: z.number().int().nonnegative().optional(),
  }),
  // styling & motion (Phase 1)
  z.object({ op: z.literal("setStyle"), id: z.string(), style: styleSpecSchema.nullable() }),
  z.object({ op: z.literal("setMotion"), id: z.string(), motion: motionSpecSchema.nullable() }),
  z.object({ op: z.literal("setTheme"), theme: themeSchema }),
  // component definitions (Phase 3)
  z.object({ op: z.literal("defineComponent"), def: componentDefSchema }),
  z.object({ op: z.literal("removeComponent"), name: z.string() }),
  // data & behaviour (Phase 4)
  z.object({ op: z.literal("setDataSource"), source: dataSourceSchema }),
  z.object({ op: z.literal("removeDataSource"), id: z.string() }),
  z.object({ op: z.literal("setState"), path: z.string(), value: jsonValueSchema }),
  z.object({
    op: z.literal("setBindings"),
    id: z.string(),
    bindings: z.record(z.string()).nullable(),
  }),
  z.object({ op: z.literal("setEvents"), id: z.string(), events: eventMapSchema.nullable() }),
]);
export type Patch = z.infer<typeof patchSchema>;
export type PatchOp = Patch["op"];

/* ------------------------------------------------------------------ *
 * Agent I/O
 * ------------------------------------------------------------------ */

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const agentResponseSchema = z
  .object({
    message: z.string().optional(),
    patches: z.array(patchSchema),
    /**
     * Populated by the agent (not the model) — one entry per patch that
     * targets a node/component/dataSource id not present in the dashboard.
     */
    warnings: z.array(z.string()).optional(),
  })
  .strict();
export type AgentResponse = z.infer<typeof agentResponseSchema>;

export const agentRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  dashboard: dashboardSchema.nullable().optional(),
});
export type AgentRequest = z.infer<typeof agentRequestSchema>;

/**
 * Streaming envelope. A streaming turn emits a sequence of these frames so
 * the client can apply patches as they arrive (Phase 2). `warning` frames
 * surface non-fatal issues (e.g. patches targeting unknown ids).
 */
export const streamFrameSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("patch"), patch: patchSchema }),
  z.object({ kind: z.literal("message"), delta: z.string() }),
  z.object({ kind: z.literal("warning"), warning: z.string() }),
  z.object({ kind: z.literal("error"), error: z.string() }),
  z.object({ kind: z.literal("done") }),
]);
export type StreamFrame = z.infer<typeof streamFrameSchema>;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** A fresh, empty dashboard. */
export function emptyDashboard(id = "dashboard"): Dashboard {
  return {
    version: SPEC_VERSION,
    id,
    title: undefined,
    root: { id: "root", type: "Grid", props: { gap: 4 }, children: [] },
    theme: undefined,
    components: {},
    dataSources: {},
    state: {},
    screens: undefined,
  };
}

/** Parse + migrate an unknown value into a current-version Dashboard. */
export function parseDashboard(value: unknown): Dashboard {
  return dashboardSchema.parse(value);
}
