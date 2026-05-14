/**
 * @autogen-ui/core — talk to an AI and watch your dashboard build itself.
 *
 * Server entry points (`createUIAgent`, `createRouteHandler`) and the LLM
 * clients (`@autogen-ui/core/clients`) require an API key and must run
 * server-side. Everything else is safe in the browser.
 */

// Spec, patches, runtime contracts
export {
  agentRequestSchema,
  agentResponseSchema,
  actionSchema,
  chatMessageSchema,
  componentDefSchema,
  componentParamSchema,
  dashboardSchema,
  dataSourceSchema,
  emptyDashboard,
  eventMapSchema,
  jsonValueSchema,
  motionSpecSchema,
  parseDashboard,
  patchSchema,
  SPEC_VERSION,
  streamFrameSchema,
  styleSpecSchema,
  themeSchema,
  uiNodeSchema,
  type Action,
  type AgentRequest,
  type AgentResponse,
  type ChatMessage,
  type ComponentDef,
  type ComponentParam,
  type Dashboard,
  type DataSource,
  type EventMap,
  type JsonValue,
  type MotionSpec,
  type Patch,
  type PatchOp,
  type StreamFrame,
  type StyleSpec,
  type Theme,
  type UINode,
} from "./schema";
export { applyPatch, applyPatches, findNode } from "./patch";
export {
  noopExtensions,
  type CompiledStyle,
  type RendererExtensions,
  type RuntimeContext,
} from "./runtime";

// Component registry + primitives
export {
  componentCatalog,
  createRegistry,
  defaultRegistry,
  type ComponentDoc,
} from "./registry";
export type {
  ComponentRegistry,
  RegistryComponent,
  RegistryComponentProps,
} from "./components/types";
export * as primitives from "./components/primitives";

// Renderer
export { DashboardRenderer, type DashboardRendererProps } from "./renderer";

// Agent (server)
export {
  buildContextMessage,
  createRouteHandler,
  createUIAgent,
  extractJson,
  getSystemPrompt,
  type CapabilityModule,
  type CreateUIAgentOptions,
  type LLMClient,
  type UIAgent,
} from "./agent";

// React hook (client)
export {
  useDashboard,
  type UseDashboardOptions,
  type UseDashboardResult,
} from "./hooks/useDashboard";

// Utilities
export { cn, nodeId } from "./utils";
