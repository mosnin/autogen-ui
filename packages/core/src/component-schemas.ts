// Per-component Zod prop schemas for the built-in component catalog.
//
// These formalize the prop contract that, today, is only conveyed to the
// model as a free-form string in `componentCatalog`. Each schema validates
// `node.props` *only* — id/type/children/style/motion/events/bindings are
// validated elsewhere by `uiNodeSchema`.
//
// Notes on strictness:
//   * `.passthrough()` everywhere so the model can emit harmless extras
//     (e.g. `span` is grid-positioning metadata read by the renderer, not
//     by the component itself; we tolerate it on every schema).
//   * Bindable props (e.g. `value` on Input, `text` on Text) are marked
//     `.optional()` because when a node carries `bindings.value`, the
//     literal `props.value` may legitimately be absent — the binding
//     fills it in at render time.
//   * Required fields are kept truly required, enums truly enumerated.
//
// To enable per-node prop validation in the agent, pass a custom
// propValidator:
//
//   createUIAgent({ ..., propValidator: (patches) => validatePatchProps(patches) })
//
// Today the agent has no such hook — the integrator will add one. Surface
// validation results via `assertValidPatches` (eval) and a host-side check
// before applying patches.

import { z } from "zod";
import type { Patch, UINode } from "./schema";

/* ------------------------------------------------------------------ *
 * Shared building blocks
 * ------------------------------------------------------------------ */

/** Allow either a literal value or a binding-template string. */
const stringOrNumber = z.union([z.string(), z.number()]);

/** Spacing token, kept in sync with the StyleSpec spacing tokens that
 *  `GAP` map in primitives.tsx actually understands. */
const gapToken = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(6),
  z.literal(8),
]);

/** Grid column span (1-12). */
const spanToken = z.number().int().min(1).max(12);

const selectOptionSchema = z.union([
  z.string(),
  z.number(),
  z
    .object({
      value: z.union([z.string(), z.number()]),
      label: z.string().optional(),
    })
    .passthrough(),
]);

const tabItemSchema = z
  .object({ value: z.string(), label: z.string() })
  .passthrough();

const accordionItemSchema = z
  .object({ value: z.string(), label: z.string() })
  .passthrough();

const breadcrumbItemSchema = z
  .object({ label: z.string(), href: z.string().optional() })
  .passthrough();

const chartDatumSchema = z
  .object({ label: z.string(), value: z.number() })
  .passthrough();

/* ------------------------------------------------------------------ *
 * Per-type schemas
 * ------------------------------------------------------------------ */

export interface ComponentPropSchemas {
  [type: string]: z.ZodTypeAny;
}

export const builtinPropSchemas: ComponentPropSchemas = {
  Grid: z
    .object({
      gap: gapToken.optional(),
    })
    .passthrough(),

  Stack: z
    .object({
      direction: z.enum(["row", "col"]).optional(),
      gap: z.number().optional(),
      align: z.enum(["start", "center", "end"]).optional(),
    })
    .passthrough(),

  Section: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .passthrough(),

  Card: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      span: spanToken.optional(),
    })
    .passthrough(),

  Stat: z
    .object({
      label: z.string(),
      value: stringOrNumber,
      delta: z.string().optional(),
      trend: z.enum(["up", "down", "flat"]).optional(),
      span: spanToken.optional(),
    })
    .passthrough(),

  Chart: z
    .object({
      kind: z.enum(["bar", "line", "area"]),
      data: z.array(chartDatumSchema),
      title: z.string().optional(),
      span: spanToken.optional(),
    })
    .passthrough(),

  Table: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.array(stringOrNumber)),
      caption: z.string().optional(),
    })
    .passthrough(),

  Heading: z
    .object({
      text: z.string(),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      reveal: z.enum(["none", "words", "chars"]).optional(),
    })
    .passthrough(),

  Text: z
    .object({
      // bindable: a node may carry `bindings.text` and omit `props.text`.
      text: z.string().optional(),
      muted: z.boolean().optional(),
      typewriter: z.boolean().optional(),
      typewriterSpeed: z.number().optional(),
    })
    .passthrough(),

  Badge: z
    .object({
      label: z.string(),
      variant: z
        .enum(["default", "secondary", "success", "warning", "danger", "outline"])
        .optional(),
    })
    .passthrough(),

  Button: z
    .object({
      label: z.string(),
      variant: z.enum(["default", "secondary", "outline", "ghost"]).optional(),
      disabled: z.boolean().optional(),
      ariaLabel: z.string().optional(),
    })
    .passthrough(),

  Progress: z
    .object({
      label: z.string().optional(),
      // bindable: numeric value can come from a binding.
      value: z.number().optional(),
    })
    .passthrough(),

  List: z
    .object({
      items: z.array(z.union([z.string(), z.number()])),
      ordered: z.boolean().optional(),
    })
    .passthrough(),

  Divider: z.object({}).passthrough(),

  Box: z
    .object({
      as: z
        .enum(["div", "section", "article", "header", "footer", "nav", "aside", "main"])
        .optional(),
    })
    .passthrough(),

  Image: z
    .object({
      src: z.string(),
      alt: z.string().optional(),
      rounded: z.enum(["none", "sm", "md", "lg", "xl", "2xl", "full"]).optional(),
      aspect: z.enum(["auto", "square", "video"]).optional(),
    })
    .passthrough(),

  Icon: z
    .object({
      name: z.enum([
        "check",
        "x",
        "arrow-up",
        "arrow-down",
        "star",
        "bolt",
        "dot",
        "chevron-right",
      ]),
      size: z.number().optional(),
    })
    .passthrough(),

  Spacer: z.object({}).passthrough(),

  Outlet: z.object({}).passthrough(),

  ForEach: z
    .object({
      source: z.string(),
      as: z.string().optional(),
      indexAs: z.string().optional(),
    })
    .passthrough(),

  Input: z
    .object({
      type: z.enum(["text", "number", "email", "password", "search", "url", "tel"]).optional(),
      placeholder: z.string().optional(),
      // bindable
      value: stringOrNumber.optional(),
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .passthrough(),

  Textarea: z
    .object({
      placeholder: z.string().optional(),
      value: z.string().optional(),
      rows: z.number().optional(),
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .passthrough(),

  Select: z
    .object({
      options: z.array(selectOptionSchema),
      value: stringOrNumber.optional(),
      placeholder: z.string().optional(),
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .passthrough(),

  Checkbox: z
    .object({
      label: z.string().optional(),
      checked: z.boolean().optional(),
    })
    .passthrough(),

  Switch: z
    .object({
      label: z.string().optional(),
      checked: z.boolean().optional(),
    })
    .passthrough(),

  Form: z.object({}).passthrough(),

  Tabs: z
    .object({
      tabs: z.array(tabItemSchema),
      value: z.string().optional(),
    })
    .passthrough(),

  Accordion: z
    .object({
      items: z.array(accordionItemSchema),
      openValues: z.array(z.string()).optional(),
    })
    .passthrough(),

  Link: z
    .object({
      href: z.string(),
      text: z.string(),
      newTab: z.boolean().optional(),
    })
    .passthrough(),

  Breadcrumb: z
    .object({
      items: z.array(breadcrumbItemSchema),
    })
    .passthrough(),

  Modal: z
    .object({
      open: z.boolean().optional(),
      title: z.string().optional(),
    })
    .passthrough(),

  Tooltip: z
    .object({
      text: z.string(),
      side: z.enum(["top", "bottom", "left", "right"]).optional(),
    })
    .passthrough(),

  Avatar: z
    .object({
      src: z.string().optional(),
      name: z.string().optional(),
      size: z.enum(["sm", "md", "lg", "xl"]).optional(),
      online: z.boolean().optional(),
    })
    .passthrough(),

  Skeleton: z
    .object({
      lines: z.number().optional(),
      height: z.enum(["sm", "md", "lg"]).optional(),
    })
    .passthrough(),

  CodeBlock: z
    .object({
      code: z.string(),
      language: z.string().optional(),
    })
    .passthrough(),

  Quote: z
    .object({
      text: z.string(),
      author: z.string().optional(),
    })
    .passthrough(),

  Kbd: z
    .object({
      keys: z.string(),
    })
    .passthrough(),

  Timeline: z
    .object({
      items: z.array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional(),
            timestamp: z.string().optional(),
            status: z.enum(["done", "current", "pending"]),
          })
          .passthrough(),
      ),
    })
    .passthrough(),

  Callout: z
    .object({
      variant: z.enum(["info", "warning", "success", "error"]),
      title: z.string().optional(),
      content: z.string().optional(),
    })
    .passthrough(),

  Stepper: z
    .object({
      steps: z.array(z.string()),
      current: z.number().optional(),
    })
    .passthrough(),
};

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

/**
 * Validate one node's `props` against its component schema. Returns a
 * one-line warning string, or null if the node validates (or if its type
 * has no registered schema — unknown types are handled elsewhere).
 */
export function validateNodeProps(
  node: { type: string; props?: Record<string, unknown>; bindings?: Record<string, string> },
  schemas: ComponentPropSchemas = builtinPropSchemas,
): string | null {
  const schema = schemas[node.type];
  if (!schema) return null;
  // Treat any prop covered by a binding as "present" so that bindable
  // required fields are not falsely flagged when the literal is omitted.
  const propsWithBindings: Record<string, unknown> = { ...(node.props ?? {}) };
  if (node.bindings) {
    for (const key of Object.keys(node.bindings)) {
      if (!(key in propsWithBindings)) propsWithBindings[key] = "";
    }
  }
  const result = schema.safeParse(propsWithBindings);
  if (result.success) return null;
  const first = result.error.errors[0];
  if (!first) return null;
  const path = first.path.join(".") || "(root)";
  return `${node.type}.props.${path}: ${first.message}`;
}

/**
 * Validate one node's `props` against its schema in **partial-update**
 * mode. Required-field errors are suppressed because the update only
 * provides a subset of props; only enum/type errors on supplied fields
 * surface. Conservative on purpose — meant to catch outright wrong
 * values, not absent ones.
 */
function validateNodePropsPartial(
  node: { type: string; props?: Record<string, unknown> },
  schemas: ComponentPropSchemas,
): string | null {
  const schema = schemas[node.type];
  if (!schema) return null;
  const result = schema.safeParse(node.props ?? {});
  if (result.success) return null;
  const supplied = new Set(Object.keys(node.props ?? {}));
  const issues = result.error.errors;
  for (const issue of issues) {
    const top = typeof issue.path[0] === "string" ? (issue.path[0] as string) : null;
    // Only surface issues that touch a key the update actually supplied.
    if (top && !supplied.has(top)) continue;
    // Required-field errors (`undefined`) on missing keys are noise for
    // partial updates.
    if (
      issue.code === "invalid_type" &&
      (issue as { received?: string }).received === "undefined"
    ) {
      continue;
    }
    const path = issue.path.join(".") || "(root)";
    return `${node.type}.props.${path}: ${issue.message}`;
  }
  return null;
}

/** Recursively walk a node tree, validating every node's props. */
function walkNodeProps(
  node: UINode,
  schemas: ComponentPropSchemas,
  out: string[],
  prefix: string,
): void {
  const warning = validateNodeProps(node, schemas);
  if (warning) out.push(`${prefix} (${node.id || "?"}): ${warning}`);
  for (const child of node.children ?? []) {
    walkNodeProps(child, schemas, out, prefix);
  }
}

/**
 * Walk every patch that introduces a node (`setRoot`, `replace`, `append`)
 * or mutates props (`update`) and emit a warning per invalid props
 * payload. Updates are validated leniently — missing required fields are
 * tolerated because the prior node holds them.
 */
export function validatePatchProps(
  patches: Patch[],
  schemas: ComponentPropSchemas = builtinPropSchemas,
): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i]!;
    const tag = `patch[${i}] (${p.op})`;
    switch (p.op) {
      case "setRoot":
      case "replace":
        walkNodeProps(p.node, schemas, warnings, tag);
        break;
      case "append":
        walkNodeProps(p.node, schemas, warnings, tag);
        break;
      case "update": {
        // We don't know the target node's type without applying patches
        // in-order against the dashboard. Skip — host-side validators can
        // do a type-aware partial check.
        // (See `validateUpdatePropsAgainstNode` for that helper.)
        break;
      }
      default:
        break;
    }
  }
  return warnings;
}

/**
 * Helper for a host-side type-aware `update` check: given the existing
 * node being updated and the patch's incoming props, run a partial-shape
 * validation against the type's schema. Returns null on success.
 */
export function validateUpdatePropsAgainstNode(
  existing: { type: string },
  incomingProps: Record<string, unknown>,
  schemas: ComponentPropSchemas = builtinPropSchemas,
): string | null {
  return validateNodePropsPartial(
    { type: existing.type, props: incomingProps },
    schemas,
  );
}

/** Merge custom prop schemas onto the defaults. Custom entries win. */
export function mergeSchemas(
  custom: ComponentPropSchemas = {},
  base: ComponentPropSchemas = builtinPropSchemas,
): ComponentPropSchemas {
  return { ...base, ...custom };
}
