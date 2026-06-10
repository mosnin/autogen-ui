import type { Dashboard } from "@autogen-ui/core";

/** A small revenue dashboard the BrandSwitcher renders against. */
export const revenueSeed: Dashboard = {
  version: 2,
  id: "site:seed:revenue",
  title: undefined,
  root: {
    id: "root",
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
        style: { span: 4 },
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
        style: { span: 4 },
      },
      {
        id: "active",
        type: "Stat",
        props: {
          label: "Active",
          value: 18420,
          delta: "+1,204 this week",
          trend: "up",
          sparkline: [15.1, 15.8, 16.3, 16.9, 17.4, 17.9, 18.4],
        },
        style: { span: 4 },
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
        style: { span: 12 },
      },
    ],
  },
  theme: undefined,
  components: {},
  dataSources: {},
  functions: {},
  state: {},
};
