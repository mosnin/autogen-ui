import type { Config } from "tailwindcss";
import preset from "@autogen-ui/core/tailwind.preset";
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

const config: Config = {
  darkMode: "class",
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/core/src/**/*.{ts,tsx}",
    "../../packages/core/dist/**/*.js",
  ],
  safelist: STATIC_SAFELIST.split(/\s+/).filter(Boolean),
  theme: { extend: {} },
  plugins: [],
};

export default config;
