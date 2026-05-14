import type { CapabilityModule } from "../agent";
import { defineCapability } from "./define";
import { dynamicCapability } from "./dynamic";
import { streamingCapability } from "./streaming";
import { styleCapability } from "./style";

export { defineCapability, dynamicCapability, streamingCapability, styleCapability };

/**
 * Capabilities for the standard (non-streaming) agent: styling, runtime
 * component definition, and dynamic data/behaviour.
 */
export const defaultCapabilities: CapabilityModule[] = [
  styleCapability,
  defineCapability,
  dynamicCapability,
];

/** Capabilities for a streaming agent — adds dependency-order guidance. */
export const streamingCapabilities: CapabilityModule[] = [
  ...defaultCapabilities,
  streamingCapability,
];
