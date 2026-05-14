import type { CapabilityModule } from "../agent";

/**
 * Phase 4 capability: data sources, prop bindings, and declarative
 * interactivity. Teaches the agent the data/behaviour patch ops.
 */
export const dynamicCapability: CapabilityModule = {
  name: "Dynamic data & interactivity",
  systemPrompt: `Dashboards can be bound to live data and made interactive — all
declaratively, never with code.

### Data sources — \`setDataSource\`
A DataSource is keyed by \`id\` and is one of:
- \`{ "kind": "static", "id": string, "data": JSON }\` — inline sample/fixed data.
- \`{ "kind": "rest", "id": string, "url": string, "method"?: "GET"|"POST",
  "headers"?: object, "body"?: JSON, "select"?: string, "pollMs"?: number }\`
  — fetched from an HTTP endpoint. \`select\` is a dot-path into the response
  (e.g. "data.results"); \`pollMs\` re-fetches on that interval for live data.

Emit \`{ "op": "setDataSource", "source": DataSource }\` to add/replace one,
\`{ "op": "removeDataSource", "id": string }\` to drop it.

### Reactive state
\`state\` holds client-side values (filters, toggles, form inputs). Set defaults
with \`{ "op": "setState", "path": string, "value": JSON }\` — \`path\` is a
dot-path, e.g. "filters.range".

### Bindings — \`setBindings\`
Bind a node's props to data or state instead of hard-coding them:
\`{ "op": "setBindings", "id": string, "bindings": Record<string,string> | null }\`
Each value is a binding expression:
- \`"{{sourceId.path}}"\` or \`"{{data.sourceId.path}}"\` — read fetched data.
- \`"{{state.path}}"\` — read reactive state.
- A whole-string \`{{...}}\` yields the raw typed value; \`{{...}}\` embedded in
  text does string interpolation, e.g. "Total: {{sales.total}}".
- Plain strings with no \`{{\` are literals.
Example: \`{ "value": "{{sales.total}}", "label": "Revenue ({{state.range}})" }\`.

### Events — \`setEvents\`
Wire interactivity with \`{ "op": "setEvents", "id": string, "events": EventMap | null }\`.
EventMap maps an event name (\`onClick\`, \`onChange\`, \`onSubmit\`, \`onLoad\`) to an
ordered list of Actions. Actions are allowlisted only:
- \`{ "type": "setState", "path": string, "value": JSON }\`
- \`{ "type": "toggleState", "path": string }\`
- \`{ "type": "refetch", "sourceId": string }\`
- \`{ "type": "openUrl", "url": string, "newTab"?: boolean }\`
- \`{ "type": "scrollTo", "nodeId": string }\`
- \`{ "type": "emitEvent", "name": string, "payload"?: JSON }\`

Typical pattern: a filter button sets state via \`onClick\`, and a Stat/Chart
binds a prop to that state or to a data source filtered by it. Use \`refetch\`
to refresh a \`rest\` source on demand. Prefer bindings + state over duplicating
data into props.`,
};
