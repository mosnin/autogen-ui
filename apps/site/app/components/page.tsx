"use client";

import { DashboardRenderer, useRuntime, type Dashboard } from "@autogen-ui/core";

const SHOWCASES: { title: string; description: string; dashboard: Dashboard }[] = [
  {
    title: "Stat",
    description: "KPI tile. Tabular numerals, count-up on mount, optional inline sparkline.",
    dashboard: makeShowcase([
      {
        id: "s1",
        type: "Stat",
        props: {
          label: "MRR",
          value: 248420,
          delta: "+12.4%",
          trend: "up",
          sparkline: [180, 195, 210, 218, 232, 241, 248],
        },
        style: { span: 4 },
      },
      {
        id: "s2",
        type: "Stat",
        props: {
          label: "Active",
          value: 18420,
          delta: "+1,204",
          trend: "up",
        },
        style: { span: 4 },
      },
      {
        id: "s3",
        type: "Stat",
        props: {
          label: "Churn",
          value: "2.1%",
          delta: "-0.4pp",
          trend: "down",
        },
        style: { span: 4 },
      },
    ]),
  },
  {
    title: "Chart",
    description: "Dependency-free SVG. Bar, line, area. Hover for crosshair + value tooltip.",
    dashboard: makeShowcase([
      {
        id: "c1",
        type: "Chart",
        props: {
          kind: "area",
          title: "MRR growth",
          data: [
            { label: "Jul", value: 180 },
            { label: "Aug", value: 195 },
            { label: "Sep", value: 210 },
            { label: "Oct", value: 232 },
            { label: "Nov", value: 241 },
            { label: "Dec", value: 248 },
          ],
        },
        style: { span: 6 },
      },
      {
        id: "c2",
        type: "Chart",
        props: {
          kind: "bar",
          title: "Signups by source",
          data: [
            { label: "Organic", value: 420 },
            { label: "Paid", value: 280 },
            { label: "Referral", value: 190 },
            { label: "Partner", value: 95 },
          ],
        },
        style: { span: 6 },
      },
    ]),
  },
  {
    title: "Table",
    description: "Tabular data with optional onRowClick events. Caption support, scoped headers.",
    dashboard: makeShowcase([
      {
        id: "t1",
        type: "Table",
        props: {
          caption: "Recent customers",
          columns: ["Company", "Plan", "MRR", "Signed up"],
          rows: [
            ["Acme Corp", "Enterprise", 1499, "2 hours ago"],
            ["Nova Labs", "Team", 299, "Yesterday"],
            ["Pulse Health", "Team", 299, "2 days ago"],
            ["Atlas Pay", "Pro", 99, "3 days ago"],
          ],
        },
        style: { span: 12 },
      },
    ]),
  },
  {
    title: "Card · Heading · Text",
    description: "Containers and typography. Heading supports word/char reveal; Text supports typewriter.",
    dashboard: makeShowcase([
      {
        id: "card",
        type: "Card",
        props: { title: "Overview", description: "Q4 narrative" },
        style: { span: 12 },
        children: [
          {
            id: "h",
            type: "Heading",
            props: { text: "Revenue is up 12% this quarter", level: 3 },
          },
          {
            id: "p",
            type: "Text",
            props: {
              text: "Driven by enterprise expansion in mid-market accounts. Churn ticked down on the back of better onboarding.",
              muted: true,
            },
          },
        ],
      },
    ]),
  },
  {
    title: "Badge · Button · Progress",
    description: "Inline elements for status, action, and progress.",
    dashboard: makeShowcase([
      {
        id: "bd1",
        type: "Badge",
        props: { label: "New", variant: "success" },
        style: { span: 2 },
      },
      {
        id: "bd2",
        type: "Badge",
        props: { label: "Beta", variant: "warning" },
        style: { span: 2 },
      },
      {
        id: "bd3",
        type: "Badge",
        props: { label: "Deprecated", variant: "danger" },
        style: { span: 2 },
      },
      {
        id: "bd4",
        type: "Badge",
        props: { label: "Default", variant: "secondary" },
        style: { span: 2 },
      },
      {
        id: "btn1",
        type: "Button",
        props: { label: "Continue", variant: "default" },
        style: { span: 4 },
      },
      {
        id: "prog",
        type: "Card",
        props: { title: "Setup progress" },
        style: { span: 12 },
        children: [
          {
            id: "pg1",
            type: "Progress",
            props: { label: "Workspace ready", value: 100 },
          },
          {
            id: "pg2",
            type: "Progress",
            props: { label: "Data connected", value: 60 },
          },
          {
            id: "pg3",
            type: "Progress",
            props: { label: "Team invited", value: 30 },
          },
        ],
      },
    ]),
  },
];

function makeShowcase(children: Dashboard["root"]["children"]): Dashboard {
  return {
    version: 2,
    id: "showcase",
    root: { id: "root", type: "Grid", props: { gap: 6 }, children },
    theme: undefined,
    components: {},
    dataSources: {},
    functions: {},
    state: {},
  };
}

function Showcase({
  title,
  description,
  dashboard,
}: {
  title: string;
  description: string;
  dashboard: Dashboard;
}) {
  const { data, state, dispatch } = useRuntime(dashboard);
  return (
    <section className="border-t border-border/40 py-16 first:border-t-0">
      <div className="mb-8 max-w-2xl">
        <h2 className="font-display text-[26px] font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <DashboardRenderer
          dashboard={dashboard}
          context={{ data, state, dispatch }}
        />
      </div>
    </section>
  );
}

export default function ComponentsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 max-w-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Components
        </div>
        <h1 className="font-display text-[44px] leading-[1.05] tracking-[-0.025em]">
          Real components. Live.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Every primitive on this page is rendered through the framework's
          actual runtime — same renderer, same animations, same StyleSpec
          tokens. Hover the charts, watch the stats count up.
        </p>
      </div>
      {SHOWCASES.map((s) => (
        <Showcase
          key={s.title}
          title={s.title}
          description={s.description}
          dashboard={s.dashboard}
        />
      ))}
    </div>
  );
}
