"use client";

import { useEffect, useRef } from "react";
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
  const mainRef = useRef<HTMLElement>(null);

  // 페이지 진입·blocks 로드 시 무조건 첫 슬라이드부터 시작 — 데이터 로드 직전 빈 main 위에
  // 마지막 슬라이드(ModeChoice) 만 잡혀 그 위치로 머무는 버그 방지.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [blocks.length]);

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

      <main
        ref={mainRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory bg-canvas text-ink-900"
      >
        {blocks.map((b) => (
          <BlockSection
            key={b.id}
            block={b}
            eventId={eventId}
            settings={settings}
          />
        ))}

        {/* 데크 마지막 — 자세히 알아보기 CTA */}
        <ModeChoice eventId={eventId} locale={locale} />

        {/* 클로징 — 외부 신청 링크 + PDF + 연락처 */}
        <ClosingSlide eventId={eventId} settings={settings} locale={locale} />
      </main>
    </>
  );
}

/**
 * 마지막 슬라이드 — KPRINT 신청 외부 링크 + 전체 PDF 다운로드 + Contact.
 * KIMES 패턴 참조.
 */
function ClosingSlide({
  eventId,
  settings,
  locale,
}: {
  eventId: string;
  settings: SiteSettings | null;
  locale: "ko" | "en";
}) {
  const contact = settings?.contact;
  return (
    <section className="h-screen snap-start snap-always relative overflow-hidden flex flex-col items-center justify-center bg-canvas text-ink-900 px-8 md:px-16">
      <div className="max-w-3xl w-full text-center flex flex-col items-center">
        {/* 브랜드 — K·print */}
        <div className="font-bold text-[34px] md:text-[44px] tracking-tight text-brand-500 leading-none mb-12 md:mb-16">
          K·print
        </div>

        {/* 메인 카피 */}
        <h2 className="text-[26px] md:text-[42px] font-bold tracking-tight text-ink-900 leading-[1.25] md:leading-[1.2] mb-10 md:mb-14">
          {locale === "en" ? (
            <>
              Reach decision-makers in the
              <br />
              print &amp; digital industry — start now.
            </>
          ) : (
            <>
              인쇄·디지털프린팅 산업 전문가가 모이는 자리에서
              <br />
              지금 바로 브랜드를 알리세요!
            </>
          )}
        </h2>

        {/* CTA 두 버튼 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:gap-3 w-full sm:w-auto">
          <a
            href="https://kprint.kr/ko/mypage/exhibitor/advertise"
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 md:px-9 py-3.5 md:py-4 rounded-btn bg-brand-500 text-white hover:bg-brand-700 text-[14px] md:text-[15px] font-bold transition-colors inline-flex items-center justify-center gap-2"
          >
            {locale === "en" ? "Apply online" : "온라인 신청 바로가기"}
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            href={`/${eventId}/print/full`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 md:px-9 py-3.5 md:py-4 rounded-btn bg-ink-900 text-white hover:bg-ink-700 text-[14px] md:text-[15px] font-bold transition-colors inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {locale === "en" ? "Download PDF" : "PDF 다운로드"}
          </Link>
        </div>

        {/* Contact — settings.contact 있을 때만 */}
        {contact && (
          <div className="mt-14 md:mt-20 text-center">
            <div className="font-bold text-[13px] text-ink-700 mb-2">
              Contact.
            </div>
            <div className="text-[12px] md:text-[13px] text-ink-500 leading-relaxed font-num">
              {contact.phone}
              {contact.phone && contact.email && (
                <span className="mx-2 text-ink-300">|</span>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="hover:text-ink-900"
                >
                  {contact.email}
                </a>
              )}
            </div>
            {contact.address && (
              <div className="text-[11.5px] md:text-[12.5px] text-ink-500 mt-1">
                {contact.address}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * 데크 마지막에 자동 추가되는 CTA 슬라이드.
 * 우상단 영속 버튼과 동일 동선이지만, 끝까지 본 사용자에게는 명시적 다음 액션이 보이도록.
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

