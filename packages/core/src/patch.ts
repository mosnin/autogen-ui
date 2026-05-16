import type { Dashboard, Patch, UINode } from "./schema";

/* ------------------------------------------------------------------ *
 * Tree helpers
 * ------------------------------------------------------------------ */

function mapTree(node: UINode, fn: (n: UINode) => UINode): UINode {
  const mapped = fn(node);
  if (!mapped.children || mapped.children.length === 0) return mapped;
  return { ...mapped, children: mapped.children.map((c) => mapTree(c, fn)) };
}

function removeFromTree(node: UINode, id: string): UINode {
  if (!node.children) return node;
  return {
    ...node,
    children: node.children.filter((c) => c.id !== id).map((c) => removeFromTree(c, id)),
  };
}

function findNode(node: UINode, id: string): UINode | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

function insertChild(node: UINode, parentId: string, child: UINode, index?: number): UINode {
  if (node.id === parentId) {
    const children = [...(node.children ?? [])];
    const at = index === undefined ? children.length : Math.min(index, children.length);
    children.splice(at, 0, child);
    return { ...node, children };
  }
  if (!node.children) return node;
  return {
    ...node,
    children: node.children.map((c) => insertChild(c, parentId, child, index)),
  };
}

/** Immutably set a value at a dot-path inside an object. */
function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".").filter(Boolean);
  if (keys.length === 0) return obj;
  const [head, ...rest] = keys as [string, ...string[]];
  if (rest.length === 0) return { ...obj, [head]: value };
  const child =
    typeof obj[head] === "object" && obj[head] !== null
      ? (obj[head] as Record<string, unknown>)
      : {};
  return { ...obj, [head]: setPath(child, rest.join("."), value) };
}

/* ------------------------------------------------------------------ *
 * Patch application
 * ------------------------------------------------------------------ */

/** Apply a single patch, returning a new Dashboard. Unknown ids are no-ops. */
export function applyPatch(dashboard: Dashboard, patch: Patch): Dashboard {
  switch (patch.op) {
    case "setRoot":
      return { ...dashboard, root: patch.node };

    case "setTitle":
      return { ...dashboard, title: patch.title };

    case "replace":
      return {
        ...dashboard,
        root: mapTree(dashboard.root, (n) => (n.id === patch.id ? patch.node : n)),
      };

    case "update":
      return {
        ...dashboard,
        root: mapTree(dashboard.root, (n) =>
          n.id === patch.id ? { ...n, props: { ...n.props, ...patch.props } } : n,
        ),
      };

    case "append":
      return {
        ...dashboard,
        root: insertChild(dashboard.root, patch.parentId, patch.node, patch.index),
      };

    case "remove":
      if (patch.id === dashboard.root.id) return dashboard;
      return { ...dashboard, root: removeFromTree(dashboard.root, patch.id) };

    case "move": {
      const moving = findNode(dashboard.root, patch.id);
      if (!moving || patch.id === dashboard.root.id) return dashboard;
      const without = removeFromTree(dashboard.root, patch.id);
      return { ...dashboard, root: insertChild(without, patch.parentId, moving, patch.index) };
    }

    case "setStyle":
      return {
        ...dashboard,
        root: mapTree(dashboard.root, (n) =>
          n.id === patch.id ? { ...n, style: patch.style ?? undefined } : n,
        ),
      };

    case "setMotion":
      return {
        ...dashboard,
        root: mapTree(dashboard.root, (n) =>
          n.id === patch.id ? { ...n, motion: patch.motion ?? undefined } : n,
        ),
      };

    case "setBindings":
      return {
        ...dashboard,
        root: mapTree(dashboard.root, (n) =>
          n.id === patch.id ? { ...n, bindings: patch.bindings ?? undefined } : n,
        ),
      };

    case "setEvents":
      return {
        ...dashboard,
        root: mapTree(dashboard.root, (n) =>
          n.id === patch.id ? { ...n, events: patch.events ?? undefined } : n,
        ),
      };

    case "setTheme":
      return { ...dashboard, theme: { ...dashboard.theme, ...patch.theme } };

    case "defineComponent":
      return {
        ...dashboard,
        components: { ...dashboard.components, [patch.def.name]: patch.def },
      };

    case "removeComponent": {
      const components = { ...dashboard.components };
      delete components[patch.name];
      return { ...dashboard, components };
    }

    case "setDataSource":
      return {
        ...dashboard,
        dataSources: { ...dashboard.dataSources, [patch.source.id]: patch.source },
      };

    case "removeDataSource": {
      const dataSources = { ...dashboard.dataSources };
      delete dataSources[patch.id];
      return { ...dashboard, dataSources };
    }

    case "setState":
      return { ...dashboard, state: setPath(dashboard.state, patch.path, patch.value) as Dashboard["state"] };

    default:
      return dashboard;
  }
}

/** Apply an ordered list of patches. */
export function applyPatches(dashboard: Dashboard, patches: Patch[]): Dashboard {
  return patches.reduce(applyPatch, dashboard);
}

export { findNode };

/* ------------------------------------------------------------------ *
 * Target validation — surface hallucinated id references
 * ------------------------------------------------------------------ */

const ID_OPS = new Set([
  "update",
  "replace",
  "remove",
  "move",
  "setStyle",
  "setMotion",
  "setBindings",
  "setEvents",
]);

function checkPatchTargets(d: Dashboard, p: Patch): string | null {
  if (ID_OPS.has(p.op)) {
    const id = (p as { id?: string }).id;
    if (id && !findNode(d.root, id)) return `unknown node id "${id}"`;
  }
  if (p.op === "append" || p.op === "move") {
    if (!findNode(d.root, p.parentId)) return `unknown parent id "${p.parentId}"`;
  }
  if (p.op === "removeComponent" && !d.components[p.name]) {
    return `unknown component "${p.name}"`;
  }
  if (p.op === "removeDataSource" && !d.dataSources[p.id]) {
    return `unknown data source "${p.id}"`;
  }
  return null;
}

/**
 * Simulate-apply patches in order, returning a warning string for each one
 * that targets an unknown id/name. Useful for surfacing the model's
 * hallucinated references without silently dropping the patch.
 */
export function validatePatchTargets(dashboard: Dashboard, patches: Patch[]): string[] {
  let current = dashboard;
  const warnings: string[] = [];
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i]!;
    const w = checkPatchTargets(current, p);
    if (w) warnings.push(`patch[${i}] (${p.op}): ${w}`);
    current = applyPatch(current, p);
  }
  return warnings;
}
