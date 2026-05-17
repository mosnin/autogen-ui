import CodeBlock from "../../components/CodeBlock";

interface ActionRow {
  type: string;
  payload: string;
  description: string;
  example: string;
}

const ACTIONS: ActionRow[] = [
  {
    type: "setState",
    payload: "path: string, value: JsonValue",
    description: "Set a value at a dot-path inside the dashboard's reactive state.",
    example: `{ "type": "setState", "path": "filter", "value": "active" }`,
  },
  {
    type: "toggleState",
    payload: "path: string",
    description: "Flip a boolean at a dot-path (no-op if undefined; reads as `!current`).",
    example: `{ "type": "toggleState", "path": "showSidebar" }`,
  },
  {
    type: "refetch",
    payload: "sourceId: string",
    description: "Re-fetch a DataSource immediately, regardless of polling.",
    example: `{ "type": "refetch", "sourceId": "sales" }`,
  },
  {
    type: "openUrl",
    payload: "url: string, newTab?: boolean",
    description: "Navigate to a URL. With `newTab: true`, opens in a new tab.",
    example: `{ "type": "openUrl", "url": "https://example.com", "newTab": true }`,
  },
  {
    type: "scrollTo",
    payload: "nodeId: string",
    description: "Scroll the DOM element with the given node id into view.",
    example: `{ "type": "scrollTo", "nodeId": "revenue-card" }`,
  },
  {
    type: "emitEvent",
    payload: "name: string, payload?: JsonValue",
    description:
      "Fire a named event for the host to observe (passed to the dispatcher's `onEvent`).",
    example: `{ "type": "emitEvent", "name": "analytics", "payload": { "kind": "click" } }`,
  },
];

const eventSubstitution = `// Wired to an Input's onChange: substitutes the input's value
{
  "id": "search",
  "type": "Input",
  "bindings": { "value": "{{state.q}}" },
  "events": {
    "onChange": [
      { "type": "setState", "path": "q", "value": "{{event.value}}" }
    ]
  }
}`;

const formSubmit = `// Form onSubmit receives { values: { <name>: value, ... } }
{
  "type": "Form",
  "events": {
    "onSubmit": [
      { "type": "setState", "path": "submitted", "value": "{{event.values}}" }
    ]
  }
}`;

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Actions</h1>
      <p className="mt-3 text-muted-foreground">
        Actions are the entire vocabulary of side effects the agent can attach to
        events. The set is fixed and allowlisted — no arbitrary code, no string
        evaluation. Each action is one bounded side effect, executed by the runtime
        dispatcher.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Vocabulary</h2>
      <div className="mt-4 space-y-4">
        {ACTIONS.map((a) => (
          <section
            key={a.type}
            className="rounded-lg border border-border bg-card/40 p-4"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="font-mono text-base font-semibold">{a.type}</h3>
              <span className="font-mono text-xs text-muted-foreground">
                {a.payload}
              </span>
            </div>
            <p className="mt-2 text-sm">{a.description}</p>
            <CodeBlock language="json" code={a.example} />
          </section>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Event substitution</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        When an action runs from an event handler, the event&apos;s payload is
        addressable via <code className="font-mono text-xs">{"{{event.<key>}}"}</code>{" "}
        inside any string value. A whole-string token preserves the typed value
        (number, boolean, object); embedded tokens always interpolate as strings.
      </p>
      <CodeBlock language="json" code={eventSubstitution} />

      <h2 className="mt-8 text-lg font-semibold">Form submit payload</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Forms collect every inner input with a DOM{" "}
        <code className="font-mono text-xs">name</code> into{" "}
        <code className="font-mono text-xs">{"{{event.values}}"}</code>.
      </p>
      <CodeBlock language="json" code={formSubmit} />

      <h2 className="mt-8 text-lg font-semibold">Event names</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Reserved event keys: <code className="font-mono text-xs">onClick</code>,{" "}
        <code className="font-mono text-xs">onChange</code>,{" "}
        <code className="font-mono text-xs">onSubmit</code>,{" "}
        <code className="font-mono text-xs">onLoad</code>,{" "}
        <code className="font-mono text-xs">onClose</code> (Modal). Only{" "}
        <code className="font-mono text-xs">onClick</code> is bound to the renderer&apos;s
        wrapper; the others are owned by their specific components to avoid double-fire
        on bubbled DOM events.
      </p>
    </article>
  );
}
