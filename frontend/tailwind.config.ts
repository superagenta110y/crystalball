import type { Config } from "tailwindcss";

// Allow opacity modifiers (bg-bull/10 etc.) via CSS variable RGB triples
function withOpacity(varName: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue !== undefined
      ? `rgba(var(${varName}-rgb), ${opacityValue})`
      : `rgb(var(${varName}-rgb))`;
}

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--surface)",
          raised:  "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
          border:  "var(--surface-border)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          muted:   "var(--accent-muted)",
        },
        bull: withOpacity("--bull") as any,
        bear: withOpacity("--bear") as any,
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
