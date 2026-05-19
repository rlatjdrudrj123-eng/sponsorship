"use client";

import { ArrowRight, Download, Tag } from "lucide-react";
import Link from "next/link";
import type { LandingBlock, SiteSettings } from "@/lib/types";
import { BlockSection } from "./blocks";
import { useLocale } from "@/lib/i18n/locale";

/**
 * 캔버스로 디자인된 슬라이드 데크를 풀스크린 snap-scroll 로 렌더.
 *
 * 어드민이 [랜딩 빌더]에서 블록(=캔버스 페이지)을 추가하면 그 순서대로 슬라이드.
 * 비어있으면 buildDefaultBlocks 자동 시드.
 *
 * 우상단 영속 버튼: "스폰서십 상세 보기" — 참가업체가 슬라이드 건너뛰고 바로
 * 카드 그리드 화면으로 갈 수 있게.
 */
export function LandingRenderer({
  blocks,
  eventId,
  settings,
}: {
  blocks: LandingBlock[];
  eventId: string;
  settings: SiteSettings | null;
}) {
  const locale = useLocale((s) => s.locale);
  return (
    <>
      {/* 우상단 영속 버튼 — 카탈로그·전체 PDF */}
      <div className="fixed top-6 right-6 md:top-8 md:right-8 z-50 flex items-center gap-2">
        <Link
          href={`/${eventId}/print/full`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-pill bg-white/90 backdrop-blur border border-ink-100 hover:border-ink-900 text-ink-900 text-[12px] md:text-[13px] font-bold transition-colors flex items-center gap-1.5"
          title={
            locale === "en"
              ? "Full sponsorship PDF"
              : "전체 패키지 PDF (인쇄·PDF 저장)"
          }
        >
          <Download className="w-3.5 h-3.5" />
          {locale === "en" ? "Full PDF" : "전체 PDF"}
        </Link>
        <Link
          href={`/${eventId}/sponsorships`}
          className="px-5 py-2.5 rounded-pill bg-brand-500 text-white hover:bg-brand-700 text-[12px] md:text-[13px] font-bold transition-colors flex items-center gap-1.5 shadow-glow-sm hover:shadow-glow"
          title={
            locale === "en"
              ? "See sponsorships in detail"
              : "스폰서십 상세 보기 (필터·가격·구좌)"
          }
        >
          <Tag className="w-3.5 h-3.5" />
          {locale === "en" ? "Sponsorships" : "스폰서십 상세 보기"}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <main className="h-screen overflow-y-scroll snap-y snap-mandatory bg-canvas text-ink-900">
        {blocks.map((b) => (
          <BlockSection
            key={b.id}
            block={b}
            eventId={eventId}
            settings={settings}
          />
        ))}

        {/* 마지막 슬라이드 다음에 양쪽 선택 화면 — 데크 끝에서 자연스럽게 결정 */}
        <ModeChoice eventId={eventId} locale={locale} />
      </main>
    </>
  );
}

/**
 * 데크 마지막에 자동 추가되는 모드 선택 슬라이드.
 * 데크 봤으니 이제 "카탈로그(필터로 찾기)" 또는 "슬라이드 다시 보기" 중 선택.
 */
function ModeChoice({
  eventId,
  locale,
}: {
  eventId: string;
  locale: "ko" | "en";
}) {
  return (
    <section className="h-screen snap-start snap-always relative overflow-hidden flex items-center justify-center bg-canvas text-ink-900 px-8 md:px-16">
      <div className="max-w-3xl w-full text-center">
        <h2 className="text-[32px] md:text-[56px] font-bold tracking-tight leading-[1.05] text-ink-900 mb-6 md:mb-8">
          {locale === "en"
            ? "Ready to dive deeper?"
            : "스폰서십, 자세히 알아볼까요?"}
        </h2>
        <p className="text-[14px] md:text-[16px] text-ink-500 leading-relaxed mb-10 md:mb-14">
          {locale === "en"
            ? "Browse the full lineup with images, sizes, prices, and slot availability — pick the ones that fit your goals."
            : "이미지·사이즈·가격·구좌 잔여까지 한눈에. 참가 목적에 맞는 항목을 골라보세요."}
        </p>
        <Link
          href={`/${eventId}/sponsorships`}
          className="inline-flex items-center gap-2.5 px-7 md:px-9 py-4 md:py-5 rounded-pill bg-ink-900 text-white hover:bg-brand-500 hover:text-ink-900 text-[15px] md:text-[16px] font-bold transition-colors shadow-glow-sm hover:shadow-glow"
        >
          {locale === "en" ? "Explore sponsorships" : "자세히 알아보기"}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
