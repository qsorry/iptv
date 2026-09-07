import type { Config } from "tailwindcss";

/**
 * Tailwind يقرأ الرموز الدلالية فقط (semantic.css). لا قيم ثابتة هنا.
 * الأسماء القديمة (brand, surface, muted, border) مُبقاة للتوافق.
 */
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
        brand: {
          DEFAULT: "var(--brand-primary)",
          fg: "var(--text-on-brand)",
          hover: "var(--brand-primary-hover)",
          secondary: "var(--brand-secondary)",
          accent: "var(--brand-accent)",
          container: "var(--brand-container)",
          "container-fg": "var(--brand-container-text)",
        },
        page: "var(--page-bg)",
        surface: {
          DEFAULT: "var(--surface-primary)",
          muted: "var(--surface-muted)",
          inverse: "var(--surface-inverse)",
          1: "var(--surface-raised-1)",
          2: "var(--surface-raised-2)",
          3: "var(--surface-raised-3)",
        },
        ink: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          disabled: "var(--text-disabled)",
          inverse: "var(--text-inverse)",
        },
        muted: "var(--text-secondary)",
        border: { DEFAULT: "var(--border-default)", strong: "var(--border-strong)" },
        success: "var(--success-bg)",
        warning: "var(--warning-bg)",
        error: "var(--error-bg)",
        info: "var(--info-bg)",
      },
      borderRadius: {
        DEFAULT: "var(--input-radius)",
        card: "var(--card-radius)",
        button: "var(--button-radius)",
        input: "var(--input-radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        card: "var(--card-shadow)",
      },
      fontFamily: { sans: "var(--font-family)" },
      transitionDuration: { fast: "var(--duration-fast)", base: "var(--duration-base)", slow: "var(--duration-slow)" },
      transitionTimingFunction: { standard: "var(--ease-standard)" },
      maxWidth: { container: "var(--container-max)" },
    },
  },
  plugins: [],
};

export default config;
