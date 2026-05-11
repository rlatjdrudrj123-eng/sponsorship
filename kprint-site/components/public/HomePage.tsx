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
 * 풀스크린 스냅 + 한 줄씩 등장하는 호흡 큰 인트로.
 * - 상단 우측에 "스폰서십 바로 보기" 스킵 버튼 (항상 노출)
 * - 각 섹션 h-screen + snap-start
 * - 뷰포트 진입 시 fade-up 애니메이션
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
      {/* 우상단 영속 스킵 버튼 */}
      <Link
        href={`/${eventId}/sponsorships`}
        className="fixed top-6 right-6 md:top-8 md:right-8 z-50 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur text-ink-900 hover:bg-mint-500 text-[12px] md:text-[13px] font-bold transition-colors flex items-center gap-1.5 shadow-lg"
      >
        스폰서십 바로 보기
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      <main className="h-screen overflow-y-scroll snap-y snap-mandatory bg-ink-900 text-white">
        {/* 1) 행사명 */}
        <Slide bgUrl={settings?.kv.desktopUrl} dark first>
          <Reveal>
            <div className="text-[12px] tracking-[0.3em] uppercase text-mint-500 font-mono mb-6">
              sponsorship
            </div>
          </Reveal>
          <Reveal delay={150}>
            <h1 className="text-[56px] md:text-[120px] font-bold leading-[0.92] tracking-tight">
              {eventName ?? "K-PRINT 2026"}
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <div className="mt-8 md:mt-10 text-[14px] md:text-[18px] text-white/80 font-mono">
              {dateRange ?? "2026"}
              {venue ? `   ·   ${venue}` : ""}
            </div>
          </Reveal>
          <Reveal delay={700}>
            <div className="mt-20 text-[10px] uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
              scroll
              <ArrowDown className="w-3 h-3 animate-bounce" />
            </div>
          </Reveal>
        </Slide>

        {/* 2) 참관 규모 */}
        <Slide>
          <Reveal>
            <div className="text-[12px] tracking-[0.3em] uppercase text-mint-500 font-mono mb-6">
              scale
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight max-w-5xl">
              {visitorStat?.value
                ? `${visitorStat.value}${visitorStat.suffix ?? ""}`
                : "수만 명"}
              <span className="text-white/40">이</span>
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <h2 className="text-[28px] md:text-[56px] font-bold leading-[1.05] tracking-tight text-white/80 max-w-4xl mt-3">
              {dateRange ? `${dateRange.split(" ")[0] || "4일간"}` : "4일간"} 다녀갑니다.
            </h2>
          </Reveal>
        </Slide>

        {/* 3) 노출 */}
        <Slide>
          <Reveal>
            <div className="text-[12px] tracking-[0.3em] uppercase text-mint-500 font-mono mb-6">
              exposure
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight max-w-5xl">
              모든 동선 위에
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight text-mint-500 mt-2">
              당신의 브랜드를.
            </h2>
          </Reveal>
          <Reveal delay={800}>
            <p className="mt-10 text-[14px] md:text-[16px] text-white/60 max-w-xl leading-relaxed">
              주차장 → 로비 → 전시홀 → 세미나실. 4일간 모든 참관객이 거치는 동선
              위에서 자연스럽게 인지됩니다.
            </p>
          </Reveal>
        </Slide>

        {/* 4) 채널 */}
        <Slide>
          <Reveal>
            <div className="text-[12px] tracking-[0.3em] uppercase text-mint-500 font-mono mb-6">
              channels
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[40px] md:text-[80px] font-bold leading-[0.95] tracking-tight max-w-5xl">
              <span className="font-mono text-mint-500">{categories.length}</span>개 채널 ·{" "}
              <span className="font-mono text-mint-500">{slotsAvailable}</span>개
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <h2 className="text-[28px] md:text-[56px] font-bold leading-[1.05] tracking-tight text-white/80 mt-2">
              구좌가 열려 있습니다.
            </h2>
          </Reveal>
          <Reveal delay={800}>
            <p className="mt-10 text-[14px] md:text-[16px] text-white/60 max-w-xl leading-relaxed">
              옥외 LED, 천장 배너, 등록대, 라이팅월, 쇼가이드, 디지털 배너, SNS 인터뷰까지.
              사전·현장·사후 6주 노출.
            </p>
          </Reveal>
        </Slide>

        {/* 5) 시그니처 패키지 (있을 때만) */}
        {signaturePkg && (
          <Slide>
            <Reveal>
              <div className="text-[12px] tracking-[0.3em] uppercase text-mint-500 font-mono mb-6">
                signature
              </div>
            </Reveal>
            <Reveal delay={200}>
              <h2 className="text-[28px] md:text-[48px] font-bold leading-[1.05] tracking-tight text-white/60 max-w-4xl">
                가장 빠르게 자리 잡는 방법
              </h2>
            </Reveal>
            <Reveal delay={500}>
              <Link
                href={`/${eventId}/packages/${signaturePkg.id}`}
                className="mt-10 inline-flex items-center gap-3 px-6 py-4 rounded-card border border-white/30 hover:bg-white/10 transition-colors max-w-xl group"
              >
                <div className="flex-1 text-left">
                  <div className="text-[10px] uppercase tracking-widest text-mint-500 font-mono">
                    {signaturePkg.code}
                  </div>
                  <div className="text-[22px] md:text-[26px] font-bold mt-1 leading-tight">
                    {signaturePkg.name.ko}
                  </div>
                  <div className="text-[14px] text-mint-500 font-mono mt-1.5">
                    {signaturePkg.discountPrice.toLocaleString()}원
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-white/40 group-hover:text-mint-500 group-hover:translate-x-1 transition-all shrink-0" />
              </Link>
            </Reveal>
          </Slide>
        )}

        {/* 6) CTA */}
        <Slide bg="bg-mint-500" textColor="text-ink-900">
          <Reveal>
            <div className="text-[12px] tracking-[0.3em] uppercase text-ink-900/60 font-mono mb-6">
              get in touch
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight max-w-5xl">
              어떤 자리에
            </h2>
          </Reveal>
          <Reveal delay={400}>
            <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight">
              들어갈지,
            </h2>
          </Reveal>
          <Reveal delay={600}>
            <h2 className="text-[44px] md:text-[88px] font-bold leading-[0.95] tracking-tight">
              먼저 둘러보세요.
            </h2>
          </Reveal>
          <Reveal delay={900}>
            <div className="mt-12 md:mt-16 flex flex-wrap gap-3">
              <Link
                href={`/${eventId}/sponsorships`}
                className="px-7 py-4 rounded-full bg-ink-900 text-white hover:bg-white hover:text-ink-900 text-[15px] md:text-[16px] font-bold flex items-center gap-3 transition-colors"
              >
                스폰서십 둘러보기
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/${eventId}/contact`}
                className="px-7 py-4 rounded-full border-2 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-mint-500 text-[15px] md:text-[16px] font-bold transition-colors"
              >
                바로 문의하기
              </Link>
            </div>
          </Reveal>
          {settings?.contact && (
            <Reveal delay={1100}>
              <div className="mt-16 text-[12px] text-ink-900/60 font-mono flex flex-wrap gap-x-8 gap-y-2">
                {settings.contact.phone && <span>{settings.contact.phone}</span>}
                {settings.contact.email && (
                  <a
                    href={`mailto:${settings.contact.email}`}
                    className="hover:text-ink-900 underline-offset-2 hover:underline"
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

function Slide({
  children,
  bgUrl,
  dark,
  bg,
  textColor,
  first,
}: {
  children: React.ReactNode;
  bgUrl?: string;
  dark?: boolean;
  bg?: string;
  textColor?: string;
  first?: boolean;
}) {
  return (
    <section
      className={
        "h-screen snap-start snap-always relative overflow-hidden flex items-center px-8 md:px-16 " +
        (bg ?? (dark ? "bg-ink-900" : "bg-ink-900")) +
        " " +
        (textColor ?? "text-white")
      }
    >
      {/* Optional background image (first slide) */}
      {bgUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/40 via-ink-900/60 to-ink-900" />
        </>
      )}
      <div className="relative max-w-7xl mx-auto w-full">{children}</div>
      {!first && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono pointer-events-none">
          ↓
        </div>
      )}
    </section>
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
