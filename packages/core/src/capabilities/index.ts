import type { CapabilityModule } from "../agent";
import { defineCapability } from "./define";
import { dynamicCapability } from "./dynamic";
import { formsCapability } from "./forms";
import { streamingCapability } from "./streaming";
import { styleCapability } from "./style";

export {
  defineCapability,
  dynamicCapability,
  formsCapability,
  streamingCapability,
  styleCapability,
};

/**
 * Capabilities for the standard (non-streaming) agent: styling, runtime
 * component definition, dynamic data/behaviour, and forms.
 */
export const defaultCapabilities: CapabilityModule[] = [
  styleCapability,
  defineCapability,
  dynamicCapability,
  formsCapability,
];

/** Capabilities for a streaming agent — adds dependency-order guidance. */
export const streamingCapabilities: CapabilityModule[] = [
  ...defaultCapabilities,
  streamingCapability,
];
