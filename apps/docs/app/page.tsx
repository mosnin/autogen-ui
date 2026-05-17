import Demo, { type DemoSpec } from "../components/Demo";

const featuredSpec: DemoSpec = {
  id: "overview",
  title: "Q3 — at a glance",
  root: {
    id: "root",
    type: "Grid",
    props: { gap: 4 },
    children: [
      {
        id: "card",
        type: "Card",
        props: { title: "Revenue", description: "Trailing 90 days", span: 12 },
        children: [
          {
            id: "stats",
            type: "Stack",
            props: { direction: "row", gap: 4 },
            children: [
              {
                id: "s1",
                type: "Stat",
                props: { label: "MRR", value: "$84,210", delta: "+12%", trend: "up" },
              },
              {
                id: "s2",
                type: "Stat",
                props: { label: "Active", value: "12,408", delta: "+4%", trend: "up" },
              },
              {
                id: "s3",
                type: "Stat",
                props: { label: "Churn", value: "1.8%", delta: "-0.3%", trend: "down" },
              },
            ],
          },
          {
            id: "chart",
            type: "Chart",
            props: {
              kind: "area",
              span: 12,
              title: "Revenue by week",
              data: [
                { label: "W1", value: 62 },
                { label: "W2", value: 71 },
                { label: "W3", value: 68 },
                { label: "W4", value: 79 },
                { label: "W5", value: 84 },
                { label: "W6", value: 91 },
              ],
            },
          },
        ],
      },
    ],
  },
};

export default function Page() {
  return (
    <article className="prose-invert">
      <h1 className="text-3xl font-bold tracking-tight">autogen-ui</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Talk to an AI and watch your dashboard build, edit, and respond to your users — live.
        <strong className="text-foreground">{" "}@autogen-ui/core</strong> is a Next.js library
        built on Tailwind, shadcn-style components, and Framer Motion. The model doesn&apos;t
        write code — it emits a validated JSON spec tree, and every follow-up message is a
        patch against that tree. The runtime renderer turns it into real components,
        animates the layout transitions, and wires data sources, bindings, and interactive
        forms.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Featured render</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This is the same renderer the agent drives, fed a hand-written spec. The layout
        animates on mount thanks to Framer Motion&apos;s layout engine.
      </p>
      <Demo spec={featuredSpec} />

      <h2 className="mt-10 text-xl font-semibold">What&apos;s in this site</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">Components</strong> — every built-in
          component, rendered live with its prop table.
        </li>
        <li>
          <strong className="text-foreground">Patches</strong> — the discriminated union
          of mutations the agent can emit, one row each.
        </li>
        <li>
          <strong className="text-foreground">Bindings</strong> — the{" "}
          <code className="font-mono text-xs">{"{{path | filter:arg}}"}</code> pipe
          language and every built-in formatter.
        </li>
        <li>
          <strong className="text-foreground">Actions</strong> — the allowlisted action
          vocabulary and how <code className="font-mono text-xs">{"{{event.X}}"}</code>{" "}
          substitution works.
        </li>
        <li>
          <strong className="text-foreground">Forms, Data, Streaming</strong> — the
          runtime hooks and transport.
        </li>
        <li>
          <strong className="text-foreground">Custom components</strong> and{" "}
          <strong className="text-foreground">LLM clients</strong> — how to extend the
          framework with your own pieces.
        </li>
      </ul>
    </article>
  );
}
