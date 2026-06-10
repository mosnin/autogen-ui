import { compileEvents } from "./actions";
import { resolveBindings } from "./data";
import { instantiateComponent } from "./define";
import { expandForEach } from "./_foreach";
import { compileMotion } from "./motion";
import type { RendererExtensions, RuntimeContext } from "./runtime";
import type { UINode } from "./schema";
import { compileStyle } from "./style";

/**
 * Compose the per-phase runtime implementations into the default
 * `RendererExtensions` the renderer uses out of the box.
 *
 * `resolveNode` chains component instantiation (Phase 3) and data-binding
 * resolution (Phase 4). Both return the same node reference when they make
 * no change, so the composition stays reference-stable and the renderer's
 * resolve loop terminates.
 */
function resolveNode(node: UINode, ctx: RuntimeContext): UINode {
  return resolveBindings(
    expandForEach(instantiateComponent(node, ctx), ctx),
    ctx,
  );
}

export const defaultExtensions: RendererExtensions = {
  compileStyle,
  compileMotion,
  compileEvents,
  resolveNode,
};
