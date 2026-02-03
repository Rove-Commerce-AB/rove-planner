// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          signal: "var(--color-brand-signal)",
          lilac: "var(--color-brand-lilac)",
          blue: "var(--color-brand-blue)",
        },
        accent: {
          1: "var(--color-accent-1)",
          2: "var(--color-accent-2)",
          3: "var(--color-accent-3)",
          4: "var(--color-accent-4)",
        },
        customer: {
          DEFAULT: "var(--color-customer-default)",
        },
        bg: {
          DEFAULT: "var(--color-bg-default)",
          page: "var(--color-bg-page)",
          muted: "var(--color-bg-muted)",
          panel: "var(--panel-bg)",
        },
        text: {
          primary: "var(--color-text-primary)",
          inverse: "var(--color-text-inverse)",
          muted: "var(--color-text-muted)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          subtle: "var(--color-border-subtle)",
        },
        grid: {
          DEFAULT: "var(--color-grid-border)",
          light: "var(--color-grid-border-light)",
          row: "var(--color-grid-row)",
          subtle: "var(--color-grid-border-subtle)",
          "light-subtle": "var(--color-grid-border-light-subtle)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
        },
        success: {
          DEFAULT: "var(--color-success)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
        },
        nav: {
          active: "var(--color-nav-active)",
          hover: "var(--color-nav-hover)",
        },
      },
      fontFamily: {
        primary: ["var(--font-primary)"],
        secondary: ["var(--font-secondary)"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        panel: "var(--radius-panel)",
      },
      keyframes: {
        "loading-bar": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
      },
      animation: {
        "loading-bar": "loading-bar 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
