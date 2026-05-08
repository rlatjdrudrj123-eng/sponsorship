import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          50: "#e6faf6",
          100: "#ccf5ed",
          200: "#99ebdb",
          400: "#33ccb5",
          500: "#00bfa6",
          600: "#00a892",
          700: "#00917f",
          900: "#003d35",
        },
        ink: {
          50: "#f5f6f7",
          100: "#e5e7eb",
          300: "#d1d5db",
          500: "#94a3b8",
          700: "#475569",
          900: "#0f172a",
        },
      },
      fontFamily: {
        sans: ["var(--font-pretendard)", "Pretendard", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
      },
    },
  },
  plugins: [],
};
export default config;
