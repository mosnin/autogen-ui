import BindingPlayground from "../../components/BindingPlayground";
import CodeBlock from "../../components/CodeBlock";

interface FilterRow {
  name: string;
  signature: string;
  input: string;
  output: string;
}

const FILTERS: FilterRow[] = [
  {
    name: "currency",
    signature: "currency:<ISO?>",
    input: "1234.5",
    output: "$1,234.50  (default USD)",
  },
  {
    name: "number",
    signature: "number:<digits?>",
    input: "1234.567",
    output: "1,234.6  (with digits=1)",
  },
  {
    name: "percent",
    signature: "percent:<digits?>",
    input: "0.245",
    output: "24.5%  (with digits=1)",
  },
  {
    name: "date",
    signature: "date:<short|medium|long|full>",
    input: '"2026-05-16T12:00:00Z"',
    output: "May 16, 2026  (default medium)",
  },
  {
    name: "time",
    signature: "time:<short|medium|long|full>",
    input: '"2026-05-16T12:00:00Z"',
    output: "12:00 PM  (default short)",
  },
  {
    name: "upper",
    signature: "upper",
    input: '"hello"',
    output: "HELLO",
  },
  {
    name: "lower",
    signature: "lower",
    input: '"HELLO"',
    output: "hello",
  },
  {
    name: "truncate",
    signature: "truncate:<len?>",
    input: '"a long string of text"',
    output: "a long string of t...  (len=20)",
  },
  {
    name: "default",
    signature: "default:<fallback>",
    input: "null",
    output: "<fallback>",
  },
  {
    name: "json",
    signature: "json",
    input: "{ a: 1 }",
    output: '{"a":1}',
  },
];

const chainedExample = `{
  "id": "rev",
  "type": "Stat",
  "bindings": {
    "label": "Revenue",
    "value": "{{data.sales.total | currency:EUR}}",
    "delta": "{{data.sales.growth | percent:1}}"
  }
}`;

const tokenForms = `// Whole-string token: yields the typed (filter-formatted) value
"{{state.count}}"

// Embedded token: interpolated into a surrounding string
"You have {{state.count}} unread messages"

// Chained pipes: left-to-right
"{{data.sales.total | number:0 | upper}}"`;

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Bindings</h1>
      <p className="mt-3 text-muted-foreground">
        Bindings are safe dot-path lookups against{" "}
        <code className="font-mono text-xs">data</code> (DataSource results) and{" "}
        <code className="font-mono text-xs">state</code> (reactive UI state), optionally
        piped through formatting filters. They are never{" "}
        <code className="font-mono text-xs">eval</code>&apos;d.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Syntax</h2>
      <CodeBlock language="ts" code={tokenForms} />

      <h2 className="mt-8 text-lg font-semibold">Chained pipes in a node</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Bindings live on the node — one expression per prop. The renderer evaluates
        them on every pass and overlays the results onto the node&apos;s static{" "}
        <code className="font-mono text-xs">props</code>.
      </p>
      <CodeBlock language="json" code={chainedExample} />

      <h2 className="mt-8 text-lg font-semibold">Built-in filters</h2>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Signature</th>
              <th className="px-3 py-2 font-medium">Input</th>
              <th className="px-3 py-2 font-medium">Output</th>
            </tr>
          </thead>
          <tbody>
            {FILTERS.map((f) => (
              <tr key={f.name} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{f.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {f.signature}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{f.input}</td>
                <td className="px-3 py-2 text-xs">{f.output}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Unknown filters are a no-op (the value passes through). Locale follows the
        runtime default.
      </p>

      <h2 className="mt-10 text-lg font-semibold">Try it</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Move the slider — every text node below is bound to the same{" "}
        <code className="font-mono text-xs">state.x</code> with a different filter.
      </p>
      <BindingPlayground />
    </article>
  );
}
