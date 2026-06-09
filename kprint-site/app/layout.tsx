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

// Microsoft Clarity — 세션 리플레이 + 히트맵. 공개 사이트·어드민 모두 적용.
// 어드민 페이지는 트래픽 적고 사용자 행동 분석 대상이 아니지만, 사무국이
// 실제 사용 패턴 확인하는 데 참고로 둠. 분석 페이지에서 페이지별 필터 가능.
const CLARITY_PROJECT_ID = "x46kkolzo9";
const clarityScript = `
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
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
        <Script
          id="ms-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: clarityScript }}
        />
        {children}
      </body>
    </html>
  );
}
