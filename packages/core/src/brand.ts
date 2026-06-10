import { z } from "zod";

/**
 * A `BrandKit` lets the host application express its own design language
 * (color, typography, radius, voice) and have the framework respect it on
 * both axes:
 *
 * 1. **Renderer**: a `<BrandProvider>` writes the kit's tokens as CSS
 *    variables so existing components — Card, Stat, Chart, Input — render in
 *    the host's identity without any component change.
 * 2. **Agent**: `createUIAgent({ brand })` injects a prompt section so the
 *    model picks props that match the host's voice and conventions.
 *
 * Colors are written as HSL triplets ("230 90% 60%") to compose with the
 * `hsl(var(--token))` pattern the preset already uses.
 */

const hslTriplet = z.string();

const colorTokensSchema = z
  .object({
    background: hslTriplet,
    foreground: hslTriplet,
    primary: hslTriplet,
    primaryForeground: hslTriplet,
    primarySoft: hslTriplet,
    secondary: hslTriplet,
    secondaryForeground: hslTriplet,
    muted: hslTriplet,
    mutedForeground: hslTriplet,
    accent: hslTriplet,
    accentForeground: hslTriplet,
    border: hslTriplet,
    input: hslTriplet,
    ring: hslTriplet,
    card: hslTriplet,
    cardForeground: hslTriplet,
    success: hslTriplet,
    warning: hslTriplet,
    danger: hslTriplet,
    chart1: hslTriplet,
    chart2: hslTriplet,
    chart3: hslTriplet,
    chart4: hslTriplet,
    chart5: hslTriplet,
  })
  .partial();

export const brandKitSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    /** HSL-triplet color tokens that override the defaults. */
    colors: colorTokensSchema.optional(),
    /** Dark-mode color overrides — applied under `.dark`. */
    dark: colorTokensSchema.optional(),
    /** Typography stack — must be loaded by the host (e.g. via next/font). */
    typography: z
      .object({
        sans: z.string().optional(),
        display: z.string().optional(),
        mono: z.string().optional(),
      })
      .optional(),
    /** Sets `--radius`. */
    radius: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
    /** Voice + content rules surfaced to the agent. */
    voice: z
      .object({
        tone: z.string().optional(),
        rules: z.array(z.string()).optional(),
      })
      .optional(),
    /** Free-form prompt addendum. */
    guidelines: z.string().optional(),
  })
  .partial();

export type BrandKit = z.infer<typeof brandKitSchema>;
export type BrandColorTokens = z.infer<typeof colorTokensSchema>;

const TOKEN_TO_VAR: Record<keyof BrandColorTokens, string> = {
  background: "--background",
  foreground: "--foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  primarySoft: "--primary-soft",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  card: "--card",
  cardForeground: "--card-foreground",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",
};

const RADIUS_REM: Record<NonNullable<BrandKit["radius"]>, string> = {
  none: "0",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.625rem",
  xl: "0.875rem",
};

/** Compile the kit's tokens into CSS variable assignments. */
export function brandToCssVars(kit: BrandKit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!kit) return out;

  if (kit.colors) {
    for (const [key, value] of Object.entries(kit.colors)) {
      if (typeof value === "string" && value.length > 0) {
        const cssVar = TOKEN_TO_VAR[key as keyof BrandColorTokens];
        if (cssVar) out[cssVar] = value;
      }
    }
  }
  if (kit.radius) out["--radius"] = RADIUS_REM[kit.radius];
  if (kit.typography?.sans) out["--font-sans"] = kit.typography.sans;
  if (kit.typography?.display) out["--font-display"] = kit.typography.display;
  if (kit.typography?.mono) out["--font-mono"] = kit.typography.mono;

  return out;
}

/** Compile the kit's `dark.*` color overrides into CSS variable assignments. */
export function brandToDarkCssVars(kit: BrandKit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!kit?.dark) return out;
  for (const [key, value] of Object.entries(kit.dark)) {
    if (typeof value === "string" && value.length > 0) {
      const cssVar = TOKEN_TO_VAR[key as keyof BrandColorTokens];
      if (cssVar) out[cssVar] = value;
    }
  }
  return out;
}

/** Compile the kit into a system-prompt addendum the agent will respect. */
export function brandToPromptSection(kit: BrandKit | undefined): string {
  if (!kit) return "";
  const lines: string[] = [];
  if (kit.name) lines.push(`Brand: ${kit.name}.`);
  if (kit.description) lines.push(kit.description);
  if (kit.voice?.tone) lines.push(`Voice: ${kit.voice.tone}.`);
  if (kit.voice?.rules && kit.voice.rules.length > 0) {
    lines.push("Content rules — strict:");
    for (const r of kit.voice.rules) lines.push(`- ${r}`);
  }
  if (kit.radius) lines.push(`Default radius: ${kit.radius}.`);
  if (kit.typography?.sans) lines.push(`Body font: ${kit.typography.sans}.`);
  if (kit.typography?.display) lines.push(`Display font: ${kit.typography.display}.`);
  if (kit.colors) {
    const major: string[] = [];
    if (kit.colors.primary) major.push(`primary ${kit.colors.primary}`);
    if (kit.colors.background) major.push(`background ${kit.colors.background}`);
    if (kit.colors.accent) major.push(`accent ${kit.colors.accent}`);
    if (major.length > 0) {
      lines.push(`Color tokens (HSL): ${major.join("; ")}.`);
    }
  }
  if (kit.guidelines) lines.push(kit.guidelines);
  if (lines.length === 0) return "";
  return `\n\n## BRAND\n${lines.join("\n")}`;
}
