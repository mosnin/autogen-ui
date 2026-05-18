/**
 * Tailwind preset for autogen-ui. Add to your tailwind.config:
 *
 *   presets: [require("@autogen-ui/core/tailwind.preset")],
 *
 * and make sure `content` covers the core package so its utility
 * classes are scanned:
 *
 *   content: ["./node_modules/@autogen-ui/core/dist/**\/*.js"]
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        rest: "var(--shadow-rest)",
        lift: "var(--shadow-lift)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans, ui-sans-serif)",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-display, var(--font-sans, ui-sans-serif))",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono, ui-monospace)",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      transitionTimingFunction: {
        // "swift in" — fast at the start, settles
        swift: "cubic-bezier(0.32, 0.72, 0, 1)",
        // "expo out" — Framer/Linear staple
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        // tight bounce-free spring for exits
        exit: "cubic-bezier(0.7, 0, 0.84, 0)",
      },
      keyframes: {
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "thinking": {
          "0%, 80%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "40%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        thinking: "thinking 1.4s ease-in-out infinite",
      },
    },
  },
};
