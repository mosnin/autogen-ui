/**
 * @autogen-ui/core — talk to an AI and watch your dashboard build itself.
 *
 * Server entry points (`createUIAgent`, `createRouteHandler`) and the
 * LLM clients (`@autogen-ui/core/clients`) require an API key and must
 * run server-side. Everything else is safe in the browser.
 */

// Spec, patches, types
export {
  agentRequestSchema,
  agentResponseSchema,
  chatMessageSchema,
  dashboardSchema,
  emptyDashboard,
  jsonValueSchema,
  patchSchema,
  uiNodeSchema,
  type AgentRequest,
  type AgentResponse,
  type ChatMessage,
  type Dashboard,
  type JsonValue,
  type Patch,
  type UINode,
} from "./schema";
export { applyPatch, applyPatches } from "./patch";

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
  createRouteHandler,
  createUIAgent,
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
