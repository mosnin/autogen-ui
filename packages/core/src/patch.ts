import type { Dashboard, Patch, UINode } from "./schema";

/** Walk the tree, returning a new node with `fn` applied to every node. */
function mapTree(node: UINode, fn: (n: UINode) => UINode): UINode {
  const mapped = fn(node);
  if (!mapped.children || mapped.children.length === 0) return mapped;
  return { ...mapped, children: mapped.children.map((c) => mapTree(c, fn)) };
}

/** Remove a node by id anywhere in the tree (root is never removed). */
function removeFromTree(node: UINode, id: string): UINode {
  if (!node.children) return node;
  return {
    ...node,
    children: node.children
      .filter((c) => c.id !== id)
      .map((c) => removeFromTree(c, id)),
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

function insertChild(
  node: UINode,
  parentId: string,
  child: UINode,
  index?: number,
): UINode {
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
      return {
        ...dashboard,
        root: insertChild(without, patch.parentId, moving, patch.index),
      };
    }

    default:
      return dashboard;
  }
}

/** Apply an ordered list of patches. */
export function applyPatches(dashboard: Dashboard, patches: Patch[]): Dashboard {
  return patches.reduce(applyPatch, dashboard);
}
