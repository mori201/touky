import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        muted: token("muted"),
        border: token("border"),
        fg: token("fg"),
        "fg-muted": token("fg-muted"),
        primary: token("primary"),
        "primary-fg": token("primary-fg"),
        navy: token("navy"),
        accent: token("accent"),
        danger: token("danger"),
        warning: token("warning"),
        success: token("success"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem" },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;
