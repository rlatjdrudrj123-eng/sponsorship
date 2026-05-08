"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { ArrowLeft, Filter, RotateCcw, Search, X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type {
  Category,
  Channel,
  SiteSettings,
  Slot,
  Subcategory,
} from "@/lib/types";
import { Footer } from "@/components/public/Footer";

const CHANNEL_LABELS: Record<Channel | "all", string> = {
  all: "전체",
  offline: "오프라인",
  online: "온라인",
  package: "패키지",
};

const PURPOSE_TAGS = [
  { id: "브랜드 확산형", label: "브랜드 확산형" },
  { id: "현장 방문객 유도형", label: "현장 방문객 유도형" },
  { id: "신제품 홍보형", label: "신제품 홍보형" },
  { id: "맞춤형 타겟팅 광고", label: "맞춤형 타겟팅 광고" },
] as const;

const PACKAGE_TAGS = [
  { id: "참관객_AtoZ_패키지", label: "참관객 A to Z" },
  { id: "옥외광고_패키지", label: "옥외광고" },
  { id: "프라임_스팟_패키지", label: "프라임 스팟" },
  { id: "얼리브랜딩_패키지", label: "얼리브랜딩" },
  { id: "온사이트_패키지", label: "온사이트" },
  { id: "세미나_컨퍼런스_패키지", label: "세미나·컨퍼런스" },
  { id: "APP_광고_패키지", label: "APP 광고" },
  { id: "SNS_패키지", label: "SNS" },
] as const;

type PriceRange = "all" | "u1m" | "1to3m" | "3to7m" | "o7m";
const PRICE_RANGES: Array<{ id: PriceRange; label: string }> = [
  { id: "all", label: "전체" },
  { id: "u1m", label: "1M 이하" },
  { id: "1to3m", label: "1 — 3M" },
  { id: "3to7m", label: "3 — 7M" },
  { id: "o7m", label: "7M 이상" },
];

function priceMatches(minPrice: number, range: PriceRange): boolean {
  if (range === "all") return true;
  if (minPrice <= 0) return false;
  if (range === "u1m") return minPrice < 1_000_000;
  if (range === "1to3m") return minPrice >= 1_000_000 && minPrice < 3_000_000;
  if (range === "3to7m") return minPrice >= 3_000_000 && minPrice < 7_000_000;
  if (range === "o7m") return minPrice >= 7_000_000;
  return true;
}

function isDeadlineSoon(
  deadline: Timestamp | undefined,
  now: number,
  windowMs: number
): boolean {
  if (!deadline) return false;
  const t = deadline.toDate?.()?.getTime?.();
  if (!t) return false;
  return t >= now && t <= now + windowMs;
}

export default function SponsorshipsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const [filterChannel, setFilterChannel] = useState<Channel | "all">("all");
  const [activePurposes, setActivePurposes] = useState<Set<string>>(new Set());
  const [activePackages, setActivePackages] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const [deadlineSoon, setDeadlineSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [catSnap, subSnap, slotSnap, settingsSnap] = await Promise.all([
          getDocs(
            query(collection(db, "categories"), where("isPublished", "==", true))
          ),
          getDocs(collection(db, "subcategories")),
          getDocs(collection(db, "slots")),
          getDoc(doc(db, "siteSettings", "main")),
        ]);
        setCategories(
          catSnap.docs.map((d) => ({ ...(d.data() as Category), id: d.id }))
        );
        setSubcategories(
          subSnap.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id }))
        );
        setSlots(slotSnap.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
        if (settingsSnap.exists()) setSettings(settingsSnap.data() as SiteSettings);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const enriched = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.order - b.order)
      .map((c) => {
        const cs = slots.filter((s) => s.categoryId === c.id);
        const subs = subcategories.filter((s) => s.categoryId === c.id);
        const prices = subs.map((s) => s.priceKRW).filter((p) => p > 0);
        return {
          ...c,
          slotTotal: cs.length,
          slotAvailable: cs.filter((s) => s.status === "available").length,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        };
      });
  }, [categories, subcategories, slots]);

  const totalCount = enriched.length;

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterChannel !== "all") {
      rows = rows.filter((r) => r.channel === filterChannel);
    }
    if (activePurposes.size > 0) {
      rows = rows.filter((r) =>
        Array.from(activePurposes).some((t) => (r.tags ?? []).includes(t))
      );
    }
    if (activePackages.size > 0) {
      rows = rows.filter((r) =>
        Array.from(activePackages).some((t) => (r.tags ?? []).includes(t))
      );
    }
    if (priceRange !== "all") {
      rows = rows.filter((r) => priceMatches(r.minPrice, priceRange));
    }
    if (deadlineSoon) {
      const now = Date.now();
      const windowMs = 7 * 24 * 60 * 60 * 1000;
      rows = rows.filter((r) => isDeadlineSoon(r.deadline, now, windowMs));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.ko.toLowerCase().includes(q) ||
          r.name.en.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [
    enriched,
    filterChannel,
    activePurposes,
    activePackages,
    priceRange,
    deadlineSoon,
    search,
  ]);

  const togglePurpose = (id: string) =>
    setActivePurposes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePackage = (id: string) =>
    setActivePackages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const resetFilters = () => {
    setFilterChannel("all");
    setActivePurposes(new Set());
    setActivePackages(new Set());
    setPriceRange("all");
    setDeadlineSoon(false);
    setSearch("");
  };

  const hasActiveFilter =
    filterChannel !== "all" ||
    activePurposes.size > 0 ||
    activePackages.size > 0 ||
    priceRange !== "all" ||
    deadlineSoon ||
    search.trim() !== "";

  return (
    <>
      <main className="min-h-screen bg-white">
        <header className="px-6 md:px-16 pt-12 pb-6 border-b border-ink-100">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            홈
          </Link>
          <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
            전체 스폰서십
          </h1>
          <p className="text-[13px] text-ink-700 mt-2">
            구좌 단위로 둘러보고, 카트에 담은 뒤, 한 번에 문의하세요.
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8 px-6 md:px-16 py-10 max-w-7xl mx-auto">
          {/* Mobile filter bar */}
          <div className="lg:hidden flex items-center justify-between mb-4 sticky top-0 z-10 bg-white py-2 border-b border-ink-100">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="px-3 py-1.5 rounded-btn border border-ink-100 text-[13px] font-semibold flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              필터
              {hasActiveFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 ml-0.5" />
              )}
            </button>
            <div className="text-[12px] text-ink-500">
              <strong className="text-ink-900">{filtered.length}</strong> /{" "}
              {totalCount}
            </div>
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
            <FilterPanel
              search={search}
              setSearch={setSearch}
              filterChannel={filterChannel}
              setFilterChannel={setFilterChannel}
              activePurposes={activePurposes}
              togglePurpose={togglePurpose}
              activePackages={activePackages}
              togglePackage={togglePackage}
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              deadlineSoon={deadlineSoon}
              setDeadlineSoon={setDeadlineSoon}
              totalCount={totalCount}
              resultCount={filtered.length}
              hasActiveFilter={hasActiveFilter}
              onReset={resetFilters}
            />
          </aside>

          {/* Mobile sheet */}
          {sheetOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col">
              <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
                <h2 className="font-bold text-[15px]">필터</h2>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="w-8 h-8 grid place-items-center rounded-btn hover:bg-ink-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <FilterPanel
                  search={search}
                  setSearch={setSearch}
                  filterChannel={filterChannel}
                  setFilterChannel={setFilterChannel}
                  activePurposes={activePurposes}
                  togglePurpose={togglePurpose}
                  activePackages={activePackages}
                  togglePackage={togglePackage}
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  deadlineSoon={deadlineSoon}
                  setDeadlineSoon={setDeadlineSoon}
                  totalCount={totalCount}
                  resultCount={filtered.length}
                  hasActiveFilter={hasActiveFilter}
                  onReset={resetFilters}
                />
              </div>
              <footer className="px-5 py-3 border-t border-ink-100 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2.5 rounded-btn border border-ink-100 text-[13px] font-semibold"
                >
                  초기화
                </button>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="px-4 py-2.5 rounded-btn bg-mint-500 text-ink-900 hover:bg-mint-700 hover:text-white text-[13px] font-semibold"
                >
                  {filtered.length}개 결과 보기
                </button>
              </footer>
            </div>
          )}

          {/* Grid */}
          <section>
            {filtered.length === 0 ? (
              <div className="bg-ink-50 rounded-card py-16 text-center text-sm text-ink-500">
                조건에 맞는 항목이 없어요.
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="block mx-auto mt-3 text-mint-700 font-semibold hover:underline"
                  >
                    필터 초기화 →
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((c) => {
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
                        <div className="absolute top-3 left-3 flex gap-1">
                          <span className="text-[10px] uppercase tracking-wider bg-white/90 text-ink-900 px-2 py-0.5 rounded font-semibold">
                            {CHANNEL_LABELS[c.channel]}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="font-bold text-[15px] text-ink-900 group-hover:text-mint-700 leading-tight">
                          {c.name.ko}
                        </div>
                        {c.shortDesc && (
                          <p className="text-[12px] text-ink-500 mt-1.5 line-clamp-2 leading-snug">
                            {c.shortDesc}
                          </p>
                        )}
                        <div className="mt-auto pt-3 flex items-center justify-between text-[11px] font-mono">
                          <span>
                            <span className="text-mint-700 font-bold">
                              {c.slotAvailable}
                            </span>
                            <span className="text-ink-500"> / {c.slotTotal} 가능</span>
                          </span>
                          <span className="text-ink-300">→</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

// ============================================================================
// FilterPanel — desktop sidebar + mobile sheet 본문 공용
// ============================================================================

function FilterPanel({
  search,
  setSearch,
  filterChannel,
  setFilterChannel,
  activePurposes,
  togglePurpose,
  activePackages,
  togglePackage,
  priceRange,
  setPriceRange,
  deadlineSoon,
  setDeadlineSoon,
  totalCount,
  resultCount,
  hasActiveFilter,
  onReset,
}: {
  search: string;
  setSearch: (s: string) => void;
  filterChannel: Channel | "all";
  setFilterChannel: (c: Channel | "all") => void;
  activePurposes: Set<string>;
  togglePurpose: (id: string) => void;
  activePackages: Set<string>;
  togglePackage: (id: string) => void;
  priceRange: PriceRange;
  setPriceRange: (r: PriceRange) => void;
  deadlineSoon: boolean;
  setDeadlineSoon: (v: boolean) => void;
  totalCount: number;
  resultCount: number;
  hasActiveFilter: boolean;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-ink-500">
          전체 <strong className="text-ink-900">{totalCount}</strong>개 중{" "}
          <strong className="text-mint-700">{resultCount}</strong>개
        </div>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-ink-500 hover:text-ink-900 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            초기화
          </button>
        )}
      </div>

      {/* (A) 검색 */}
      <FilterSection title="검색">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·코드"
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
          />
        </div>
      </FilterSection>

      {/* (B) 채널 */}
      <FilterSection title="채널">
        <div className="flex flex-wrap lg:flex-col gap-1">
          {(["all", "offline", "online", "package"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterChannel(c)}
              className={
                "text-left px-3 py-1.5 rounded-btn text-[13px] transition-colors " +
                (filterChannel === c
                  ? "bg-ink-900 text-white font-semibold"
                  : "text-ink-700 hover:bg-ink-50")
              }
            >
              {CHANNEL_LABELS[c]}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* (C) 광고 목적 */}
      <FilterSection title="광고 목적">
        <ul className="space-y-1.5">
          {PURPOSE_TAGS.map((t) => (
            <li key={t.id}>
              <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer hover:text-ink-900">
                <input
                  type="checkbox"
                  checked={activePurposes.has(t.id)}
                  onChange={() => togglePurpose(t.id)}
                  className="accent-mint-500 w-3.5 h-3.5"
                />
                <span>{t.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </FilterSection>

      {/* (D) 패키지 */}
      <FilterSection title="패키지에 포함된 항목">
        <ul className="space-y-1.5">
          {PACKAGE_TAGS.map((t) => (
            <li key={t.id}>
              <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer hover:text-ink-900">
                <input
                  type="checkbox"
                  checked={activePackages.has(t.id)}
                  onChange={() => togglePackage(t.id)}
                  className="accent-mint-500 w-3.5 h-3.5"
                />
                <span>{t.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </FilterSection>

      {/* (E) 가격대 */}
      <FilterSection title="가격대 (최저가 기준)">
        <div className="flex flex-wrap lg:flex-col gap-1">
          {PRICE_RANGES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPriceRange(p.id)}
              className={
                "text-left px-3 py-1.5 rounded-btn text-[13px] transition-colors " +
                (priceRange === p.id
                  ? "bg-ink-900 text-white font-semibold"
                  : "text-ink-700 hover:bg-ink-50")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* (F) 마감 임박 */}
      <FilterSection title="마감">
        <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer hover:text-ink-900">
          <input
            type="checkbox"
            checked={deadlineSoon}
            onChange={(e) => setDeadlineSoon(e.target.checked)}
            className="accent-mint-500 w-3.5 h-3.5"
          />
          <span>7일 이내 마감만 보기</span>
        </label>
      </FilterSection>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-2 font-semibold">
        {title}
      </div>
      {children}
    </div>
  );
}
