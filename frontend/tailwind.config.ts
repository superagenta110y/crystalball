import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0d0d0d",
          raised: "#141414",
          overlay: "#1a1a1a",
          border: "#2a2a2a",
        },
        accent: {
          DEFAULT: "#00d4aa",
          muted: "#00d4aa33",
        },
        bull: "#00d4aa",    // green — long / calls
        bear: "#ff4d6d",   // red   — short / puts
        neutral: "#8b8fa8",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
