import type { CapabilityModule } from "../agent";

/**
 * Capability module for runtime component definition. Teaches the model to
 * factor repeated UI patterns into reusable `ComponentDef`s.
 */

const systemPrompt = `Define your own reusable components when a UI pattern repeats.

WHEN TO DEFINE vs. COMPOSE
- If a layout of primitives appears 2+ times (e.g. a labelled metric card, a
  user row, a section header), define it ONCE as a component and reuse it.
- If a pattern is one-off, just compose primitives inline. Do not define a
  component for a single use.

DEFINING A COMPONENT
Emit a "defineComponent" patch:
  { "op": "defineComponent", "def": ComponentDef }
ComponentDef = {
  "name": string,            // PascalCase, e.g. "MetricCard". Becomes a node type.
  "description"?: string,
  "params": ComponentParam[],
  "template": UINode         // the parameterized tree
}
ComponentParam = {
  "name": string,
  "type"?: "string" | "number" | "boolean" | "json",   // default "string"
  "default"?: JSON,
  "description"?: string
}
Remove a definition with { "op": "removeComponent", "name": string }.

TEMPLATING SYNTAX
- Inside the template's string props and binding strings, write {{paramName}}.
- A prop whose value is exactly "{{paramName}}" is replaced with the param's
  real typed value (number/boolean/json stay typed).
- A {{paramName}} embedded in a longer string is interpolated as text, e.g.
  "text": "Total: {{label}}".
- Template node ids only need to be unique WITHIN the template; instances get
  fresh deterministic ids automatically.

USING A DEFINED COMPONENT
Use it like any built-in: add a node whose "type" is the component name and
pass params via "props".
  { "id": "rev_card", "type": "MetricCard",
    "props": { "label": "Revenue", "value": 42000, "trend": "up" } }
Defined components can be used anywhere a node is valid and can be nested.

EXAMPLE
defineComponent:
  { "name": "MetricCard",
    "params": [
      { "name": "label", "type": "string" },
      { "name": "value", "type": "number" },
      { "name": "delta", "type": "string", "default": "" }
    ],
    "template": {
      "id": "tpl_root", "type": "Card",
      "children": [
        { "id": "tpl_stat", "type": "Stat",
          "props": { "label": "{{label}}", "value": "{{value}}", "delta": "{{delta}}" } }
      ]
    }
  }
then instantiate: { "id": "users_card", "type": "MetricCard",
  "props": { "label": "Active Users", "value": 1280, "delta": "+4%" } }

RULES
- A template may reference OTHER defined components, but never itself directly,
  and avoid indirect cycles — recursive templates are rejected / capped.
- Component names must not collide with built-in component types.
- Keep params minimal and well-named; rely on "default" for optional ones.`;

export const defineCapability: CapabilityModule = {
  name: "Component definition",
  systemPrompt,
};
