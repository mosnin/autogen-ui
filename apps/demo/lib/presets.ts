import type { Dashboard } from "@autogen-ui/core";

/**
 * Hand-curated dashboard "seeds" — pre-baked specs that render instantly
 * when a suggestion is clicked. The agent never has to start from zero.
 * Each is tuned to look great immediately, then the user keeps editing
 * via the agent. This is what kills the "cold start" feeling.
 */

const id = (n: string) => n;

export const revenueSeed: Dashboard = {
  version: 2,
  id: "seed:revenue",
  title: "Revenue — Q4",
  root: {
    id: id("root"),
    type: "Grid",
    props: { gap: 6 },
    children: [
      {
        id: "mrr",
        type: "Stat",
        props: {
          label: "MRR",
          value: 248420,
          delta: "+12.4% vs Q3",
          trend: "up",
          sparkline: [180, 195, 210, 218, 232, 241, 248],
        },
        style: { span: 3 },
      },
      {
        id: "arr",
        type: "Stat",
        props: {
          label: "ARR",
          value: 2981040,
          delta: "+18% YoY",
          trend: "up",
          sparkline: [2400, 2520, 2650, 2780, 2860, 2920, 2981],
        },
        style: { span: 3 },
      },
      {
        id: "churn",
        type: "Stat",
        props: {
          label: "Net Churn",
          value: "2.1%",
          delta: "-0.4pp",
          trend: "down",
          sparkline: [3.2, 3.0, 2.8, 2.6, 2.5, 2.3, 2.1],
        },
        style: { span: 3 },
      },
      {
        id: "active",
        type: "Stat",
        props: {
          label: "Active Users",
          value: 18420,
          delta: "+1,204 this week",
          trend: "up",
          sparkline: [15.1, 15.8, 16.3, 16.9, 17.4, 17.9, 18.4],
        },
        style: { span: 3 },
      },
      {
        id: "growth",
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
        style: { span: 8 },
      },
      {
        id: "channels",
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
        style: { span: 4 },
      },
      {
        id: "customers",
        type: "Card",
        props: { title: "Recent customers", description: "Last 7 days" },
        style: { span: 12 },
        children: [
          {
            id: "customers-table",
            type: "Table",
            props: {
              columns: ["Company", "Plan", "MRR", "Signed up"],
              rows: [
                ["Acme Corp", "Enterprise", 1499, "2 hours ago"],
                ["Nova Labs", "Team", 299, "Yesterday"],
                ["Pulse Health", "Team", 299, "2 days ago"],
                ["Atlas Pay", "Pro", 99, "3 days ago"],
                ["Cobalt Inc", "Pro", 99, "5 days ago"],
              ],
            },
          },
        ],
      },
    ],
  },
  theme: undefined,
  components: {},
  dataSources: {},
  state: {},
};

export const fitnessSeed: Dashboard = {
  version: 2,
  id: "seed:fitness",
  title: "This week",
  root: {
    id: "root",
    type: "Grid",
    props: { gap: 6 },
    children: [
      {
        id: "steps",
        type: "Stat",
        props: {
          label: "Steps",
          value: 64280,
          delta: "+8% vs last week",
          trend: "up",
          sparkline: [8200, 9100, 7800, 10200, 9400, 11800, 7780],
        },
        style: { span: 3 },
      },
      {
        id: "minutes",
        type: "Stat",
        props: {
          label: "Active minutes",
          value: 412,
          delta: "+24 min",
          trend: "up",
          sparkline: [48, 62, 51, 78, 64, 89, 60],
        },
        style: { span: 3 },
      },
      {
        id: "sleep",
        type: "Stat",
        props: {
          label: "Sleep avg",
          value: "7h 24m",
          delta: "-12 min",
          trend: "down",
        },
        style: { span: 3 },
      },
      {
        id: "rhr",
        type: "Stat",
        props: {
          label: "Resting HR",
          value: 58,
          delta: "-2 bpm",
          trend: "down",
          sparkline: [62, 61, 60, 59, 59, 58, 58],
        },
        style: { span: 3 },
      },
      {
        id: "activity",
        type: "Chart",
        props: {
          kind: "bar",
          title: "Activity this week",
          data: [
            { label: "Mon", value: 48 },
            { label: "Tue", value: 62 },
            { label: "Wed", value: 51 },
            { label: "Thu", value: 78 },
            { label: "Fri", value: 64 },
            { label: "Sat", value: 89 },
            { label: "Sun", value: 60 },
          ],
        },
        style: { span: 12 },
      },
    ],
  },
  theme: undefined,
  components: {},
  dataSources: {},
  state: {},
};

export const contentSeed: Dashboard = {
  version: 2,
  id: "seed:content",
  title: "Content performance",
  root: {
    id: "root",
    type: "Grid",
    props: { gap: 6 },
    children: [
      {
        id: "views",
        type: "Stat",
        props: {
          label: "Views",
          value: 1284200,
          delta: "+22% this month",
          trend: "up",
          sparkline: [820, 910, 980, 1050, 1140, 1220, 1284],
        },
        style: { span: 4 },
      },
      {
        id: "ctr",
        type: "Stat",
        props: {
          label: "Click-through",
          value: "4.2%",
          delta: "+0.3pp",
          trend: "up",
        },
        style: { span: 4 },
      },
      {
        id: "watch",
        type: "Stat",
        props: {
          label: "Avg. watch time",
          value: "3m 18s",
          delta: "+22s",
          trend: "up",
        },
        style: { span: 4 },
      },
      {
        id: "trend",
        type: "Chart",
        props: {
          kind: "area",
          title: "Daily views",
          data: Array.from({ length: 14 }, (_, i) => ({
            label: `D${i + 1}`,
            value: Math.round(60_000 + Math.sin(i / 2) * 18_000 + i * 2_400),
          })),
        },
        style: { span: 12 },
      },
    ],
  },
  theme: undefined,
  components: {},
  dataSources: {},
  state: {},
};

export interface Seed {
  id: string;
  label: string;
  prompt: string;
  dashboard: Dashboard;
}

export const seeds: Seed[] = [
  {
    id: "revenue",
    label: "SaaS revenue dashboard",
    prompt: "Build a SaaS revenue dashboard with MRR, churn and active users",
    dashboard: revenueSeed,
  },
  {
    id: "fitness",
    label: "Fitness tracker",
    prompt: "Build a fitness tracker dashboard with steps, sleep and heart rate",
    dashboard: fitnessSeed,
  },
  {
    id: "content",
    label: "Content analytics",
    prompt: "Build a content analytics dashboard with views, CTR and watch time",
    dashboard: contentSeed,
  },
];
