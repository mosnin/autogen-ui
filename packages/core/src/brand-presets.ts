import type { BrandKit } from "./brand";

/**
 * Hand-tuned starter brand kits. Use them as-is, or fork the closest match
 * and override fields. Colors are HSL triplets to compose with the
 * `hsl(var(--token))` resolver in the preset.
 */

/** Default — deep, restrained indigo. The framework's signature kit. */
export const violetKit: BrandKit = {
  name: "violet",
  description:
    "Confident indigo, warm-tinted neutrals, deliberate negative space. Editorial.",
  colors: {
    primary: "248 65% 50%",
    primaryForeground: "0 0% 100%",
    primarySoft: "248 80% 96%",
    background: "30 25% 99%",
    foreground: "240 12% 8%",
    muted: "30 18% 96%",
    mutedForeground: "240 8% 42%",
    border: "240 6% 90%",
    chart1: "248 65% 50%",
    chart2: "175 70% 38%",
    chart3: "30 92% 55%",
    chart4: "320 70% 55%",
    chart5: "200 80% 50%",
  },
  dark: {
    background: "240 12% 4%",
    foreground: "30 10% 96%",
    primary: "248 85% 68%",
    primarySoft: "248 50% 14%",
    card: "240 12% 6.5%",
    muted: "240 10% 12%",
    border: "240 8% 14%",
  },
  radius: "lg",
  typography: { sans: "Inter", display: "Inter" },
  voice: { tone: "restrained, editorial, confident in silence" },
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

/** Dark-first, electric cyan, terminal aesthetic. */
export const midnightKit: BrandKit = {
  name: "midnight",
  description: "Dark-first, electric cyan on obsidian. Terminal-precise, no warmth.",
  colors: {
    primary: "183 100% 46%",
    primaryForeground: "220 25% 4%",
    primarySoft: "183 100% 8%",
    background: "220 25% 4%",
    foreground: "210 20% 94%",
    muted: "220 20% 10%",
    mutedForeground: "220 12% 55%",
    border: "220 18% 14%",
    chart1: "183 100% 46%",
    chart2: "155 80% 50%",
    chart3: "263 80% 65%",
    chart4: "28 90% 55%",
    chart5: "210 80% 60%",
  },
  dark: {
    background: "220 30% 3%",
    foreground: "210 20% 96%",
    primary: "183 100% 52%",
    primarySoft: "183 100% 6%",
    card: "220 25% 6%",
    muted: "220 20% 9%",
    border: "220 18% 12%",
  },
  radius: "sm",
  voice: {
    tone: "precise, technical, no-nonsense",
    rules: [
      "Use monospace font for numbers and IDs.",
      "Labels are lowercase.",
      "No decorative language — state facts.",
    ],
  },
};

/** High-fashion editorial, blush + champagne. */
export const roseKit: BrandKit = {
  name: "rose",
  description: "High-fashion editorial. Rose primary, champagne neutrals, generous white space.",
  colors: {
    primary: "338 75% 55%",
    primaryForeground: "0 0% 100%",
    primarySoft: "338 75% 96%",
    background: "30 30% 99%",
    foreground: "340 15% 12%",
    muted: "338 20% 96%",
    mutedForeground: "340 10% 50%",
    border: "338 18% 90%",
    chart1: "338 75% 55%",
    chart2: "15 80% 60%",
    chart3: "270 55% 65%",
    chart4: "48 85% 58%",
    chart5: "180 45% 50%",
  },
  dark: {
    background: "340 20% 5%",
    foreground: "30 20% 95%",
    primary: "338 75% 68%",
    primarySoft: "338 50% 12%",
    card: "340 18% 8%",
    muted: "340 15% 12%",
    border: "338 15% 16%",
  },
  radius: "xl",
  typography: { sans: "DM Sans", display: "Playfair Display" },
  voice: {
    tone: "aspirational, editorial, warm precision",
    rules: [
      "Numbers in stats are accompanied by trend indicators.",
      "Headings use sentence case.",
      "Chart labels are concise and elegant.",
    ],
  },
};

/** Amber/gold on rich cream, financial data aesthetic. */
export const solarKit: BrandKit = {
  name: "solar",
  description: "Bold amber on warm cream. Commodity-data confidence, Bloomberg-adjacent.",
  colors: {
    primary: "38 95% 48%",
    primaryForeground: "38 20% 8%",
    primarySoft: "38 95% 95%",
    background: "40 30% 98%",
    foreground: "30 25% 8%",
    muted: "40 20% 94%",
    mutedForeground: "35 15% 45%",
    border: "38 18% 86%",
    chart1: "38 95% 48%",
    chart2: "18 80% 45%",
    chart3: "158 55% 38%",
    chart4: "248 65% 55%",
    chart5: "338 70% 52%",
  },
  dark: {
    background: "30 20% 5%",
    foreground: "40 20% 95%",
    primary: "38 95% 58%",
    primarySoft: "38 70% 10%",
    card: "30 18% 8%",
    muted: "32 15% 12%",
    border: "35 15% 16%",
  },
  radius: "none",
  voice: {
    tone: "authoritative, data-dense, concise",
    rules: [
      "All numeric values include units.",
      "Charts always have axis labels.",
      "Use percentage change for stat deltas.",
    ],
  },
};

/** Cyberpunk dark, electric lime on near-black. */
export const neonKit: BrandKit = {
  name: "neon",
  description: "Cyberpunk dark-first. Electric lime on deep near-black. Vibrant, high-saturation.",
  colors: {
    primary: "82 100% 50%",
    primaryForeground: "82 20% 5%",
    primarySoft: "82 100% 8%",
    background: "240 20% 4%",
    foreground: "82 30% 95%",
    muted: "240 18% 9%",
    mutedForeground: "240 10% 55%",
    border: "82 30% 14%",
    chart1: "82 100% 50%",
    chart2: "183 100% 46%",
    chart3: "263 90% 65%",
    chart4: "338 90% 60%",
    chart5: "28 100% 55%",
  },
  dark: {
    background: "240 25% 3%",
    foreground: "82 20% 97%",
    primary: "82 100% 55%",
    primarySoft: "82 100% 6%",
    card: "240 20% 6%",
    muted: "240 18% 8%",
    border: "82 20% 12%",
  },
  radius: "sm",
  voice: {
    tone: "bold, urgent, high-energy",
    rules: ["Use ALL CAPS for section headings.", "Stats show raw numbers, no softening."],
  },
};

/** Deep teal primary, coastal blue-greens, SaaS analytics. */
export const oceanKit: BrandKit = {
  name: "ocean",
  description: "Deep teal primary, coastal blue-greens. Analytics SaaS, calm authority.",
  colors: {
    primary: "192 85% 38%",
    primaryForeground: "0 0% 100%",
    primarySoft: "192 85% 94%",
    background: "200 25% 99%",
    foreground: "210 25% 10%",
    muted: "200 20% 95%",
    mutedForeground: "210 15% 46%",
    border: "200 18% 88%",
    chart1: "192 85% 38%",
    chart2: "165 60% 42%",
    chart3: "215 70% 52%",
    chart4: "248 60% 58%",
    chart5: "28 75% 52%",
  },
  dark: {
    background: "215 30% 5%",
    foreground: "200 20% 95%",
    primary: "192 80% 52%",
    primarySoft: "192 70% 10%",
    card: "215 25% 8%",
    muted: "215 22% 12%",
    border: "210 20% 16%",
  },
  radius: "lg",
  voice: {
    tone: "calm, professional, data-forward",
    rules: [
      "Charts include comparison periods.",
      "Stat deltas show directional arrow icons.",
    ],
  },
};

export const brandPresets = {
  violet: violetKit,
  linear: linearKit,
  warm: warmKit,
  sharp: sharpKit,
  mono: monoKit,
  forest: forestKit,
  midnight: midnightKit,
  rose: roseKit,
  solar: solarKit,
  neon: neonKit,
  ocean: oceanKit,
} as const;

export type BrandPresetName = keyof typeof brandPresets;
