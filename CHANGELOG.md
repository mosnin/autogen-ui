# Changelog

All notable changes to `@autogen-ui/core` are tracked here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-06-10

The "embeddable framework" release. Host applications can adopt their own
identity, components, and styling. The framework now expresses full app
shells (sidebars, screens, back navigation), HTTP-backed agent actions,
server-side persistence, telemetry, and ships a `create-autogen-ui` CLI.
208 end-to-end tests, all green.

### Added — host integration

- **`BrandKit`** + `BrandProvider` (`brand.ts`, `brand-provider.tsx`).
  Color tokens (22), dark overrides, typography, radius, voice rules,
  guidelines. Compiles to CSS variables for the renderer AND a
  `## BRAND` section appended to the cacheable system prompt. Six
  starter kits ship: `violetKit` (default), `linearKit`, `warmKit`,
  `sharpKit`, `monoKit`, `forestKit`.
- **`createComponentAdapter`** + `mapComponent` (`adapter.ts`). Bridge
  host React components into the registry: rename props (`title` →
  `heading`), supply defaults, compute derived props, route children
  into named slots.
- **`createInlineStyleCompiler`** (`style-adapters.ts`). Alternate
  `compileStyle` that emits inline `CSSProperties` (resolving colors
  via `hsl(var(--token))`) for non-Tailwind hosts (styled-components,
  Emotion, Tamagui, vanilla CSS Modules).

### Added — framework primitives

- **`Dashboard.layout` + `Outlet`** component. Persistent app shell:
  declare a wrapper tree with an `Outlet` marker; the renderer swaps
  in the active screen there on every navigation. Sidebars, top nav,
  branded chrome survive screen changes.
- **`navigateBack` action + screen history**. The `navigate` action
  now pushes the previous `currentScreen` onto `state.screenHistory`.
  `navigateBack` pops. At-root is a no-op.
- **`defineFunction` + `callFunction`**. Agent declares its own
  HTTP-backed actions with URL/body/header `{{args.X}}` templating.
  `callFunction` resolves args against state + event payload, fires
  the request (optionally through the data proxy), stores the result
  in `data[into ?? name]`, and dispatches `onSuccess`/`onError`
  action lists with `{{event.result}}` / `{{event.error}}` available.
- **Spec migrations** (`migrateDashboard`). Walk older dashboard JSON
  forward to current `SPEC_VERSION` via a registry of per-version
  migrators. `deserializeDashboard` + the persistence handler both
  route through it.

### Added — server

- **`createPersistenceHandler`** + `createMemoryStore`. Framework-
  agnostic Web Request handler for GET (load) / POST (save) / DELETE /
  LIST. Plug any backend store; the handler enforces size limits and
  routes saves through `migrateDashboard`. Optional `authorize` gate.
- **`useAutoSave`** hook. Debounced POST of every dashboard mutation
  to the persistence endpoint, with AbortController + unmount cancel.

### Added — agent & data

- **`onTurn` telemetry hook** on `createUIAgent`. Fires `{
  clientName, attempts, durationMs, patchCount, warningCount,
  hadRepair, error? }` after every turn. Wrapped in a try/catch so
  telemetry failures never crash the run.
- **WebSocket data source** (`kind: "ws"`). Third `DataSource` variant
  with `url`, `select?`, `onConnect?`. `useDataSources` manages the
  socket lifecycle.
- **17 compute filters**: `length`, `count`, `sum`/`sum:field`, `avg`,
  `min`, `max`, `first`, `last`, `pluck:field`, `slice:N`, `reverse`,
  `sort`/`sort:field`, `not`, `empty`. Chain with formatters.
- **Per-source `errors`** in the runtime context. `useDataSources`
  exposes `errors: Record<string, string|null>`; bindings can read
  `{{errors.sourceId}}` and gate fallback UI via `when`.
- **`ForEach` loops, `when` gate**. The two remaining control-flow
  primitives. `ForEach` clones a template per item with scoped
  bindings; `when` evaluates a binding expression and skips render
  on falsy.
- **`Link.to` for internal navigation** — alternative to `href`,
  dispatches `navigate`.
- **Table `events.onRowClick`** with `{{event.row}}`, `{{event.index}}`,
  and per-column fields in the payload.
- **`validateInput`** + form schema validation (`required`, `email`,
  `url`, `minLength`, `maxLength`, `min`, `max`, `pattern`). Inputs +
  Textarea render inline error messages with `aria-errormessage`.
- **Chart interaction**: hover state, tooltip with tabular-num value,
  dashed crosshair on line/area, opacity dimming for non-hovered bars.
- **Modal a11y**: focus capture/restore, Esc to close, Tab/Shift+Tab
  focus trap, `aria-labelledby` for title.

### Added — distribution

- **`create-autogen-ui`** new workspace package. `npx create-autogen-ui
  my-app` scaffolds a Next.js 14 App Router project preconfigured with
  the preset, brand provider, streaming route, and provider stubs
  (`--provider claude|openai`, `--no-streaming` flag).
- **Design pass** on the framework's own visual identity: signature
  violet-indigo accent, warm-tinted neutrals, custom motion easing,
  Stat with tabular-num count-up + sparkline, Chart with
  chart-palette gradients + dotted reference grid.

### Changed

- Renderer wraps each node in `Framer.motion` with `siblingIndex`-based
  stagger (36ms between siblings); inline-literal `extensions`/`context`
  props are stabilised via `useShallowMemo` so re-renders don't
  invalidate the merged ctx.
- `RuntimeContext` gains `scope`, `loading`, `errors` channels.
- `useRuntime` accepts `proxyUrl` and surfaces `loading` + `errors`.
- `compileEvents` no longer wires `onChange`/`onSubmit` on the wrapper
  (only `onClick`) — form components own those.
- README rewritten to surface the integration story end-to-end.

### Fixed

- `useRuntime` now syncs `dashboard.state` → local state when the spec
  changes externally (was a real bug — agent-driven `setState` patches
  weren't rendering).
- Registry no longer spread-merges client-module exports.

### Tests

52 → 208. Added coverage for ForEach expansion, `when` gate, screens
routing, screen history (navigate/back), Outlet substitution, brand kit
compilation, prompt injection, component adapters (renderToStaticMarkup),
inline style compiler, persistence handler (round-trip + migration +
authorize), agent telemetry, WebSocket source schema, compute filters,
form validation, error path bindings, and `callFunction` substitution.

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
