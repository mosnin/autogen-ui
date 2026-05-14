import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

let counter = 0;

/** Stable-ish unique id for spec nodes. */
export function nodeId(prefix = "n"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
