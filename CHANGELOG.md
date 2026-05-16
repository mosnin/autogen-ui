# Changelog

All notable changes to `@autogen-ui/core` are tracked here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-16

The "actually-importable" release. Tool-use agent, real-time streaming,
custom components, dynamic data + forms, and a 52-case end-to-end test suite
that runs without an API key.

### Added

- **Tool-use agent.** The model is forced to call a single `emit_patches`
  tool; structured tool input replaces free-text JSON extraction. Prompt
  caching via Anthropic `cache_control` segments.
- **Auto-repair loop.** Zod validation failures are fed back as a corrective
  user message; bounded by `maxRepairAttempts` (default 2).
- **Custom components extension.** `createUIAgent({ components })` merges
  consumer-defined `ComponentDoc`s into the system prompt so the agent uses
  them like built-ins.
- **Real-time streaming.** Streaming agent + NDJSON transport
  (`stream.ts`), incremental tool-input JSON scanner (`_patch-stream.ts`),
  streaming clients (Anthropic SSE + OpenAI SSE), `useStreamingDashboard`.
- **Runtime component definition.** `defineComponent` patch ships
  parameterized spec templates with `{{param}}` substitution and cycle
  guards.
- **Style engine.** Token-based `StyleSpec` → Tailwind compiler with
  responsive (`sm`/`md`/`lg`) and state (`hover`/`focus`) overrides; live
  theming via `setTheme` + `ThemeProvider`; motion presets.
- **Forms + interactivity.** New components: `Input`, `Textarea`, `Select`,
  `Checkbox`, `Switch`, `Form`. Actions can substitute `{{event.value}}` /
  `{{event.values}}` etc. into string values; whole-string tokens preserve
  typed values.
- **Server-side data proxy.** `createDataProxyHandler` with URL allowlist,
  server-injected auth headers (override client), timeout. Hooks accept a
  `proxyUrl` option.
- **Binding pipes.** `{{path | filter:arg | filter2}}` with built-in
  filters: `currency`, `number`, `percent`, `date`, `time`, `upper`,
  `lower`, `truncate`, `json`, `default`.
- **Patch-target warnings.** `validatePatchTargets` simulates patches and
  surfaces ones referencing unknown ids; agent attaches them to
  `AgentResponse.warnings`; `useDashboard` exposes them.
- **Abort/cancellation.** `useDashboard` + `useStreamingDashboard` plumb an
  `AbortController`; new send aborts the previous, hook aborts on unmount.
- **Node http adapter.** `toNodeHandler` (`@autogen-ui/core/node`) lets the
  framework-agnostic `Request`/`Response` handlers run on plain Node http.
- **Server-only entry point.** `@autogen-ui/core/server` avoids dragging
  the `"use client"` graph into API routes.
- **Node error boundary.** Renderer wraps each node so a single bad render
  doesn't crash the whole dashboard.
- **History + persistence.** `createHistory`/`useHistory` (undo/redo),
  `serializeDashboard`/`loadDashboard`/`saveDashboard`, schema versioning
  (`SPEC_VERSION`).
- **Eval harness.** `createFakeClient`, `runEval`, `assertValidPatches`,
  `goldenCases`. 52-test end-to-end suite (`pnpm test`).

### Changed

- `agentResponseSchema` is now `.strict()` with `patches` required, so the
  auto-repair loop actually trips on bad model output.
- `useRuntime` now syncs `dashboard.state` → local state when the spec's
  state object changes externally (was a real bug — agent-driven `setState`
  patches didn't render).
- `compileEvents` only wires `onClick` on the wrapper; `onChange`/`onSubmit`
  are owned by form components (avoids double-dispatch on bubbled events).
- `LLMClient` interface redesigned around tool use + streaming events
  (`tool_start` / `tool_input_delta` / `tool_end` / `text_delta`).

### Fixed

- Registry no longer spread-merges client-module exports (which dragged the
  client graph into server bundles).

## [0.1.0]

Initial scaffolding: spec/patch types, basic Anthropic + OpenAI clients,
renderer, demo app.
