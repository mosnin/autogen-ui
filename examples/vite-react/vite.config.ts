import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import {
  createRouteHandler,
  createUIAgent,
  defaultCapabilities,
  createFakeClient,
} from "@autogen-ui/core/server";
import { toNodeHandler } from "@autogen-ui/core/node";

// A scripted fake client so this example runs with zero API keys.
// To swap in a real model, replace the `client` argument below with
// `createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! })`
// (or `createOpenAIClient(...)`) imported from `@autogen-ui/core/clients`.
// Put the key in a `.env` file or your shell env; never commit it.
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
const apiHandler = toNodeHandler(createRouteHandler({ agent }));

// Mount the autogen-ui POST handler on Vite's dev middleware so the example
// runs as a single `pnpm dev` process (no separate API server needed).
function autogenUiApi(): PluginOption {
  return {
    name: "autogen-ui-api",
    configureServer(server) {
      server.middlewares.use("/api/autogen-ui", (req, res, next) => {
        if (req.method !== "POST") return next();
        apiHandler(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), autogenUiApi()],
  server: {
    port: 5173,
  },
});
