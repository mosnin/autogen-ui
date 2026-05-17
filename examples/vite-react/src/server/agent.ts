// Server-side agent setup, loaded by Vite via `ssrLoadModule` from
// `vite.config.ts`. Living in the Vite module graph (rather than being a
// top-level import in the config) lets Vite's resolver handle the
// `@autogen-ui/core/server` subpath exports properly during dev.
//
// Uses the library's scripted fake client so the example runs without any
// API key. To plug in a real model, replace the `client` below with one of:
//
//   import { createAnthropicClient } from "@autogen-ui/core/clients";
//   const client = createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! });
//
//   import { createOpenAIClient } from "@autogen-ui/core/clients";
//   const client = createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY! });
//
// Put the key in a local `.env` file or your shell env; never commit it.

import {
  createFakeClient,
  createRouteHandler,
  createUIAgent,
  defaultCapabilities,
} from "@autogen-ui/core/server";
import { toNodeHandler } from "@autogen-ui/core/node";

const fake = createFakeClient([
  {
    message: "Built a starter sales dashboard.",
    patches: [
      { op: "setTitle", title: "Sales — Q4" },
      {
        op: "append",
        parentId: "root",
        node: {
          id: "mrr",
          type: "Stat",
          props: { label: "MRR", value: 124500, delta: "+8%", trend: "up" },
        },
      },
      {
        op: "append",
        parentId: "root",
        node: {
          id: "chart",
          type: "Chart",
          props: {
            kind: "bar",
            title: "Signups",
            data: [
              { label: "Jan", value: 40 },
              { label: "Feb", value: 55 },
              { label: "Mar", value: 72 },
              { label: "Apr", value: 90 },
            ],
          },
        },
      },
    ],
  },
]);

const agent = createUIAgent({ client: fake, capabilities: defaultCapabilities });

export const apiHandler = toNodeHandler(createRouteHandler({ agent }));
