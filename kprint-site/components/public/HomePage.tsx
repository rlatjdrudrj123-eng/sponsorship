"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { ArrowDown, ArrowRight } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Category, Package, SiteSettings, Slot } from "@/lib/types";

/**
 * KIMES Figma 톤에 맞춘 라이트 풀스크린 인트로.
 *
 * - 캔버스 #F6F6F6, 텍스트 ink-900
 * - 빨강 액센트 (#DB0711) — 통계 숫자·언더라인·미니 도트
 * - 큰 타이포: Pretendard 500/700, display 스케일 (~64–120px)
 * - 마지막 슬라이드(CTA)만 빨강 풀브리드
 */
export function HomePage({ eventId }: { eventId: string }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const [settingsSnap, catsSnap, pkgsSnap, slotsSnap] = await Promise.all([
          getDoc(doc(db, "siteSettings", eventId)),
          getDocs(
            query(
              collection(db, "categories"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDocs(
            query(
              collection(db, "packages"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDocs(
            query(collection(db, "slots"), where("eventId", "==", eventId))
          ),
        ]);
        if (settingsSnap.exists()) setSettings(settingsSnap.data() as SiteSettings);
        setCategories(
          catsSnap.docs.map((d) => ({ ...(d.data() as Category), id: d.id }))
        );
        setPackages(
          pkgsSnap.docs.map((d) => ({ ...(d.data() as Package), id: d.id }))
        );
        setSlots(slotsSnap.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
      } catch (e) {
        console.error("home fetch failed", e);
      }
    })();
  }, [eventId]);

  const slotsAvailable = slots.filter((s) => s.status === "available").length;
  const eventName = settings?.event.nameKo;
  const dateRange = settings?.event.dateRange;
  const venue = settings?.event.venue;
  const visitorStat = settings?.why.stats?.find(
    (s) => s.label.includes("참관") || s.label.includes("방문")
  );
  const signaturePkg = packages.find((p) => p.tier === "signature");

  return (
    <>
      {/* 우상단 영속 스킵 버튼 — KIMES 빨강 글로우 */}
      <Link
        href={`/${eventId}/sponsorships`}
        className="fixed top-6 right-6 md:top-8 md:right-8 z-50 px-5 py-2.5 rounded-pill bg-brand-500 text-white hover:bg-brand-700 text-[12px] md:text-[13px] font-bold transition-colors flex items-center gap-1.5 shadow-glow-sm hover:shadow-glow"
      >
        스폰서십 바로 보기
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      <main className="h-screen overflow-y-scroll snap-y snap-mandatory bg-canvas text-ink-900">
        {/* 1) COVER — KIMES 스타일 워드마크 + 행사명 */}
        <Slide variant="cover" first>
          {/* 빨강 그라데이션 플레어 (배경) */}
          <div
            aria-hidden
            className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-red-flare opacity-60 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 right-0 w-[600px] h-[600px] rounded-full bg-brand-grad opacity-20 blur-3xl"
          />

          <div className="relative">
            <Reveal>
              <div className="font-num text-[14px] md:text-[16px] tracking-[0.5em] uppercase text-brand-500 font-bold mb-6">
                Sponsorship
              </div>
            </Reveal>
            <Reveal delay={150}>
              <h1 className="text-[56px] md:text-[120px] font-bold leading-[0.95] tracking-tight text-ink-900">
                {eventName ?? "K-PRINT 2026"}
              </h1>
            </Reveal>
            <Reveal delay={400}>
              <div className="mt-8 md:mt-10 text-[14px] md:text-[18px] text-ink-500 font-num">
                {dateRange ?? "2026"}
                {venue ? `   ·   ${venue}` : ""}
              </div>
            </Reveal>
            <Reveal delay={700}>
              <div className="mt-20 text-[10px] uppercase tracking-[0.3em] text-ink-300 font-mono flex items-center gap-2">
                scroll
                <ArrowDown className="w-3 h-3 animate-bounce" />
              </div>
            </Reveal>
          </div>
        </Slide>

        {/* 2) SCALE — 참관 규모 */}
        <Slide>
          <Reveal>
            <SectionLabel>scale</SectionLabel>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight max-w-5xl text-ink-900">
              <span className="text-brand-500 font-num">
                {visitorStat?.value ?? "70,000"}
                {visitorStat?.suffix ?? "명"}
              </span>
              <span className="text-ink-500">이</span>
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <h2 className="text-[28px] md:text-[56px] font-bold leading-[1.1] tracking-tight text-ink-700 max-w-4xl mt-3">
              {dateRange ? `${dateRange.split(" ")[0] || "4일간"}` : "4일간"} 다녀갑니다.
            </h2>
          </Reveal>
          <Reveal delay={800}>
            <p className="mt-10 text-[14px] md:text-[16px] text-ink-500 max-w-xl leading-relaxed">
              전체 방문객의 70% 이상이 B2B 참관객. 의료/병원·제조/무역/유통·언론/기관까지
              핵심 결정권자가 한자리에 모입니다.
            </p>
          </Reveal>
        </Slide>

        {/* 3) EXPOSURE — 노출 */}
        <Slide>
          <Reveal>
            <SectionLabel>exposure</SectionLabel>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight max-w-5xl text-ink-900">
              모든 동선 위에
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight text-brand-500 mt-2">
              당신의 브랜드를.
            </h2>
          </Reveal>
          <Reveal delay={800}>
            <p className="mt-10 text-[14px] md:text-[16px] text-ink-500 max-w-xl leading-relaxed">
              주차장 → 로비 → 전시홀 → 세미나실. 4일간 모든 참관객이 거치는 동선
              위에서 자연스럽게 인지됩니다.
            </p>
          </Reveal>
        </Slide>

        {/* 4) CHANNELS — 채널·구좌 통계 */}
        <Slide>
          <Reveal>
            <SectionLabel>channels</SectionLabel>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight max-w-5xl text-ink-900">
              <span className="font-num text-brand-500">{categories.length}</span>
              <span className="text-ink-500">개 채널</span>
              <span className="mx-3 text-ink-300">·</span>
              <span className="font-num text-brand-500">{slotsAvailable}</span>
              <span className="text-ink-500">개</span>
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <h2 className="text-[28px] md:text-[56px] font-bold leading-[1.1] tracking-tight text-ink-700 mt-2">
              구좌가 열려 있습니다.
            </h2>
          </Reveal>
          <Reveal delay={800}>
            <p className="mt-10 text-[14px] md:text-[16px] text-ink-500 max-w-xl leading-relaxed">
              옥외 LED, 천장 배너, 등록대, 라이팅월, 쇼가이드, 디지털 배너, SNS 인터뷰까지.
              사전·현장·사후 6주 노출.
            </p>
          </Reveal>
        </Slide>

        {/* 5) SIGNATURE — 시그니처 패키지 (있을 때만) */}
        {signaturePkg && (
          <Slide>
            <Reveal>
              <SectionLabel>signature</SectionLabel>
            </Reveal>
            <Reveal delay={200}>
              <h2 className="text-[28px] md:text-[48px] font-bold leading-[1.1] tracking-tight text-ink-500 max-w-4xl">
                가장 빠르게 자리 잡는 방법
              </h2>
            </Reveal>
            <Reveal delay={500}>
              <Link
                href={`/${eventId}/packages/${signaturePkg.id}`}
                className="mt-10 inline-flex items-center gap-3 px-6 py-5 rounded-card bg-surface border border-ink-100 hover:border-brand-500 hover:shadow-glow-sm transition-all max-w-xl group"
              >
                <div className="flex-1 text-left">
                  <div className="font-num text-[10px] uppercase tracking-widest text-brand-500 font-bold">
                    {signaturePkg.code}
                  </div>
                  <div className="text-[22px] md:text-[26px] font-bold mt-1 leading-tight text-ink-900">
                    {signaturePkg.name.ko}
                  </div>
                  <div className="text-[14px] text-brand-500 font-num font-bold mt-1.5">
                    {signaturePkg.discountPrice.toLocaleString()}원
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-ink-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all shrink-0" />
              </Link>
            </Reveal>
          </Slide>
        )}

        {/* 6) CTA — 빨강 풀브리드 */}
        <Slide variant="cta">
          <Reveal>
            <div className="text-[12px] tracking-[0.3em] uppercase text-white/70 font-mono mb-6">
              get in touch
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight max-w-5xl text-white">
              어떤 자리에
            </h2>
          </Reveal>
          <Reveal delay={400}>
            <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight text-white">
              들어갈지,
            </h2>
          </Reveal>
          <Reveal delay={600}>
            <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight text-white">
              먼저 둘러보세요.
            </h2>
          </Reveal>
          <Reveal delay={900}>
            <div className="mt-12 md:mt-16 flex flex-wrap gap-3">
              <Link
                href={`/${eventId}/sponsorships`}
                className="px-7 py-4 rounded-pill bg-white text-ink-900 hover:bg-ink-900 hover:text-white text-[15px] md:text-[16px] font-bold flex items-center gap-3 transition-colors"
              >
                스폰서십 둘러보기
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/${eventId}/contact`}
                className="px-7 py-4 rounded-pill border-2 border-white text-white hover:bg-white hover:text-brand-500 text-[15px] md:text-[16px] font-bold transition-colors"
              >
                바로 문의하기
              </Link>
            </div>
          </Reveal>
          {settings?.contact && (
            <Reveal delay={1100}>
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
        </Slide>
      </main>
    </>
  );
}

// ============================================================================
// Slide — 풀스크린 한 화면, 스냅
// ============================================================================

type SlideVariant = "default" | "cover" | "cta";

function Slide({
  children,
  variant = "default",
  first,
}: {
  children: React.ReactNode;
  variant?: SlideVariant;
  first?: boolean;
}) {
  const variantCls =
    variant === "cta"
      ? "bg-brand-grad text-white"
      : variant === "cover"
        ? "bg-canvas text-ink-900"
        : "bg-canvas text-ink-900";

  return (
    <section
      className={
        "h-screen snap-start snap-always relative overflow-hidden flex items-center px-8 md:px-16 " +
        variantCls
      }
    >
      <div className="relative max-w-7xl mx-auto w-full">{children}</div>

      {/* 슬라이드 사이 헤어라인 (CTA 빼고) */}
      {variant !== "cta" && (
        <div className="absolute inset-x-0 bottom-0 h-px bg-ink-100 pointer-events-none" />
      )}

      {!first && variant !== "cta" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-ink-300 font-mono pointer-events-none">
          ↓
        </div>
      )}
    </section>
  );
}

// ============================================================================
// SectionLabel — KIMES 스타일 빨강 라벨 (12px, tracking 0.3em uppercase)
// ============================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] tracking-[0.3em] uppercase text-brand-500 font-num font-bold mb-6 flex items-center gap-2">
      <span className="w-6 h-px bg-brand-500" />
      {children}
    </div>
  );
}

// ============================================================================
// Reveal — 뷰포트 진입 시 fade-up
// ============================================================================

function Reveal({
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
      { threshold: 0.3 }
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
        (visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6")
      }
    >
      {children}
    </div>
  );
}
