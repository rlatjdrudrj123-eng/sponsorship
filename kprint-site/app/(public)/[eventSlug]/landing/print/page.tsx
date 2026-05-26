"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Printer } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { cachedFetch } from "@/lib/firebase/cache";
import type { LandingBlock, SiteSettings } from "@/lib/types";
import { BlockSection } from "@/components/public/landing/blocks";

/**
 * 랜딩 PDF 출력 페이지.
 *
 * /[eventSlug]/landing/print 진입 → settings.landing 블록들을 A4 landscape 한 장씩 렌더
 * → 자동으로 window.print() 호출.
 *
 * 사용자가 "다른 이름으로 PDF 저장" 선택하면 영업용 데크 PDF 완성.
 * 슬라이드 1장 = 1페이지 (16:9 ≈ A4 landscape) 원칙 유지.
 */

// Reveal 컴포넌트가 IntersectionObserver 로 visible 처리하는데,
// print 페이지에선 viewport 밖 슬라이드의 IO 가 발화되지 않아 opacity-0 으로 나감.
// 모듈 로드 시 IO 를 즉시 발화되는 mock 으로 교체 — 이 파일을 import 한 페이지에서만 적용.
if (typeof window !== "undefined") {
  const w = window as unknown as { __ioPrintMocked?: boolean };
  if (!w.__ioPrintMocked) {
    w.__ioPrintMocked = true;
    class ImmediateIO {
      private cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
      }
      observe(target: Element) {
        // microtask 로 즉시 isIntersecting=true 전달
        Promise.resolve().then(() => {
          this.cb(
            [
              {
                isIntersecting: true,
                target,
                intersectionRatio: 1,
                time: 0,
                boundingClientRect: target.getBoundingClientRect(),
                intersectionRect: target.getBoundingClientRect(),
                rootBounds: null,
              } as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver
          );
        });
      }
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds: ReadonlyArray<number> = [];
    }
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      ImmediateIO;
  }
}

export default function LandingPrintPage() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [imgProgress, setImgProgress] = useState<{
    loaded: number;
    total: number;
    printing: boolean;
  }>({ loaded: 0, total: 0, printing: false });

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const data = await cachedFetch(`pub:settings:${eventId}`, async () => {
          const snap = await getDoc(doc(getDb(), "siteSettings", eventId));
          return snap.exists() ? (snap.data() as SiteSettings) : null;
        });
        if (data) setSettings(data);
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    })();
  }, [eventId]);

  // 어드민이 만든 블록만 사용 — 자동 기본 블록은 더 이상 그리지 않음
  const blocks = useMemo<LandingBlock[]>(
    () => settings?.landing ?? [],
    [settings?.landing]
  );

  // 데이터 준비되면 자동 인쇄 — 단, 모든 <img> 가 로드된 후에.
  // Firebase Storage 이미지는 첫 페인트에 안 잡혀서 print 시점에 빈 칸으로 나갈 수 있음.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const waitAllImages = async () => {
      // IO mock 의 microtask + Reveal 의 setState 가 다 흘러간 후 시작
      await new Promise((r) => setTimeout(r, 800));
      // 캔버스 스케일도 한 번 더 보정 — 마지막 페이지 layout 안 잡힌 케이스
      window.dispatchEvent(new Event("resize"));
      await new Promise((r) => setTimeout(r, 300));

      // lazy 이미지를 모두 eager 로 강제 변환 — PDF 인쇄 시점에 viewport 밖
      // 슬라이드 이미지가 아직 src 요청도 안 한 상태라 빈 칸으로 인쇄되는 이슈 회피.
      document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        if (img.loading === "lazy") img.loading = "eager";
        // src 가 없으면 강제 트리거 안 됨 — 일단 src 가 있는 이미지에 한해 즉시 fetch 유도
      });
      // 변환 직후엔 아직 fetch 시작 전이라 한 프레임 대기
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const imgs = Array.from(document.images);
      let loaded = 0;
      const total = imgs.length;
      setImgProgress({ loaded: 0, total, printing: false });
      await Promise.all(
        imgs.map((img) => {
          const tick = () => {
            loaded++;
            setImgProgress({ loaded, total, printing: false });
          };
          if (img.complete && img.naturalWidth > 0) {
            tick();
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            const done = () => {
              tick();
              resolve();
            };
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            // 안전망 — 40초 안에 안 끝나면 그냥 진행 (35페이지 전부 다운로드 시간)
            setTimeout(done, 40000);
          });
        })
      );
      // 폰트도 같이 대기
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          /* noop */
        }
      }
      // 이미지 로드 후 캔버스 스케일/레이아웃 한 번 더 재계산 — 이미지 natural dim 이
      // 늦게 잡혀 layout 변동된 슬라이드 보정
      window.dispatchEvent(new Event("resize"));
      await new Promise((r) => setTimeout(r, 400));
      // 페인트 2 프레임 — 캔버스 transform: scale 적용 + 렌더링 안정화
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (!cancelled) {
        setImgProgress((p) => ({ ...p, printing: true }));
        window.print();
      }
    };

    void waitAllImages();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // print CSS — styled-jsx 가 @page at-rule 을 통째로 삼키는 이슈가 있어서
  // document.head 에 일반 <style> 로 직접 삽입.
  // 페이지는 표준 A4 landscape — 비표준 사이즈(297×167mm) 는 Chrome "PDF 저장" 이
  // OS 기본 portrait 으로 떨어뜨려 콘텐츠가 회전된 것처럼 나오는 이슈가 있음.
  // 캔버스(16:9) 와 페이지(1.414:1) 비율 차이로 생기는 위아래 띠는 캔버스 bg 가 채워줌.
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-landing-print", "1");
    style.textContent = `
      @page {
        size: A4 landscape;
        margin: 0;
      }
      @media print {
        html, body {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* 배경색·이미지 보존 — 검정 캔버스가 통째로 날아가지 않게 */
        html, body, .page-slide, .page-slide * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* 각 블록 = 1페이지. 페이지 크기와 무관하게 전체 채우게 (vw/vh).
           @page 가 무시되어 페이지가 A4 가 되어도 .page-slide 가 페이지 전체를 덮어서
           안의 캔버스 bg 가 띠까지 채움 (= 흰 여백 안 보이게). */
        .page-slide {
          page-break-after: always;
          page-break-inside: avoid;
          width: 100vw !important;
          height: 100vh !important;
          overflow: hidden;
        }
        .page-slide:last-child {
          page-break-after: auto;
        }
        /* 캔버스 페이지의 section/wrap 도 강제로 페이지 전체. h-screen 의 vh 가
           가끔 page-slide 와 안 맞게 잡히는 케이스 방지. */
        .page-slide > * {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          scroll-snap-align: none !important;
        }
        .page-slide section {
          min-height: 0 !important;
          height: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  if (!ready) {
    return (
      <div className="p-12 text-center text-sm text-ink-500">
        랜딩 PDF 준비 중…
      </div>
    );
  }

  return (
    <div className="bg-canvas min-h-screen print:bg-white">
      {/* 인쇄 안내 + 진행률 (인쇄 시 숨김) */}
      <div className="print:hidden bg-surface border-b border-ink-100 px-6 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-ink-700">
              {blocks.length === 0
                ? "어드민에서 랜딩 블록을 만들지 않은 행사입니다 — 기본 표지 1장만 출력합니다."
                : imgProgress.printing
                  ? `인쇄 다이얼로그가 열렸어요 — [방향: 가로]·[배경 그래픽: 켜기] 확인 후 저장하세요.`
                  : imgProgress.total > 0 && imgProgress.loaded < imgProgress.total
                    ? `이미지 ${imgProgress.loaded} / ${imgProgress.total}장 로딩 중… (전부 받은 후 자동으로 인쇄 다이얼로그가 열립니다)`
                    : `랜딩 PDF — ${blocks.length}페이지. 곧 인쇄 다이얼로그가 자동으로 열립니다.`}
            </p>
            {imgProgress.total > 0 && imgProgress.loaded < imgProgress.total && (
              <div className="mt-2 h-1 bg-ink-100 rounded overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{
                    width: `${(imgProgress.loaded / imgProgress.total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-pill bg-ink-900 text-white text-[12px] font-bold hover:bg-brand-500 flex items-center gap-1.5 shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            지금 인쇄
          </button>
        </div>
      </div>

      {/* 블록 — 각 블록 한 페이지. 어드민 미설정 시 폴백 표지 1장. */}
      <div className="print:m-0">
        {blocks.length === 0 ? (
          <FallbackCover settings={settings} />
        ) : (
          blocks.map((b) => (
            <div key={b.id} className="page-slide">
              <BlockSection block={b} eventId={eventId} settings={settings} />
            </div>
          ))
        )}
      </div>

      <style jsx global>{`
        /* 화면 모드에서도 한 화면씩 보이게 (print 규칙은 useEffect 에서 주입) */
        @media screen {
          .page-slide {
            min-height: 100vh;
          }
        }
      `}</style>
    </div>
  );
}

// ─── 폴백 표지 — 어드민이 랜딩 블록을 안 만든 행사용 ─────────────
function FallbackCover({ settings }: { settings: SiteSettings | null }) {
  const eventName = settings?.event.nameKo ?? "K-PRINT 2026";
  return (
    <div className="page-slide bg-canvas">
      <section className="h-screen relative overflow-hidden flex flex-col justify-center px-12 md:px-20 bg-brand-grad text-white">
        <div className="font-num text-[14px] uppercase tracking-[0.35em] font-bold mb-6 opacity-90">
          Sponsorship Deck
        </div>
        <h1 className="text-[64px] md:text-[88px] font-bold tracking-tight leading-[0.95]">
          {eventName}
        </h1>
        <div className="mt-10 space-y-2 text-[18px] md:text-[20px] leading-relaxed opacity-95">
          {settings?.event.dateRange && (
            <div className="font-num font-semibold">
              {settings.event.dateRange}
            </div>
          )}
          {settings?.event.venue && <div>{settings.event.venue}</div>}
        </div>
        <div className="absolute bottom-10 right-12 md:right-20 text-[12px] opacity-80 leading-relaxed">
          {settings?.contact.phone && <div>{settings.contact.phone}</div>}
          {settings?.contact.email && <div>{settings.contact.email}</div>}
        </div>
      </section>
    </div>
  );
}
