import type { Config } from "tailwindcss";
import autogenUiPreset from "@autogen-ui/core/tailwind.preset";

const config: Config = {
  darkMode: "class",
  presets: [autogenUiPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    // Scan the library so its utility classes survive purging.
    "../../packages/core/src/**/*.{ts,tsx}",
    "../../packages/core/dist/**/*.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
