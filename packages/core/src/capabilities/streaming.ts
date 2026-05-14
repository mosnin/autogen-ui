import type { CapabilityModule } from "../agent";

/**
 * Streaming capability. When the agent runs under the streaming agent
 * (Phase 2), patches are applied by the client the instant each one arrives —
 * so their order matters. This module instructs the model to emit patches in
 * dependency order so the UI assembles coherently frame by frame.
 */
export const streamingCapability: CapabilityModule = {
  name: "Streaming",
  systemPrompt: `Your patches are streamed to the client and applied one by one,
in order, as each arrives. Emit them in DEPENDENCY ORDER so the UI builds
coherently:
- Create or set a container node BEFORE appending children into it. An
  "append" whose parentId does not yet exist is dropped.
- For a brand-new dashboard, emit "setRoot" (or the root container) first,
  then append sections, then append leaf nodes into those sections.
- Apply styling, motion, bindings, or events to a node only AFTER the patch
  that creates it.
- Prefer many small, ordered patches over one large "setRoot" so the user
  sees the dashboard fill in progressively.`,
};
