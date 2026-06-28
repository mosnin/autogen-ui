/**
 * autogen-ui × shadcn/ui — a drop-in registry that renders the agent's spec
 * tree with shadcn/ui components and lucide-react icons.
 *
 * Copy the `autogen-shadcn/` folder into your shadcn app (it imports
 * `@/components/ui/*`), then:
 *
 *   import { createShadcnRegistry, shadcnInstructions } from "@/autogen-shadcn";
 *
 *   // client — render with shadcn components
 *   <DashboardRenderer dashboard={dashboard} registry={createShadcnRegistry()} ... />
 *
 *   // server — tell the agent it's targeting shadcn + the full lucide icon set
 *   createStreamingUIAgent({ client, capabilities, instructions: shadcnInstructions });
 *
 * See ../README.md for the full setup (which shadcn components to add, the
 * Tailwind safelist, and what falls through to the core built-ins).
 */

export { createShadcnRegistry } from "./registry";
export { LucideIcon } from "./icon";
export { shadcnInstructions, advertisedIconNames } from "./prompt";
