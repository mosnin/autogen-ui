import CodeBlock from "../../components/CodeBlock";

const reactComponent = `// components/UserAvatar.tsx
import type { RegistryComponent } from "@autogen-ui/core";

export const UserAvatar: RegistryComponent = ({
  userId,
  size = "md",
  online = false,
}) => {
  // ...your implementation
  return <div>{String(userId)}</div>;
};`;

const registerOnClient = `// app/page.tsx
"use client";
import { createRegistry, DashboardRenderer } from "@autogen-ui/core";
import { UserAvatar } from "@/components/UserAvatar";

const registry = createRegistry({ UserAvatar });

export default function Page() {
  return (
    <DashboardRenderer dashboard={dashboard} registry={registry} />
  );
}`;

const registerOnAgent = `// app/api/autogen-ui/route.ts
import { createUIAgent, defaultCapabilities } from "@autogen-ui/core/server";

createUIAgent({
  client,
  capabilities: defaultCapabilities,
  components: [
    {
      type: "UserAvatar",
      description: "Round avatar with optional online indicator.",
      props: "userId: string, size?: 'sm'|'md'|'lg', online?: boolean",
      acceptsChildren: false,
    },
  ],
});`;

export default function Page() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Custom components</h1>
      <p className="mt-3 text-muted-foreground">
        The agent can only emit components it knows exist. Adding your own is a
        two-step process: register the React component with the renderer, then tell
        the agent about it via a <code className="font-mono text-xs">ComponentDoc</code>.
      </p>

      <h2 className="mt-8 text-lg font-semibold">1. Implement the React component</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Components receive their <code className="font-mono text-xs">props</code> as
        ordinary React props, and a <code className="font-mono text-xs">node</code>{" "}
        prop carrying the raw <code className="font-mono text-xs">UINode</code> (useful
        for reading <code className="font-mono text-xs">events</code>). If the
        component <em>accepts children</em>, they come pre-rendered via{" "}
        <code className="font-mono text-xs">children</code>.
      </p>
      <CodeBlock language="tsx" code={reactComponent} />

      <h2 className="mt-8 text-lg font-semibold">2. Register with the renderer</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <code className="font-mono text-xs">createRegistry</code> merges your
        components onto the default registry — your entries win on key conflict, so
        you can override built-ins too.
      </p>
      <CodeBlock language="tsx" code={registerOnClient} />

      <h2 className="mt-8 text-lg font-semibold">3. Tell the agent it exists</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Without this step, the model&apos;s system prompt won&apos;t list your
        component and it will never emit one. The{" "}
        <code className="font-mono text-xs">ComponentDoc</code> shape is the same one
        used by the built-in catalog.
      </p>
      <CodeBlock language="ts" code={registerOnAgent} />

      <h2 className="mt-8 text-lg font-semibold">Tips</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Use the same <code className="font-mono text-xs">props</code> string format
          as the built-in catalog — short, comma-separated, with{" "}
          <code className="font-mono text-xs">?</code> for optional. The model parses
          it as TypeScript-ish.
        </li>
        <li>
          The description should tell the agent <em>when</em> to use the component, not
          just what it looks like — e.g. &quot;Round avatar; use for user identity
          chips in headers and lists.&quot;
        </li>
        <li>
          For interactive custom components, call{" "}
          <code className="font-mono text-xs">useRuntimeContext()</code> to access{" "}
          <code className="font-mono text-xs">dispatch</code> and{" "}
          <code className="font-mono text-xs">state</code>.
        </li>
      </ul>
    </article>
  );
}
