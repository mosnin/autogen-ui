/**
 * Sandboxed code generation — the opt-in escape hatch for components that
 * the declarative `ComponentDef` template system cannot express (complex
 * conditional rendering, computed layouts, bespoke SVG, ...).
 *
 * STATUS: disabled by default and intentionally a no-op stub. The real
 * implementation is gated behind a security review and is NOT part of
 * Phase 3's shipped surface. This file exists so the integration seam is
 * defined and type-checked now; flipping it on is a deliberate, reviewed
 * follow-up.
 *
 * Intended design (for the reviewed implementation):
 *
 *  1. The model emits a small, self-contained TSX module string as a patch
 *     payload — a single default-exported React component, no imports of its
 *     own beyond an allowlist.
 *  2. The string is transpiled at runtime with a lightweight, dependency-free
 *     transpiler (e.g. Sucrase) — JSX + TS stripped to plain JS. No bundler,
 *     no filesystem access, no `eval` of attacker-influenced module specifiers.
 *  3. The transpiled code is executed inside a sandboxed scope:
 *       - constructed via `new Function(...allowlistedNames, code)` so it has
 *         NO access to the surrounding lexical scope;
 *       - `require`/`import` is replaced by an allowlisted module map
 *         (`react`, the autogen-ui primitive registry, a curated util set)
 *         — anything not on the map throws;
 *       - no `window`, `document`, `fetch`, `globalThis`, timers, or network:
 *         these are shadowed with `undefined` bindings in the Function args so
 *         the generated code cannot reach the DOM or escape the sandbox;
 *       - execution is wrapped in a try/catch and a time/again budget so a
 *         pathological component degrades to an error node, never a hang.
 *  4. The resulting component is memoised by a content hash and exposed to
 *     the renderer as just another entry in the resolve pipeline, behind the
 *     same `resolveNode` contract as `instantiateComponent`.
 *
 * Until that review lands, `createCodegenResolver` returns a strict no-op:
 * with `allowCodegen` falsy (the default) it returns every node unchanged,
 * exactly like `noopExtensions.resolveNode`.
 */

import type { RuntimeContext } from "../runtime";
import type { UINode } from "../schema";

export interface CodegenOptions {
  /**
   * Master switch for runtime code generation. Defaults to `false`. Even
   * when `true`, the current build performs no code execution — see the
   * file header. Treat enabling this as a security-sensitive decision.
   */
  allowCodegen?: boolean;
}

/** A `resolveNode`-shaped transform. */
export type CodegenResolver = (node: UINode, ctx: RuntimeContext) => UINode;

/**
 * Build a `resolveNode`-shaped resolver for generated components. Currently
 * always a no-op (returns the node unchanged) regardless of `allowCodegen`,
 * pending the security review described in this file's header.
 */
export function createCodegenResolver(opts: CodegenOptions = {}): CodegenResolver {
  const enabled = opts.allowCodegen === true;

  // Intentionally identical behaviour whether enabled or not: the executing
  // path does not exist yet. `enabled` is referenced so callers and linters
  // see the flag is wired through and ready for the reviewed implementation.
  void enabled;

  return function codegenResolver(node: UINode, _ctx: RuntimeContext): UINode {
    return node;
  };
}
