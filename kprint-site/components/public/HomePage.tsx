"use client";

import { useEffect, useMemo, useState } from "react";
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
import type {
  Category,
  Channel,
  Package,
  SiteSettings,
  Slot,
} from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = {
  offline: "오프라인",
  online: "온라인",
  package: "패키지",
};

const BENEFITS: Array<{ title: string; desc: string }> = [
  {
    title: "전 동선 노출",
    desc: "주차장→로비→전시홀→세미나실까지, 4일간 모든 방문객 동선에서 자연스럽게 인지됩니다.",
  },
  {
    title: "사전·사후 채널 통합",
    desc: "공식 사이트, 뉴스레터, SNS 인터뷰까지. 행사 전후 6주의 유효 노출.",
  },
  {
    title: "현장 데이터 동시 수집",
    desc: "QR 등록경로 추적과 결합해, 단순 노출이 아닌 검증 가능한 결과 보고.",
  },
  {
    title: "결정 빠른 한 채널",
    desc: "구좌 단위 견적 카트 — 둘러보고, 담고, 1영업일 회신. 복잡한 PT 자료 X.",
  },
];

export function HomePage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [settingsSnap, catsSnap, pkgsSnap, slotsSnap] = await Promise.all([
          getDoc(doc(db, "siteSettings", "main")),
          getDocs(
            query(collection(db, "categories"), where("isPublished", "==", true))
          ),
          getDocs(
            query(collection(db, "packages"), where("isPublished", "==", true))
          ),
          getDocs(collection(db, "slots")),
        ]);
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data() as SiteSettings);
        }
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
  }, []);

  return (
    <main className="h-screen overflow-y-scroll snap-y snap-mandatory bg-white text-ink-900 [scrollbar-gutter:stable]">
      <KvSection settings={settings} />
      <WhySection settings={settings} />
      <BenefitsSection />
      <CategoriesSection categories={categories} slots={slots} />
      <PackagesSection packages={packages} />
      <CtaSection settings={settings} />
    </main>
  );
}

// ========================================================================
// 1. KV
// ========================================================================
function KvSection({ settings }: { settings: SiteSettings | null }) {
  const url = settings?.kv.desktopUrl;

  return (
    <section className="h-screen snap-start relative bg-ink-900 text-white overflow-hidden">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="K-PRINT 2026"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent" />
      <div className="absolute inset-0 flex flex-col px-8 md:px-16 py-12 md:py-16">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-mint-500">
          <span className="w-1.5 h-1.5 rounded-full bg-mint-500" />
          K-PRINT 2026
        </div>
        <div className="flex-1" />
        <div className="space-y-4">
          {settings?.kv.overlayText && (
            <div className="text-[13px] md:text-[14px] tracking-wide text-white/80 max-w-xl">
              {settings.kv.overlayText}
            </div>
          )}
          <div className="text-[36px] md:text-[56px] font-bold leading-tight tracking-tight">
            {settings?.event.dateRange ?? "2026"}
          </div>
          <div className="text-[14px] md:text-[16px] text-white/70 max-w-xl">
            {settings?.event.venue ?? ""}
          </div>
        </div>
        <div className="mt-12 flex items-center gap-2 text-[11px] text-white/50">
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          스크롤해서 둘러보기
        </div>
      </div>
    </section>
  );
}

// ========================================================================
// 2. Why
// ========================================================================
function WhySection({ settings }: { settings: SiteSettings | null }) {
  const stats = settings?.why.stats ?? [];
  const headline = settings?.why.headline ?? "왜 K-PRINT인가?";
  const chartData = settings?.why.chartData ?? [];

  return (
    <section className="h-screen snap-start bg-[#fafaf7] flex items-center px-8 md:px-16 py-16">
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-[11px] tracking-[0.2em] uppercase text-mint-700 mb-3">
          why
        </div>
        <h2 className="text-[28px] md:text-[44px] font-bold tracking-tight mb-12 max-w-2xl leading-tight">
          {headline}
        </h2>

        {stats.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-[44px] md:text-[56px] font-bold tracking-tight text-ink-900 leading-none">
                  {s.value}
                  {s.suffix && (
                    <span className="text-[20px] md:text-[24px] text-ink-700 font-normal ml-1">
                      {s.suffix}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-ink-700 mt-2 font-semibold">
                  {s.label}
                </div>
                {s.desc && <div className="text-[12px] text-ink-500 mt-1">{s.desc}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-500">통계는 어드민 사이트 설정에서 추가할 수 있습니다.</p>
        )}

        {chartData.length > 0 && (
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl">
            {chartData.map((c) => (
              <div
                key={c.year}
                className="bg-white border border-ink-100 rounded-card p-3 text-center"
              >
                <div className="text-[11px] text-ink-500">{c.year}</div>
                <div className="text-[18px] font-bold text-mint-700 mt-1">
                  {c.visitors.toLocaleString()}
                </div>
                <div className="text-[10px] text-ink-500">방문 · 참가 {c.exhibitors}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ========================================================================
// 3. Benefits
// ========================================================================
function BenefitsSection() {
  return (
    <section className="h-screen snap-start bg-white flex items-center px-8 md:px-16 py-16">
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-[11px] tracking-[0.2em] uppercase text-mint-700 mb-3">
          sponsor benefits
        </div>
        <h2 className="text-[28px] md:text-[44px] font-bold tracking-tight mb-12 max-w-3xl leading-tight">
          스폰서가 되면, 무엇이 달라지나
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-w-4xl">
          {BENEFITS.map((b, i) => (
            <div key={i} className="border-l-2 border-mint-500 pl-5">
              <div className="text-[18px] md:text-[20px] font-bold text-ink-900 mb-2 leading-tight">
                {b.title}
              </div>
              <p className="text-[13px] md:text-[14px] text-ink-700 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ========================================================================
// 4. Categories
// ========================================================================
function CategoriesSection({
  categories,
  slots,
}: {
  categories: Category[];
  slots: Slot[];
}) {
  const enriched = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.order - b.order)
      .map((c) => {
        const cs = slots.filter((s) => s.categoryId === c.id);
        return {
          ...c,
          slotTotal: cs.length,
          slotAvailable: cs.filter((s) => s.status === "available").length,
        };
      });
  }, [categories, slots]);

  return (
    <section className="h-screen snap-start bg-[#fafaf7] flex items-center px-8 md:px-16 py-16 overflow-hidden">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-mint-700 mb-3">
              sponsorships
            </div>
            <h2 className="text-[28px] md:text-[44px] font-bold tracking-tight leading-tight">
              한눈에 보기
            </h2>
          </div>
          {enriched.length > 0 && (
            <Link
              href="/sponsorships"
              className="px-4 py-2 rounded-full bg-ink-900 text-white hover:bg-mint-500 hover:text-ink-900 transition-colors text-[13px] font-semibold flex items-center gap-1.5"
            >
              전체 {enriched.length}개 보기
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {enriched.length === 0 ? (
          <p className="text-ink-500 text-sm">스폰서십 항목은 곧 공개됩니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 overflow-y-auto max-h-[55vh] [scrollbar-gutter:stable]">
            {enriched.slice(0, 8).map((c) => {
              const hero = c.heroImages?.images?.[0]?.url;
              return (
                <Link
                  key={c.id}
                  href={`/sponsorships/${c.slug}`}
                  className="group bg-white border border-ink-100 rounded-card overflow-hidden hover:border-mint-500 transition-colors flex flex-col h-full"
                >
                  <div className="aspect-[4/3] bg-ink-100 relative shrink-0">
                    {hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero}
                        alt={c.name.ko}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-ink-300 text-xs">
                        이미지 없음
                      </div>
                    )}
                    <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-white/90 text-ink-900 px-1.5 py-0.5 rounded font-semibold">
                      {CHANNEL_LABELS[c.channel]}
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="font-bold text-[13px] text-ink-900 group-hover:text-mint-700 leading-tight">
                      {c.name.ko}
                    </div>
                    {c.shortDesc && (
                      <div className="text-[11px] text-ink-500 mt-1 line-clamp-2 leading-snug">
                        {c.shortDesc}
                      </div>
                    )}
                    <div className="text-[10px] mt-auto pt-2 font-mono">
                      <span className="text-mint-700 font-bold">{c.slotAvailable}</span>
                      <span className="text-ink-500"> / {c.slotTotal} 가능</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {enriched.length > 8 && (
          <div className="mt-6 text-center">
            <Link
              href="/sponsorships"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-mint-500 text-ink-900 hover:bg-mint-700 hover:text-white transition-colors text-[15px] font-bold shadow-sm hover:shadow"
            >
              스폰서십 {enriched.length}개 전체 둘러보기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[11px] text-ink-500 mt-2">
              필터·검색·슬라이드 보기는 전체 페이지에서 가능합니다
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ========================================================================
// 5. Packages
// ========================================================================
function PackagesSection({ packages }: { packages: Package[] }) {
  const signature = packages
    .filter((p) => p.tier === "signature")
    .sort((a, b) => a.order - b.order);

  return (
    <section className="h-screen snap-start bg-white flex items-center px-8 md:px-16 py-16">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-mint-700 mb-3">
              signature
            </div>
            <h2 className="text-[28px] md:text-[44px] font-bold tracking-tight leading-tight">
              추천 패키지
            </h2>
          </div>
          <Link
            href="/packages"
            className="text-[13px] text-mint-700 font-semibold hover:underline flex items-center gap-1"
          >
            전체 패키지 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {signature.length === 0 ? (
          <p className="text-ink-500 text-sm">시그니처 패키지가 곧 공개됩니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {signature.slice(0, 2).map((pkg) => {
              const hero = pkg.heroImages?.images?.[0]?.url;
              const discount =
                pkg.originalPrice > 0
                  ? Math.round((1 - pkg.discountPrice / pkg.originalPrice) * 100)
                  : 0;
              return (
                <Link
                  key={pkg.id}
                  href={`/packages/${pkg.id}`}
                  className="group bg-[#fafaf7] border border-ink-100 rounded-card overflow-hidden hover:border-mint-500 transition-colors flex flex-col h-full"
                >
                  <div className="aspect-[16/9] bg-ink-100 relative shrink-0">
                    {hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero}
                        alt={pkg.name.ko}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-ink-300 text-xs">
                        이미지 없음
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="absolute top-3 right-3 bg-mint-500 text-ink-900 text-[11px] font-bold px-2 py-1 rounded">
                        {discount}% OFF
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="text-[10px] uppercase tracking-widest text-mint-700 mb-1.5">
                      {pkg.code} · 시그니처
                    </div>
                    <div className="font-bold text-[18px] text-ink-900 group-hover:text-mint-700 leading-tight">
                      {pkg.name.ko}
                    </div>
                    {pkg.tagline && (
                      <p className="text-[12px] text-ink-500 mt-2 leading-relaxed">
                        {pkg.tagline}
                      </p>
                    )}
                    <ul className="mt-3 text-[12px] text-ink-700 space-y-1">
                      {(pkg.includedItems ?? []).slice(0, 3).map((it, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="w-1 h-1 rounded-full bg-mint-500 mt-1.5 shrink-0" />
                          <span>{it.label}</span>
                        </li>
                      ))}
                      {(pkg.includedItems?.length ?? 0) > 3 && (
                        <li className="text-[11px] text-ink-500 ml-3">
                          외 {pkg.includedItems!.length - 3}건
                        </li>
                      )}
                    </ul>
                    <div className="mt-auto pt-4 flex items-baseline gap-2">
                      <span className="text-[20px] font-bold text-mint-700">
                        {pkg.discountPrice.toLocaleString()}원
                      </span>
                      {pkg.originalPrice > pkg.discountPrice && (
                        <span className="text-[12px] text-ink-300 line-through">
                          {pkg.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ========================================================================
// 6. CTA
// ========================================================================
function CtaSection({ settings }: { settings: SiteSettings | null }) {
  return (
    <section className="h-screen snap-start bg-ink-900 text-white flex items-center px-8 md:px-16 py-16 relative overflow-hidden">
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-[11px] tracking-[0.2em] uppercase text-mint-500 mb-3">
          let&apos;s talk
        </div>
        <h2 className="text-[36px] md:text-[64px] font-bold tracking-tight leading-tight mb-8 max-w-3xl">
          어떤 자리에 들어갈지,
          <br />
          먼저 둘러보세요.
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md">
          <Link
            href="/sponsorships"
            className="px-6 py-4 rounded-card border border-white/30 hover:bg-white/10 text-[14px] font-semibold flex items-center justify-between gap-3"
          >
            <span>전체 둘러보기</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contact"
            className="px-6 py-4 rounded-card bg-mint-500 text-ink-900 hover:bg-mint-700 hover:text-white text-[14px] font-semibold flex items-center justify-between gap-3"
          >
            <span>문의하기</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {settings && (
          <div className="mt-16 grid md:grid-cols-3 gap-6 text-[12px] text-ink-300 border-t border-white/10 pt-8">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-mint-500 mb-1">
                일정
              </div>
              <div>{settings.event.dateRange}</div>
              <div>{settings.event.venue}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-mint-500 mb-1">
                연락
              </div>
              <div>{settings.contact.phone}</div>
              <a href={`mailto:${settings.contact.email}`} className="hover:text-mint-500">
                {settings.contact.email}
              </a>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-mint-500 mb-1">
                주소
              </div>
              <div className="text-[11px]">{settings.contact.address}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
