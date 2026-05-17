import CodeBlock from "../../components/CodeBlock";
import FormDemo from "../../components/FormDemo";

const controlledInput = `{
  "id": "search",
  "type": "Input",
  "bindings": { "value": "{{state.q}}" },
  "events": {
    "onChange": [
      { "type": "setState", "path": "q", "value": "{{event.value}}" }
    ]
  }
}`;

const echoText = `{
  "id": "echo",
  "type": "Text",
  "bindings": { "text": "You typed: {{state.q | default:nothing yet}}" }
}`;

const formExample = `{
  "id": "form",
  "type": "Form",
  "events": {
    "onSubmit": [
      { "type": "setState", "path": "lastSubmit", "value": "{{event.values}}" }
    ]
  },
  "children": [
    { "id": "n", "type": "Input", "props": { "name": "name", "placeholder": "Name" } },
    { "id": "e", "type": "Input", "props": { "name": "email", "placeholder": "Email" } },
    { "id": "b", "type": "Button", "props": { "label": "Submit" } }
  ]
}`;

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
      <p className="mt-3 text-muted-foreground">
        Form components are wired through the same runtime context as everything else.
        The pattern is always the same: bind a prop to a state path, then wire the
        matching event to a <code className="font-mono text-xs">setState</code> action
        that reads <code className="font-mono text-xs">{"{{event.value}}"}</code>.
      </p>

      <h2 className="mt-8 text-lg font-semibold">The controlled-input loop</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Below is the canonical pair: an <code className="font-mono text-xs">Input</code>{" "}
        bound to <code className="font-mono text-xs">state.q</code>, and a{" "}
        <code className="font-mono text-xs">Text</code> that echoes it back through a
        binding (with a <code className="font-mono text-xs">default</code> filter).
      </p>
      <CodeBlock language="json" code={controlledInput} />
      <CodeBlock language="json" code={echoText} />

      <h2 className="mt-8 text-lg font-semibold">Live</h2>
      <FormDemo />

      <h2 className="mt-10 text-lg font-semibold">Form submit</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A <code className="font-mono text-xs">Form</code> collects every inner input
        with a DOM <code className="font-mono text-xs">name</code> into{" "}
        <code className="font-mono text-xs">{"{{event.values}}"}</code> when{" "}
        <code className="font-mono text-xs">onSubmit</code> fires.
      </p>
      <CodeBlock language="json" code={formExample} />

      <h2 className="mt-8 text-lg font-semibold">Why the loop is necessary</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Inputs in autogen-ui are always <em>controlled</em> — their{" "}
        <code className="font-mono text-xs">value</code> comes from{" "}
        <code className="font-mono text-xs">props</code> (or a binding). Without an{" "}
        <code className="font-mono text-xs">onChange</code> wiring state back, the input
        would appear frozen because React replaces the DOM value every render.
      </p>
    </article>
  );
}
