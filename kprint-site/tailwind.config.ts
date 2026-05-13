import type { Config } from "tailwindcss";

/**
 * KIMES 2026 Figma export 기반 디자인 토큰.
 *
 * - 메인 브랜드 컬러: 빨강 (#DB0711)
 * - 서브 컬러: 앰버/주황 (#F39800) — 사용처 별로 강조용
 * - 그레이스케일: KIMES 뉴트럴 (텍스트 #0A0A0A, 뮤트 #808080, 배경 #F6F6F6)
 * - 폰트: Pretendard (한글+라틴 본문), Inter (라틴 숫자 라벨)
 * - 카드: 20px 라운드 + soft shadow / CTA: 빨강 글로우
 *
 * 기존 토큰명 (mint→brand 리네임) 외 ink, card, btn 은 유지.
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
        // ── 브랜드 (빨강) ── KIMES primary
        brand: {
          50: "#FEE9EA",
          100: "#FFC7C9",
          200: "#FF9296",
          400: "#FF4047",
          500: "#DB0711", // 메인
          600: "#BE000F",
          700: "#AA0008",
          800: "#83000A",
          900: "#750409",
        },
        // ── 서브 액센트 (앰버/주황) ── 강조 라벨/뱃지
        accent: {
          50: "#FFF6E5",
          100: "#FFE7B8",
          400: "#F8B616",
          500: "#F39800",
          600: "#E99214",
          700: "#A85F00",
          900: "#443105",
        },
        // ── 그레이스케일 (텍스트·라인) ──
        ink: {
          50: "#F6F6F6",   // 캔버스 / 라이트 surface
          100: "#EBEBEB",  // 헤어라인 보더
          300: "#D9D9D9",  // 비활성, 디바이더
          500: "#808080",  // 뮤트 텍스트
          700: "#515151",  // 중간 텍스트
          900: "#0A0A0A",  // 본문 텍스트
        },
        // 단일 알리아스 — 캔버스/서피스
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
        // Inter 는 라틴 숫자/캡션 전용
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
        // Figma 추출 스케일. [size, { lineHeight, letterSpacing, fontWeight }]
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
        // 기존 단축 키 유지
        btn: "9px",
        card: "20px",
        chip: "6px",
        pill: "9999px",
        feature: "30px",
      },
      boxShadow: {
        // KIMES Figma 에서 반복되는 그림자 레시피
        card: "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)",
        drop: "0 4px 4px rgba(0,0,0,0.25)",
        heavy: "5px 5px 10px rgba(0,0,0,0.5)",
        glow:
          "0 0 13px rgba(200,16,46,0.3), 0 0 26px rgba(200,16,46,0.2), 0 0 39px rgba(200,16,46,0.1)",
        "glow-sm":
          "0 0 8px rgba(200,16,46,0.25), 0 0 16px rgba(200,16,46,0.12)",
      },
      backgroundImage: {
        // 반복 그라데이션
        "brand-grad": "linear-gradient(360deg, #83000A 0%, #E60012 100%)",
        "chrome-grad":
          "linear-gradient(180deg, #DFDFDF 0%, #DDDDDD 36%, #666666 100%)",
        "red-flare":
          "linear-gradient(0deg, rgba(246,246,246,0) 15%, #E60012 68%, #BE000F 100%)",
        "red-fade":
          "linear-gradient(180deg, #F3CBCB 0%, rgba(246,246,246,0) 100%)",
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
