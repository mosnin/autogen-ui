# autogen-ui × shadcn/ui

Render the agent's generated UI with **shadcn/ui** components and **lucide-react**
icons instead of the framework's built-ins.

This is a **drop-in module**, not an installable package — it imports
`@/components/ui/*` from your own app, the way shadcn is meant to be used (you
own the component code). Copy the `autogen-shadcn/` folder into your project and
wire it up.

> Because it imports `@/components/ui/*` and `lucide-react`, this folder does
> **not** typecheck inside this repo — those modules only exist in your app.

## Why this works with almost no glue

The framework was built to be component-library-agnostic, and two things make
shadcn a near-perfect fit:

1. **The design tokens are identical.** autogen-ui styles everything with
   `background` / `card` / `primary` / `muted` / `border` / `--chart-1…` — which
   are exactly the CSS variables shadcn writes into `globals.css`. So even the
   components we *don't* remap already look native.
2. **The adapter API.** `createRegistry` lets you override any spec `type` →
   component mapping. We only remap the ~21 types that have a real shadcn
   primitive; the rest fall through to the built-ins.

## Setup

### 1. Prerequisites

A Next.js (or any React) app that already has:

- **shadcn/ui** initialised (`npx shadcn@latest init`) — gives you `globals.css`
  with the design tokens and the `@/components/ui` alias.
- **`@autogen-ui/core`** and its peer **`framer-motion`** installed.
- **`lucide-react`** (shadcn installs this already).

### 2. Add the shadcn components this registry maps onto

```bash
npx shadcn@latest add card button badge input textarea select checkbox \
  switch label tabs accordion avatar skeleton tooltip dialog separator \
  progress table
```

### 3. Copy the module in

Copy `autogen-shadcn/` to your app so it resolves as `@/autogen-shadcn`
(e.g. `src/autogen-shadcn/` or `app/autogen-shadcn/`).

### 4. Keep the Tailwind safelist

The renderer still compiles each node's `style` to Tailwind utility classes and
wraps every node in a grid-span class. Those are runtime-generated, so Tailwind
can't see them by scanning source — add the framework's safelist (same as the
base quickstart):

```ts
// tailwind.config.ts
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

export default {
  // ...your shadcn config
  safelist: STATIC_SAFELIST.split(/\s+/).filter(Boolean),
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/@autogen-ui/core/dist/**/*.js",
  ],
};
```

You do **not** need to import `@autogen-ui/core/styles.css` — shadcn's
`globals.css` already defines the tokens. (Keep your shadcn `--chart-1…`
variables; the built-in `Chart` uses `--chart-1`.)

### 5. Wire it up

**Client** — pass the registry to the renderer (see `example/page.tsx`):

```tsx
import { createShadcnRegistry } from "@/autogen-shadcn";
const registry = createShadcnRegistry();

<DashboardRenderer dashboard={dashboard} registry={registry} context={{ data, state, dispatch }} />
```

**Server** — tell the agent it's targeting shadcn + the full lucide icon set
(see `example/route.ts`):

```ts
import { shadcnInstructions } from "@/autogen-shadcn";

createStreamingUIAgent({ client, capabilities, instructions: shadcnInstructions });
```

That's the whole integration.

## What maps to what

| Mapped to shadcn/ui | Falls through to the built-in (no shadcn primitive) |
|---|---|
| Card, Stat\*, Badge, Button, Progress, Divider→Separator, Avatar, Skeleton, Tooltip, Table, Input, Textarea, Select, Checkbox, Switch, Form, Tabs, Accordion, Modal→Dialog, Link, **Icon→lucide** | Grid, Stack, Section, Box, Spacer, Image, Outlet, ForEach, Heading, Text, List, Quote, Kbd, CodeBlock, Chart |

\* `Stat` is rendered inside a shadcn `Card`. The framework's own `Stat` has a
count-up animation + sparkline; if you prefer that, drop `Stat` from the
overrides and it falls back to the built-in.

### Icons: the real fix

The built-in `Icon` shipped **eight** hand-drawn SVGs (`check`, `x`, `arrow-up`,
`arrow-down`, `star`, `bolt`, `dot`, `chevron-right`). `LucideIcon` resolves the
**entire lucide-react set** at runtime by name (kebab-case → PascalCase), with a
neutral fallback for unknown names — so the agent can ask for `shopping-cart`,
`trending-up`, `shield`, `github`, whatever, and get a real icon.
`shadcnInstructions` advertises a curated list so the model reaches for names
that exist.

## Faithful event wiring

The interactive components aren't just restyled — they preserve the framework's
runtime contracts, so the agent's generated `events` keep working:

- `Input` / `Textarea` / `Select` / `Checkbox` / `Switch` dispatch `onChange`
  with `{{event.value}}` (and `Input` keeps schema validation).
- `Form` dispatches `onSubmit` with `{{event.values}}`.
- `Tabs` / `Accordion` dispatch `onChange` with the changed item's value
  (Accordion recovers the single toggled item from Radix's array callback so the
  agent's `toggleState` action still works).
- `Modal`→`Dialog` dispatches `onClose` on Esc/backdrop/close.
- `Table` dispatches `onRowClick` with the row payload.
- `Button` stays presentational — the renderer auto-wires `onClick`, so wiring it
  here too would double-fire.

## Customising

`createShadcnRegistry(overrides)` takes a registry you can use to replace or add
mappings:

```ts
createShadcnRegistry({
  Chart: MyRechartsChart,          // swap the built-in SVG chart
  PricingTier: MyPricingComponent, // add an agent-usable custom type
});
```
