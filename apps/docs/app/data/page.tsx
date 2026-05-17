import CodeBlock from "../../components/CodeBlock";

const staticSource = `// Inline data — no fetch, no proxy. Great for fixtures.
{
  "op": "setDataSource",
  "source": {
    "kind": "static",
    "id": "demoSales",
    "data": { "total": 84210, "growth": 0.12 }
  }
}`;

const restSource = `// REST source — fetched from the browser (or via proxy, below).
{
  "op": "setDataSource",
  "source": {
    "kind": "rest",
    "id": "sales",
    "url": "https://api.example.com/v1/sales",
    "method": "GET",
    "select": "data.summary",
    "pollMs": 30000
  }
}`;

const proxyRoute = `// app/api/autogen-ui/proxy/route.ts
import { createDataProxyHandler } from "@autogen-ui/core/server";

export const POST = createDataProxyHandler({
  // URL allowlist — origins not on this list are rejected.
  allow: ["https://api.yourcompany.com/"],

  // Server-injected headers override anything the client sends.
  // Auth tokens stay server-side and never reach the browser.
  headers: () => ({
    authorization: \`Bearer \${process.env.UPSTREAM_TOKEN}\`,
  }),
});`;

const hookUsage = `// Client page
"use client";
import {
  DashboardRenderer,
  useDataSources,
  useRuntime,
} from "@autogen-ui/core";

export default function Page({ dashboard }: { dashboard: Dashboard }) {
  // Route every REST source through your proxy.
  const { data, refetch, loading } = useDataSources(dashboard, {
    proxyUrl: "/api/autogen-ui/proxy",
  });
  const { state, dispatch } = useRuntime(dashboard);

  return (
    <DashboardRenderer
      dashboard={dashboard}
      context={{ data, state, dispatch }}
    />
  );
}`;

const bindingExample = `// Once registered, any node can read from it via bindings.
{
  "id": "rev",
  "type": "Stat",
  "bindings": {
    "label": "Revenue",
    "value": "{{data.sales.total | currency:EUR}}"
  }
}`;

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Data</h1>
      <p className="mt-3 text-muted-foreground">
        Dashboards talk to the outside world through{" "}
        <code className="font-mono text-xs">DataSource</code>s — declarative records the
        agent registers via the <code className="font-mono text-xs">setDataSource</code>{" "}
        patch. The runtime fetches them, exposes the results as{" "}
        <code className="font-mono text-xs">data.&lt;id&gt;</code>, and re-fetches on
        the <code className="font-mono text-xs">pollMs</code> interval if set.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Two kinds: static + rest</h2>
      <CodeBlock language="json" code={staticSource} />
      <CodeBlock language="json" code={restSource} />

      <h2 className="mt-8 text-lg font-semibold">Reading data in bindings</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Once a source is registered, any node binding can read from it. Dot-paths
        traverse the payload after <code className="font-mono text-xs">select</code> has
        applied.
      </p>
      <CodeBlock language="json" code={bindingExample} />

      <h2 className="mt-8 text-lg font-semibold">The proxy pattern</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Browser <code className="font-mono text-xs">fetch</code> is subject to CORS and
        can&apos;t carry secrets. Route REST sources through a server handler that
        injects auth headers and enforces an origin allowlist — neither ever leaves the
        server.
      </p>
      <CodeBlock language="ts" code={proxyRoute} />
      <CodeBlock language="tsx" code={hookUsage} />

      <h2 className="mt-8 text-lg font-semibold">When to use what</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">Static</strong> — fixtures, demos, tests.
          Zero network. The payload travels inside the dashboard spec.
        </li>
        <li>
          <strong className="text-foreground">REST + proxy</strong> — anything talking
          to your own backend. Auth tokens stay server-side.
        </li>
        <li>
          <strong className="text-foreground">REST direct</strong> — public,
          CORS-friendly APIs. The browser hits the URL as-is.
        </li>
      </ul>
    </article>
  );
}
