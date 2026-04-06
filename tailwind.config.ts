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
        background:      "var(--background)",
        foreground:      "var(--foreground)",
        "verde-escuro":  "#1A2B01",
        "verde":         "#396100",
        "verde-claro":   "#EDFBD9",
        "amarelo":       "#FFC300",
        "amarelo-vivo":  "#FFD23D",
        "cta":           "#94DD2D",
        "cta-hover":     "#a8f033",
        "btn-claro":     "#F9FFF1",
      },
      fontFamily: {
        sans:    ["Montserrat", "sans-serif"],
        display: ["Bebas Neue", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
