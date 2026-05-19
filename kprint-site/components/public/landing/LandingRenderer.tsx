"use client";

import { ArrowRight, Download, LayoutGrid, Sparkles } from "lucide-react";
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
 * 우상단 영속 버튼: "카탈로그로 보기" — 참가업체가 슬라이드 건너뛰고 바로
 * 필터·페르소나 화면으로 갈 수 있게.
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
              ? "Browse the catalog"
              : "필터·페르소나로 직접 찾기"
          }
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          {locale === "en" ? "Catalog" : "카탈로그로 보기"}
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
      <div className="max-w-5xl w-full">
        <div className="font-num text-[12px] md:text-[14px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-4 flex items-center gap-2 justify-center">
          <span className="w-6 h-px bg-brand-500" />
          {locale === "en"
            ? "How would you like to explore?"
            : "어떻게 둘러보시겠어요?"}
          <span className="w-6 h-px bg-brand-500" />
        </div>
        <h2 className="text-[32px] md:text-[56px] font-bold text-center tracking-tight leading-[1.05] text-ink-900 mb-10 md:mb-14">
          {locale === "en"
            ? "Dive into the sponsorships"
            : "본격적으로 스폰서십 살펴보기"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {/* 카탈로그 */}
          <Link
            href={`/${eventId}/sponsorships`}
            className="group bg-surface border-2 border-ink-100 hover:border-brand-500 hover:shadow-card rounded-card p-7 md:p-9 transition-all flex flex-col"
          >
            <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3">
              recommended
            </div>
            <div className="text-[26px] md:text-[32px] font-bold text-ink-900 tracking-tight leading-tight">
              {locale === "en" ? "Catalog" : "카탈로그"}
            </div>
            <p className="text-[13px] md:text-[14px] text-ink-500 mt-3 leading-relaxed flex-1">
              {locale === "en" ? (
                <>
                  Get suggestions by{" "}
                  <strong className="text-ink-900">
                    persona · budget · goal
                  </strong>{" "}
                  and compare candidates as cards. Start here if you&apos;re new.
                </>
              ) : (
                <>
                  <strong className="text-ink-900">
                    페르소나·예산·목적
                  </strong>
                  으로 추천을 받고, 필터로 좁혀 카드 단위로 비교. 처음이라면
                  여기서 시작하세요.
                </>
              )}
            </p>
            <div className="mt-5 flex items-center gap-1 text-[12.5px] font-num font-bold text-brand-500">
              <LayoutGrid className="w-3.5 h-3.5" />
              {locale === "en" ? "Card grid" : "카드 그리드"}
              <span className="text-ink-300 mx-1.5">·</span>
              <Sparkles className="w-3 h-3" />
              {locale === "en" ? "Persona match" : "페르소나 추천"}
              <span className="text-ink-300 mx-1.5">·</span>
              {locale === "en" ? "Compare" : "비교"}
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-[13.5px] font-bold text-ink-900 group-hover:text-brand-500 transition-colors">
              {locale === "en" ? "Open catalog" : "카탈로그 열기"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* 슬라이드 (자세히) */}
          <Link
            href={`/${eventId}/sponsorships?view=slide`}
            className="group bg-surface border-2 border-ink-100 hover:border-ink-900 hover:shadow-card rounded-card p-7 md:p-9 transition-all flex flex-col"
          >
            <div className="font-num text-[11px] uppercase tracking-[0.3em] text-ink-500 font-bold mb-3">
              one by one
            </div>
            <div className="text-[26px] md:text-[32px] font-bold text-ink-900 tracking-tight leading-tight">
              {locale === "en" ? "Slides" : "슬라이드"}
            </div>
            <p className="text-[13px] md:text-[14px] text-ink-500 mt-3 leading-relaxed flex-1">
              {locale === "en"
                ? "One slot per fullscreen — image, size, price, slot selector. Print-friendly as is."
                : "슬롯 하나씩 풀스크린으로. 이미지 · 사이즈 · 가격 · 구좌 선택까지 한 화면에. PDF 출력에 그대로 사용 가능합니다."}
            </p>
            <div className="mt-5 flex items-center gap-1 text-[12.5px] font-num font-bold text-ink-700">
              {locale === "en" ? "One at a time" : "한 장씩 보기"}
              <span className="text-ink-300 mx-1.5">·</span>
              16:9
              <span className="text-ink-300 mx-1.5">·</span>
              {locale === "en" ? "Print-friendly" : "PDF 친화"}
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-[13.5px] font-bold text-ink-900 group-hover:text-brand-500 transition-colors">
              {locale === "en" ? "Open slides" : "슬라이드 보기"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
