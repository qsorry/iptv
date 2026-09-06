import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        brand: { DEFAULT: "var(--brand)", fg: "var(--brand-fg)" },
        surface: "var(--surface)",
        muted: "var(--muted)",
        border: "var(--border)",
      },
      borderRadius: { DEFAULT: "var(--radius)" },
    },
  },
  plugins: [],
};

export default config;
