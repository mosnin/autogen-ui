/**
 * Motion identity for autogen-ui. A small, opinionated set of easing curves
 * used across the renderer and primitives. Imported as plain arrays so they
 * pass straight to Framer Motion's `transition.ease`.
 */

/**
 * Restrained, Apple-flavored easing. Single curve for almost everything —
 * `EASE_OUT` settles slowly and decisively. Longer durations + tighter
 * sibling stagger so entrances feel deliberate and unhurried.
 */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Fast, decisive exit. */
export const EASE_EXIT: [number, number, number, number] = [0.7, 0, 0.84, 0];

/** Swift snap for taps + small reveals. */
export const EASE_SWIFT: [number, number, number, number] = [0.32, 0.72, 0, 1];

/** Sibling stagger — tight enough to read as one composed gesture. */
export const STAGGER_MS = 28;

/** Default entrance duration — long enough to feel intentional. */
export const ENTRANCE_DURATION = 0.7;
