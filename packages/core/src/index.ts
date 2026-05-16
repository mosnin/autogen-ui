/**
 * @autogen-ui/core — talk to an AI and watch your dashboard build itself.
 *
 * Server entry points (`createUIAgent`, `createStreamingUIAgent`, the route
 * handlers) and the LLM clients (`@autogen-ui/core/clients`) require an API
 * key and must run server-side. Everything else is safe in the browser.
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
export { applyPatch, applyPatches, findNode, validatePatchTargets } from "./patch";
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
export { Box, Icon, Image, Spacer } from "./components/box";
export { Checkbox, Form, Input, Select, Switch, Textarea } from "./components/forms";

// Renderer + runtime extensions
export {
  DashboardRenderer,
  NodeErrorBoundary,
  useRuntimeContext,
  type DashboardRendererProps,
} from "./renderer";
export { defaultExtensions } from "./extensions";

// Phase 1 — style engine, motion, theming
export { compileStyle, STATIC_SAFELIST } from "./style";
export { compileMotion } from "./motion";
export { ThemeProvider, themeToCssVars, type ThemeProviderProps } from "./theme";

// Phase 3 — runtime component definition
export { instantiateComponent, listComponentTypes, validateComponentDef } from "./define";
export {
  createCodegenResolver,
  type CodegenOptions,
  type CodegenResolver,
} from "./sandbox/codegen";

// Phase 4 — dynamic data + declarative actions
export {
  builtinFilters,
  fetchDataSource,
  getPath,
  resolveBindings,
  selectPath,
  useDataSources,
  type FetchDataSourceOptions,
  type FilterFn,
  type UseDataSourcesOptions,
  type UseDataSourcesResult,
} from "./data";
export { createDataProxyHandler, type DataProxyOptions } from "./proxy";
export {
  compileEvents,
  createDispatcher,
  type CreateDispatcherArgs,
  type Dispatch,
} from "./actions";
export {
  useRuntime,
  type UseRuntimeOptions,
  type UseRuntimeResult,
} from "./hooks/useRuntime";

// Phase 2 — real-time streaming
export { encodeFrame, framesToResponse, readFrames } from "./stream";
export {
  createStreamingUIAgent,
  type CreateStreamingUIAgentOptions,
  type StreamingUIAgent,
} from "./streaming-agent";
export { createStreamingRouteHandler } from "./createStreamRouteHandler";
export {
  useStreamingDashboard,
  type UseStreamingDashboardOptions,
  type UseStreamingDashboardResult,
} from "./hooks/useStreamingDashboard";

// Capabilities (system-prompt modules)
export {
  defaultCapabilities,
  defineCapability,
  dynamicCapability,
  formsCapability,
  streamingCapabilities,
  streamingCapability,
  styleCapability,
} from "./capabilities";

// Agent (server)
export {
  buildContextMessage,
  buildSystemSegments,
  createRouteHandler,
  createUIAgent,
  EMIT_PATCHES_TOOL,
  getSystemPrompt,
  type CapabilityModule,
  type CreateUIAgentOptions,
  type LLMClient,
  type LLMEvent,
  type LLMRequest,
  type LLMResult,
  type LLMSystemSegment,
  type LLMTool,
  type ToolCall,
  type UIAgent,
} from "./agent";
export { systemToSegments, systemToString } from "./llm";

// React hooks (client)
export {
  useDashboard,
  type UseDashboardOptions,
  type UseDashboardResult,
} from "./hooks/useDashboard";

// Phase 5 — history, persistence, eval
export {
  createHistory,
  useHistory,
  type DashboardHistory,
  type UseHistoryResult,
} from "./history";
export {
  deserializeDashboard,
  exportDashboardFile,
  loadDashboard,
  saveDashboard,
  serializeDashboard,
  STORAGE_KEY,
} from "./persistence";
export {
  assertValidPatches,
  createFakeClient,
  runEval,
  type EvalCase,
  type EvalResult,
} from "./eval/harness";
export { goldenCases } from "./eval/cases";

// Utilities
export { cn, nodeId } from "./utils";
