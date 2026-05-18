/**
 * Motion identity for autogen-ui. A small, opinionated set of easing curves
 * used across the renderer and primitives. Imported as plain arrays so they
 * pass straight to Framer Motion's `transition.ease`.
 */

/** Soft expo-out — entries settle without bouncing. Linear/Framer staple. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Fast, decisive exit. */
export const EASE_EXIT: [number, number, number, number] = [0.7, 0, 0.84, 0];

/** Swift snap for taps + small reveals. */
export const EASE_SWIFT: [number, number, number, number] = [0.32, 0.72, 0, 1];

/** Frame staggering: 36ms between sibling children feels alive, not slow. */
export const STAGGER_MS = 36;

/** Total duration ceiling for entrance animations. */
export const ENTRANCE_DURATION = 0.55;
