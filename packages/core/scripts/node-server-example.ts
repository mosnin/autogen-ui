// Minimal framework-agnostic example: serve the autogen-ui agent from a
// plain Node http server. Uses the fake client so it runs without an API
// key — swap in createAnthropicClient/createOpenAIClient for production.
//
//   pnpm --filter @autogen-ui/core example:node
//   curl -s localhost:3000/api/autogen-ui -X POST \
//     -H 'content-type: application/json' \
//     -d '{"messages":[{"role":"user","content":"hi"}]}'

import { createServer } from "node:http";
import { toNodeHandler } from "../src/node";
import {
  createRouteHandler,
  createUIAgent,
  defaultCapabilities,
} from "../src/server";
import { createFakeClient } from "../src/eval/harness";

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
const handler = toNodeHandler(createRouteHandler({ agent }));

const port = Number(process.env.PORT) || 3000;
createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/autogen-ui") {
    return handler(req, res);
  }
  res.statusCode = 404;
  res.end("not found");
}).listen(port, () => {
  process.stdout.write(`autogen-ui node example listening on :${port}\n`);
});
