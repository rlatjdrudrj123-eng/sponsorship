import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "K-PRINT 2026 — 스폰서십",
  description: "K-PRINT 2026 스폰서십 안내 및 견적 문의",
};

// 첫 페인트 전 (React 하이드레이션 전) 동기적으로 캐시된 브랜드 색상을 주입.
// URL 의 첫 path 세그먼트를 eventSlug 로 보고 localStorage 캐시를 읽어 CSS 변수에 세팅.
// 이렇게 해야 같은 행사를 두 번째 방문할 때 빨간 기본값이 잠깐 보이는 FOUC 가 사라짐.
const themePreloadScript = `
(function(){
  try {
    var seg = window.location.pathname.split('/').filter(Boolean)[0];
    if (!seg) return;
    var key = 'kprint-theme:' + seg;
    var hex = window.localStorage.getItem(key);
    if (hex && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) {
      document.documentElement.style.setProperty('--brand-500', hex);
    }
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Script
          id="theme-preload"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themePreloadScript }}
        />
        {children}
      </body>
    </html>
  );
}
