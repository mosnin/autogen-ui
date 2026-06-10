/**
 * @autogen-ui/core/server — server-only entry point.
 *
 * Import this (not the package root) from API routes, server components and
 * other server code. It deliberately excludes every `"use client"` module
 * (renderer, hooks, theming components) so a server bundle never drags the
 * client graph in.
 */

// Spec + patches (isomorphic)
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

// Data proxy for routing browser data fetches through a server-side endpoint
// (CORS bypass + auth header injection).
export { createDataProxyHandler, type DataProxyOptions } from "./proxy";

// Brand kits — host-defined identity (color, typography, voice).
export {
  brandKitSchema,
  brandToCssVars,
  brandToDarkCssVars,
  brandToPromptSection,
  type BrandColorTokens,
  type BrandKit,
} from "./brand";
export {
  brandPresets,
  forestKit,
  linearKit,
  monoKit,
  sharpKit,
  violetKit,
  warmKit,
  type BrandPresetName,
} from "./brand-presets";

// Agent (standard + streaming) + route handlers
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
export {
  createStreamingUIAgent,
  type CreateStreamingUIAgentOptions,
  type StreamingUIAgent,
} from "./streaming-agent";
export { createStreamingRouteHandler } from "./createStreamRouteHandler";
export { encodeFrame, framesToResponse, readFrames } from "./stream";

// Capabilities (plain data — system-prompt modules)
export {
  defaultCapabilities,
  defineCapability,
  dynamicCapability,
  formsCapability,
  streamingCapabilities,
  streamingCapability,
  styleCapability,
} from "./capabilities";

// Eval harness
export {
  assertValidPatches,
  createFakeClient,
  runEval,
  type EvalCase,
  type EvalResult,
} from "./eval/harness";
export { goldenCases } from "./eval/cases";
