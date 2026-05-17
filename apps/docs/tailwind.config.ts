import type { Config } from "tailwindcss";
import autogenUiPreset from "@autogen-ui/core/tailwind.preset";
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

const config: Config = {
  darkMode: "class",
  presets: [autogenUiPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/core/src/**/*.{ts,tsx}",
    "../../packages/core/dist/**/*.js",
  ],
  safelist: STATIC_SAFELIST.split(/\s+/).filter(Boolean),
  theme: { extend: {} },
  plugins: [],
};

export default config;
