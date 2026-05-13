import type { Config } from "tailwindcss";

/**
 * KIMES Figma 기반 디자인 토큰.
 *
 * 색상은 CSS 변수로 추상화돼있어 행사별로 다른 primary color를 주입할 수 있다.
 * 기본값은 KIMES 빨강. 어드민 [사이트 설정] → 테마 색상에서 행사별로 변경.
 *
 * 변수는 globals.css :root 에 정의되고, 공개 페이지에서 ThemeProvider 가
 * 행사의 settings.theme.primary 값을 받아 inline style 로 덮어쓴다.
 *
 * 어두운 음영(700)·밝은 음영(100, 50)은 color-mix() 로 런타임 파생.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── 브랜드 (행사별 가변, CSS 변수) ──
        brand: {
          50: "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          400: "var(--brand-400)",
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          800: "var(--brand-800)",
          900: "var(--brand-900)",
        },
        // ── 서브 액센트 (앰버) — 행사 무관 고정 ──
        accent: {
          50: "#FFF6E5",
          100: "#FFE7B8",
          400: "#F8B616",
          500: "#F39800",
          600: "#E99214",
          700: "#A85F00",
          900: "#443105",
        },
        // ── 그레이스케일 (KIMES 표준) ──
        ink: {
          50: "#F6F6F6",
          100: "#EBEBEB",
          300: "#D9D9D9",
          500: "#808080",
          700: "#515151",
          900: "#0A0A0A",
        },
        canvas: "#F6F6F6",
        surface: "#FFFFFF",
      },
      fontFamily: {
        sans: [
          "var(--font-pretendard)",
          "Pretendard",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        num: [
          "var(--font-inter)",
          "Inter",
          "var(--font-pretendard)",
          "ui-sans-serif",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      fontSize: {
        hero: ["80px", { lineHeight: "100px", fontWeight: "500" }],
        display: [
          "64px",
          { lineHeight: "72px", letterSpacing: "2px", fontWeight: "700" },
        ],
        h1: ["48px", { lineHeight: "1.2", fontWeight: "500" }],
        h2: ["40px", { lineHeight: "48px", fontWeight: "500" }],
        h3: ["36px", { lineHeight: "1.4", fontWeight: "500" }],
        h4: ["32px", { lineHeight: "1.4", fontWeight: "500" }],
        sub: ["24px", { lineHeight: "1.6", fontWeight: "500" }],
        body: ["20px", { lineHeight: "1.6", fontWeight: "500" }],
        "body-sm": ["16px", { lineHeight: "24px", fontWeight: "300" }],
        caption: ["15px", { lineHeight: "1.6", fontWeight: "500" }],
        micro: ["10px", { lineHeight: "12px", fontWeight: "400" }],
      },
      borderRadius: {
        btn: "9px",
        card: "20px",
        chip: "6px",
        pill: "9999px",
        feature: "30px",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)",
        drop: "0 4px 4px rgba(0,0,0,0.25)",
        heavy: "5px 5px 10px rgba(0,0,0,0.5)",
        glow:
          "0 0 13px var(--brand-glow-strong, rgba(200,16,46,0.3)), 0 0 26px var(--brand-glow-mid, rgba(200,16,46,0.2)), 0 0 39px var(--brand-glow-weak, rgba(200,16,46,0.1))",
        "glow-sm":
          "0 0 8px var(--brand-glow-mid, rgba(200,16,46,0.25)), 0 0 16px var(--brand-glow-weak, rgba(200,16,46,0.12))",
      },
      backgroundImage: {
        "brand-grad":
          "linear-gradient(360deg, var(--brand-800) 0%, var(--brand-500) 100%)",
        "chrome-grad":
          "linear-gradient(180deg, #DFDFDF 0%, #DDDDDD 36%, #666666 100%)",
        "red-flare":
          "linear-gradient(0deg, rgba(246,246,246,0) 15%, var(--brand-500) 68%, var(--brand-700) 100%)",
        "red-fade":
          "linear-gradient(180deg, var(--brand-50) 0%, rgba(246,246,246,0) 100%)",
      },
      letterSpacing: {
        display: "2px",
        tightish: "-0.65px",
      },
    },
  },
  plugins: [],
};
export default config;
