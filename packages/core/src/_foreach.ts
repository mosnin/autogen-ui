import type { RuntimeContext } from "./runtime";
import type { JsonValue, UINode } from "./schema";

/**
 * ForEach expansion. Detects nodes of type `ForEach` and replaces them with a
 * Box wrapper containing N rendered copies of the first child (the template),
 * each carrying an iteration scope (`{ [as]: item, [indexAs]: i }`).
 *
 * Bindings on the template resolve via `ctx.scope` at render time. Event
 * actions that reference `{{<as>.X}}` are rewritten at expansion to the
 * concrete value — actions don't have access to ctx.scope at dispatch time.
 */

function isArr<T = unknown>(v: unknown): v is T[] {
  return Array.isArray(v);
}

function readPath(obj: unknown, path: string): unknown {
  const keys = path.split(".").filter(Boolean);
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function resolveSource(source: string, ctx: RuntimeContext): unknown {
  if (source.startsWith("state.")) return readPath(ctx.state, source.slice("state.".length));
  if (source === "state") return ctx.state;
  if (source.startsWith("data.")) return readPath(ctx.data, source.slice("data.".length));
  return readPath(ctx.data, source);
}

/** Deep-clone a node and suffix every id with `__<sfx>` so iterations are unique. */
function cloneWithSuffix(node: UINode, sfx: string): UINode {
  const clone: UINode = {
    ...node,
    id: `${node.id}__${sfx}`,
  };
  if (node.props) clone.props = JSON.parse(JSON.stringify(node.props));
  if (node.bindings) clone.bindings = { ...node.bindings };
  if (node.events) clone.events = JSON.parse(JSON.stringify(node.events));
  if (node.style) clone.style = JSON.parse(JSON.stringify(node.style));
  if (node.children) clone.children = node.children.map((c) => cloneWithSuffix(c, sfx));
  return clone;
}

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Replace `{{<as>.X}}` / `{{<as>}}` / `{{<indexAs>}}` in a string with concrete values. */
function rewriteString(
  value: string,
  scope: Record<string, unknown>,
): string | unknown {
  const wholeMatch = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(value);
  if (wholeMatch) {
    const path = wholeMatch[1]!.trim();
    const head = path.split(".")[0]!;
    if (head in scope) {
      const rest = path.slice(head.length).replace(/^\./, "");
      const root = scope[head];
      return rest === "" ? root : readPath(root, rest);
    }
    return value;
  }
  TOKEN_RE.lastIndex = 0;
  return value.replace(TOKEN_RE, (match, raw: string) => {
    const path = raw.trim();
    const head = path.split(".")[0]!;
    if (!(head in scope)) return match;
    const rest = path.slice(head.length).replace(/^\./, "");
    const root = scope[head];
    const resolved = rest === "" ? root : readPath(root, rest);
    return resolved == null ? "" : String(resolved);
  });
}

function rewriteValue(value: JsonValue, scope: Record<string, unknown>): JsonValue {
  if (typeof value === "string") {
    const next = rewriteString(value, scope);
    // If `next` is no longer a string (whole-token replaced with typed value),
    // coerce back into JsonValue. Strings/numbers/booleans/null are fine; objects/arrays too.
    if (
      typeof next === "string" ||
      typeof next === "number" ||
      typeof next === "boolean" ||
      next === null ||
      Array.isArray(next) ||
      (typeof next === "object" && next !== null)
    ) {
      return next as JsonValue;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteValue(v, scope)) as JsonValue;
  if (value && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewriteValue(v as JsonValue, scope);
    return out;
  }
  return value;
}

/** Walk a node tree, rewriting only `events` action values (one-shot scope substitution). */
function rewriteEventsInTree(node: UINode, scope: Record<string, unknown>): void {
  if (node.events) {
    for (const eventName of Object.keys(node.events)) {
      const actions = node.events[eventName];
      if (!actions) continue;
      node.events[eventName] = actions.map(
        (action) => rewriteValue(action as unknown as JsonValue, scope) as unknown as typeof action,
      );
    }
  }
  if (node.children) for (const c of node.children) rewriteEventsInTree(c, scope);
}

/**
 * `resolveNode` implementation. Returns `node` unchanged when it isn't a
 * `ForEach`, so the renderer's resolve loop terminates.
 */
export function expandForEach(node: UINode, ctx: RuntimeContext): UINode {
  if (node.type !== "ForEach") return node;

  const source = typeof node.props?.source === "string" ? node.props.source : "";
  const as = typeof node.props?.as === "string" ? node.props.as : "item";
  const indexAs = typeof node.props?.indexAs === "string" ? node.props.indexAs : "i";

  const template = node.children?.[0];
  if (!source || !template) {
    return { ...node, type: "Box", children: [], props: { _expanded: true } };
  }

  const resolved = resolveSource(source, ctx);
  if (!isArr(resolved)) {
    return { ...node, type: "Box", children: [], props: { _expanded: true } };
  }

  const children: UINode[] = resolved.map((item, i) => {
    const child = cloneWithSuffix(template, String(i));
    const scope: Record<string, unknown> = { [as]: item, [indexAs]: i };
    rewriteEventsInTree(child, scope);
    return {
      ...child,
      props: {
        ...(child.props ?? {}),
        _scope: scope as Record<string, JsonValue>,
      },
    };
  });

  return {
    ...node,
    type: "Box",
    children,
    props: { ...(node.props ?? {}), _expanded: true },
  };
}
