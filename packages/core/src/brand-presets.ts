import type { BrandKit } from "./brand";

/**
 * Hand-tuned starter brand kits. Use them as-is, or fork the closest match
 * and override fields. Colors are HSL triplets to compose with the
 * `hsl(var(--token))` resolver in the preset.
 */

/** Default — confident violet-indigo, the framework's signature kit. */
export const violetKit: BrandKit = {
  name: "violet",
  description: "Confident, technical, modern. The framework's default.",
  colors: {
    primary: "255 85% 60%",
    primaryForeground: "0 0% 100%",
    primarySoft: "255 80% 96%",
    chart1: "255 85% 60%",
    chart2: "175 70% 42%",
    chart3: "30 92% 56%",
    chart4: "320 70% 60%",
    chart5: "200 80% 55%",
  },
  radius: "lg",
  voice: { tone: "technical, confident" },
};

/** Indigo-blue, Linear-style — minimal, restrained. */
export const linearKit: BrandKit = {
  name: "linear",
  description: "Minimal, fast, engineer-first.",
  colors: {
    primary: "232 86% 62%",
    primaryForeground: "0 0% 100%",
    primarySoft: "232 86% 96%",
    background: "240 8% 99%",
    foreground: "240 10% 6%",
    border: "240 10% 92%",
    chart1: "232 86% 62%",
    chart2: "215 70% 50%",
    chart3: "260 75% 60%",
    chart4: "190 70% 45%",
    chart5: "300 60% 55%",
  },
  radius: "md",
  voice: {
    tone: "minimal, declarative",
    rules: [
      "Sentence case headings.",
      "No exclamation marks.",
      "Stat labels are 1-2 words.",
    ],
  },
};

/** Warm + serious, Anthropic / Substack territory. */
export const warmKit: BrandKit = {
  name: "warm",
  description: "Editorial warmth, thoughtful, considered.",
  colors: {
    primary: "20 70% 50%",
    primaryForeground: "30 35% 98%",
    primarySoft: "30 70% 95%",
    background: "30 25% 98%",
    foreground: "20 15% 12%",
    muted: "30 18% 94%",
    border: "30 14% 88%",
    chart1: "20 75% 55%",
    chart2: "165 50% 45%",
    chart3: "40 80% 55%",
    chart4: "350 65% 55%",
    chart5: "200 50% 50%",
  },
  radius: "sm",
  voice: {
    tone: "warm, considered, editorial",
    rules: ["Long-form descriptions allowed.", "Charts include axis labels."],
  },
};

/** Stripe / Vercel — sharp, polished, deeply blue-purple. */
export const sharpKit: BrandKit = {
  name: "sharp",
  description: "Polished commerce — Stripe, Vercel, Notion-adjacent.",
  colors: {
    primary: "245 100% 65%",
    primaryForeground: "0 0% 100%",
    primarySoft: "245 100% 96%",
    chart1: "245 100% 65%",
    chart2: "210 80% 50%",
    chart3: "280 75% 60%",
    chart4: "165 55% 45%",
    chart5: "350 75% 55%",
  },
  radius: "lg",
  voice: { tone: "premium, polished" },
};

/** High-contrast monochrome — print-inspired, ultra-minimal. */
export const monoKit: BrandKit = {
  name: "mono",
  description: "Print-inspired, mono accent, zero saturation.",
  colors: {
    primary: "0 0% 10%",
    primaryForeground: "0 0% 100%",
    primarySoft: "0 0% 96%",
    background: "0 0% 100%",
    foreground: "0 0% 8%",
    muted: "0 0% 96%",
    border: "0 0% 88%",
    chart1: "0 0% 15%",
    chart2: "0 0% 35%",
    chart3: "0 0% 55%",
    chart4: "0 0% 70%",
    chart5: "0 0% 82%",
  },
  radius: "none",
  voice: {
    tone: "editorial, dense, neutral",
    rules: ["No drop shadows.", "Borders only — no card fills."],
  },
};

/** Forest green — calm, growth, climate-friendly. */
export const forestKit: BrandKit = {
  name: "forest",
  description: "Calm, climate-friendly, growth-coded.",
  colors: {
    primary: "155 60% 35%",
    primaryForeground: "0 0% 100%",
    primarySoft: "155 60% 95%",
    background: "120 15% 99%",
    foreground: "150 20% 10%",
    border: "150 15% 88%",
    chart1: "155 60% 40%",
    chart2: "200 60% 45%",
    chart3: "85 50% 45%",
    chart4: "40 70% 50%",
    chart5: "265 50% 55%",
  },
  radius: "md",
  voice: { tone: "calm, grounded, optimistic" },
};

export const brandPresets = {
  violet: violetKit,
  linear: linearKit,
  warm: warmKit,
  sharp: sharpKit,
  mono: monoKit,
  forest: forestKit,
} as const;

export type BrandPresetName = keyof typeof brandPresets;
