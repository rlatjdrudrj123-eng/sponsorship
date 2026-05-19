"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, Download } from "lucide-react";
import type {
  AdGoals4Block,
  Benefits4Block,
  BigStatBlock,
  BlockStyle,
  ButtonRowBlock,
  CanvasPageBlock,
  CoverBlock,
  CtaBlock,
  CustomHtmlBlock,
  DividerBlock,
  ImageBlock,
  ImageGridBlock,
  LandingBlock,
  PdfDownloadBlock,
  RichTextBlock,
  SiteSettings,
  SlotsTeaserBlock,
  SpacerBlock,
  Stats3YearBlock,
  Steps4Block,
  TextHeroBlock,
  TwoColumnBlock,
  VideoEmbedBlock,
} from "@/lib/types";
import { CanvasRenderer } from "@/components/public/canvas/CanvasRenderer";

/**
 * 블록 컴포넌트들 — 어드민이 자유 구성한 시퀀스를 렌더링.
 *
 * 각 블록은 BlockStyle override (bg/text/accent/minHeight/align/pad/fullBleed) 를
 * 받아 어드민이 원하는 만큼 자유롭게 커스터마이즈 가능.
 */

// ============================================================================
// 공용: SectionLabel
// ============================================================================

export function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  if (!children) return null;
  return (
    <div
      className="text-[12px] tracking-[0.3em] uppercase font-num font-bold mb-6 flex items-center gap-2"
      style={color ? { color } : undefined}
    >
      <span
        className="w-6 h-px"
        style={{ background: color ?? "var(--brand-500)" }}
      />
      <span className={color ? undefined : "text-brand-500"}>{children}</span>
    </div>
  );
}

// ============================================================================
// 공용: Reveal
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
      { threshold: 0.15 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={
        "transition-all duration-700 " +
        (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")
      }
    >
      {children}
    </div>
  );
}

// ============================================================================
// SlideShell — 블록 공통 컨테이너. BlockStyle override 적용.
// ============================================================================

function resolveBg(bg?: string): string | undefined {
  if (!bg) return undefined;
  if (bg === "canvas") return "var(--color-canvas, #F6F6F6)";
  if (bg === "surface") return "var(--color-surface, #FFFFFF)";
  if (bg === "ink") return "#0A0A0A";
  if (bg === "brand") return "var(--brand-500)";
  if (bg === "transparent") return "transparent";
  return bg;
}

function minHeightCls(mh?: BlockStyle["minHeight"]): string {
  // 16:9 PDF 호환: 슬라이드 1장 = 정확히 h-screen, 스크롤 없음, overflow 잘림
  switch (mh) {
    case "half":
      return "h-[50vh] overflow-hidden";
    case "auto":
      return "";
    case "screen":
    default:
      return "h-screen overflow-hidden";
  }
}

function padCls(pad?: BlockStyle["pad"]): string {
  switch (pad) {
    case "tight":
      return "py-10 md:py-12 px-6 md:px-12";
    case "loose":
      return "py-24 md:py-32 px-8 md:px-20";
    case "normal":
    default:
      return "py-16 md:py-20 px-8 md:px-16";
  }
}

function alignCls(align?: BlockStyle["align"]): string {
  if (align === "center") return "text-center items-center";
  if (align === "right") return "text-right items-end";
  return "text-left items-start";
}

function snapCls(): string {
  return "snap-start snap-always";
}

function SlideShell({
  style,
  variant,
  children,
}: {
  style?: BlockStyle;
  variant?: "light" | "dark" | "brand";
  children: React.ReactNode;
}) {
  // variant default → bg/text
  let bg =
    variant === "brand"
      ? "var(--brand-500)"
      : variant === "dark"
        ? "#0A0A0A"
        : "var(--color-canvas, #F6F6F6)";
  let text =
    variant === "brand" || variant === "dark" ? "#FFFFFF" : "#0A0A0A";

  // override
  const ob = resolveBg(style?.bg);
  if (ob) bg = ob;
  if (style?.text) text = style.text;

  const containerStyle: CSSProperties = {
    background: bg,
    color: text,
  };
  if (style?.accent) {
    (containerStyle as Record<string, string>)["--brand-500"] = style.accent;
  }

  const align = style?.align ?? "left";

  return (
    <section
      className={
        "relative overflow-hidden flex " +
        minHeightCls(style?.minHeight) +
        " " +
        snapCls() +
        " " +
        (align === "center"
          ? "items-center justify-center"
          : align === "right"
            ? "items-center justify-end"
            : "items-center justify-start")
      }
      style={containerStyle}
    >
      <div
        className={
          (style?.fullBleed ? "w-full " : "max-w-7xl w-full mx-auto ") +
          padCls(style?.pad) +
          " flex flex-col gap-6 " +
          alignCls(align)
        }
      >
        {children}
      </div>
    </section>
  );
}

// ============================================================================
// Cover
// ============================================================================

export function CoverSection({
  block,
  eventId,
}: {
  block: CoverBlock;
  eventId: string;
}) {
  const { eyebrow, title, subtitle, bgImageUrl } = block.data;
  const style = block.style;
  const accent = style?.accent;
  return (
    <section
      className={
        "relative flex items-center " +
        minHeightCls(style?.minHeight ?? "screen") +
        " " +
        snapCls() +
        " " +
        padCls(style?.pad)
      }
      style={{
        background: resolveBg(style?.bg) ?? "var(--color-canvas, #F6F6F6)",
        color: style?.text ?? "#0A0A0A",
        ...(accent
          ? ({ ["--brand-500" as string]: accent } as CSSProperties)
          : {}),
      }}
    >
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
          <h1 className="text-[56px] md:text-[120px] font-bold leading-[0.95] tracking-tight">
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
// Stats3Year
// ============================================================================

export function Stats3YearSection({ block }: { block: Stats3YearBlock }) {
  const { eyebrow, headline, years, footnote } = block.data;
  return (
    <SlideShell style={block.style}>
      <Reveal>
        <SectionLabel>{eyebrow ?? "scale"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[64px] font-bold leading-[1.05] tracking-tight max-w-5xl mb-2">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-6">
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
          <p className="mt-6 text-[12px] md:text-[13px] text-ink-500 max-w-2xl leading-relaxed">
            {footnote}
          </p>
        </Reveal>
      )}
    </SlideShell>
  );
}

// ============================================================================
// AdGoals4
// ============================================================================

export function AdGoals4Section({ block }: { block: AdGoals4Block }) {
  const { eyebrow, headline, cards } = block.data;
  return (
    <SlideShell style={block.style}>
      <Reveal>
        <SectionLabel>{eyebrow ?? "ad goals"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[56px] font-bold leading-[1.05] tracking-tight max-w-4xl">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full mt-6">
        {cards.map((c, i) => (
          <Reveal key={i} delay={300 + i * 120}>
            <div className="bg-surface border border-ink-100 rounded-card p-5 md:p-6 h-full flex flex-col hover:border-brand-500 hover:shadow-card transition-all">
              <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3">
                Type {i + 1}
              </div>
              {c.emoji && <div className="text-[32px] mb-3">{c.emoji}</div>}
              <div className="text-[17px] md:text-[18px] font-bold leading-tight tracking-tight">
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
// Benefits4
// ============================================================================

export function Benefits4Section({ block }: { block: Benefits4Block }) {
  const { eyebrow, headline, cards } = block.data;
  return (
    <SlideShell style={block.style}>
      <Reveal>
        <SectionLabel>{eyebrow ?? "sponsors benefits"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[56px] font-bold leading-[1.05] tracking-tight max-w-4xl">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full mt-6">
        {cards.map((c, i) => (
          <Reveal key={i} delay={300 + i * 120}>
            <div className="relative bg-surface border border-ink-100 rounded-card p-5 md:p-6 h-full flex flex-col shadow-card">
              <div className="absolute -top-3 left-5 px-2.5 py-1 rounded-pill bg-brand-500 text-white text-[10px] font-num font-bold uppercase tracking-widest shadow-glow-sm">
                혜택 {i + 1}
              </div>
              {c.emoji && <div className="text-[32px] mb-2 mt-2">{c.emoji}</div>}
              <div className="text-[16px] md:text-[17px] font-bold leading-tight tracking-tight mt-2">
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
// Steps4
// ============================================================================

export function Steps4Section({ block }: { block: Steps4Block }) {
  const { eyebrow, headline, steps } = block.data;
  return (
    <SlideShell style={block.style}>
      <Reveal>
        <SectionLabel>{eyebrow ?? "application"}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[36px] md:text-[56px] font-bold leading-[1.05] tracking-tight max-w-4xl">
          {headline}
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full mt-6">
        {steps.map((s, i) => (
          <Reveal key={i} delay={300 + i * 120}>
            <div className="bg-surface border border-ink-100 rounded-feature p-5 md:p-6 h-full flex flex-col shadow-card relative">
              <div className="font-num text-[36px] md:text-[44px] font-bold text-brand-500 leading-none border-b-2 border-brand-500 pb-3 mb-4">
                0{i + 1}
              </div>
              <div className="text-[16px] md:text-[18px] font-bold leading-tight tracking-tight">
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
// TextHero
// ============================================================================

export function TextHeroSection({ block }: { block: TextHeroBlock }) {
  const { eyebrow, lines, description } = block.data;
  return (
    <SlideShell style={block.style}>
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
                  (accent ? "text-brand-500" : "")
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
          <p className="mt-6 text-[14px] md:text-[16px] text-ink-500 max-w-2xl leading-relaxed">
            {description}
          </p>
        </Reveal>
      )}
    </SlideShell>
  );
}

// ============================================================================
// BigStat
// ============================================================================

export function BigStatSection({ block }: { block: BigStatBlock }) {
  const { eyebrow, value, valueSuffix, label, description } = block.data;
  return (
    <SlideShell style={block.style}>
      <Reveal>
        <SectionLabel>{eyebrow}</SectionLabel>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight max-w-5xl">
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
          <p className="mt-6 text-[14px] md:text-[16px] text-ink-500 max-w-2xl leading-relaxed">
            {description}
          </p>
        </Reveal>
      )}
    </SlideShell>
  );
}

// ============================================================================
// CTA
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
    <SlideShell style={block.style} variant="brand">
      <Reveal>
        {eyebrow && (
          <div className="text-[12px] tracking-[0.3em] uppercase text-white/70 font-mono mb-6">
            {eyebrow}
          </div>
        )}
      </Reveal>
      {lines.map((line, i) => (
        <Reveal key={i} delay={150 + i * 200}>
          <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight max-w-5xl">
            {line}
          </h2>
        </Reveal>
      ))}
      <Reveal delay={150 + lines.length * 200}>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryHref ?? `/${eventId}/sponsorships`}
            className="px-7 py-4 rounded-pill bg-white text-ink-900 hover:bg-ink-900 hover:text-white text-[15px] md:text-[16px] font-bold flex items-center gap-3 transition-colors"
          >
            {primaryLabel ?? "스폰서십 둘러보기"}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={secondaryHref ?? `/${eventId}/contact`}
            className="px-7 py-4 rounded-pill border-2 border-white hover:bg-white hover:text-brand-500 text-[15px] md:text-[16px] font-bold transition-colors"
          >
            {secondaryLabel ?? "바로 문의하기"}
          </Link>
        </div>
      </Reveal>
      {showContact && settings?.contact && (
        <Reveal delay={400 + lines.length * 200}>
          <div className="mt-10 text-[12px] text-white/70 font-num flex flex-wrap gap-x-8 gap-y-2">
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
// Image
// ============================================================================

export function ImageSection({ block }: { block: ImageBlock }) {
  const { url, alt, caption, fullBleed } = block.data;
  const styleMerged: BlockStyle = {
    ...block.style,
    fullBleed: fullBleed ?? block.style?.fullBleed,
  };
  return (
    <SlideShell style={styleMerged}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ""}
          className={
            fullBleed
              ? "w-screen max-h-[100vh] object-cover"
              : "max-w-full max-h-[75vh] object-contain mx-auto"
          }
        />
      ) : (
        <div className="text-ink-300 text-sm">이미지 URL이 비어있습니다</div>
      )}
      {caption && (
        <div className="text-[12px] text-ink-500 font-num">{caption}</div>
      )}
    </SlideShell>
  );
}

// ============================================================================
// RichText
// ============================================================================

export function RichTextSection({ block }: { block: RichTextBlock }) {
  const { eyebrow, headline, body, align = "left" } = block.data;
  const styleMerged: BlockStyle = { ...block.style, align };
  return (
    <SlideShell style={styleMerged}>
      <div className="max-w-3xl w-full">
        <Reveal>
          <SectionLabel>{eyebrow}</SectionLabel>
        </Reveal>
        {headline && (
          <Reveal delay={150}>
            <h2 className="text-[32px] md:text-[48px] font-bold leading-[1.1] tracking-tight mb-6">
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
// TwoColumn
// ============================================================================

export function TwoColumnSection({ block }: { block: TwoColumnBlock }) {
  const { left, right, ratio } = block.data;
  const gridCols =
    ratio === "1.5:1"
      ? "lg:grid-cols-[1.5fr_1fr]"
      : ratio === "1:1.5"
        ? "lg:grid-cols-[1fr_1.5fr]"
        : "lg:grid-cols-2";
  return (
    <SlideShell style={block.style}>
      <div className={"grid gap-8 lg:gap-12 items-center w-full " + gridCols}>
        <ColumnRenderer side={left} />
        <ColumnRenderer side={right} />
      </div>
    </SlideShell>
  );
}

function ColumnRenderer({ side }: { side: TwoColumnBlock["data"]["left"] }) {
  if (side.kind === "image") {
    return side.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={side.imageUrl}
        alt={side.imageAlt ?? ""}
        className="w-full rounded-card object-cover max-h-[70vh] border border-ink-100 shadow-card"
      />
    ) : (
      <div className="aspect-[4/3] bg-ink-100 rounded-card border border-ink-100 grid place-items-center text-ink-300 text-sm">
        이미지 미설정
      </div>
    );
  }
  return (
    <div>
      <SectionLabel>{side.eyebrow}</SectionLabel>
      {side.headline && (
        <h2 className="text-[28px] md:text-[40px] font-bold leading-[1.1] tracking-tight mb-4">
          {side.headline}
        </h2>
      )}
      {side.body && (
        <p className="text-[15px] md:text-[16px] text-ink-700 leading-[1.7] whitespace-pre-line">
          {side.body}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// ImageGrid
// ============================================================================

export function ImageGridSection({ block }: { block: ImageGridBlock }) {
  const { eyebrow, headline, columns, images } = block.data;
  return (
    <SlideShell style={block.style}>
      {eyebrow && (
        <Reveal>
          <SectionLabel>{eyebrow}</SectionLabel>
        </Reveal>
      )}
      {headline && (
        <Reveal delay={150}>
          <h2 className="text-[28px] md:text-[40px] font-bold leading-[1.1] tracking-tight mb-6">
            {headline}
          </h2>
        </Reveal>
      )}
      <div
        className="grid gap-2 md:gap-3 w-full"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="aspect-square bg-ink-100 rounded-card overflow-hidden border border-ink-100 relative"
          >
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.url}
                alt={img.alt ?? ""}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            {img.caption && (
              <div className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-white font-num bg-ink-900/70 px-1.5 py-0.5 rounded backdrop-blur">
                {img.caption}
              </div>
            )}
          </div>
        ))}
        {images.length === 0 && (
          <div className="col-span-full text-center text-ink-500 text-sm py-10">
            이미지를 추가하세요
          </div>
        )}
      </div>
    </SlideShell>
  );
}

// ============================================================================
// Divider
// ============================================================================

export function DividerSection({ block }: { block: DividerBlock }) {
  const { label, accent } = block.data;
  return (
    <section
      className={
        "snap-start snap-always py-16 md:py-20 px-8 md:px-16 " +
        (block.style?.bg ? "" : "bg-canvas")
      }
      style={{
        background: resolveBg(block.style?.bg),
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <div
          className={
            "flex-1 h-px " + (accent ? "bg-brand-500" : "bg-ink-300")
          }
        />
        {label && (
          <span className="text-[11px] uppercase tracking-[0.3em] font-num font-bold text-ink-500">
            {label}
          </span>
        )}
        <div
          className={
            "flex-1 h-px " + (accent ? "bg-brand-500" : "bg-ink-300")
          }
        />
      </div>
    </section>
  );
}

// ============================================================================
// Spacer
// ============================================================================

export function SpacerSection({ block }: { block: SpacerBlock }) {
  const h =
    block.data.size === "sm"
      ? "h-[8vh]"
      : block.data.size === "md"
        ? "h-[20vh]"
        : block.data.size === "lg"
          ? "h-[40vh]"
          : "h-[60vh]";
  return (
    <section
      className={"snap-start " + h}
      style={{ background: resolveBg(block.style?.bg) }}
    />
  );
}

// ============================================================================
// ButtonRow
// ============================================================================

export function ButtonRowSection({
  block,
  eventId,
}: {
  block: ButtonRowBlock;
  eventId: string;
}) {
  const { eyebrow, headline, description, buttons } = block.data;
  return (
    <SlideShell style={block.style}>
      {eyebrow && (
        <Reveal>
          <SectionLabel>{eyebrow}</SectionLabel>
        </Reveal>
      )}
      {headline && (
        <Reveal delay={150}>
          <h2 className="text-[28px] md:text-[44px] font-bold leading-[1.1] tracking-tight max-w-4xl">
            {headline}
          </h2>
        </Reveal>
      )}
      {description && (
        <Reveal delay={300}>
          <p className="text-[15px] md:text-[16px] text-ink-700 leading-[1.7] max-w-2xl">
            {description}
          </p>
        </Reveal>
      )}
      <Reveal delay={450}>
        <div className="flex flex-wrap gap-3 mt-4">
          {buttons.map((b, i) => {
            const variant = b.variant ?? "primary";
            const href = b.href.startsWith("/")
              ? b.href.replace(/^\/(?!\/)/, `/${eventId}/`).replace(`/${eventId}/${eventId}/`, `/${eventId}/`)
              : b.href;
            const cls =
              variant === "primary"
                ? "px-6 py-3 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 hover:shadow-glow-sm transition-all"
                : variant === "outline"
                  ? "px-6 py-3 rounded-pill border-2 border-ink-900 font-bold hover:bg-ink-900 hover:text-white transition-colors"
                  : "px-6 py-3 rounded-pill font-bold underline-offset-2 hover:underline";
            return (
              <Link key={i} href={href} className={cls}>
                {b.label}
              </Link>
            );
          })}
        </div>
      </Reveal>
    </SlideShell>
  );
}

// ============================================================================
// VideoEmbed
// ============================================================================

export function VideoEmbedSection({ block }: { block: VideoEmbedBlock }) {
  const { eyebrow, headline, url, aspect = "16:9" } = block.data;
  const embed = toEmbedUrl(url);
  const aspectCls =
    aspect === "4:3"
      ? "aspect-[4/3]"
      : aspect === "1:1"
        ? "aspect-square"
        : aspect === "9:16"
          ? "aspect-[9/16]"
          : "aspect-video";
  return (
    <SlideShell style={block.style}>
      {eyebrow && (
        <Reveal>
          <SectionLabel>{eyebrow}</SectionLabel>
        </Reveal>
      )}
      {headline && (
        <Reveal delay={150}>
          <h2 className="text-[28px] md:text-[40px] font-bold leading-[1.1] tracking-tight mb-4">
            {headline}
          </h2>
        </Reveal>
      )}
      <div className={"w-full rounded-card overflow-hidden border border-ink-100 bg-ink-100 " + aspectCls}>
        {embed ? (
          embed.kind === "iframe" ? (
            <iframe
              src={embed.url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video
              src={embed.url}
              controls
              className="w-full h-full object-contain bg-black"
            />
          )
        ) : (
          <div className="w-full h-full grid place-items-center text-ink-300 text-sm">
            동영상 URL을 입력하세요
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function toEmbedUrl(
  url: string
): { kind: "iframe" | "video"; url: string } | null {
  if (!url) return null;
  const u = url.trim();

  // YouTube — watch / youtu.be / embed / shorts / live
  const yt = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/
  );
  if (yt) {
    return {
      kind: "iframe",
      url: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`,
    };
  }

  // Vimeo
  const v = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v) {
    return { kind: "iframe", url: `https://player.vimeo.com/video/${v[1]}` };
  }

  // Google Drive — view / preview / open?id=
  const driveView = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (driveView) {
    return {
      kind: "iframe",
      url: `https://drive.google.com/file/d/${driveView[1]}/preview`,
    };
  }
  const driveOpen = u.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);
  if (driveOpen) {
    return {
      kind: "iframe",
      url: `https://drive.google.com/file/d/${driveOpen[1]}/preview`,
    };
  }

  // 직접 영상 파일 — 쿼리스트링 무시하고 확장자 검사
  const pathPart = u.split("?")[0];
  if (/\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(pathPart)) {
    return { kind: "video", url: u };
  }

  // Firebase / GCS Storage — 인코딩된 경로 안에 비디오 확장자가 있는지 검사
  if (
    u.includes("firebasestorage.googleapis.com") ||
    u.includes("storage.googleapis.com")
  ) {
    try {
      const decoded = decodeURIComponent(u);
      if (/\.(mp4|webm|mov|m4v|ogg|ogv)/i.test(decoded)) {
        return { kind: "video", url: u };
      }
    } catch {
      // 디코드 실패 시 fall through
    }
    return { kind: "video", url: u };
  }

  // 알 수 없는 URL — iframe fallback (대부분 X-Frame-Options 로 차단됨)
  return { kind: "iframe", url: u };
}

// ============================================================================
// CustomHtml — escape hatch
// ============================================================================

export function CustomHtmlSection({ block }: { block: CustomHtmlBlock }) {
  return (
    <SlideShell style={block.style}>
      <div
        className="w-full prose prose-ink max-w-none"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: block.data.html }}
      />
    </SlideShell>
  );
}

// ============================================================================
// SlotsTeaser — 카테고리 slug 들을 카드 그리드로 (간단 버전)
// ============================================================================

export function SlotsTeaserSection({
  block,
  eventId,
}: {
  block: SlotsTeaserBlock;
  eventId: string;
}) {
  const { eyebrow, headline, categorySlugs, layout } = block.data;
  return (
    <SlideShell style={block.style}>
      {eyebrow && (
        <Reveal>
          <SectionLabel>{eyebrow}</SectionLabel>
        </Reveal>
      )}
      {headline && (
        <Reveal delay={150}>
          <h2 className="text-[28px] md:text-[40px] font-bold leading-[1.1] tracking-tight mb-6">
            {headline}
          </h2>
        </Reveal>
      )}
      {categorySlugs.length === 0 ? (
        <div className="text-ink-500 text-sm">
          카테고리 slug 를 추가해 슬롯 카드를 노출하세요.
        </div>
      ) : (
        <div
          className={
            "w-full gap-3 md:gap-4 " +
            (layout === "row"
              ? "flex overflow-x-auto pb-2"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3")
          }
        >
          {categorySlugs.map((slug) => (
            <Link
              key={slug}
              href={`/${eventId}/sponsorships/${slug}`}
              className={
                "bg-surface border border-ink-100 rounded-card p-5 hover:border-brand-500 hover:shadow-card transition-all " +
                (layout === "row" ? "min-w-[260px]" : "")
              }
            >
              <div className="font-num text-[10px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-2">
                slot
              </div>
              <div className="text-[16px] font-bold text-ink-900 tracking-tight">
                {slug}
              </div>
              <div className="mt-3 text-[12px] text-ink-500 font-num">
                자세히 보기 →
              </div>
            </Link>
          ))}
        </div>
      )}
    </SlideShell>
  );
}

// ============================================================================
// 디스패처
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
      return <CtaSection block={block} eventId={eventId} settings={settings} />;
    case "image":
      return <ImageSection block={block} />;
    case "richText":
      return <RichTextSection block={block} />;
    case "twoColumn":
      return <TwoColumnSection block={block} />;
    case "imageGrid":
      return <ImageGridSection block={block} />;
    case "divider":
      return <DividerSection block={block} />;
    case "spacer":
      return <SpacerSection block={block} />;
    case "buttonRow":
      return <ButtonRowSection block={block} eventId={eventId} />;
    case "videoEmbed":
      return <VideoEmbedSection block={block} />;
    case "customHtml":
      return <CustomHtmlSection block={block} />;
    case "slotsTeaser":
      return <SlotsTeaserSection block={block} eventId={eventId} />;
    case "canvasPage":
      return (
        <CanvasPageSection
          block={block}
          eventId={eventId}
          settings={settings}
        />
      );
    case "pdfDownload":
      return <PdfDownloadSection block={block} eventId={eventId} />;
    default: {
      const _: never = block;
      void _;
      return null;
    }
  }
}

// ============================================================================
// CanvasPage — 1920×1080 자유 캔버스 한 페이지
// ============================================================================

function CanvasPageSection({
  block,
  eventId,
  settings,
}: {
  block: CanvasPageBlock;
  eventId: string;
  settings: SiteSettings | null;
}) {
  return (
    <section className="snap-start snap-always relative overflow-hidden h-screen">
      {/* 모바일에서도 데스크톱 레이아웃을 fit-contain 으로 — stack 모드 대신 캔버스 통째로
          작게 중앙 정렬. 글자가 작아도 한 화면 안에 디자인이 그대로 보이도록. */}
      <CanvasRenderer
        page={block.data.page}
        eventId={eventId}
        settings={settings}
        forceDesktop
        fitOnly
      />
    </section>
  );
}

// ============================================================================
// PdfDownload — 전체 패키지 PDF 다운로드 슬라이드
// ============================================================================

function PdfDownloadSection({
  block,
  eventId,
}: {
  block: PdfDownloadBlock;
  eventId: string;
}) {
  const eyebrow = block.data.eyebrow || "Download";
  const headline = block.data.headline || "전체 패키지를 한 장에";
  const description =
    block.data.description ||
    "행사 소개와 모든 카테고리·패키지 상세를 한 PDF로 받아보세요. 인쇄 다이얼로그가 자동으로 열리며, [PDF로 저장]을 선택하면 됩니다.";
  const buttonLabel = block.data.buttonLabel || "전체 패키지 PDF 다운로드";
  const style = block.style;

  return (
    <section
      className="snap-start snap-always relative overflow-hidden h-screen flex items-center"
      style={{
        background: style?.bg ?? "var(--color-canvas, #F6F6F6)",
        color: style?.text ?? undefined,
      }}
    >
      <div className="max-w-5xl mx-auto px-6 md:px-12 w-full text-center">
        <div
          className="text-[11px] md:text-[13px] uppercase tracking-[0.35em] font-bold mb-6 flex items-center justify-center gap-3"
          style={{ color: style?.accent ?? "var(--color-brand, #DB0711)" }}
        >
          <span className="w-10 h-px" style={{ background: "currentColor" }} />
          {eyebrow}
          <span className="w-10 h-px" style={{ background: "currentColor" }} />
        </div>
        <h2 className="text-[40px] md:text-[72px] font-bold tracking-tight leading-[1.04]">
          {headline}
        </h2>
        {description && (
          <p className="text-[14px] md:text-[16px] mt-6 max-w-2xl mx-auto leading-relaxed opacity-70">
            {description}
          </p>
        )}
        <div className="mt-10">
          <Link
            href={`/${eventId}/print/full`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-7 py-4 rounded-pill font-bold text-[14px] md:text-[15px] transition-all hover:shadow-glow"
            style={{
              background: style?.accent ?? "var(--color-brand, #DB0711)",
              color: style?.bg ?? "#fff",
            }}
          >
            <Download className="w-4 h-4" />
            {buttonLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
