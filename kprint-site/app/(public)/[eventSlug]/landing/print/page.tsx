"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Printer } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
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
export default function LandingPrintPage() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "siteSettings", eventId));
        if (snap.exists()) setSettings(snap.data() as SiteSettings);
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

  // 데이터 준비되면 자동 인쇄
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [ready]);

  if (!ready) {
    return (
      <div className="p-12 text-center text-sm text-ink-500">
        랜딩 PDF 준비 중…
      </div>
    );
  }

  return (
    <div className="bg-canvas min-h-screen print:bg-white">
      {/* 인쇄 안내 (인쇄 시 숨김) */}
      <div className="print:hidden bg-surface border-b border-ink-100 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <p className="text-[13px] text-ink-700">
          랜딩 PDF — {blocks.length}페이지. 자동으로 인쇄 다이얼로그가 열립니다.
          PDF로 저장하려면 [PDF로 저장]을 선택하세요.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-pill bg-ink-900 text-white text-[12px] font-bold hover:bg-brand-500 flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" />
          인쇄 / PDF
        </button>
      </div>

      {/* 블록 — 각 블록 한 페이지 */}
      <div className="print:m-0">
        {blocks.map((b) => (
          <div key={b.id} className="page-slide">
            <BlockSection block={b} eventId={eventId} settings={settings} />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html,
          body {
            background: white !important;
          }
          /* 각 블록 = 1페이지 */
          .page-slide {
            page-break-after: always;
            page-break-inside: avoid;
            height: 100vh;
            overflow: hidden;
          }
          .page-slide:last-child {
            page-break-after: auto;
          }
          /* snap 스크롤 안 보이게 */
          .page-slide > * {
            scroll-snap-align: none !important;
          }
        }
        /* 화면 모드에서도 한 화면씩 보이게 */
        @media screen {
          .page-slide {
            min-height: 100vh;
          }
        }
      `}</style>
    </div>
  );
}
