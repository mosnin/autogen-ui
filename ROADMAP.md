# autogen-ui Roadmap

`autogen-ui` lets an AI model generate and edit live dashboards by emitting a
validated JSON spec tree of patches — never code, never HTML. The model speaks
one vocabulary (`schema.ts`); the runtime renders it. This roadmap describes
how that vocabulary grows from "lay out built-in components" to "define,
style, wire, and animate a fully interactive surface" — without ever handing
the model a code-execution primitive it doesn't need.

## The four generative layers

Every capability we add falls into one of four layers. Framing the roadmap
this way keeps the schema coherent: each layer is an independent axis the
model can operate on, and each phase below extends one or more of them.

- **Compose** — arrange nodes into a tree (`append`, `move`, `replace`,
  `setRoot`). The structural baseline.
- **Style** — change how nodes look without touching structure (`setStyle`,
  `setMotion`, `setTheme`). A constrained, token-based vocabulary.
- **Define** — mint new reusable building blocks at runtime
  (`defineComponent`) — parameterized spec templates, not arbitrary code.
- **Wire** — make the surface dynamic: bind data, hold state, and attach
  declarative, allowlisted behaviour (`setDataSource`, `setBindings`,
  `setState`, `setEvents`).

## Phased plan

### Phase 1 — Primitive & style layer

- A small set of layout primitives (`Box`, `Image`, `Icon`) so the model can
  express structure that doesn't map onto a domain component.
- `StyleSpec`: a constrained, token-based styling vocabulary compiled to
  Tailwind by the style engine. Responsive (`sm`/`md`/`lg`) and interaction
  (`hover`/`focus`) variants; a raw `className` escape hatch used sparingly.
- Live theming — the model mutates design tokens (`setTheme`) and the surface
  re-skins instantly.
- Motion presets (`MotionSpec`) — named, curated animations (`fade`, `rise`,
  `pop`) the model attaches per node.

### Phase 2 — Real-time streaming

- An NDJSON transport that streams `StreamFrame`s (`patch` / `message` /
  `error` / `done`) so the client applies patches as they arrive.
- A streaming agent that emits frames incrementally instead of buffering a
  whole response.
- A streaming React hook so the dashboard visibly assembles itself during a
  turn rather than snapping in at the end.

### Phase 3 — Runtime component definition

- `defineComponent`: the model creates parameterized spec templates
  (`{{param}}` placeholders substituted at instantiation) that become usable
  node `type` values — reuse without code.
- Opt-in, gated codegen for the rare cases a pure spec template can't express,
  behind an explicit capability flag and a sandbox (see cross-cutting work).

### Phase 4 — Dynamic & interactive

- Data sources (`static`, `rest`) with polling and response selection.
- Prop bindings — per-prop expressions (`{{sales.total}}`) resolved against
  data sources and client state.
- Declarative, allowlisted actions (`setState`, `toggleState`, `refetch`,
  `openUrl`, `scrollTo`, `emitEvent`) wired to events — interactivity with no
  arbitrary code path.

### Phase 5 — Infrastructure

- Undo/redo history — a snapshot stack over discrete `Dashboard` states
  (`createHistory`, `useHistory`).
- Persistence with migrations — serialize/deserialize through the schema so
  older specs are validated and migrated forward; `localStorage` helpers and
  file export.
- An eval harness — a deterministic fake client, golden cases, and a runner
  for measuring generation quality in tests and CI.

## Cross-cutting infrastructure

- **Schema as contract** — `schema.ts` is the single source of truth shared by
  model, runtime, and tests. Every phase extends it deliberately.
- **Capability modules** — each phase registers a `CapabilityModule` that adds
  its slice to the system prompt, so the prompt grows with the runtime instead
  of drifting from it.
- **Provider-agnostic agent** — the agent depends only on `LLMClient`, so the
  same logic runs against any model backend or a fake in tests.
- **Validation everywhere** — all model output and all restored specs are
  parsed against Zod schemas before they touch the runtime.

## Status

Phases 1–5 foundations are now in the repo: the spec schema covers all four
generative layers, patch application is implemented, the agent is
provider-agnostic with capability modules, and the Phase 5 infrastructure —
`history.ts`, `persistence.ts`, and the `eval/` harness with golden cases — has
landed.

### Remaining work

- **Codegen sandbox security review** — the Phase 3 opt-in real-codegen path
  needs a hardened sandbox and a full security review before it ships.
- **Multi-surface support** — generalize beyond dashboards to forms, landing
  pages, and other surfaces.
- **Persistence backend** — a server-side store beyond `localStorage`
  (versioned documents, sharing, history).
- **Richer eval coverage** — expand the golden case set across all four layers
  and add scoring/regression tracking in CI.
