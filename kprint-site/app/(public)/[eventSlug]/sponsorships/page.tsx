"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { PersonaCourses, matchesPersona } from "@/components/public/PersonaCourses";
import type {
  Category,
  Channel,
  Package,
  Persona,
  SiteSettings,
  Slot,
  Subcategory,
} from "@/lib/types";
import { Footer } from "@/components/public/Footer";
import { LocaleSwitch } from "@/components/public/LocaleSwitch";
import { SlotPicker } from "@/components/public/CategoryDetail/_shared/SlotPicker";
import { localized, useLocale, type Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { derivePurposes } from "@/lib/purposes";
import { PURPOSE_META, PURPOSE_ORDER, type Purpose } from "@/lib/types";

function channelLabel(c: Channel | "all", locale: Locale): string {
  const key = (
    {
      all: "spons.channel.all",
      offline: "spons.channel.offline",
      online: "spons.channel.online",
      package: "spons.channel.package",
    } as const
  )[c];
  return t(key, locale);
}

// 사이드바 필터에서는 패키지를 별도 섹션으로 분리했으므로 채널 옵션에서 제외
const CHANNEL_FILTER_IDS: Array<Channel | "all"> = ["all", "offline", "online"];

// ============================================================================
// 매체 유형 / 노출 시점 / 위치 — 실무 필터
// ============================================================================

type MediaType = Exclude<Category["type"], "package">;
type Timing = "pre" | "onsite" | "post";
type LocationTag = "hall_a" | "hall_b" | "hall_c" | "hall_d" | "outdoor" | "online";

// 'floor_plan' 옵션은 media 도 같이 매칭 (LDL 같은 실내 LED 영상도 전시장 설치물에 속함)
const MEDIA_TYPE_OPTIONS: Array<{
  id: MediaType;
  label: { ko: string; en: string };
}> = [
  { id: "floor_plan", label: { ko: "전시장 내부 설치", en: "On-floor install" } },
  { id: "xpace", label: { ko: "LED 영상 광고", en: "LED video ads" } },
  { id: "digital_banner", label: { ko: "사이트·앱 배너", en: "Web/app banners" } },
  { id: "mailing", label: { ko: "뉴스레터·푸시", en: "Newsletter / push" } },
  { id: "print_page", label: { ko: "쇼가이드 인쇄", en: "Show guide print" } },
  { id: "content", label: { ko: "SNS 콘텐츠", en: "SNS content" } },
  { id: "quantity", label: { ko: "참관객 배포물", en: "Visitor giveaways" } },
];

const TIMING_OPTIONS: Array<{
  id: Timing;
  label: { ko: string; en: string };
}> = [
  { id: "pre", label: { ko: "사전 (행사 전)", en: "Pre (before)" } },
  { id: "onsite", label: { ko: "현장 (행사 중)", en: "On-site (during)" } },
  { id: "post", label: { ko: "사후 (행사 후)", en: "Post (after)" } },
];

const LOCATION_OPTIONS: Array<{
  id: LocationTag;
  label: { ko: string; en: string };
}> = [
  { id: "hall_a", label: { ko: "Hall A", en: "Hall A" } },
  { id: "hall_b", label: { ko: "Hall B", en: "Hall B" } },
  { id: "hall_c", label: { ko: "Hall C", en: "Hall C" } },
  { id: "hall_d", label: { ko: "Hall D", en: "Hall D" } },
  { id: "outdoor", label: { ko: "옥외", en: "Outdoor" } },
  { id: "online", label: { ko: "온라인", en: "Online" } },
];

function getTiming(c: Category): Timing[] {
  // 어드민이 명시 설정한 값 우선
  if (c.timingOverride && c.timingOverride.length > 0) return c.timingOverride;
  // 휴리스틱 fallback
  const out: Timing[] = [];
  if (c.type === "mailing") out.push("pre");
  if (c.type === "digital_banner") out.push("pre");
  if (c.type === "content") {
    if (c.code === "OIC" || c.name.ko.includes("현장")) out.push("onsite", "post");
    else out.push("pre");
  }
  if (
    c.type === "floor_plan" ||
    c.type === "xpace" ||
    c.type === "quantity" ||
    c.type === "media" ||
    c.type === "print_page"
  ) {
    out.push("onsite");
  }
  return out;
}

function getLocations(c: Category): LocationTag[] {
  if (c.locationOverride && c.locationOverride.length > 0) return c.locationOverride;
  const out: LocationTag[] = [];
  const n = c.name.ko;
  if (c.channel === "online") out.push("online");
  if (n.includes("Hall A") || /A\b/.test(c.code)) out.push("hall_a");
  if (n.includes("Hall B") || /B\b/.test(c.code)) out.push("hall_b");
  if (n.includes("Hall C") || /C\b/.test(c.code)) out.push("hall_c");
  if (n.includes("Hall D") || /D\b/.test(c.code)) out.push("hall_d");
  if (c.type === "xpace" || n.includes("옥외")) out.push("outdoor");
  return out;
}

// 광고 목적 태그는 taxonomy/main 도큐먼트에서 동적으로 로드 (kind === 'purpose')

// 예산 슬라이더 — 0이면 필터 미적용. 양수면 그 금액 이하 카테고리만.

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
  badges: Badge[];
};

type Badge = "popular" | "closing" | "solo" | "limited" | "sold_out";

function computeBadges(c: Category, slotAvailable: number, slotTotal: number): Badge[] {
  const badges: Badge[] = [];
  if (c.isFeatured) badges.push("popular");
  if (slotTotal === 0) {
    // no slots — skip
  } else if (slotAvailable === 0) {
    badges.push("sold_out");
  } else if (slotTotal === 1) {
    badges.push("solo");
  } else if (slotAvailable === 1) {
    badges.push("limited");
  } else if (slotAvailable / slotTotal <= 0.3) {
    badges.push("closing");
  }
  return badges;
}

export default function SponsorshipsPage() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;
  const locale = useLocale((s) => s.locale);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const [filterChannel, setFilterChannel] = useState<Channel | "all">("all");
  const [budget, setBudget] = useState<number>(0); // 0 = 필터 X
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [activePurposes, setActivePurposes] = useState<Set<Purpose>>(new Set());
  const [activeMediaTypes, setActiveMediaTypes] = useState<Set<MediaType>>(new Set());
  const [activeTimings, setActiveTimings] = useState<Set<Timing>>(new Set());
  const [activeLocations, setActiveLocations] = useState<Set<LocationTag>>(new Set());
  const [deadlineSoon, setDeadlineSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "slide">("card");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const [catSnap, subSnap, slotSnap, pkgSnap, settingsSnap, personaSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "categories"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDocs(
            query(collection(db, "subcategories"), where("eventId", "==", eventId))
          ),
          getDocs(
            query(collection(db, "slots"), where("eventId", "==", eventId))
          ),
          getDocs(
            query(
              collection(db, "packages"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDoc(doc(db, "siteSettings", eventId)),
          getDocs(
            query(collection(db, "personas"), where("eventId", "==", eventId))
          ),
        ]);
        setPersonas(
          personaSnap.docs.map((d) => ({ ...(d.data() as Persona), id: d.id }))
        );
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
      } catch (e) {
        console.error(e);
      }
    })();
  }, [eventId]);

  const enriched = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.order - b.order)
      .map((c) => {
        const cs = slots.filter((s) => s.categoryId === c.id);
        const subs = subcategories.filter((s) => s.categoryId === c.id);
        const prices = subs.map((s) => s.priceKRW).filter((p) => p > 0);
        const slotTotal = cs.length;
        const slotAvailable = cs.filter((s) => s.status === "available").length;
        return {
          ...c,
          slotTotal,
          slotAvailable,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          badges: computeBadges(c, slotAvailable, slotTotal),
        };
      });
  }, [categories, subcategories, slots]);

  const totalCount = enriched.length;

  // 예산 슬라이더 최대값 (전체 카테고리 minPrice 중 가장 큰 값을 100만 단위로 올림)
  const budgetMax = useMemo(() => {
    const max = enriched.reduce((m, c) => Math.max(m, c.minPrice), 0);
    if (max <= 0) return 100_000_000;
    return Math.ceil(max / 1_000_000) * 1_000_000;
  }, [enriched]);

  // 현재 예산 안에 들어오는 카테고리 수 (슬라이더 옆 라이브 카운트)
  const inBudgetCount = useMemo(() => {
    if (budget <= 0) return enriched.length;
    return enriched.filter((c) => c.minPrice > 0 && c.minPrice <= budget).length;
  }, [enriched, budget]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterChannel !== "all") {
      rows = rows.filter((r) => r.channel === filterChannel);
    }
    if (budget > 0) {
      rows = rows.filter((r) => r.minPrice > 0 && r.minPrice <= budget);
    }
    if (selectedPersona) {
      // 페르소나는 태그·맥락 기반 추천만. 예산은 슬라이더에서 별도로 제어.
      rows = rows.filter((r) => matchesPersona(r, selectedPersona));
    }
    if (activePurposes.size > 0) {
      // 참가업체 시점의 광고 목적 필터 (단일 진실원)
      rows = rows.filter((r) => {
        const purps = derivePurposes(r);
        return purps.some((p) => activePurposes.has(p));
      });
    }
    if (activeMediaTypes.size > 0) {
      rows = rows.filter((r) => {
        // floor_plan 선택 시 media(이벤트 LED)도 같이 포함
        if (r.type === "media" && activeMediaTypes.has("floor_plan")) return true;
        return activeMediaTypes.has(r.type as MediaType);
      });
    }
    if (activeTimings.size > 0) {
      rows = rows.filter((r) => {
        const t = getTiming(r);
        return t.some((x) => activeTimings.has(x));
      });
    }
    if (activeLocations.size > 0) {
      rows = rows.filter((r) => {
        const l = getLocations(r);
        return l.some((x) => activeLocations.has(x));
      });
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
    budget,
    deadlineSoon,
    search,
    selectedPersona,
    activePurposes,
    activeMediaTypes,
    activeTimings,
    activeLocations,
  ]);

  const resetFilters = () => {
    setFilterChannel("all");
    setBudget(0);
    setSelectedPersona(null);
    setActivePurposes(new Set());
    setActiveMediaTypes(new Set());
    setActiveTimings(new Set());
    setActiveLocations(new Set());
    setDeadlineSoon(false);
    setSearch("");
  };

  // 페르소나 선택 시 목적 필터 자동 적용 (단일 진실원)
  const pickPersona = (p: Persona) => {
    setSelectedPersona(p);
    if (p.purposes && p.purposes.length > 0) {
      setActivePurposes(new Set(p.purposes));
    }
  };
  const clearPersona = () => {
    setSelectedPersona(null);
    setActivePurposes(new Set());
  };

  const hasActiveFilter =
    filterChannel !== "all" ||
    budget > 0 ||
    deadlineSoon ||
    search.trim() !== "" ||
    !!selectedPersona ||
    activePurposes.size > 0 ||
    activeMediaTypes.size > 0 ||
    activeTimings.size > 0 ||
    activeLocations.size > 0;

  // 패키지 노출 규칙:
  //  - 필터 없음 → 전체 패키지
  //  - 페르소나 + packageTier 일치 → 해당 tier 만
  //  - 그 외 필터(채널·예산·검색…) → 숨김
  const packagesToShow = useMemo<Package[]>(() => {
    if (packages.length === 0) return [];
    if (selectedPersona) {
      if (!selectedPersona.packageTier) return [];
      return packages.filter((p) => p.tier === selectedPersona.packageTier);
    }
    if (hasActiveFilter) return [];
    return packages;
  }, [packages, selectedPersona, hasActiveFilter]);

  return (
    <>
      {viewMode === "slide" ? (
        <SlideStream
          items={filtered}
          subcategories={subcategories}
          slots={slots}
          totalCount={totalCount}
          onCardMode={() => setViewMode("card")}
          onOpenFilter={() => setSheetOpen(true)}
          hasActiveFilter={hasActiveFilter}
          eventId={eventId}
        />
      ) : (
        <>
          <main className="min-h-screen bg-canvas">
            <header className="px-6 md:px-16 pt-16 md:pt-20 pb-8 md:pb-10 border-b border-ink-100 bg-surface">
              <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-num text-[11px] md:text-[12px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3 flex items-center gap-2">
                    <span className="w-6 h-px bg-brand-500" />
                    {localized(
                      {
                        ko: settings?.event.nameKo,
                        en: settings?.event.nameEn,
                      },
                      locale
                    ) || eventId}
                  </div>
                  <h1 className="text-[36px] md:text-[64px] font-bold tracking-tight leading-[1.05] text-ink-900">
                    {t("spons.title", locale)}
                  </h1>
                  <p className="text-[14px] md:text-[16px] text-ink-500 mt-3 max-w-xl leading-relaxed">
                    {t("spons.subtitle", locale)}
                  </p>
                </div>
                <LocaleSwitch />
              </div>
            </header>

            {/* 페르소나 추천 코스 */}
            <PersonaCourses
              personas={personas}
              categories={categories}
              packages={packages}
              selectedPersonaId={selectedPersona?.id ?? null}
              onPick={({ persona }) => pickPersona(persona)}
              onClear={clearPersona}
            />

            <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8 px-6 md:px-16 py-10 max-w-7xl mx-auto">
              {/* Mobile filter bar */}
              <div className="lg:hidden flex items-center justify-between mb-4 sticky top-0 z-10 bg-white py-2 border-b border-ink-100">
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="px-3 py-1.5 rounded-btn border border-ink-100 text-[13px] font-semibold flex items-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  {t("spons.filter", locale)}
                  {hasActiveFilter && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 ml-0.5" />
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
                  budget={budget}
                  setBudget={setBudget}
                  budgetMax={budgetMax}
                  inBudgetCount={inBudgetCount}
                  activePurposes={activePurposes}
                  setActivePurposes={setActivePurposes}
                  activeMediaTypes={activeMediaTypes}
                  setActiveMediaTypes={setActiveMediaTypes}
                  activeTimings={activeTimings}
                  setActiveTimings={setActiveTimings}
                  activeLocations={activeLocations}
                  setActiveLocations={setActiveLocations}
                  deadlineSoon={deadlineSoon}
                  setDeadlineSoon={setDeadlineSoon}
                  totalCount={totalCount}
                  resultCount={filtered.length}
                  hasActiveFilter={hasActiveFilter}
                  onReset={resetFilters}
                  advancedOpen={advancedOpen}
                  setAdvancedOpen={setAdvancedOpen}
                />
              </aside>

              {/* Grid */}
              <section>
                {/* 뷰 모드 토글 */}
                <div className="hidden lg:flex items-center justify-between mb-4">
                  <div className="text-[12px] text-ink-500">
                    전체 <strong className="text-ink-900">{totalCount}</strong>개 중{" "}
                    <strong className="text-brand-700">{filtered.length}</strong>개
                  </div>
                  <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="lg:hidden mb-4 flex justify-end">
                  <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>

                {/* 패키지 전용 섹션 */}
                {packagesToShow.length > 0 && (
                  <PackageSection packages={packagesToShow} eventId={eventId} />
                )}

                {filtered.length === 0 ? (
                  <div className="bg-ink-50 rounded-card py-16 text-center text-sm text-ink-500">
                    조건에 맞는 항목이 없어요.
                    {hasActiveFilter && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="block mx-auto mt-3 text-brand-700 font-semibold hover:underline"
                      >
                        필터 초기화 →
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {packagesToShow.length > 0 && (
                      <div className="mt-8 mb-4 flex items-center gap-3">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-brand-700 font-bold">
                          개별 구좌
                        </span>
                        <div className="flex-1 h-px bg-ink-100" />
                      </div>
                    )}
                    <CardGrid items={filtered} eventId={eventId} />
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
                budget={budget}
                setBudget={setBudget}
                budgetMax={budgetMax}
                inBudgetCount={inBudgetCount}
                activePurposes={activePurposes}
                setActivePurposes={setActivePurposes}
                activeMediaTypes={activeMediaTypes}
                setActiveMediaTypes={setActiveMediaTypes}
                activeTimings={activeTimings}
                setActiveTimings={setActiveTimings}
                activeLocations={activeLocations}
                setActiveLocations={setActiveLocations}
                deadlineSoon={deadlineSoon}
                setDeadlineSoon={setDeadlineSoon}
                totalCount={totalCount}
                resultCount={filtered.length}
                hasActiveFilter={hasActiveFilter}
                onReset={resetFilters}
                advancedOpen={advancedOpen}
                setAdvancedOpen={setAdvancedOpen}
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
                className="px-4 py-2.5 rounded-btn bg-brand-500 text-ink-900 hover:bg-brand-700 hover:text-white text-[13px] font-semibold"
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
  budget,
  setBudget,
  budgetMax,
  inBudgetCount,
  activePurposes,
  setActivePurposes,
  activeMediaTypes,
  setActiveMediaTypes,
  activeTimings,
  setActiveTimings,
  activeLocations,
  setActiveLocations,
  deadlineSoon,
  setDeadlineSoon,
  totalCount,
  resultCount,
  hasActiveFilter,
  onReset,
  advancedOpen,
  setAdvancedOpen,
}: {
  search: string;
  setSearch: (s: string) => void;
  filterChannel: Channel | "all";
  setFilterChannel: (c: Channel | "all") => void;
  budget: number;
  setBudget: (n: number) => void;
  budgetMax: number;
  inBudgetCount: number;
  activePurposes: Set<Purpose>;
  setActivePurposes: (s: Set<Purpose>) => void;
  activeMediaTypes: Set<MediaType>;
  setActiveMediaTypes: (s: Set<MediaType>) => void;
  activeTimings: Set<Timing>;
  setActiveTimings: (s: Set<Timing>) => void;
  activeLocations: Set<LocationTag>;
  setActiveLocations: (s: Set<LocationTag>) => void;
  deadlineSoon: boolean;
  setDeadlineSoon: (v: boolean) => void;
  totalCount: number;
  resultCount: number;
  hasActiveFilter: boolean;
  onReset: () => void;
  advancedOpen: boolean;
  setAdvancedOpen: (v: boolean) => void;
}) {
  const locale = useLocale((s) => s.locale);
  const mediaOptions = MEDIA_TYPE_OPTIONS.map((o) => ({
    id: o.id,
    label: localized(o.label, locale),
  }));
  const timingOptions = TIMING_OPTIONS.map((o) => ({
    id: o.id,
    label: localized(o.label, locale),
  }));
  const locationOptions = LOCATION_OPTIONS.map((o) => ({
    id: o.id,
    label: localized(o.label, locale),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-ink-500">
          {locale === "en" ? (
            <>
              <strong className="text-brand-500">{resultCount}</strong> of{" "}
              <strong className="text-ink-900">{totalCount}</strong>
            </>
          ) : (
            <>
              전체 <strong className="text-ink-900">{totalCount}</strong>개 중{" "}
              <strong className="text-brand-500">{resultCount}</strong>개
            </>
          )}
        </div>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-ink-500 hover:text-ink-900 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            {t("common.reset", locale)}
          </button>
        )}
      </div>

      {/* (1) 예산 — 가장 먼저 묻는 질문 */}
      <FilterSection title={t("spons.budget", locale)}>
        <BudgetSlider
          budget={budget}
          setBudget={setBudget}
          budgetMax={budgetMax}
          inBudgetCount={inBudgetCount}
        />
      </FilterSection>

      {/* (2) 광고 목적 — 참가업체 언어 (단일 진실원) */}
      <FilterSection
        title={locale === "en" ? "Purpose" : "광고 목적"}
        hint={
          locale === "en"
            ? "Why are you buying?"
            : "왜 사시는지 — 참가업체 시점"
        }
      >
        <div className="space-y-1.5">
          {PURPOSE_ORDER.map((p) => {
            const meta = PURPOSE_META[p];
            const active = activePurposes.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const next = new Set(activePurposes);
                  if (active) next.delete(p);
                  else next.add(p);
                  setActivePurposes(next);
                }}
                className={
                  "w-full text-left px-3 py-2 rounded-btn border-2 transition-colors " +
                  (active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-ink-100 bg-surface hover:border-brand-500")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      "text-[12.5px] font-bold " +
                      (active ? "text-white" : "text-ink-900")
                    }
                  >
                    {locale === "en" ? meta.en : meta.ko}
                  </span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div
                  className={
                    "text-[10.5px] mt-0.5 leading-snug " +
                    (active ? "text-white/85" : "text-ink-500")
                  }
                >
                  {meta.desc}
                </div>
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* (3) 노출 시점 */}
      <FilterSection title={t("spons.timing", locale)}>
        <CheckboxList
          options={timingOptions}
          active={activeTimings}
          onToggle={(id) => {
            const next = new Set(activeTimings);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setActiveTimings(next);
          }}
        />
      </FilterSection>

      {/* (4) 위치 */}
      <FilterSection title={t("spons.location", locale)}>
        <CheckboxList
          options={locationOptions}
          active={activeLocations}
          onToggle={(id) => {
            const next = new Set(activeLocations);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setActiveLocations(next);
          }}
        />
      </FilterSection>

      {/* (5) 마감 임박 */}
      <FilterSection title={t("spons.deadline", locale)}>
        <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer hover:text-ink-900">
          <input
            type="checkbox"
            checked={deadlineSoon}
            onChange={(e) => setDeadlineSoon(e.target.checked)}
            className="accent-brand-500 w-3.5 h-3.5"
          />
          <span>{t("spons.deadlineSoon", locale)}</span>
        </label>
      </FilterSection>

      {/* (6) 고급 필터 — 접힘. 사무국·내부 표현(매체 유형/채널/검색) */}
      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="border-t border-ink-100 pt-5"
      >
        <summary className="cursor-pointer text-[11px] uppercase tracking-widest text-ink-500 font-semibold flex items-center gap-1.5 list-none">
          <span className="inline-block transition-transform" style={{ transform: advancedOpen ? "rotate(90deg)" : "none" }}>
            ›
          </span>
          {locale === "en" ? "Advanced filters" : "고급 필터"}
          <span className="ml-auto text-[10px] text-ink-300 normal-case tracking-normal font-normal">
            {locale === "en" ? "(media · channel · search)" : "(매체 · 채널 · 검색)"}
          </span>
        </summary>

        <div className="space-y-5 mt-4">
          <FilterSection title={t("common.search", locale)}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("spons.searchPlaceholder", locale)}
                className="w-full pl-9 pr-3 py-2 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
              />
            </div>
          </FilterSection>

          <FilterSection title={t("spons.channel", locale)}>
            <div className="flex flex-wrap lg:flex-col gap-1">
              {CHANNEL_FILTER_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilterChannel(id)}
                  className={
                    "text-left px-3 py-1.5 rounded-btn text-[13px] transition-colors " +
                    (filterChannel === id
                      ? "bg-ink-900 text-white font-semibold"
                      : "text-ink-700 hover:bg-ink-50")
                  }
                >
                  {channelLabel(id, locale)}
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection
            title={t("spons.media", locale)}
            hint={locale === "en" ? "Organizer's view" : "사무국 분류 — 참고용"}
          >
            <CheckboxList
              options={mediaOptions}
              active={activeMediaTypes}
              onToggle={(id) => {
                const next = new Set(activeMediaTypes);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setActiveMediaTypes(next);
              }}
            />
          </FilterSection>
        </div>
      </details>
    </div>
  );
}

function FilterSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-1 font-semibold flex items-baseline gap-2 flex-wrap">
        <span>{title}</span>
        {hint && (
          <span className="text-[10px] text-ink-300 normal-case tracking-normal font-normal">
            · {hint}
          </span>
        )}
      </div>
      <div className="mt-2">{children}</div>
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
// CheckboxList — 사이드바 필터의 공용 체크박스 리스트
// ============================================================================

function CheckboxList<T extends string>({
  options,
  active,
  onToggle,
}: {
  options: Array<{ id: T; label: string }>;
  active: Set<T>;
  onToggle: (id: T) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {options.map((o) => (
        <li key={o.id}>
          <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer hover:text-ink-900">
            <input
              type="checkbox"
              checked={active.has(o.id)}
              onChange={() => onToggle(o.id)}
              className="accent-brand-500 w-3.5 h-3.5"
            />
            <span>{o.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// BudgetSlider — 예산 슬라이더 + 라이브 카운트
// ============================================================================

function BudgetSlider({
  budget,
  setBudget,
  budgetMax,
  inBudgetCount,
}: {
  budget: number;
  setBudget: (n: number) => void;
  budgetMax: number;
  inBudgetCount: number;
}) {
  const active = budget > 0;
  const display =
    budget >= 10_000_000
      ? `${(budget / 10_000_000).toFixed(1).replace(/\.0$/, "")}억`
      : budget >= 1_000_000
        ? `${(budget / 10_000).toFixed(0)}만`
        : "전체";

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={"font-mono text-[15px] font-bold " + (active ? "text-brand-700" : "text-ink-500")}>
          {active ? `${display}원 이하` : "예산 미정"}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => setBudget(0)}
            className="text-[10.5px] text-ink-500 hover:text-ink-900"
          >
            초기화
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={budgetMax}
        step={500_000}
        value={budget}
        onChange={(e) => setBudget(parseInt(e.target.value, 10))}
        className="w-full accent-brand-500 cursor-pointer"
        aria-label="예산 슬라이더"
      />
      <div className="flex items-center justify-between text-[10.5px] text-ink-500 font-mono">
        <span>0</span>
        <span>{(budgetMax / 10_000_000).toFixed(1).replace(/\.0$/, "")}억</span>
      </div>
      <div
        className={
          "mt-2 px-3 py-2 rounded-btn text-[11.5px] border " +
          (active
            ? "bg-brand-50 border-brand-100 text-brand-700 font-semibold"
            : "bg-ink-50 border-ink-100 text-ink-500")
        }
      >
        {active ? (
          <>
            이 예산으로 <strong className="text-[14px]">{inBudgetCount}</strong>개 채널 가능
          </>
        ) : (
          <>슬라이더를 끌면 예산 내 채널만 보입니다</>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BadgePill — 카드 뱃지 (인기/마감임박/단독/한정/매진)
// ============================================================================

function BadgePill({ badge }: { badge: Badge }) {
  const config: Record<
    Badge,
    { label: string; bg: string; text: string }
  > = {
    popular: { label: "인기", bg: "bg-brand-500", text: "text-ink-900" },
    closing: { label: "마감 임박", bg: "bg-amber-500", text: "text-white" },
    solo: { label: "단독", bg: "bg-ink-900", text: "text-brand-500" },
    limited: { label: "1석 남음", bg: "bg-red-600", text: "text-white" },
    sold_out: { label: "매진", bg: "bg-ink-300", text: "text-white" },
  };
  const c = config[badge];
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

// ============================================================================
// Package section (상단 전용)
// ============================================================================

function PackageSection({ packages, eventId }: { packages: Package[]; eventId: string }) {
  const locale = useLocale((s) => s.locale);
  const sorted = [...packages].sort((a, b) => {
    // 시그니처 먼저, 그다음 order
    if (a.tier !== b.tier) return a.tier === "signature" ? -1 : 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return (
    <section className="mb-2">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-brand-700 font-bold">
          {t("spons.packagesSection", locale)}
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
              href={`/${eventId}/packages/${pkg.id}`}
              className={
                "group bg-surface border-2 rounded-card overflow-hidden flex flex-col h-full transition-all " +
                (isSignature
                  ? "border-brand-500 hover:shadow-glow-sm"
                  : "border-ink-100 hover:border-brand-500 hover:shadow-card")
              }
            >
              <div className="aspect-[4/3] bg-ink-100 relative shrink-0">
                {hero ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hero}
                    alt={localized(pkg.name, locale)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-ink-300 text-xs">
                    {locale === "en" ? "No image" : "이미지 없음"}
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span
                    className={
                      "text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-pill font-num font-bold " +
                      (isSignature
                        ? "bg-brand-500 text-white shadow-glow-sm"
                        : "bg-white/90 text-ink-900")
                    }
                  >
                    {isSignature ? "Signature" : "Standard"}
                  </span>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div
                  className={
                    "font-bold leading-tight tracking-tight transition-colors " +
                    (isSignature
                      ? "text-[18px] text-ink-900 group-hover:text-brand-500"
                      : "text-[15px] text-ink-900 group-hover:text-brand-500")
                  }
                >
                  {localized(pkg.name, locale)}
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
                      <div className="text-[14px] font-bold text-brand-700 font-mono">
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

function CardGrid({ items, eventId }: { items: EnrichedCategory[]; eventId: string }) {
  const locale = useLocale((s) => s.locale);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((c) => {
        const hero = c.heroImages?.images?.[0]?.url;
        return (
          <Link
            key={c.id}
            href={`/${eventId}/sponsorships/${c.slug}`}
            className="group bg-surface border border-ink-100 rounded-card overflow-hidden hover:border-brand-500 hover:shadow-card transition-all flex flex-col h-full"
          >
            <div className="aspect-[4/3] bg-ink-100 relative shrink-0">
              {hero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hero}
                  alt={localized(c.name, locale)}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-ink-300 text-xs">
                  {locale === "en" ? "No image" : "이미지 없음"}
                </div>
              )}
              <div className="absolute top-3 left-3 flex gap-1 flex-wrap max-w-[calc(100%-1.5rem)]">
                <span className="text-[10px] uppercase tracking-wider bg-white/90 text-ink-900 px-2 py-0.5 rounded font-semibold">
                  {channelLabel(c.channel, locale)}
                </span>
                {c.badges.map((b) => (
                  <BadgePill key={b} badge={b} />
                ))}
              </div>
              {/* 잔여 N자리 강조 — 한정 재고 정직 표시 */}
              {c.slotTotal > 0 && c.slotAvailable > 0 && c.slotAvailable <= 3 && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="px-2 py-1 rounded-pill bg-ink-900 text-white text-[10.5px] font-num font-bold shadow-card">
                    잔여 {c.slotAvailable}자리
                  </span>
                </div>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="font-bold text-[16px] text-ink-900 group-hover:text-brand-500 leading-tight tracking-tight transition-colors">
                {localized(c.name, locale)}
              </div>
              {c.shortDesc && (
                <p className="text-[12.5px] text-ink-500 mt-2 line-clamp-2 leading-snug">
                  {c.shortDesc}
                </p>
              )}

              {/* 목적 칩 — 참가업체 시점 */}
              {(() => {
                const purps = derivePurposes(c).slice(0, 2);
                if (purps.length === 0) return null;
                return (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {purps.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] font-num font-semibold text-brand-500 bg-brand-50 px-2 py-0.5 rounded-pill"
                      >
                        {PURPOSE_META[p][locale === "en" ? "en" : "ko"]}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* 작년 이 자리 산 회사 — 사회적 증거 */}
              {c.lastYear?.buyers && c.lastYear.buyers.length > 0 && (
                <div className="mt-3 text-[10.5px] text-ink-500 leading-snug">
                  <span className="font-num font-bold text-ink-700">작년: </span>
                  {c.lastYear.buyers.slice(0, 3).join(", ")}
                  {c.lastYear.buyers.length > 3 && ` 외 ${c.lastYear.buyers.length - 3}곳`}
                </div>
              )}
              {c.lastYear?.soldOutDate && (
                <div className="text-[10.5px] text-amber-700 font-num font-semibold mt-1">
                  작년 매진: {c.lastYear.soldOutDate}
                </div>
              )}

              <div className="mt-auto pt-4 flex items-center justify-between text-[11.5px] font-num">
                <span>
                  {c.minPrice > 0 ? (
                    <>
                      <span className="text-ink-500">{t("spons.minPrice", locale)} </span>
                      <span className="text-ink-900 font-bold">
                        {c.minPrice.toLocaleString()}원
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-500">{t("common.priceNegotiable", locale)}</span>
                  )}
                </span>
                <span className="text-ink-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all">
                  →
                </span>
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
  subcategories,
  slots,
  totalCount,
  onCardMode,
  onOpenFilter,
  hasActiveFilter,
  eventId,
}: {
  items: EnrichedCategory[];
  subcategories: Subcategory[];
  slots: Slot[];
  totalCount: number;
  onCardMode: () => void;
  onOpenFilter: () => void;
  hasActiveFilter: boolean;
  eventId: string;
}) {
  const locale = useLocale((s) => s.locale);
  return (
    <>
      {/* 상단 고정 바 */}
      <div className="fixed top-0 inset-x-0 z-20 bg-white/90 backdrop-blur border-b border-ink-100 px-4 md:px-8 h-14 flex items-center gap-3">
        <Link
          href={`/${eventId}`}
          className="text-[12px] text-ink-500 hover:text-ink-900 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("common.home", locale)}
        </Link>
        <span className="text-ink-300">/</span>
        <span className="text-[13px] font-bold text-ink-900">
          {t("spons.title", locale)}
        </span>
        <span className="text-[12px] text-ink-500">
          {locale === "en" ? (
            <>
              <strong className="text-brand-700">{items.length}</strong> of{" "}
              <strong className="text-ink-900">{totalCount}</strong>
            </>
          ) : (
            <>
              전체 <strong className="text-ink-900">{totalCount}</strong>개 중{" "}
              <strong className="text-brand-700">{items.length}</strong>개
            </>
          )}
        </span>
        <span className="ml-auto" />
        <LocaleSwitch size="sm" />
        <button
          type="button"
          onClick={onOpenFilter}
          className="px-2.5 py-1.5 rounded-btn border border-ink-100 text-[12px] font-semibold flex items-center gap-1"
          title={t("spons.filter", locale)}
        >
          <Filter className="w-3.5 h-3.5" />
          {t("spons.filter", locale)}
          {hasActiveFilter && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onCardMode}
          className="px-2.5 py-1.5 rounded-btn bg-ink-900 text-white hover:bg-brand-500 hover:text-ink-900 text-[12px] font-semibold flex items-center gap-1"
          title={t("spons.viewCard", locale)}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          {t("spons.viewCard", locale)}
        </button>
      </div>

      {items.length === 0 ? (
        <main className="h-screen pt-14 grid place-items-center bg-canvas">
          <div className="text-center text-sm text-ink-500">
            {t("spons.filterEmpty", locale)}
          </div>
        </main>
      ) : (
        <main className="h-screen overflow-y-scroll snap-y snap-proximity bg-canvas scroll-smooth">
          {items.map((c, i) => {
            const subs = subcategories
              .filter((s) => s.categoryId === c.id)
              .sort((a, b) => a.order - b.order);
            const catSlots = slots
              .filter((s) => s.categoryId === c.id)
              .sort((a, b) => a.order - b.order);
            return (
              <SlideSection
                key={c.id}
                item={c}
                subcategories={subs}
                slots={catSlots}
                index={i}
                total={items.length}
                eventId={eventId}
              />
            );
          })}
        </main>
      )}
    </>
  );
}

function SlideSection({
  item,
  subcategories,
  slots,
  index,
  total,
  eventId,
}: {
  item: EnrichedCategory;
  subcategories: Subcategory[];
  slots: Slot[];
  index: number;
  eventId: string;
  total: number;
}) {
  const locale = useLocale((s) => s.locale);
  const hero = item.heroImages?.images?.[0]?.url;
  const deadlineStr = item.deadline
    ? item.deadline.toDate().toLocaleDateString(
        locale === "en" ? "en-US" : "ko-KR",
        {
          year: "numeric",
          month: locale === "en" ? "short" : "long",
          day: "numeric",
        }
      )
    : null;

  // 해시태그 — 채널 + 카테고리.tags 중 첫 2개
  const hashTags: string[] = [
    channelLabel(item.channel, locale),
    ...(item.tags ?? []).slice(0, 2),
  ];

  return (
    <section className="min-h-screen snap-start bg-canvas pt-14 relative">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12 grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-14 items-start">
        {/* LEFT: 정보 */}
        <div className="flex flex-col min-w-0">
          {/* 해시태그 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] md:text-[14px] tracking-wide text-brand-500 font-bold mb-5 md:mb-7 font-num">
            {hashTags.map((tag, i) => (
              <span key={i}>#{tag}</span>
            ))}
          </div>

          {/* 거대한 카테고리 명 + 코드 */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[40px] md:text-[64px] font-bold leading-[0.95] tracking-tight text-ink-900">
              {localized(item.name, locale)}
            </h2>
            <span className="text-[14px] md:text-[18px] text-ink-300 font-num">
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
          <hr className="border-ink-100 my-6 md:my-7" />

          {/* 스펙 표 (2열 콤팩트) */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {item.size && (
              <SpecRow label={t("spons.size", locale)} value={item.size} />
            )}
            {item.fileFormat && (
              <SpecRow
                label={t("spons.fileFormat", locale)}
                value={item.fileFormat}
              />
            )}
            {deadlineStr && (
              <SpecRow
                label={t("spons.submitDeadline", locale)}
                value={deadlineStr}
              />
            )}
            <SpecRow
              label={t("spons.slots", locale)}
              value={
                <>
                  <span className="text-brand-500 font-bold">
                    {item.slotAvailable}
                  </span>
                  <span className="text-ink-500">
                    {" "}
                    / {item.slotTotal} {t("spons.slotsAvailable", locale)}
                  </span>
                </>
              }
            />
          </dl>

          {/* 액션 버튼 */}
          <div className="mt-6 flex flex-wrap gap-2">
            {item.designGuideFileUrl && (
              <a
                href={item.designGuideFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-pill bg-brand-500 text-white hover:bg-brand-700 hover:shadow-glow-sm font-bold text-[13px] transition-all"
              >
                {t("spons.designGuide", locale)}
              </a>
            )}
            <Link
              href={`/${eventId}/sponsorships/${item.slug}`}
              className="px-5 py-2.5 rounded-pill border-2 border-ink-100 text-ink-900 hover:border-ink-900 font-bold text-[13px] transition-colors"
            >
              {t("common.viewMore", locale)}
            </Link>
          </div>
        </div>

        {/* RIGHT: 큰 hero 이미지 + 최저가 박스 */}
        <div className="flex flex-col gap-4">
          <div className="aspect-[4/3] rounded-card bg-ink-100 overflow-hidden border border-ink-100 relative shadow-card">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={localized(item.name, locale)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-ink-300 text-sm">
                {locale === "en" ? "Image coming soon" : "이미지 준비 중"}
              </div>
            )}
          </div>

          {/* 최저가 박스 */}
          <div className="bg-surface border border-ink-100 rounded-card p-5 shadow-card">
            <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-2 flex items-center gap-2">
              <span className="w-4 h-px bg-brand-500" />
              {t("spons.minPrice", locale)}
            </div>
            {item.minPrice > 0 ? (
              <>
                <div className="text-[32px] md:text-[40px] font-bold text-ink-900 leading-none tracking-tight font-num">
                  {item.minPrice.toLocaleString()}
                  <span className="text-[16px] md:text-[20px] ml-1 font-semibold">
                    {t("common.won", locale)}
                  </span>
                </div>
                <div className="text-[11px] text-ink-500 mt-1.5">
                  {t("common.priceVatExcluded", locale)}
                </div>
              </>
            ) : (
              <div className="text-[14px] text-ink-500">
                {t("common.priceNegotiable", locale)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 — 소분류 + 슬롯 picker (자세히 보기 콘텐츠 포함) */}
      {subcategories.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 md:px-12 pb-14">
          <div className="bg-surface border border-ink-100 rounded-card p-6 md:p-8 shadow-card">
            <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-5 flex items-center gap-2">
              <span className="w-4 h-px bg-brand-500" />
              구좌 선택
            </div>
            <SlotPicker
              categoryId={item.id}
              eventId={item.eventId}
              subcategories={subcategories}
              slots={slots}
            />
            <div className="mt-6 pt-5 border-t border-ink-100 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11.5px] text-ink-500">
                구좌를 클릭하면 관심 표시되며, 우상단 카트에서 확인할 수 있어요.
              </p>
              <Link
                href={`/${eventId}/sponsorships/${item.slug}`}
                className="text-[12px] font-num font-bold text-brand-500 hover:text-brand-700 flex items-center gap-1 group"
              >
                {item.type === "floor_plan" ? "도면형 자세히 보기" : "전체 자세히 보기"}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 페이지 번호 (우하단, 강조) */}
      <div className="sticky bottom-3 ml-auto mr-6 md:mr-12 w-fit font-mono tracking-widest text-ink-300 text-[12px] pointer-events-none">
        <span className="text-ink-700 font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
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
