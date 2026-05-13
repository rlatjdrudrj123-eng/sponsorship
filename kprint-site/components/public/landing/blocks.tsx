"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import type {
  AdGoals4Block,
  Benefits4Block,
  BigStatBlock,
  CoverBlock,
  CtaBlock,
  ImageBlock,
  LandingBlock,
  RichTextBlock,
  SiteSettings,
  Stats3YearBlock,
  Steps4Block,
  TextHeroBlock,
} from "@/lib/types";

/**
 * KIMES Figma 톤에 맞춘 블록 컴포넌트 모음.
 *
 * 각 블록은 자체 슬라이드(h-screen snap)로 렌더되며 LandingRenderer 가 시퀀스를 관리한다.
 * 데이터는 어드민 [사이트 설정] → 랜딩 빌더에서 자유롭게 추가·편집·재배치된다.
 */

// ============================================================================
// 공용: SectionLabel — 빨강 헤어라인 + uppercase 라벨
// ============================================================================

export function SectionLabel({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="text-[12px] tracking-[0.3em] uppercase text-brand-500 font-num font-bold mb-6 flex items-center gap-2">
      <span className="w-6 h-px bg-brand-500" />
      {children}
    </div>
  );
}

// ============================================================================
// 공용: Reveal — 뷰포트 진입 fade-up
// ============================================================================

export function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={
        "transition-all duration-1000 " +
        (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")
      }
    >
      {children}
    </div>
  );
}

// ============================================================================
// 공용: SlideShell — 풀스크린 + max-w-7xl 컨테이너
// ============================================================================

function SlideShell({
  children,
  variant = "light",
}: {
  children: React.ReactNode;
  variant?: "light" | "dark" | "brand";
}) {
  const bg =
    variant === "brand"
      ? "bg-brand-grad text-white"
      : variant === "dark"
        ? "bg-ink-900 text-white"
        : "bg-canvas text-ink-900";
  return (
    <section
      className={
        "h-screen snap-start snap-always relative overflow-hidden flex items-center px-8 md:px-16 " +
        bg
      }
    >
      <div className="relative max-w-7xl mx-auto w-full">{children}</div>
      {variant !== "brand" && (
        <div className="absolute inset-x-0 bottom-0 h-px bg-ink-100/60 pointer-events-none" />
      )}
    </section>
  );
}

// ============================================================================
// Cover — 풀스크린 표지 (빨강 플레어 + 큰 행사명)
// ============================================================================

export function CoverSection({
  block,
  eventId,
}: {
  block: CoverBlock;
  eventId: string;
}) {
  const { eyebrow, title, subtitle, bgImageUrl } = block.data;
  return (
    <section className="h-screen snap-start snap-always relative overflow-hidden flex items-center px-8 md:px-16 bg-canvas text-ink-900">
      {bgImageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas/70 to-canvas" />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-red-flare opacity-60 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 right-0 w-[600px] h-[600px] rounded-full bg-brand-grad opacity-20 blur-3xl"
          />
        </>
      )}

      <div className="relative max-w-7xl mx-auto w-full">
        <Reveal>
          {eyebrow && (
            <div className="font-num text-[14px] md:text-[16px] tracking-[0.5em] uppercase text-brand-500 font-bold mb-6">
              {eyebrow}
            </div>
          )}
        </Reveal>
        <Reveal delay={150}>
          <h1 className="text-[56px] md:text-[120px] font-bold leading-[0.95] tracking-tight text-ink-900">
            {title}
          </h1>
        </Reveal>
        {subtitle && (
          <Reveal delay={400}>
            <div className="mt-8 md:mt-10 text-[14px] md:text-[18px] text-ink-500 font-num">
              {subtitle}
            </div>
          </Reveal>
        )}
        <Reveal delay={700}>
          <div className="mt-16 md:mt-20 flex items-center gap-4 flex-wrap">
            <Link
              href={`/${eventId}/sponsorships`}
              className="px-7 py-4 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 hover:shadow-glow-sm transition-all flex items-center gap-2"
            >
              스폰서십 둘러보기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/${eventId}/contact`}
              className="px-7 py-4 rounded-pill border-2 border-ink-900 text-ink-900 font-bold hover:bg-ink-900 hover:text-white transition-colors"
            >
              바로 문의하기
            </Link>
          </div>
        </Reveal>
        <Reveal delay={1000}>
          <div className="mt-16 text-[10px] uppercase tracking-[0.3em] text-ink-300 font-mono flex items-center gap-2">
            scroll
            <ArrowDown className="w-3 h-3 animate-bounce" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================================
// Stats3Year — 3년치 방문객/해외바이어 카드 (KIMES 슬라이드 126)
// ============================================================================

export function Stats3YearSection({ block }: { block: Stats3YearBlock }) {
  const { eyebrow, headline, years, footnote } = block.data;
  return (
    <SlideShell>
      <Reveal>
        <SectionLabel>{eyebrow ?? "scale"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[64px] font-bold leading-[1.05] tracking-tight max-w-5xl mb-10 text-ink-900">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {years.map((y, i) => (
          <Reveal key={i} delay={300 + i * 150}>
            <div className="bg-surface border border-ink-100 rounded-card p-6 md:p-8 shadow-card hover:shadow-glow-sm hover:border-brand-500 transition-all">
              <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3">
                {y.year}
              </div>
              <div className="font-num text-[40px] md:text-[48px] font-bold text-ink-900 leading-none tracking-tight">
                {y.visitors.toLocaleString()}
                <span className="text-[18px] ml-1 font-semibold">명</span>
              </div>
              <div className="text-[11px] text-ink-500 mt-1">전체 방문객</div>
              {y.overseas !== undefined && y.overseas > 0 && (
                <div className="mt-5 pt-5 border-t border-ink-100">
                  <div className="font-num text-[22px] md:text-[26px] font-bold text-ink-900">
                    {y.overseas.toLocaleString()}
                    <span className="text-[14px] ml-1 font-semibold">명</span>
                  </div>
                  <div className="text-[11px] text-ink-500 mt-0.5">해외 바이어</div>
                </div>
              )}
              {y.note && (
                <div className="mt-3 text-[11px] text-ink-500">{y.note}</div>
              )}
            </div>
          </Reveal>
        ))}
      </div>

      {footnote && (
        <Reveal delay={300 + years.length * 150}>
          <p className="mt-8 text-[12px] md:text-[13px] text-ink-500 max-w-2xl leading-relaxed">
            {footnote}
          </p>
        </Reveal>
      )}
    </SlideShell>
  );
}

// ============================================================================
// AdGoals4 — 4가지 광고 목적 카드 (Figma 132-133)
// ============================================================================

export function AdGoals4Section({ block }: { block: AdGoals4Block }) {
  const { eyebrow, headline, cards } = block.data;
  return (
    <SlideShell>
      <Reveal>
        <SectionLabel>{eyebrow ?? "ad goals"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[56px] font-bold leading-[1.05] tracking-tight max-w-4xl mb-10 text-ink-900">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c, i) => (
          <Reveal key={i} delay={300 + i * 120}>
            <div className="bg-surface border border-ink-100 rounded-card p-5 md:p-6 h-full flex flex-col hover:border-brand-500 hover:shadow-card transition-all">
              <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3">
                Type {i + 1}
              </div>
              {c.emoji && <div className="text-[32px] mb-3">{c.emoji}</div>}
              <div className="text-[17px] md:text-[18px] font-bold text-ink-900 leading-tight tracking-tight">
                {c.label}
              </div>
              <p className="text-[12.5px] md:text-[13px] text-ink-500 mt-3 leading-relaxed flex-1">
                {c.description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </SlideShell>
  );
}

// ============================================================================
// Benefits4 — 4가지 혜택 카드 (Figma 131)
// ============================================================================

export function Benefits4Section({ block }: { block: Benefits4Block }) {
  const { eyebrow, headline, cards } = block.data;
  return (
    <SlideShell>
      <Reveal>
        <SectionLabel>{eyebrow ?? "sponsors benefits"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[56px] font-bold leading-[1.05] tracking-tight max-w-4xl mb-10 text-ink-900">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c, i) => (
          <Reveal key={i} delay={300 + i * 120}>
            <div className="relative bg-surface border border-ink-100 rounded-card p-5 md:p-6 h-full flex flex-col shadow-card">
              <div className="absolute -top-3 left-5 px-2.5 py-1 rounded-pill bg-brand-500 text-white text-[10px] font-num font-bold uppercase tracking-widest shadow-glow-sm">
                혜택 {i + 1}
              </div>
              {c.emoji && <div className="text-[32px] mb-2 mt-2">{c.emoji}</div>}
              <div className="text-[16px] md:text-[17px] font-bold text-ink-900 leading-tight tracking-tight mt-2">
                {c.title}
              </div>
              {c.description && (
                <p className="text-[12.5px] md:text-[13px] text-ink-500 mt-3 leading-relaxed flex-1">
                  {c.description}
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </SlideShell>
  );
}

// ============================================================================
// Steps4 — 4단계 신청 절차 카드 (Figma 158)
// ============================================================================

export function Steps4Section({ block }: { block: Steps4Block }) {
  const { eyebrow, headline, steps } = block.data;
  return (
    <SlideShell>
      <Reveal>
        <SectionLabel>{eyebrow ?? "application"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[56px] font-bold leading-[1.05] tracking-tight max-w-4xl mb-10 text-ink-900">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {steps.map((s, i) => (
          <Reveal key={i} delay={300 + i * 120}>
            <div className="bg-surface border border-ink-100 rounded-feature p-5 md:p-6 h-full flex flex-col shadow-card relative">
              <div className="font-num text-[36px] md:text-[44px] font-bold text-brand-500 leading-none border-b-2 border-brand-500 pb-3 mb-4">
                0{i + 1}
              </div>
              <div className="text-[16px] md:text-[18px] font-bold text-ink-900 leading-tight tracking-tight">
                {s.title}
              </div>
              {s.description && (
                <p className="text-[12.5px] md:text-[13px] text-ink-500 mt-3 leading-relaxed flex-1 whitespace-pre-line">
                  {s.description}
                </p>
              )}
              {i < steps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-300" />
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </SlideShell>
  );
}

// ============================================================================
// TextHero — 큰 텍스트 줄들 (Figma "모든 동선 위에 / 당신의 브랜드를")
// ============================================================================

export function TextHeroSection({ block }: { block: TextHeroBlock }) {
  const { eyebrow, lines, description } = block.data;
  return (
    <SlideShell>
      <Reveal>
        <SectionLabel>{eyebrow}</SectionLabel>
      </Reveal>
      <div className="space-y-2">
        {lines.map((line, i) => {
          const accent = line.startsWith("*");
          const text = accent ? line.slice(1).trim() : line;
          return (
            <Reveal key={i} delay={150 + i * 250}>
              <h2
                className={
                  "text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight max-w-5xl " +
                  (accent ? "text-brand-500" : "text-ink-900")
                }
              >
                {text}
              </h2>
            </Reveal>
          );
        })}
      </div>
      {description && (
        <Reveal delay={150 + lines.length * 250}>
          <p className="mt-10 text-[14px] md:text-[16px] text-ink-500 max-w-2xl leading-relaxed">
            {description}
          </p>
        </Reveal>
      )}
    </SlideShell>
  );
}

// ============================================================================
// BigStat — 큰 숫자 하나 (Figma "70,000명이 / 4일간 다녀갑니다")
// ============================================================================

export function BigStatSection({ block }: { block: BigStatBlock }) {
  const { eyebrow, value, valueSuffix, label, description } = block.data;
  return (
    <SlideShell>
      <Reveal>
        <SectionLabel>{eyebrow}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight max-w-5xl text-ink-900">
          <span className="text-brand-500 font-num">{value}</span>
          {valueSuffix && <span className="font-num">{valueSuffix}</span>}
        </h2>
      </Reveal>
      <Reveal delay={400}>
        <h3 className="text-[28px] md:text-[48px] font-bold leading-[1.1] tracking-tight text-ink-700 max-w-4xl mt-2">
          {label}
        </h3>
      </Reveal>
      {description && (
        <Reveal delay={700}>
          <p className="mt-10 text-[14px] md:text-[16px] text-ink-500 max-w-2xl leading-relaxed">
            {description}
          </p>
        </Reveal>
      )}
    </SlideShell>
  );
}

// ============================================================================
// CTA — 빨강 풀브리드 CTA (마지막 슬라이드)
// ============================================================================

export function CtaSection({
  block,
  eventId,
  settings,
}: {
  block: CtaBlock;
  eventId: string;
  settings: SiteSettings | null;
}) {
  const {
    eyebrow,
    lines,
    primaryLabel,
    primaryHref,
    secondaryLabel,
    secondaryHref,
    showContact,
  } = block.data;
  return (
    <SlideShell variant="brand">
      <Reveal>
        {eyebrow && (
          <div className="text-[12px] tracking-[0.3em] uppercase text-white/70 font-mono mb-6">
            {eyebrow}
          </div>
        )}
      </Reveal>
      {lines.map((line, i) => (
        <Reveal key={i} delay={150 + i * 200}>
          <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight max-w-5xl text-white">
            {line}
          </h2>
        </Reveal>
      ))}
      <Reveal delay={150 + lines.length * 200}>
        <div className="mt-12 md:mt-16 flex flex-wrap gap-3">
          <Link
            href={primaryHref ?? `/${eventId}/sponsorships`}
            className="px-7 py-4 rounded-pill bg-white text-ink-900 hover:bg-ink-900 hover:text-white text-[15px] md:text-[16px] font-bold flex items-center gap-3 transition-colors"
          >
            {primaryLabel ?? "스폰서십 둘러보기"}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={secondaryHref ?? `/${eventId}/contact`}
            className="px-7 py-4 rounded-pill border-2 border-white text-white hover:bg-white hover:text-brand-500 text-[15px] md:text-[16px] font-bold transition-colors"
          >
            {secondaryLabel ?? "바로 문의하기"}
          </Link>
        </div>
      </Reveal>
      {showContact && settings?.contact && (
        <Reveal delay={400 + lines.length * 200}>
          <div className="mt-16 text-[12px] text-white/70 font-num flex flex-wrap gap-x-8 gap-y-2">
            {settings.contact.phone && <span>{settings.contact.phone}</span>}
            {settings.contact.email && (
              <a
                href={`mailto:${settings.contact.email}`}
                className="hover:text-white underline-offset-2 hover:underline"
              >
                {settings.contact.email}
              </a>
            )}
          </div>
        </Reveal>
      )}
    </SlideShell>
  );
}

// ============================================================================
// Image — 단일 이미지 (full bleed 또는 contained)
// ============================================================================

export function ImageSection({ block }: { block: ImageBlock }) {
  const { url, alt, caption, fullBleed } = block.data;
  return (
    <section className="h-screen snap-start snap-always relative overflow-hidden flex items-center bg-canvas">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ""}
          className={
            fullBleed
              ? "w-full h-full object-cover"
              : "max-w-7xl mx-auto max-h-[80vh] object-contain"
          }
        />
      ) : (
        <div className="max-w-7xl mx-auto w-full grid place-items-center text-ink-300">
          이미지 URL이 비어있습니다
        </div>
      )}
      {caption && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[12px] text-ink-500 font-num">
          {caption}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// RichText — 자유 텍스트 본문 (마크다운 X, plain text)
// ============================================================================

export function RichTextSection({ block }: { block: RichTextBlock }) {
  const { eyebrow, headline, body, align = "left" } = block.data;
  const alignCls = align === "center" ? "text-center mx-auto" : "";
  return (
    <SlideShell>
      <div className={"max-w-3xl " + alignCls}>
        <Reveal>
          <SectionLabel>{eyebrow}</SectionLabel>
        </Reveal>
        {headline && (
          <Reveal delay={150}>
            <h2 className="text-[32px] md:text-[48px] font-bold leading-[1.1] tracking-tight text-ink-900 mb-6">
              {headline}
            </h2>
          </Reveal>
        )}
        <Reveal delay={300}>
          <p className="text-[16px] md:text-[18px] text-ink-700 leading-[1.7] whitespace-pre-line">
            {body}
          </p>
        </Reveal>
      </div>
    </SlideShell>
  );
}

// ============================================================================
// 디스패처 — type 별로 적절한 섹션 컴포넌트 렌더
// ============================================================================

export function BlockSection({
  block,
  eventId,
  settings,
}: {
  block: LandingBlock;
  eventId: string;
  settings: SiteSettings | null;
}) {
  switch (block.type) {
    case "cover":
      return <CoverSection block={block} eventId={eventId} />;
    case "stats3year":
      return <Stats3YearSection block={block} />;
    case "adGoals4":
      return <AdGoals4Section block={block} />;
    case "benefits4":
      return <Benefits4Section block={block} />;
    case "steps4":
      return <Steps4Section block={block} />;
    case "textHero":
      return <TextHeroSection block={block} />;
    case "bigStat":
      return <BigStatSection block={block} />;
    case "cta":
      return (
        <CtaSection block={block} eventId={eventId} settings={settings} />
      );
    case "image":
      return <ImageSection block={block} />;
    case "richText":
      return <RichTextSection block={block} />;
    default: {
      // exhaustiveness check
      const _: never = block;
      void _;
      return null;
    }
  }
}

// 미사용 import 안전망 (Check 가 다른 블록에서 쓰일 수도 있어 보관)
void Check;
