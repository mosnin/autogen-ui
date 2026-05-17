import { componentCatalog, type ComponentDoc, type JsonValue } from "@autogen-ui/core";
import Demo, { type DemoSpec } from "../../components/Demo";
import PropTable from "../../components/PropTable";

// Hand-picked example props for each built-in component. Anything not in this
// table renders with an empty props object — fine for layout containers.
const EXAMPLES: Record<
  string,
  {
    props?: Record<string, unknown>;
    children?: Array<{ id: string; type: string; props?: Record<string, unknown> }>;
    note?: string;
  }
> = {
  Grid: {
    props: { gap: 4 },
    children: [
      { id: "g1", type: "Stat", props: { label: "Users", value: "12.4k" } },
      { id: "g2", type: "Stat", props: { label: "Revenue", value: "$84k" } },
      { id: "g3", type: "Stat", props: { label: "Churn", value: "1.8%" } },
    ],
  },
  Stack: {
    props: { direction: "row", gap: 3 },
    children: [
      { id: "b1", type: "Badge", props: { label: "Stable" } },
      { id: "b2", type: "Badge", props: { label: "Beta", variant: "secondary" } },
      { id: "b3", type: "Badge", props: { label: "Alpha", variant: "warning" } },
    ],
  },
  Section: {
    props: { title: "Operations", description: "Latency, uptime, errors." },
    children: [
      { id: "p1", type: "Progress", props: { label: "Uptime", value: 99 } },
    ],
  },
  Card: {
    props: { title: "Latency", description: "p50 over the last hour", span: 12 },
    children: [{ id: "card-inner", type: "Stat", props: { label: "p50", value: "84ms" } }],
  },
  Stat: {
    props: { label: "Revenue", value: "$84,210", delta: "+12%", trend: "up" },
  },
  Chart: {
    props: {
      kind: "bar",
      title: "Signups by day",
      span: 12,
      data: [
        { label: "Mon", value: 12 },
        { label: "Tue", value: 19 },
        { label: "Wed", value: 14 },
        { label: "Thu", value: 23 },
        { label: "Fri", value: 31 },
      ],
    },
  },
  Table: {
    props: {
      columns: ["Plan", "Users", "MRR"],
      rows: [
        ["Free", 8421, "$0"],
        ["Pro", 3104, "$62k"],
        ["Team", 412, "$22k"],
      ],
    },
  },
  Heading: { props: { text: "Section heading", level: 2 } },
  Text: { props: { text: "A paragraph of body text. Mutes nicely.", muted: true } },
  Badge: { props: { label: "Success", variant: "success" } },
  Button: { props: { label: "Click me" } },
  Progress: { props: { label: "Quota", value: 64 } },
  List: { props: { items: ["First", "Second", "Third"], ordered: true } },
  Divider: {},
  Box: {
    props: {},
    children: [{ id: "box-inner", type: "Text", props: { text: "I'm inside a Box." } }],
  },
  Image: {
    props: {
      src: "https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?w=400&q=60",
      alt: "Sample",
      rounded: "lg",
      aspect: "video",
    },
  },
  Icon: { props: { name: "star", size: 24 } },
  Spacer: { note: "Renders nothing visible on its own (absorbs flex space)." },
  Input: { props: { placeholder: "Type here..." } },
  Textarea: { props: { placeholder: "Multi-line input...", rows: 3 } },
  Select: {
    props: {
      options: [
        { value: "today", label: "Today" },
        { value: "week", label: "This week" },
        { value: "month", label: "This month" },
      ],
      placeholder: "Pick a range",
    },
  },
  Checkbox: { props: { label: "Email me updates", checked: true } },
  Switch: { props: { label: "Dark mode", checked: true } },
  Form: {
    children: [
      {
        id: "form-input",
        type: "Input",
        props: { name: "email", placeholder: "you@example.com" },
      },
    ],
  },
  Tabs: {
    props: {
      tabs: [
        { value: "overview", label: "Overview" },
        { value: "members", label: "Members" },
      ],
      value: "overview",
    },
    children: [
      { id: "t1", type: "Text", props: { text: "Overview panel" } },
      { id: "t2", type: "Text", props: { text: "Members panel" } },
    ],
  },
  Accordion: {
    props: {
      items: [
        { value: "a", label: "First item" },
        { value: "b", label: "Second item" },
      ],
      openValues: ["a"],
    },
    children: [
      { id: "ac1", type: "Text", props: { text: "Body of the first item." } },
      { id: "ac2", type: "Text", props: { text: "Body of the second item." } },
    ],
  },
  Link: { props: { href: "https://example.com", text: "An example link", newTab: true } },
  Breadcrumb: {
    props: {
      items: [
        { label: "Home", href: "/" },
        { label: "Settings", href: "/settings" },
        { label: "Profile" },
      ],
    },
  },
  Modal: {
    note:
      "Modal renders into a fixed overlay; it would cover the page when open. Below is the dismissed state — drive `open` from `state` to show it.",
    props: { open: false, title: "Example modal" },
    children: [{ id: "mt", type: "Text", props: { text: "Modal body content." } }],
  },
  Tooltip: {
    props: { text: "I'm a tooltip", side: "top" },
    children: [
      { id: "tt-inner", type: "Button", props: { label: "Hover me" } },
    ],
  },
  Avatar: {
    props: { name: "Ada Lovelace", size: "lg", online: true },
  },
  Skeleton: { props: { lines: 3, height: "md" } },
  CodeBlock: {
    props: {
      language: "ts",
      code: "const greet = (name: string) => `Hi, ${name}!`;",
    },
  },
  Quote: {
    props: { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  },
  Kbd: { props: { keys: "Ctrl + K" } },
};

function buildDemoSpec(doc: ComponentDoc): DemoSpec {
  const ex = EXAMPLES[doc.type] ?? {};
  return {
    id: `demo-${doc.type}`,
    root: {
      id: "root",
      type: "Grid",
      props: { gap: 4 },
      children: [
        {
          id: `n-${doc.type}`,
          type: doc.type,
          props: (ex.props ?? {}) as Record<string, JsonValue>,
          ...(ex.children ? { children: ex.children } : {}),
        },
      ],
    } as DemoSpec["root"],
  };
}

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Components</h1>
      <p className="mt-3 text-muted-foreground">
        Every built-in component the agent is allowed to draw from. Each entry shows the
        component&apos;s machine-readable description (the same one fed into the
        model&apos;s system prompt), its prop table, and a live render with sample props.
      </p>

      <div className="mt-10 space-y-12">
        {componentCatalog.map((doc) => {
          const ex = EXAMPLES[doc.type] ?? {};
          return (
            <section key={doc.type} id={doc.type}>
              <h2 className="text-2xl font-semibold tracking-tight">{doc.type}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
              <PropTable doc={doc} />
              {ex.note && (
                <p className="my-3 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                  {ex.note}
                </p>
              )}
              <Demo spec={buildDemoSpec(doc)} caption="Live render" />
            </section>
          );
        })}
      </div>
    </article>
  );
}
