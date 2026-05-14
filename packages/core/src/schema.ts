import { z } from "zod";

/** Arbitrary JSON-serializable value, used for component props. */
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

/**
 * A single node in the UI spec tree. `type` is resolved against the
 * component registry at render time, so the schema stays open-ended
 * and forward-compatible with custom components.
 */
export interface UINode {
  id: string;
  type: string;
  props?: Record<string, JsonValue>;
  children?: UINode[];
}

export const uiNodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: z.record(jsonValueSchema).optional(),
    children: z.array(uiNodeSchema).optional(),
  }),
);

/** The complete state of a generated surface. */
export const dashboardSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  root: uiNodeSchema,
});
export type Dashboard = z.infer<typeof dashboardSchema>;

/**
 * Incremental edits the model emits to mutate an existing dashboard.
 * Targeting nodes by id is what makes "edit as you talk" cheap — the
 * model patches the tree instead of re-emitting it.
 */
export const patchSchema = z.discriminatedUnion("op", [
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
]);
export type Patch = z.infer<typeof patchSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** What an adapter returns for a single turn. */
export const agentResponseSchema = z.object({
  message: z.string().optional(),
  patches: z.array(patchSchema).default([]),
});
export type AgentResponse = z.infer<typeof agentResponseSchema>;

/** Request body for the built-in route handler / useDashboard hook. */
export const agentRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  dashboard: dashboardSchema.nullable().optional(),
});
export type AgentRequest = z.infer<typeof agentRequestSchema>;

/** An empty starting dashboard. */
export function emptyDashboard(id = "dashboard"): Dashboard {
  return {
    id,
    title: undefined,
    root: { id: "root", type: "Grid", props: { columns: 12, gap: 4 }, children: [] },
  };
}
