import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ifood: {
          DEFAULT: "#ea1d2c",
          dark: "#c41220",
          soft: "#ffe5e8",
        },
        ink: "#1a1a1a",
        muted: "#717171",
        page: "#f7f7f7",
      },
      fontFamily: {
        title: ["var(--font-title)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        if: "12px",
        "if-lg": "16px",
      },
      boxShadow: {
        if: "0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04)",
      },
    },
  },
  plugins: [],
};

export default config;
