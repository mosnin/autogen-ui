import CodeBlock from "../../components/CodeBlock";

interface PatchRow {
  op: string;
  fields: string;
  description: string;
  example: string;
}

const PATCHES: PatchRow[] = [
  {
    op: "setRoot",
    fields: "node: UINode",
    description: "Replace the entire dashboard tree with a new root node.",
    example: `{ "op": "setRoot", "node": { "id": "root", "type": "Grid", "children": [] } }`,
  },
  {
    op: "setTitle",
    fields: "title: string",
    description: "Set or update the dashboard title shown above the renderer.",
    example: `{ "op": "setTitle", "title": "Q3 — at a glance" }`,
  },
  {
    op: "replace",
    fields: "id, node",
    description: "Find the node with `id` and replace it (and its subtree) wholesale.",
    example: `{ "op": "replace", "id": "rev", "node": { "id": "rev", "type": "Stat", "props": { "label": "Rev", "value": 0 } } }`,
  },
  {
    op: "update",
    fields: "id, props",
    description: "Merge the given props into an existing node's `props` object.",
    example: `{ "op": "update", "id": "rev", "props": { "value": "$84,210" } }`,
  },
  {
    op: "append",
    fields: "parentId, node, index?",
    description: "Append a child to `parentId`. With `index`, insert at that position.",
    example: `{ "op": "append", "parentId": "root", "node": { "id": "rev", "type": "Stat", "props": { "label": "MRR", "value": "$84k" } } }`,
  },
  {
    op: "remove",
    fields: "id",
    description: "Detach the node with `id` from the tree.",
    example: `{ "op": "remove", "id": "old-card" }`,
  },
  {
    op: "move",
    fields: "id, parentId, index?",
    description: "Move an existing node to a new parent (and optional index).",
    example: `{ "op": "move", "id": "rev", "parentId": "summary", "index": 0 }`,
  },
  {
    op: "setStyle",
    fields: "id, style: StyleSpec | null",
    description: "Set or clear a node's StyleSpec. `null` removes styling entirely.",
    example: `{ "op": "setStyle", "id": "rev", "style": { "bg": "card", "rounded": "lg", "p": 4 } }`,
  },
  {
    op: "setMotion",
    fields: "id, motion: MotionSpec | null",
    description: "Attach (or clear) a Framer Motion spec, e.g. a preset like `\"rise\"`.",
    example: `{ "op": "setMotion", "id": "rev", "motion": { "preset": "rise" } }`,
  },
  {
    op: "setTheme",
    fields: "theme: Theme",
    description: "Mutate design tokens live — colors, radius, font, light/dark mode.",
    example: `{ "op": "setTheme", "theme": { "mode": "dark", "radius": "lg" } }`,
  },
  {
    op: "defineComponent",
    fields: "def: ComponentDef",
    description:
      "Define a reusable parameterized component the agent can instantiate by name.",
    example: `{ "op": "defineComponent", "def": { "name": "MetricCard", "params": [{ "name": "label" }, { "name": "value" }], "template": { "id": "t", "type": "Stat", "bindings": { "label": "{{label}}", "value": "{{value}}" } } } }`,
  },
  {
    op: "removeComponent",
    fields: "name",
    description: "Forget a previously-defined component by name.",
    example: `{ "op": "removeComponent", "name": "MetricCard" }`,
  },
  {
    op: "setDataSource",
    fields: "source: DataSource",
    description: "Register (or replace) a `static` or `rest` data source by id.",
    example: `{ "op": "setDataSource", "source": { "kind": "rest", "id": "sales", "url": "https://api.example.com/sales" } }`,
  },
  {
    op: "removeDataSource",
    fields: "id",
    description: "Drop a previously-registered data source.",
    example: `{ "op": "removeDataSource", "id": "sales" }`,
  },
  {
    op: "setState",
    fields: "path, value",
    description: "Set a value at a dot-path in `dashboard.state` (also fires locally).",
    example: `{ "op": "setState", "path": "q", "value": "" }`,
  },
  {
    op: "setBindings",
    fields: "id, bindings: Record<string, string> | null",
    description:
      "Attach per-prop binding expressions to a node, or clear them with `null`.",
    example: `{ "op": "setBindings", "id": "rev", "bindings": { "value": "{{data.sales.total | currency:EUR}}" } }`,
  },
  {
    op: "setEvents",
    fields: "id, events: EventMap | null",
    description: "Set or clear a node's event handlers (e.g. onClick, onChange).",
    example: `{ "op": "setEvents", "id": "btn", "events": { "onClick": [{ "type": "openUrl", "url": "https://example.com" }] } }`,
  },
];

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Patches</h1>
      <p className="mt-3 text-muted-foreground">
        Every mutation the agent can emit is one of these patch ops. The set is a Zod
        discriminated union keyed on <code className="font-mono text-xs">op</code>; the
        runtime applies them in order with{" "}
        <code className="font-mono text-xs">applyPatches()</code>.
      </p>

      <div className="mt-8 space-y-6">
        {PATCHES.map((p) => (
          <section
            key={p.op}
            className="rounded-lg border border-border bg-card/40 p-4"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-mono text-lg font-semibold">{p.op}</h2>
              <span className="font-mono text-xs text-muted-foreground">
                {p.fields}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground/90">{p.description}</p>
            <CodeBlock language="json" code={p.example} />
          </section>
        ))}
      </div>
    </article>
  );
}
