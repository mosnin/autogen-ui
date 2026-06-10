import type { BrandKit } from "./brand";

/**
 * Voice presets — pre-tuned content guidance the agent will respect.
 * Drop one into `BrandKit.voice` (or merge with examples from the host's
 * own copy) and the agent's headings, button labels, empty states, and
 * descriptions take on a recognizable tone.
 *
 *   createUIAgent({ brand: { ..., voice: voicePresets["engineer-minimal"] } })
 */

type VoiceProfile = NonNullable<BrandKit["voice"]>;

export const voicePresets = {
  /** Linear / Vercel-adjacent — minimal, fast, no fluff. */
  "engineer-minimal": {
    tone: "minimal, technical, no fluff",
    rules: [
      "Sentence case headings.",
      "No exclamation marks.",
      "Stat labels are 1–2 words.",
      "Charts include numerical axis ticks.",
      "Avoid emoji.",
    ],
  },
  /** Substack / Anthropic-adjacent — editorial, considered, thoughtful. */
  "editorial-warm": {
    tone: "warm, considered, narrative",
    rules: [
      "Title case for major headings.",
      "Long-form descriptions allowed (1–2 sentences).",
      "Connect dashboards with prose.",
      "Charts include axis labels and units.",
    ],
  },
  /** B2C / Notion-adjacent — friendly, second-person, helpful. */
  "casual-product": {
    tone: "friendly, casual, second-person",
    rules: [
      "Use 'your' liberally.",
      "Short sentences.",
      "Lowercase labels OK.",
      "Empty states can be playful but not gimmicky.",
    ],
  },
  /** Apple-adjacent — restrained, confident in silence. */
  "premium-quiet": {
    tone: "restrained, confident in silence",
    rules: [
      "Title case headings.",
      "Single-sentence descriptions max.",
      "Avoid jargon.",
      "No emoji.",
      "Numbers carry the meaning; labels are descriptive, not promotional.",
    ],
  },
  /** Bloomberg / data-platform — precise, comparative, dense. */
  "data-dense": {
    tone: "information-dense, precise, comparative",
    rules: [
      "Always include units (USD, %, ms, items).",
      "Three-letter month abbreviations on time axes.",
      "Use percentages to one decimal (4.2%, not 4%).",
      "Compare to a prior period explicitly when relevant.",
      "Lowercase axis labels are fine.",
    ],
  },
  /** GitHub-adjacent — technical, comma-rich, accurate. */
  "developer-tools": {
    tone: "technical, accurate, comma-rich",
    rules: [
      "Use the exact technical term (commit, repository, branch — not 'thing').",
      "Numerals over spelled-out numbers (5, not five).",
      "Code-style for identifiers (monospace).",
      "Stat labels can be 2–3 words and include the unit.",
    ],
  },
} as const satisfies Record<string, VoiceProfile>;

export type VoicePresetName = keyof typeof voicePresets;
