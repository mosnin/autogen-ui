import type { Config } from "tailwindcss";
import autogenUiPreset from "@autogen-ui/core/tailwind.preset";
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

const config: Config = {
  darkMode: "class",
  presets: [autogenUiPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    // Scan the library so its utility classes survive purging.
    "../../packages/core/src/**/*.{ts,tsx}",
    "../../packages/core/dist/**/*.js",
  ],
  // The style engine emits token-driven classes (incl. responsive/state
  // prefixes) that the scanner can't see as literals — keep them all.
  safelist: STATIC_SAFELIST.split(/\s+/).filter(Boolean),
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
