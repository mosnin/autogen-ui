import type { MotionSpec } from "./schema";

/**
 * Motion engine: turns a `MotionSpec` into Framer Motion props spreadable
 * onto a `motion.div`. A named `preset` supplies sensible defaults; any
 * explicit `initial`/`animate`/`exit`/`whileHover`/`whileTap`/`transition`
 * field on the spec overrides the corresponding preset value.
 */

type MotionProps = Record<string, unknown>;

const PRESETS: Record<string, MotionProps> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.25, ease: "easeOut" },
  },
  rise: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { type: "spring", stiffness: 260, damping: 26 },
  },
  pop: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { type: "spring", stiffness: 400, damping: 22 },
  },
  "slide-left": {
    initial: { opacity: 0, x: 32 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -32 },
    transition: { type: "spring", stiffness: 280, damping: 28 },
  },
  "slide-up": {
    initial: { opacity: 0, y: 32 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -32 },
    transition: { type: "spring", stiffness: 280, damping: 28 },
  },
  "scale-in": {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.92 },
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

/** Compile a `MotionSpec` into Framer Motion props. */
export function compileMotion(motion: MotionSpec): Record<string, unknown> {
  const base: MotionProps =
    motion.preset && PRESETS[motion.preset] ? { ...PRESETS[motion.preset] } : {};

  const result: MotionProps = { ...base };

  if (motion.initial !== undefined) result.initial = motion.initial;
  if (motion.animate !== undefined) result.animate = motion.animate;
  if (motion.exit !== undefined) result.exit = motion.exit;
  if (motion.whileHover !== undefined) result.whileHover = motion.whileHover;
  if (motion.whileTap !== undefined) result.whileTap = motion.whileTap;
  if (motion.transition !== undefined) result.transition = motion.transition;

  return result;
}
