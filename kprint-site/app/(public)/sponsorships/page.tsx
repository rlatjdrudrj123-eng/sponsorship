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
import {
  ArrowLeft,
  ArrowRight,
  Filter,
  LayoutGrid,
  Maximize2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type {
  Category,
  Channel,
  Package,
  SiteSettings,
  Slot,
  Subcategory,
  Tag,
  Taxonomy,
} from "@/lib/types";
import { Footer } from "@/components/public/Footer";

const CHANNEL_LABELS: Record<Channel | "all", string> = {
  all: "전체",
  offline: "오프라인",
  online: "온라인",
  package: "패키지",
};

// 사이드바 필터에서는 패키지를 별도 섹션으로 분리했으므로 채널 옵션에서 제외
const CHANNEL_FILTER_OPTIONS: Array<{ id: Channel | "all"; label: string }> = [
  { id: "all", label: "전체" },
  { id: "offline", label: "오프라인" },
  { id: "online", label: "온라인" },
];

// 광고 목적 태그는 taxonomy/main 도큐먼트에서 동적으로 로드 (kind === 'purpose')

type PriceRange = "all" | "u1m" | "1to3m" | "3to7m" | "o7m";
const PRICE_RANGES: Array<{ id: PriceRange; label: string }> = [
  { id: "all", label: "전체" },
  { id: "u1m", label: "100만원 미만" },
  { id: "1to3m", label: "100만 — 300만원" },
  { id: "3to7m", label: "300만 — 700만원" },
  { id: "o7m", label: "700만원 이상" },
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

type EnrichedCategory = Category & {
  slotTotal: number;
  slotAvailable: number;
  minPrice: number;
};

export default function SponsorshipsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const [purposeTags, setPurposeTags] = useState<Tag[]>([]);
  const [filterChannel, setFilterChannel] = useState<Channel | "all">("all");
  const [activePurposes, setActivePurposes] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const [deadlineSoon, setDeadlineSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "slide">("card");

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [catSnap, subSnap, slotSnap, pkgSnap, settingsSnap, taxSnap] = await Promise.all([
          getDocs(
            query(collection(db, "categories"), where("isPublished", "==", true))
          ),
          getDocs(collection(db, "subcategories")),
          getDocs(collection(db, "slots")),
          getDocs(
            query(collection(db, "packages"), where("isPublished", "==", true))
          ),
          getDoc(doc(db, "siteSettings", "main")),
          getDoc(doc(db, "taxonomy", "main")),
        ]);
        setCategories(
          // type='package'인 카테고리는 통합 후 별도 섹션에 표시되므로 그리드에서 제외
          catSnap.docs
            .map((d) => ({ ...(d.data() as Category), id: d.id }))
            .filter((c) => c.type !== "package")
        );
        setSubcategories(
          subSnap.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id }))
        );
        setSlots(slotSnap.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
        setPackages(
          pkgSnap.docs.map((d) => ({ ...(d.data() as Package), id: d.id }))
        );
        if (settingsSnap.exists()) setSettings(settingsSnap.data() as SiteSettings);
        if (taxSnap.exists()) {
          const tax = taxSnap.data() as Taxonomy;
          const purposes = (tax.tags ?? [])
            .filter((t) => t.kind === "purpose" && t.isActive !== false)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setPurposeTags(purposes);
        }
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
      // category.tags 배열은 라벨 문자열을 담고 있음 (엑셀 입력 그대로)
      rows = rows.filter((r) =>
        Array.from(activePurposes).some((t) => (r.tags ?? []).includes(t))
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

  const resetFilters = () => {
    setFilterChannel("all");
    setActivePurposes(new Set());
    setPriceRange("all");
    setDeadlineSoon(false);
    setSearch("");
  };

  const hasActiveFilter =
    filterChannel !== "all" ||
    activePurposes.size > 0 ||
    priceRange !== "all" ||
    deadlineSoon ||
    search.trim() !== "";

  return (
    <>
      {viewMode === "slide" ? (
        <SlideStream
          items={filtered}
          totalCount={totalCount}
          onCardMode={() => setViewMode("card")}
          onOpenFilter={() => setSheetOpen(true)}
          hasActiveFilter={hasActiveFilter}
        />
      ) : (
        <>
          <main className="min-h-screen bg-white">
            <header className="px-6 md:px-16 pt-12 pb-6 border-b border-ink-100">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" />홈
              </Link>
              <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
                전체 스폰서십
              </h1>
              <p className="text-[13px] text-ink-700 mt-2">
                구좌 단위로 둘러보고 관심 표시한 뒤, 사무국에 한 번에 문의하세요.
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
                  purposeTags={purposeTags}
                  activePurposes={activePurposes}
                  togglePurpose={togglePurpose}
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

              {/* Grid */}
              <section>
                {/* 뷰 모드 토글 */}
                <div className="hidden lg:flex items-center justify-between mb-4">
                  <div className="text-[12px] text-ink-500">
                    전체 <strong className="text-ink-900">{totalCount}</strong>개 중{" "}
                    <strong className="text-mint-700">{filtered.length}</strong>개
                  </div>
                  <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="lg:hidden mb-4 flex justify-end">
                  <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>

                {/* 패키지 전용 섹션 (필터 미적용 — 항상 노출) */}
                {packages.length > 0 && !hasActiveFilter && (
                  <PackageSection packages={packages} />
                )}

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
                  <>
                    {packages.length > 0 && !hasActiveFilter && (
                      <div className="mt-8 mb-4 flex items-center gap-3">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold">
                          개별 구좌
                        </span>
                        <div className="flex-1 h-px bg-ink-100" />
                      </div>
                    )}
                    <CardGrid items={filtered} />
                  </>
                )}
              </section>
            </div>
          </main>
          <Footer settings={settings} />
        </>
      )}

      {/* 필터 드로어 — 우측 드로어 (카드·슬라이드 모드 공용) */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 배경 */}
          <button
            type="button"
            aria-label="필터 닫기"
            onClick={() => setSheetOpen(false)}
            className="flex-1 bg-ink-900/30 backdrop-blur-[1px]"
          />
          {/* 드로어 */}
          <aside className="w-full max-w-[420px] bg-white flex flex-col shadow-2xl border-l border-ink-100">
            <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
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
                purposeTags={purposeTags}
                activePurposes={activePurposes}
                togglePurpose={togglePurpose}
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
            <footer className="px-5 py-3 border-t border-ink-100 grid grid-cols-2 gap-2 shrink-0">
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
          </aside>
        </div>
      )}

      {/* 슬라이드 모드에서도 토글 보이도록 floating 버튼 (모바일 대응) */}
      {viewMode === "slide" && (
        <div className="fixed bottom-6 right-6 z-30 lg:hidden">
          <button
            type="button"
            onClick={() => setViewMode("card")}
            className="px-3 py-2 rounded-full bg-ink-900 text-white shadow-lg text-[12px] font-semibold flex items-center gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            카드형
          </button>
        </div>
      )}
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
  purposeTags,
  activePurposes,
  togglePurpose,
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
  purposeTags: Tag[];
  activePurposes: Set<string>;
  togglePurpose: (id: string) => void;
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
          {CHANNEL_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilterChannel(opt.id)}
              className={
                "text-left px-3 py-1.5 rounded-btn text-[13px] transition-colors " +
                (filterChannel === opt.id
                  ? "bg-ink-900 text-white font-semibold"
                  : "text-ink-700 hover:bg-ink-50")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-ink-500">
          패키지는 페이지 상단 전용 섹션에서 확인하세요.
        </p>
      </FilterSection>

      {/* (C) 광고 목적 — taxonomy 기반 동적 (kind === 'purpose' && isActive) */}
      {purposeTags.length > 0 && (
        <FilterSection title="광고 목적">
          <ul className="space-y-1.5">
            {purposeTags.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer hover:text-ink-900">
                  <input
                    type="checkbox"
                    checked={activePurposes.has(t.label)}
                    onChange={() => togglePurpose(t.label)}
                    className="accent-mint-500 w-3.5 h-3.5"
                  />
                  <span>{t.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {/* (D) 가격대 */}
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

      {/* (E) 마감 임박 */}
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

// ============================================================================
// View mode toggle (Card / Slide)
// ============================================================================

function ViewModeToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: "card" | "slide";
  setViewMode: (m: "card" | "slide") => void;
}) {
  return (
    <div className="inline-flex items-center bg-ink-50 rounded-btn p-0.5 border border-ink-100">
      <button
        type="button"
        onClick={() => setViewMode("card")}
        className={
          "px-2.5 py-1.5 rounded text-[12px] font-semibold flex items-center gap-1.5 transition-colors " +
          (viewMode === "card"
            ? "bg-white shadow-sm text-ink-900"
            : "text-ink-500 hover:text-ink-900")
        }
        title="카드형 보기"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        카드형
      </button>
      <button
        type="button"
        onClick={() => setViewMode("slide")}
        className={
          "px-2.5 py-1.5 rounded text-[12px] font-semibold flex items-center gap-1.5 transition-colors " +
          (viewMode === "slide"
            ? "bg-white shadow-sm text-ink-900"
            : "text-ink-500 hover:text-ink-900")
        }
        title="슬라이드형 보기 (피트페이퍼 스타일)"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        슬라이드
      </button>
    </div>
  );
}

// ============================================================================
// Card grid view (default)
// ============================================================================

// ============================================================================
// Package section (상단 전용)
// ============================================================================

function PackageSection({ packages }: { packages: Package[] }) {
  const sorted = [...packages].sort((a, b) => {
    // 시그니처 먼저, 그다음 order
    if (a.tier !== b.tier) return a.tier === "signature" ? -1 : 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return (
    <section className="mb-2">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold">
          추천 패키지
        </span>
        <div className="flex-1 h-px bg-ink-100" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((pkg) => {
          const hero = pkg.heroImages?.images?.[0]?.url;
          const hasDiscount = pkg.originalPrice > 0 && pkg.originalPrice > pkg.discountPrice;
          const isSignature = pkg.tier === "signature";
          return (
            <Link
              key={pkg.id}
              href={`/packages/${pkg.id}`}
              className={
                "group bg-white border-2 rounded-card overflow-hidden flex flex-col h-full transition-colors " +
                (isSignature
                  ? "border-mint-500 hover:border-mint-700"
                  : "border-ink-100 hover:border-mint-500")
              }
            >
              <div className="aspect-[4/3] bg-ink-100 relative shrink-0">
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
                <div className="absolute top-3 left-3">
                  <span
                    className={
                      "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold " +
                      (isSignature
                        ? "bg-mint-500 text-ink-900"
                        : "bg-white/90 text-ink-900")
                    }
                  >
                    {isSignature ? "Signature" : "Standard"}
                  </span>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="font-bold text-[15px] text-ink-900 group-hover:text-mint-700 leading-tight">
                  {pkg.name.ko}
                </div>
                {pkg.tagline && (
                  <p className="text-[12px] text-ink-500 mt-1.5 line-clamp-2 leading-snug">
                    {pkg.tagline}
                  </p>
                )}
                {pkg.includedItems && pkg.includedItems.length > 0 && (
                  <ul className="mt-2.5 space-y-0.5 text-[11px] text-ink-700">
                    {pkg.includedItems.slice(0, 3).map((it, i) => (
                      <li key={i} className="truncate">
                        · {it.label}
                      </li>
                    ))}
                    {pkg.includedItems.length > 3 && (
                      <li className="text-ink-500">
                        … 외 {pkg.includedItems.length - 3}개
                      </li>
                    )}
                  </ul>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between">
                  {hasDiscount ? (
                    <div>
                      <div className="text-[10px] text-ink-500 line-through font-mono">
                        {pkg.originalPrice.toLocaleString()}원
                      </div>
                      <div className="text-[14px] font-bold text-mint-700 font-mono">
                        {pkg.discountPrice.toLocaleString()}원
                      </div>
                    </div>
                  ) : pkg.discountPrice > 0 ? (
                    <div className="text-[14px] font-bold text-ink-900 font-mono">
                      {pkg.discountPrice.toLocaleString()}원
                    </div>
                  ) : (
                    <div className="text-[11px] text-ink-500">문의 가격</div>
                  )}
                  <span className="text-ink-300">→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function CardGrid({ items }: { items: EnrichedCategory[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((c) => {
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
                  <span className="text-mint-700 font-bold">{c.slotAvailable}</span>
                  <span className="text-ink-500"> / {c.slotTotal} 가능</span>
                </span>
                <span className="text-ink-300">→</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ============================================================================
// Slide stream (전체 화면 — 휠 스크롤로 한 화면씩 스냅)
// ============================================================================

function SlideStream({
  items,
  totalCount,
  onCardMode,
  onOpenFilter,
  hasActiveFilter,
}: {
  items: EnrichedCategory[];
  totalCount: number;
  onCardMode: () => void;
  onOpenFilter: () => void;
  hasActiveFilter: boolean;
}) {
  return (
    <>
      {/* 상단 고정 바 */}
      <div className="fixed top-0 inset-x-0 z-20 bg-white/90 backdrop-blur border-b border-ink-100 px-4 md:px-8 h-14 flex items-center gap-3">
        <Link
          href="/"
          className="text-[12px] text-ink-500 hover:text-ink-900 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />홈
        </Link>
        <span className="text-ink-300">/</span>
        <span className="text-[13px] font-bold text-ink-900">스폰서십 슬라이드</span>
        <span className="text-[12px] text-ink-500">
          전체 <strong className="text-ink-900">{totalCount}</strong>개 중{" "}
          <strong className="text-mint-700">{items.length}</strong>개
        </span>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={onOpenFilter}
          className="px-2.5 py-1.5 rounded-btn border border-ink-100 text-[12px] font-semibold flex items-center gap-1"
          title="필터"
        >
          <Filter className="w-3.5 h-3.5" />
          필터
          {hasActiveFilter && (
            <span className="w-1.5 h-1.5 rounded-full bg-mint-500 ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onCardMode}
          className="px-2.5 py-1.5 rounded-btn bg-ink-900 text-white hover:bg-mint-500 hover:text-ink-900 text-[12px] font-semibold flex items-center gap-1"
          title="카드형으로 돌아가기"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          카드형
        </button>
      </div>

      {items.length === 0 ? (
        <main className="h-screen pt-14 grid place-items-center bg-white">
          <div className="text-center text-sm text-ink-500">
            조건에 맞는 항목이 없어요.
          </div>
        </main>
      ) : (
        <main className="h-screen overflow-y-scroll snap-y snap-mandatory bg-white scroll-smooth">
          {items.map((c, i) => (
            <SlideSection key={c.id} item={c} index={i} total={items.length} />
          ))}
        </main>
      )}
    </>
  );
}

function SlideSection({
  item,
  index,
  total,
}: {
  item: EnrichedCategory;
  index: number;
  total: number;
}) {
  const hero = item.heroImages?.images?.[0]?.url;
  const deadlineStr = item.deadline
    ? item.deadline.toDate().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // 해시태그 — 채널 + 카테고리.tags 중 첫 2개
  const hashTags: string[] = [
    CHANNEL_LABELS[item.channel],
    ...(item.tags ?? []).slice(0, 2),
  ];

  return (
    <section className="h-screen snap-start snap-always bg-white pt-14 overflow-hidden relative">
      <div className="h-full max-w-7xl mx-auto px-6 md:px-12 py-6 md:py-10 grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-14 items-stretch">
        {/* LEFT: 정보 */}
        <div className="flex flex-col min-w-0">
          {/* 해시태그 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] md:text-[14px] tracking-wide text-mint-700 font-semibold mb-5 md:mb-7">
            {hashTags.map((t, i) => (
              <span key={i}>#{t}</span>
            ))}
          </div>

          {/* 거대한 카테고리 명 + 코드 */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[40px] md:text-[64px] font-bold leading-[0.95] tracking-tight text-ink-900">
              {item.name.ko}
            </h2>
            <span className="text-[14px] md:text-[18px] text-ink-300 font-mono">
              #{item.code}
            </span>
          </div>

          {/* 한 줄 설명 */}
          {item.shortDesc && (
            <p className="text-[13px] md:text-[15px] text-ink-700 mt-3 leading-relaxed max-w-xl">
              {item.shortDesc}
            </p>
          )}

          {/* 구분선 */}
          <hr className="border-ink-100 my-6 md:my-8" />

          {/* 스펙 표 */}
          <dl className="space-y-3 md:space-y-4 flex-1">
            {item.size && <SpecRow label="사이즈" value={item.size} />}
            {item.fileFormat && (
              <SpecRow label="파일 형식" value={item.fileFormat} />
            )}
            {deadlineStr && <SpecRow label="제출 마감" value={deadlineStr} />}
            <SpecRow
              label="구좌"
              value={
                <>
                  <span className="text-mint-700 font-bold">
                    {item.slotAvailable}
                  </span>
                  <span className="text-ink-500"> / {item.slotTotal} 가능</span>
                </>
              }
            />
          </dl>

          {/* 액션 버튼 */}
          <div className="mt-6 md:mt-8 flex flex-wrap gap-2">
            {item.designGuideFileUrl && (
              <a
                href={item.designGuideFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-btn bg-ink-900 text-white hover:bg-mint-500 hover:text-ink-900 font-semibold text-[13px] transition-colors"
              >
                디자인 가이드 다운로드
              </a>
            )}
            <Link
              href={`/sponsorships/${item.slug}`}
              className="px-5 py-2.5 rounded-btn border border-ink-100 text-ink-900 hover:border-mint-500 hover:text-mint-700 font-semibold text-[13px] transition-colors"
            >
              자세히 보기
            </Link>
          </div>

          {/* 가격 (우측 정렬, 큰 텍스트) */}
          <hr className="border-ink-100 mt-6 mb-4" />
          <div className="flex items-baseline justify-end gap-2 mb-2">
            <div className="text-right">
              {item.minPrice > 0 ? (
                <>
                  <div className="text-[28px] md:text-[40px] font-bold text-ink-900 leading-none tracking-tight">
                    {item.minPrice.toLocaleString()}
                    <span className="text-[16px] md:text-[20px] ml-1 font-semibold">원</span>
                  </div>
                  <div className="text-[11px] text-ink-500 mt-1.5">
                    (부가세 별도)
                  </div>
                </>
              ) : (
                <div className="text-[14px] text-ink-500">가격 협의</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: 큰 hero 이미지 */}
        <div className="relative flex flex-col min-h-0">
          <div className="aspect-[4/3] lg:aspect-auto lg:flex-1 rounded-card bg-ink-100 overflow-hidden border border-ink-100 relative">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={item.name.ko}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-ink-300 text-sm">
                이미지 준비 중
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 페이지 번호 (우하단, 강조) */}
      <div className="absolute bottom-3 right-6 md:right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>

      {/* 스크롤 안내 (마지막 빼고) */}
      {index < total - 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-ink-300 font-mono uppercase tracking-widest pointer-events-none flex items-center gap-1.5">
          <span className="w-4 h-px bg-ink-300" />
          scroll
          <ArrowRight className="w-3 h-3 rotate-90" />
          <span className="w-4 h-px bg-ink-300" />
        </div>
      )}
    </section>
  );
}

function SpecRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-6 md:gap-8">
      <dt className="text-[13px] md:text-[14px] font-bold text-ink-900 w-20 md:w-24 shrink-0">
        {label}
      </dt>
      <dd className="text-[13px] md:text-[14px] text-ink-700 flex-1 min-w-0 break-words">
        {value}
      </dd>
    </div>
  );
}
