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
export { applyPatch, applyPatches, findNode } from "./patch";

// Agent (standard + streaming) + route handlers
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
