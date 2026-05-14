import { defaultRegistry } from "./registry";
import type { RuntimeContext } from "./runtime";
import {
  componentDefSchema,
  type ComponentDef,
  type ComponentParam,
  type Dashboard,
  type JsonValue,
  type UINode,
} from "./schema";

/**
 * Component instantiation. `instantiateComponent` is a `resolveNode`
 * implementation: it expands a node whose `type` matches a defined
 * `ComponentDef` into that def's template, substituting `{{param}}`
 * placeholders and re-iding the subtree deterministically.
 */

/** Hard cap on transitive expansion depth — guards against recursive defs. */
const MAX_DEPTH = 20;

const BUILTIN_TYPES = new Set(Object.keys(defaultRegistry));

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const WHOLE_TOKEN_RE = /^\{\{\s*([A-Za-z0-9_]+)\s*\}\}$/;

type ParamValues = Record<string, JsonValue>;

function resolveParamValues(def: ComponentDef, props: Record<string, JsonValue> | undefined): ParamValues {
  const values: ParamValues = {};
  for (const param of def.params) {
    const provided = props?.[param.name];
    if (provided !== undefined) {
      values[param.name] = provided;
    } else if (param.default !== undefined) {
      values[param.name] = param.default;
    }
  }
  return values;
}

/** Substitute `{{param}}` tokens inside a single string value. */
function substituteString(value: string, params: ParamValues): JsonValue {
  const whole = value.match(WHOLE_TOKEN_RE);
  if (whole) {
    const name = whole[1]!;
    const replacement = params[name];
    return replacement === undefined ? value : replacement;
  }
  return value.replace(TOKEN_RE, (match, name: string) => {
    const replacement = params[name];
    if (replacement === undefined) return match;
    if (typeof replacement === "string") return replacement;
    if (typeof replacement === "number" || typeof replacement === "boolean") {
      return String(replacement);
    }
    return JSON.stringify(replacement);
  });
}

/** Deep-substitute tokens inside any JSON value. */
function substituteJson(value: JsonValue, params: ParamValues): JsonValue {
  if (typeof value === "string") return substituteString(value, params);
  if (Array.isArray(value)) return value.map((v) => substituteJson(v, params));
  if (value !== null && typeof value === "object") {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteJson(v, params);
    return out;
  }
  return value;
}

function substituteProps(
  props: Record<string, JsonValue> | undefined,
  params: ParamValues,
): Record<string, JsonValue> | undefined {
  if (!props) return undefined;
  const out: Record<string, JsonValue> = {};
  for (const [k, v] of Object.entries(props)) out[k] = substituteJson(v, params);
  return out;
}

function substituteBindings(
  bindings: Record<string, string> | undefined,
  params: ParamValues,
): Record<string, string> | undefined {
  if (!bindings) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(bindings)) {
    const sub = substituteString(v, params);
    out[k] = typeof sub === "string" ? sub : String(sub);
  }
  return out;
}

/** Clone a template subtree, substituting tokens and deterministically re-iding. */
function expandTemplate(template: UINode, params: ParamValues, idPrefix: string): UINode {
  const expanded: UINode = {
    id: `${idPrefix}__${template.id}`,
    type: template.type,
  };
  const props = substituteProps(template.props, params);
  if (props) expanded.props = props;
  const bindings = substituteBindings(template.bindings, params);
  if (bindings) expanded.bindings = bindings;
  if (template.style) expanded.style = template.style;
  if (template.motion) expanded.motion = template.motion;
  if (template.events) expanded.events = template.events;
  if (template.children) {
    expanded.children = template.children.map((child) =>
      expandTemplate(child, params, idPrefix),
    );
  }
  return expanded;
}

function errorNode(id: string, message: string): UINode {
  return { id, type: "Text", props: { text: message, muted: true } };
}

/**
 * `resolveNode` implementation: expand a defined-component node into its
 * template. Returns the same reference when `node.type` is not a defined
 * component, so the renderer's resolve loop terminates.
 */
export function instantiateComponent(node: UINode, ctx: RuntimeContext): UINode {
  const def = ctx.dashboard.components[node.type];
  if (!def) return node;

  // Cycle / runaway-recursion guard: count how deep this expansion chain is
  // by walking the deterministic id prefix produced by `expandTemplate`.
  const depth = node.id.split("__").length - 1;
  if (depth >= MAX_DEPTH) {
    return errorNode(node.id, `Component "${node.type}" exceeded max expansion depth`);
  }

  const params = resolveParamValues(def, node.props);
  const expansion = expandTemplate(def.template, params, node.id);

  // The expansion root keeps the instance node's id; instance overrides win.
  const root: UINode = { ...expansion, id: node.id };
  if (node.style) root.style = node.style;
  if (node.motion) root.motion = node.motion;
  if (node.events) root.events = node.events;
  if (node.children) root.children = node.children;

  return root;
}

/** True if the template references `name` anywhere in its subtree. */
function templateReferences(template: UINode, name: string): boolean {
  if (template.type === name) return true;
  return (template.children ?? []).some((child) => templateReferences(child, name));
}

/**
 * Parse + validate a `ComponentDef`. Rejects defs that collide with a
 * built-in type or that directly self-reference with no base case.
 */
export function validateComponentDef(
  def: unknown,
): { ok: true; def: ComponentDef } | { ok: false; error: string } {
  const parsed = componentDefSchema.safeParse(def);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join("; ") };
  }
  const value = parsed.data;
  if (BUILTIN_TYPES.has(value.name)) {
    return { ok: false, error: `Name "${value.name}" collides with a built-in component type` };
  }
  if (value.template.type === value.name) {
    return {
      ok: false,
      error: `Component "${value.name}" directly self-references at its template root (infinite recursion)`,
    };
  }
  return { ok: true, def: value };
}

/** Names of all components defined on a dashboard. */
export function listComponentTypes(dashboard: Dashboard): string[] {
  return Object.keys(dashboard.components);
}

export type { ComponentDef, ComponentParam };
