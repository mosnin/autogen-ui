import type { CapabilityModule } from "../agent";

/**
 * Phase 4 capability: data sources, prop bindings, declarative
 * interactivity, loops, conditionals and routing.
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
  — fetched from an HTTP endpoint. \`select\` is a dot-path into the response;
  \`pollMs\` re-fetches on that interval.
- \`{ "kind": "ws", "id": string, "url": string, "select"?: string,
  "onConnect"?: JSON }\` — WebSocket. Each message replaces \`data.id\`;
  \`onConnect\` is sent on open.

Emit \`{ "op": "setDataSource", "source": DataSource }\` to add/replace one,
\`{ "op": "removeDataSource", "id": string }\` to drop it.

### Reactive state
\`state\` holds client-side values (filters, toggles, form inputs, current screen).
Set defaults with \`{ "op": "setState", "path": string, "value": JSON }\` —
\`path\` is a dot-path, e.g. "filters.range".

### Bindings — \`setBindings\` (and \`bindings\` on any node)
Bind a node's props to data or state instead of hard-coding them:
\`{ "op": "setBindings", "id": string, "bindings": Record<string,string> | null }\`
Each value is an expression:
- \`"{{sourceId.path}}"\` / \`"{{data.x.y}}"\` — fetched data.
- \`"{{state.path}}"\` — reactive state.
- \`"{{loading.sourceId}}"\` — true while a source is loading.
- A whole-string \`{{...}}\` returns the typed value; embedded \`{{...}}\`
  interpolates as string.

**Pipe filters** — \`{{path | filter:arg | filter2}}\`. Built-ins:
- Format: \`currency:USD\`, \`number\`, \`percent:1\`, \`date:short\`, \`time\`,
  \`upper\`, \`lower\`, \`truncate:50\`, \`json\`, \`default:N/A\`.
- Compute: \`length\`, \`count\`, \`sum\`, \`sum:field\`, \`avg\`, \`avg:field\`,
  \`min\`, \`min:field\`, \`max\`, \`first\`, \`last\`, \`pluck:field\`,
  \`slice:5\`, \`reverse\`, \`sort\`, \`sort:field\`, \`not\`, \`empty\`.

### Lists — the \`ForEach\` node
Render a template once per item in an array. The \`ForEach\` node has props
\`{ source: string, as?: string, indexAs?: string }\` and **exactly one
template child**:
\`\`\`
{ "id": "customers_loop", "type": "ForEach",
  "props": { "source": "data.customers", "as": "row" },
  "children": [
    { "id": "row_card", "type": "Card",
      "bindings": { "title": "{{row.name}}", "description": "{{row.email}}" }}
  ] }
\`\`\`
Inside the template, bindings reference \`{{<as>.X}}\` and \`{{<indexAs>}}\`.
Event actions are rewritten to concrete per-iteration values at expansion.

### Conditionals — the \`when\` prop (any node)
Every node accepts \`"when": "<expression>"\`. Falsy → not rendered.
\`\`\`
{ "id": "detail", "type": "Card", "when": "{{state.selectedId | not}}",
  "props": { "title": "Pick a customer" } }
\`\`\`

### Routing — multiple screens
Use \`Dashboard.screens?: Record<name, UINode>\` for alternate roots. When
\`state.currentScreen\` matches a screen name, that screen is rendered
instead of \`root\`. Set with \`{ "type": "navigate", "to": string }\` or use
\`Link\` with \`to\` instead of \`href\`. Typical use: dashboard ⇄ detail ⇄ settings.

### Events — \`setEvents\`
\`{ "op": "setEvents", "id": string, "events": EventMap | null }\`
EventMap maps event names (\`onClick\`, \`onChange\`, \`onSubmit\`, \`onRowClick\`)
to ordered Actions:
- \`{ "type": "setState", "path": string, "value": JSON }\`
- \`{ "type": "toggleState", "path": string }\`
- \`{ "type": "refetch", "sourceId": string }\`
- \`{ "type": "navigate", "to": string }\`
- \`{ "type": "openUrl", "url": string, "newTab"?: boolean }\`
- \`{ "type": "scrollTo", "nodeId": string }\`
- \`{ "type": "emitEvent", "name": string, "payload"?: JSON }\`

Use \`{{event.value}}\` (Input onChange), \`{{event.row}}\` / \`{{event.index}}\`
(Table onRowClick) to capture the live value into an action.

Patterns:
- Filtered list: Input.onChange → setState filter q; ForEach over
  \`{{data.items | filter:q}}\` (best done via state-aware bindings).
- Drill-down: Table.onRowClick → setState selectedId; detail Card with
  \`when: "{{state.selectedId}}"\` shows below.
- Multi-screen: Link \`to="settings"\` navigates; \`screens.settings\` is the
  alternate root.
- Live data: setDataSource with kind:"ws" or pollMs; bindings update
  automatically.`,
};
