import type { CapabilityModule } from "../agent";

/**
 * Teaches the agent how to wire interactive forms: controlled inputs via
 * bindings, dispatch via events, and the `{{event.value}}` substitution
 * that lets actions reference what the user just typed/picked.
 */
export const formsCapability: CapabilityModule = {
  name: "forms",
  systemPrompt: `## Forms & interactivity

Form components fire user input through the action dispatcher. The key idea:
an action value can reference the live event payload using
\`{{event.<key>}}\`. The most useful key is \`{{event.value}}\`, which is the
new value of the input/select/checkbox/switch that triggered the change.

CONTROLLED INPUT LOOP (the pattern almost every interactive UI needs):

1. Add the input node:
   { id: "search", type: "Input", props: { placeholder: "Search…" },
     bindings: { value: "{{state.q}}" },
     events: { onChange: [
       { type: "setState", path: "q", value: "{{event.value}}" }
     ] } }

2. Read \`state.q\` somewhere downstream, e.g. via a Text binding:
   { id: "echo", type: "Text",
     bindings: { text: "{{state.q}}" } }

3. Or filter a DataSource by it — combine with bindings on a node that
   shows the filtered result.

OTHER COMPONENTS:
- Select: \`options: [{value, label?}|string|number, ...]\`, \`onChange\`
  fires with \`{{event.value}}\`.
- Checkbox / Switch: \`onChange\` fires with \`{{event.value}}\` = the next
  boolean. Use \`toggleState\` for one-line toggles.
- Form: container; \`onSubmit\` fires with \`{{event.values}}\` = a record
  of named field values (inner inputs need a \`name\` prop via the host).

RULES:
- Never wire \`onChange\` on the wrapper of a non-form node — it's
  semantically owned by the inner input and the renderer ignores it.
- For text Input with \`type: "number"\`, \`{{event.value}}\` is a number.
- If you want the user's choice to filter live data, set their selection
  with \`setState\`, then bind a chart/table prop to derive from
  \`{{state.<key>}}\` or refetch a data source.`,
};
