import type { Patch } from "@autogen-ui/core";

/**
 * A "patch script" is a pre-recorded sequence of patches with timings —
 * the exact stream a real agent turn would emit, but baked in so the
 * landing page can show the magic without an API key.
 */
export interface ScriptStep {
  /** Delay before this step (ms). */
  delay: number;
  patch: Patch;
}

export interface AgentScript {
  /** What the user typed. Shown above the dashboard. */
  prompt: string;
  /** Optional assistant message. Typed in as patches arrive. */
  message?: string;
  steps: ScriptStep[];
}

/**
 * "Build a SaaS revenue dashboard" — composes 6 widgets across ~5 seconds
 * with realistic inter-patch timing. Each Stat/Chart arrives, animates in,
 * count-ups settle, sparklines trace.
 */
export const revenueScript: AgentScript = {
  prompt: "Build a SaaS revenue dashboard with MRR, churn, and active users.",
  message: "Composed a Q4 revenue dashboard.",
  steps: [
    { delay: 200, patch: { op: "setTitle", title: "Revenue — Q4" } },
    {
      delay: 350,
      patch: {
        op: "append",
        parentId: "root",
        node: {
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
      },
    },
    {
      delay: 280,
      patch: {
        op: "append",
        parentId: "root",
        node: {
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
      },
    },
    {
      delay: 280,
      patch: {
        op: "append",
        parentId: "root",
        node: {
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
      },
    },
    {
      delay: 280,
      patch: {
        op: "append",
        parentId: "root",
        node: {
          id: "active",
          type: "Stat",
          props: {
            label: "Active",
            value: 18420,
            delta: "+1,204",
            trend: "up",
            sparkline: [15.1, 15.8, 16.3, 16.9, 17.4, 17.9, 18.4],
          },
          style: { span: 3 },
        },
      },
    },
    {
      delay: 480,
      patch: {
        op: "append",
        parentId: "root",
        node: {
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
      },
    },
    {
      delay: 400,
      patch: {
        op: "append",
        parentId: "root",
        node: {
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
      },
    },
  ],
};

/** A short edit turn that shows patches re-flowing in place. */
export const editScript: AgentScript = {
  prompt: "Make MRR the big one — full width — and add a sparkline.",
  steps: [
    {
      delay: 250,
      patch: {
        op: "update",
        id: "mrr",
        props: { value: 248420, delta: "+12.4% vs Q3", trend: "up" },
      },
    },
    {
      delay: 200,
      patch: { op: "setStyle", id: "mrr", style: { span: 12 } },
    },
  ],
};
