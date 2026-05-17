import type { Config } from "tailwindcss";
import autogenUiPreset from "@autogen-ui/core/tailwind.preset";
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

const config: Config = {
  darkMode: "class",
  presets: [autogenUiPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    // Scan the built library so its runtime utility classes survive purging.
    "../../packages/core/dist/**/*.js",
  ],
  // The style engine emits token-driven classes the scanner can't see — keep them.
  safelist: STATIC_SAFELIST.split(/\s+/).filter(Boolean),
  theme: { extend: {} },
  plugins: [],
};

export default config;
