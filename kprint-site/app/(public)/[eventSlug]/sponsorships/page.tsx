"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
  Download,
  Filter,
  LayoutGrid,
  Maximize2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { matchesPersona } from "@/components/public/PersonaCourses";
import type { Taxonomy } from "@/lib/types";
import { SponsorshipDiagnosisChat } from "@/components/public/SponsorshipDiagnosisChat";
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
import { PersonaRecommendation } from "@/components/public/PersonaRecommendation";
import { localized, useLocale, type Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { derivePurposes } from "@/lib/purposes";
import { PURPOSE_META, PURPOSE_ORDER, type Purpose } from "@/lib/types";
import { getTypeLayout } from "@/lib/typeLayouts";
import {
  DEFAULT_BUNDLED_PERKS,
  calcPerksTotalValue,
  filterPerksForContext,
} from "@/lib/perks";

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

type Badge = "popular" | "closing" | "solo" | "limited" | "sold_out" | "new";

/** 2026 신규 상품 selectorId 목록 — "신규" 뱃지용 */
const NEW_SELECTOR_IDS = new Set([
  "distribution_stand",
  "category_wall",
  "custom_seminar_package",
]);

function computeBadges(c: Category, slotAvailable: number, slotTotal: number): Badge[] {
  const badges: Badge[] = [];
  if (c.selectorId && NEW_SELECTOR_IDS.has(c.selectorId)) badges.push("new");
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
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);

  const [filterChannel, setFilterChannel] = useState<Channel | "all">("all");
  const [budget, setBudget] = useState<number>(0); // 0 = 필터 X
  // 페르소나 — 필터 사이드바에서 직접 선택. 선택 시 그 페르소나 매칭 매체만 노출
  // + PersonaRecommendation 배너 띄움.
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [activePurposes, setActivePurposes] = useState<Set<Purpose>>(new Set());
  const [activeMediaTypes, setActiveMediaTypes] = useState<Set<MediaType>>(new Set());
  const [activeTimings, setActiveTimings] = useState<Set<Timing>>(new Set());
  const [activeLocations, setActiveLocations] = useState<Set<LocationTag>>(new Set());
  const [deadlineSoon, setDeadlineSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"card" | "slide">(
    searchParams?.get("view") === "slide" ? "slide" : "card"
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  // 첫 질문 Q1 (목적) 의 4가지 (룩업 매트릭스 Q1 값)
  const [aiChatInitial, setAiChatInitial] = useState<
    "launch" | "acquisition" | "retention" | "awareness" | null
  >(null);
  // 비교 모드 — 카드에서 직접 체크해 모은다 (카트 거치지 않고 바로 compare로)
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  // 도면·사례 모달 — 카드 클릭 시 SlideSection 형 모달.
  // ?detail=<slug> 로 자동 오픈 가능 (compare 페이지에서 돌아올 때).
  const [detailModalSlug, setDetailModalSlug] = useState<string | null>(
    searchParams?.get("detail") ?? null
  );

  const toggleCompare = (key: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const clearCompare = () => setCompareIds(new Set());

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const [catSnap, subSnap, slotSnap, pkgSnap, settingsSnap, taxonomySnap, personaSnap] = await Promise.all([
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
          getDoc(doc(db, "taxonomy", eventId)),
          getDocs(
            query(collection(db, "personas"), where("eventId", "==", eventId))
          ),
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
        if (taxonomySnap.exists()) setTaxonomy(taxonomySnap.data() as Taxonomy);
        setPersonas(
          personaSnap.docs.map((d) => ({ ...(d.data() as Persona), id: d.id }))
        );
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

  // 현재 예산 안에 들어오는 카테고리 수 (예산 칩 옆 라이브 카운트)
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

  // 패키지는 필터와 무관하게 항상 별도 섹션 표시 (사용자 요청).
  // (옛 packagesToShow 노출 규칙 폐기)

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
          onOpenDetail={setDetailModalSlug}
          typeLayouts={settings?.typeLayouts}
          bundledPerks={settings?.bundledPerks}
        />
      ) : (
        <>
          <main className="min-h-screen bg-canvas">
            {/* 우측 상단 로케일 스위치만 작게 */}
            <div className="absolute top-4 right-6 z-30">
              <LocaleSwitch />
            </div>

            {/* 메인 — 스폰서십 진단 진입 (페이지의 최상단 배너).
                 좌측: 비즈니스 카피 / 우측: 인라인 채팅 형태로 첫 질문 노출 */}
            <section className="bg-canvas border-b border-ink-100">
              <div className="max-w-7xl mx-auto px-6 md:px-16 py-14 md:py-24">
                <div className="grid lg:grid-cols-[1fr_1.35fr] gap-12 lg:gap-20 items-start">
                  {/* 좌측 — 안내 카피 (비즈니스 포멀) */}
                  <div>
                    <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold flex items-center gap-2 mb-5">
                      <span className="w-6 h-px bg-brand-500" />
                      Sponsorship Advisor
                    </div>
                    <h2 className="text-[34px] md:text-[52px] font-bold text-ink-900 leading-[1.04] tracking-tight">
                      참가 목표 기반
                      <br />
                      <span className="text-brand-500">맞춤 스폰서십 진단</span>
                    </h2>
                    <p className="text-[14px] md:text-[16px] text-ink-700 mt-6 leading-[1.7] max-w-md">
                      목적·부스 규모·예산·검토 단계 4문항으로 가장 효율 높은
                      노출 조합을 즉시 제안합니다. 클릭 응답 기반,
                      소요 시간 약 1분.
                    </p>
                    <ul className="mt-7 space-y-2.5 text-[13px] text-ink-700 leading-relaxed">
                      {[
                        "목적별 채널 매칭 (런칭·발굴·관계강화·인지도)",
                        "예산 상한에 맞춰 가격 초과 매체 자동 필터",
                        "검토 단계에 따라 카드형·비교표 결과",
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 우측 — 채팅 카드 (첫 질문 노출, 칩 클릭 = 모달 진입) */}
                  <div className="bg-surface border border-ink-100 rounded-card shadow-card overflow-hidden">
                    <div className="px-5 py-3 bg-ink-50 border-b border-ink-100 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-ink-900 grid place-items-center text-white text-[11px] font-bold tracking-wider">
                        SA
                      </div>
                      <div className="text-[12.5px] text-ink-700 font-semibold">
                        Sponsorship Advisor
                        <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-num text-ink-500">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "#10B981" }}
                          />
                          준비됨
                        </span>
                      </div>
                    </div>
                    <div className="p-5 md:p-6 space-y-4">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-ink-900 grid place-items-center text-white text-[10px] font-bold shrink-0 tracking-wider">
                          SA
                        </div>
                        <div className="bg-ink-50 rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13.5px] text-ink-900 max-w-[88%] leading-relaxed">
                          K-PRINT 2026 사무국입니다. 귀사의 참가 목표·부스 규모·예산을
                          바탕으로 가장 효율이 높은 스폰서십 구성을 검토해
                          드립니다. 4개 항목, 약 1분이 소요됩니다.
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-ink-900 grid place-items-center text-white text-[10px] font-bold shrink-0 tracking-wider">
                          SA
                        </div>
                        <div className="bg-ink-50 rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13.5px] text-ink-900 max-w-[88%] leading-relaxed">
                          이번 K-PRINT 참가, 가장 우선하는 목적 하나를 선택해주세요.
                        </div>
                      </div>

                      <div className="pl-10 grid grid-cols-2 gap-2">
                        {[
                          {
                            label: "신제품·신기술 런칭",
                            value: "launch",
                            hint: "세미나·콘텐츠·시그니처",
                          },
                          {
                            label: "신규 거래선·대리점 발굴",
                            value: "acquisition",
                            hint: "검색·도면 노출",
                          },
                          {
                            label: "기존 고객·파트너 강화",
                            value: "retention",
                            hint: "초대장·뉴스레터",
                          },
                          {
                            label: "브랜드 인지도·점유율",
                            value: "awareness",
                            hint: "천장·목걸이·통합",
                          },
                        ].map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => {
                              setAiChatInitial(
                                c.value as
                                  | "launch"
                                  | "acquisition"
                                  | "retention"
                                  | "awareness"
                              );
                              setAiChatOpen(true);
                            }}
                            className="w-full text-left px-3.5 py-3 rounded-2xl border-[1.5px] border-ink-100 hover:border-brand-500 hover:bg-brand-50 transition-colors group"
                          >
                            <div className="text-[13px] font-semibold text-ink-900 leading-tight">
                              {c.label}
                            </div>
                            <div className="text-[11.5px] text-ink-500 mt-0.5">
                              {c.hint}
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="text-center text-[11px] text-ink-400 pt-2 font-num tracking-wider">
                        STEP 1 / 4 · 목적
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>


            {/* 패키지 — 별도 섹션, 필터 무관 */}
            {packages.length > 0 && (
              <section className="border-b border-ink-100 bg-surface">
                <div className="max-w-7xl mx-auto px-6 md:px-16 py-10">
                  <PackageSection packages={packages} eventId={eventId} />
                </div>
              </section>
            )}

            {/* 단품 섹션 상단 고정 바 — 페이지 어디서 스크롤해도 viewport top 에 붙음 */}
            <div className="sticky top-0 z-30 bg-canvas/95 backdrop-blur border-b border-ink-100">
              <div className="max-w-7xl mx-auto px-6 md:px-16 py-3 flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-num text-[10.5px] uppercase tracking-[0.25em] text-ink-500 font-bold">
                    개별 스폰서십
                  </span>
                  <span className="text-[12.5px] text-ink-700">
                    전체{" "}
                    <strong className="text-ink-900 font-num">
                      {totalCount}
                    </strong>
                    개 중{" "}
                    <strong className="text-brand-500 font-num">
                      {filtered.length}
                    </strong>
                    개
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="lg:hidden px-3 py-1.5 rounded-btn border border-ink-100 text-[12.5px] font-semibold flex items-center gap-1.5"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {t("spons.filter", locale)}
                    {hasActiveFilter && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 ml-0.5" />
                    )}
                  </button>
                  <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
              </div>
            </div>

            <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8 px-6 md:px-16 py-10 max-w-7xl mx-auto">

              {/* Desktop sidebar — 상단 바 (sticky 51px) 아래로 붙음 */}
              <aside className="hidden lg:block lg:sticky lg:top-[68px] lg:self-start">
                <FilterPanel
                  search={search}
                  setSearch={setSearch}
                  filterChannel={filterChannel}
                  setFilterChannel={setFilterChannel}
                  budget={budget}
                  setBudget={setBudget}
                  inBudgetCount={inBudgetCount}
                  personas={personas}
                  selectedPersona={selectedPersona}
                  setSelectedPersona={setSelectedPersona}
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
                  taxonomy={taxonomy}
                />
              </aside>

              {/* Grid */}
              <section>
                {/* 페르소나 선택 시 추천 콤보 배너 */}
                {selectedPersona && (
                  <PersonaRecommendation
                    persona={selectedPersona}
                    categories={categories}
                    subcategories={subcategories}
                    slots={slots}
                    packages={packages}
                    eventId={eventId}
                  />
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
                  <CardGrid
                    items={filtered}
                    packages={packages}
                    compareIds={compareIds}
                    onToggleCompare={toggleCompare}
                    onOpenDetail={setDetailModalSlug}
                  />
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
                inBudgetCount={inBudgetCount}
                personas={personas}
                selectedPersona={selectedPersona}
                setSelectedPersona={setSelectedPersona}
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
                taxonomy={taxonomy}
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

      {/* 슬라이드 모드의 floating 카드형 토글은 상단 바에 이미 있어 제거 — 모바일 콘텐츠 하단 영역 확보 */}

      {/* 플로팅 비교 바 — 카드 체크박스로 모은 항목이 있으면 표시 */}
      {compareIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-ink-900 text-white rounded-pill px-2 pl-5 py-2 shadow-2xl flex items-center gap-3 text-[13px] max-w-[90vw]">
          <span className="font-num font-bold">
            {compareIds.size}개 선택됨
          </span>
          <span className="text-white/40">·</span>
          <button
            type="button"
            onClick={clearCompare}
            className="text-[12px] text-white/70 hover:text-white"
          >
            지우기
          </button>
          <Link
            href={`/${eventId}/compare?ids=${encodeURIComponent(
              Array.from(compareIds)
                .map((k) => {
                  // slot-cat:catId → 비교 페이지가 카테고리 단위 비교를 지원하도록 같은 형태로 패스
                  return k;
                })
                .join(",")
            )}`}
            className="ml-1 px-4 py-2 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 transition-colors"
          >
            나란히 비교 →
          </Link>
        </div>
      )}

      {/* 진단 챗봇 v2 — 4문항 룩업 매트릭스 기반 */}
      <SponsorshipDiagnosisChat
        open={aiChatOpen}
        onClose={() => {
          setAiChatOpen(false);
          setAiChatInitial(null);
        }}
        eventName={settings?.event.nameKo ?? eventId}
        eventId={eventId}
        categories={categories}
        subcategories={subcategories}
        packages={packages}
        diagnosisV2Config={settings?.diagnosisV2Config}
        initialQ1={aiChatInitial ?? undefined}
      />

      {/* 도면·사례 상세 모달 — 슬라이드형(SlideSection) 그대로 띄움.
           카드 / 슬라이드 / 모달 — 한 컴포넌트로 통일. iframe 제거. */}
      {detailModalSlug && (() => {
        const item = filtered.find((c) => c.slug === detailModalSlug);
        if (!item) return null;
        const itemIdx = filtered.findIndex((c) => c.slug === detailModalSlug);
        const itemSubs = subcategories
          .filter((s) => s.categoryId === item.id)
          .sort((a, b) => a.order - b.order);
        const itemSlots = slots
          .filter((s) => s.categoryId === item.id)
          .sort((a, b) => a.order - b.order);
        const goPrev =
          itemIdx > 0
            ? () => setDetailModalSlug(filtered[itemIdx - 1].slug)
            : undefined;
        const goNext =
          itemIdx < filtered.length - 1
            ? () => setDetailModalSlug(filtered[itemIdx + 1].slug)
            : undefined;
        return (
          <DetailSlideModal
            item={item}
            subcategories={itemSubs}
            slots={itemSlots}
            index={itemIdx}
            total={filtered.length}
            onPrev={goPrev}
            onNext={goNext}
            onClose={() => setDetailModalSlug(null)}
            onOpenDetail={setDetailModalSlug}
            typeLayouts={settings?.typeLayouts}
            bundledPerks={settings?.bundledPerks}
          />
        );
      })()}
    </>
  );
}

function DetailSlideModal({
  item,
  subcategories,
  slots,
  index,
  total,
  onPrev,
  onNext,
  onClose,
  onOpenDetail,
  typeLayouts,
  bundledPerks,
}: {
  item: EnrichedCategory;
  subcategories: Subcategory[];
  slots: Slot[];
  index: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onOpenDetail: (slug: string) => void;
  typeLayouts?: SiteSettings["typeLayouts"];
  bundledPerks?: SiteSettings["bundledPerks"];
}) {
  // 콜백 최신값을 ref 로 유지 — 매 키 이벤트마다 최신 prev/next 가 호출되되,
  // useEffect 본체는 onPrev/onNext 변경에 재실행되지 않음.
  // (이전 구현: deps 에 onPrev/onNext/onClose 가 들어가 prev/next 누를 때마다
  //  history 가 push/back 을 반복 → 결국 뒤로가기 시 페이지 밖으로 튕겨나가는 버그)
  const handlersRef = useRef({ onClose, onPrev, onNext });
  useEffect(() => {
    handlersRef.current = { onClose, onPrev, onNext };
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      if (e.key === "Escape") h.onClose();
      if (e.key === "ArrowLeft" && h.onPrev) h.onPrev();
      if (e.key === "ArrowRight" && h.onNext) h.onNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // 모달이 페이지처럼 보여서 사용자가 뒤로가기 버튼을 누르는 경우 →
    // history 에 더미 state 를 한 번만 추가하고 popstate 이벤트로 onClose 호출.
    // 결과: 뒤로가기 = 모달 닫기 (페이지 이탈 X)
    let didPush = false;
    if (!window.history.state?.detailModalOpen) {
      window.history.pushState({ detailModalOpen: true }, "");
      didPush = true;
    }
    const onPop = () => handlersRef.current.onClose();
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = "";
      // 닫힐 때 — 우리가 push 한 적 있고 현재 state 가 그대로면 직접 pop.
      // popstate 로 닫혔으면 history 가 이미 빠진 상태라 if 가 false.
      if (didPush && window.history.state?.detailModalOpen) {
        window.history.back();
      }
    };
    // 마운트/언마운트 한 번씩만 실행 — 콜백은 ref 로 전달
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-900/70 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-canvas w-full h-full md:rounded-card md:shadow-2xl md:max-w-[1280px] md:max-h-[92vh] flex flex-col overflow-hidden"
      >
        <header className="px-5 py-3 border-b border-ink-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold">
              스폰서십 상세
            </span>
            <span className="text-[12px] text-ink-500 font-num">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              className="px-3 py-1.5 rounded-btn border border-ink-100 hover:border-ink-900 text-[12px] font-semibold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              title="이전 (←)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              이전
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              className="px-3 py-1.5 rounded-btn border border-ink-100 hover:border-ink-900 text-[12px] font-semibold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              title="다음 (→)"
            >
              다음
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-5 bg-ink-100 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-btn border border-ink-100 hover:border-ink-900 text-[12px] font-semibold flex items-center gap-1"
              title="닫기 (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              닫기
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <SlideSection
            item={item}
            subcategories={subcategories}
            slots={slots}
            index={index}
            total={total}
            onOpenDetail={onOpenDetail}
            inModal
            typeLayouts={typeLayouts}
            bundledPerks={bundledPerks}
          />
        </div>
      </div>
    </div>
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
  inBudgetCount,
  personas,
  selectedPersona,
  setSelectedPersona,
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
  taxonomy,
}: {
  search: string;
  setSearch: (s: string) => void;
  filterChannel: Channel | "all";
  setFilterChannel: (c: Channel | "all") => void;
  budget: number;
  setBudget: (n: number) => void;
  inBudgetCount: number;
  personas: Persona[];
  selectedPersona: Persona | null;
  setSelectedPersona: (p: Persona | null) => void;
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
  taxonomy?: Taxonomy | null;
}) {
  const locale = useLocale((s) => s.locale);
  // taxonomy 도큐먼트의 mediaBuckets / timingBuckets / locationBuckets 우선,
  // 없으면 코드 상수 fallback. 어드민 「분류 관리 > 항목 편집」 변경이 즉시 반영됨.
  const mediaOptions = (taxonomy?.mediaBuckets && taxonomy.mediaBuckets.length > 0
    ? taxonomy.mediaBuckets.map((b) => ({ id: b.id as MediaType, label: b.label }))
    : MEDIA_TYPE_OPTIONS.map((o) => ({
        id: o.id,
        label: localized(o.label, locale),
      })));
  const timingOptions = (taxonomy?.timingBuckets && taxonomy.timingBuckets.length > 0
    ? taxonomy.timingBuckets.map((b) => ({ id: b.id as Timing, label: b.label }))
    : TIMING_OPTIONS.map((o) => ({
        id: o.id,
        label: localized(o.label, locale),
      })));
  const locationOptions = (taxonomy?.locationBuckets && taxonomy.locationBuckets.length > 0
    ? taxonomy.locationBuckets.map((b) => ({
        id: b.id as LocationTag,
        label: b.label,
      }))
    : LOCATION_OPTIONS.map((o) => ({
        id: o.id,
        label: localized(o.label, locale),
      })));

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

      {/* (0) 검색 — 항상 상단 노출 (이메일에서 코드/이름 직접 진입) */}
      <div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("spons.searchPlaceholder", locale)}
            className="w-full pl-9 pr-3 py-2.5 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
          />
        </div>
      </div>

      {/* (1) 예산 — 칩 4개 (진단 챗봇 Q3 와 동일 구간). 슬라이더 제거 (중복). */}
      <FilterSection title={t("spons.budget", locale)}>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: locale === "en" ? "Up to ₩3M" : "300만 이하", value: 3_000_000 },
            { label: locale === "en" ? "Up to ₩7M" : "700만 이하", value: 7_000_000 },
            { label: locale === "en" ? "Up to ₩15M" : "1,500만 이하", value: 15_000_000 },
            { label: locale === "en" ? "All" : "전체", value: 0 },
          ].map((tier) => {
            const active =
              tier.value === 0
                ? budget === 0
                : budget === tier.value;
            return (
              <button
                key={tier.label}
                type="button"
                onClick={() => setBudget(tier.value)}
                className={
                  "px-3 py-2 rounded-btn text-[12px] font-semibold border transition-colors " +
                  (active
                    ? "bg-brand-50 border-brand-500 text-brand-700"
                    : "bg-white border-ink-100 text-ink-700 hover:border-ink-700")
                }
              >
                {tier.label}
              </button>
            );
          })}
        </div>
        {budget > 0 && (
          <div className="mt-2 text-[10.5px] text-ink-500 font-num">
            {inBudgetCount}{locale === "en" ? " items in budget" : "개 매체 표시"}
          </div>
        )}
      </FilterSection>

      {/* (1.5) 페르소나 — 행사별 어드민 설정. 있으면 노출, 없으면 섹션 자체 숨김. */}
      {personas.length > 0 && (
        <FilterSection
          title={locale === "en" ? "Persona" : "페르소나"}
          hint={
            locale === "en"
              ? "Quick path — pre-curated exhibitor profiles"
              : "어떤 회사세요? — 사전 큐레이션"
          }
        >
          <div className="space-y-1.5">
            {personas.map((p) => {
              const active = selectedPersona?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelectedPersona(active ? null : p)
                  }
                  className={
                    "w-full text-left px-3 py-2.5 rounded-btn border transition-colors " +
                    (active
                      ? "bg-brand-50 border-brand-500"
                      : "bg-white border-ink-100 hover:border-ink-700")
                  }
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[16px] shrink-0 leading-none mt-0.5">
                      {p.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold text-ink-900 leading-tight">
                        {p.title}
                      </div>
                      {p.description && (
                        <div className="text-[10.5px] text-ink-500 mt-0.5 leading-snug line-clamp-2">
                          {p.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

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
    new: { label: "신규", bg: "bg-emerald-600", text: "text-white" },
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
  const signature = packages
    .filter((p) => p.tier === "signature")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const standard = packages
    .filter((p) => p.tier !== "signature")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <section className="space-y-10">
      <header className="text-center max-w-3xl mx-auto">
        <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-2">
          PACKAGES
        </div>
        <h2 className="text-[26px] md:text-[34px] font-bold text-ink-900 leading-tight tracking-tight">
          패키지 광고 안내
        </h2>
        <p className="text-[13.5px] md:text-[15px] text-ink-500 mt-2 leading-relaxed">
          단품을 묶어 할인된 가격에 — 전시회 핵심 동선 + 노출 채널을 통합 구성한
          프리미엄 패키지입니다.
        </p>
      </header>

      {signature.length > 0 && (
        <PackageGroup
          label={`Signature Package`}
          sub="전시회 핵심 동선과 주요 노출 지면을 중심으로 구성된 프리미엄 패키지"
          items={signature}
          eventId={eventId}
          locale={locale}
          accent
        />
      )}
      {standard.length > 0 && (
        <PackageGroup
          label={`Standard Package`}
          sub="선택 가능한 스폰서십 항목을 유연하게 구성한 실속형 패키지"
          items={standard}
          eventId={eventId}
          locale={locale}
        />
      )}

      <p className="text-[11.5px] text-ink-500 text-center">
        ※ 패키지 내 광고상품은 별도 표기가 없을 경우 1개 구좌 기준입니다.
      </p>
    </section>
  );
}

function PackageGroup({
  label,
  sub,
  items,
  eventId,
  locale,
  accent,
}: {
  label: string;
  sub: string;
  items: Package[];
  eventId: string;
  locale: Locale;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span
          className={
            "font-num text-[11px] uppercase tracking-[0.25em] font-bold " +
            (accent ? "text-brand-500" : "text-ink-700")
          }
        >
          {label}
        </span>
        <div className="flex-1 h-px bg-ink-100" />
        <span className="text-[11.5px] text-ink-500 hidden md:block">
          {sub}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            eventId={eventId}
            locale={locale}
            accent={accent}
          />
        ))}
      </div>
    </div>
  );
}

function PackageCard({
  pkg,
  eventId,
  locale,
  accent,
}: {
  pkg: Package;
  eventId: string;
  locale: Locale;
  accent?: boolean;
}) {
  const hasDiscount =
    pkg.originalPrice > 0 && pkg.originalPrice > pkg.discountPrice;
  const discountPct = hasDiscount
    ? Math.round(
        ((pkg.originalPrice - pkg.discountPrice) / pkg.originalPrice) * 100
      )
    : 0;

  return (
    <Link
      href={`/${eventId}/packages/${pkg.id}`}
      className={
        "group bg-surface border rounded-card overflow-hidden grid grid-cols-[1fr_auto] transition-all " +
        (accent
          ? "border-ink-100 hover:border-brand-500 hover:shadow-glow-sm"
          : "border-ink-100 hover:border-brand-500 hover:shadow-card")
      }
    >
      {/* 좌측 — 카피·포함 항목 */}
      <div className="px-6 py-6 min-w-0">
        {pkg.tagline && (
          <div className="text-[11.5px] text-brand-500 font-semibold mb-1 leading-snug line-clamp-2">
            {pkg.tagline}
          </div>
        )}
        <div className="text-[22px] md:text-[26px] font-bold text-ink-900 group-hover:text-brand-500 tracking-tight leading-tight">
          {localized(pkg.name, locale)}
        </div>

        {pkg.includedItems && pkg.includedItems.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {pkg.includedItems.map((it, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13.5px] text-ink-900 leading-snug"
              >
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full mt-2 shrink-0 " +
                    (accent ? "bg-brand-500" : "bg-ink-400")
                  }
                />
                <span>{it.label}</span>
              </li>
            ))}
          </ul>
        )}

        {pkg.priceNote && (
          <p className="text-[11px] text-ink-500 mt-3 leading-snug">
            {pkg.priceNote}
          </p>
        )}
      </div>

      {/* 우측 — 가격 column (세로 구분선) */}
      <div className="border-l border-ink-100 px-5 py-6 flex flex-col items-end justify-center min-w-[160px]">
        {hasDiscount && (
          <>
            <div className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
              <span>기존</span>
              <span className="line-through font-num">
                {pkg.originalPrice.toLocaleString()}원
              </span>
            </div>
            <div className="text-[10px] font-num font-bold text-brand-500 mt-0.5">
              {discountPct}% OFF
            </div>
          </>
        )}
        <div className="flex items-baseline gap-1.5 mt-1.5">
          <span className="text-[11.5px] text-ink-900 font-semibold">
            할인가
          </span>
          {pkg.discountPrice > 0 ? (
            <span
              className={
                "font-num font-bold leading-none " +
                (accent ? "text-[20px] text-brand-700" : "text-[18px] text-ink-900")
              }
            >
              {pkg.discountPrice.toLocaleString()}
              <span className="text-[11px] ml-0.5 font-semibold">원</span>
            </span>
          ) : (
            <span className="text-[12.5px] text-ink-500">문의</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CardGrid({
  items,
  packages,
  compareIds,
  onToggleCompare,
  onOpenDetail,
}: {
  items: EnrichedCategory[];
  packages: Package[];
  compareIds: Set<string>;
  onToggleCompare: (key: string) => void;
  onOpenDetail: (slug: string) => void;
}) {
  const locale = useLocale((s) => s.locale);
  const packagesById = useMemo(() => {
    const m = new Map<string, Package>();
    packages.forEach((p) => m.set(p.id, p));
    return m;
  }, [packages]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((c) => {
        const hero = c.heroImages?.images?.[0]?.url;
        const compareKey = `slot-cat:${c.id}`; // 카테고리 단위로 비교 추가 (대표 슬롯 자동 선정은 compare 페이지에서)
        const inCompare = compareIds.has(compareKey);
        return (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetail(c.slug)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDetail(c.slug);
              }
            }}
            className="group bg-surface border border-ink-100 rounded-card overflow-hidden hover:border-brand-500 hover:shadow-card transition-all flex flex-col h-full relative text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              {/* 비교 체크박스 — 우상단 */}
              <button
                type="button"
                aria-pressed={inCompare}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleCompare(compareKey);
                }}
                className={
                  "absolute top-3 right-3 w-8 h-8 rounded-full grid place-items-center transition-all shadow-card " +
                  (inCompare
                    ? "bg-brand-500 text-white"
                    : "bg-white/90 text-ink-500 hover:bg-white hover:text-brand-500")
                }
                title={inCompare ? "비교에서 빼기" : "비교에 추가"}
              >
                {inCompare ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none stroke-[3]" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="text-[16px] leading-none font-bold">+</span>
                )}
              </button>
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

              {/* 이 카테고리를 포함하는 패키지 크로스 표시 — 패키지 매력 살리기 */}
              {(() => {
                const pkgs = (c.inPackages ?? [])
                  .map((id) => packagesById.get(id))
                  .filter((p): p is Package => !!p);
                if (pkgs.length === 0) return null;
                return (
                  <div className="mt-2 text-[10.5px] text-ink-500 leading-snug">
                    <span className="font-num font-semibold text-ink-700">
                      📦 {locale === "en" ? "In packages:" : "포함 패키지:"}{" "}
                    </span>
                    {pkgs
                      .slice(0, 2)
                      .map(
                        (p) =>
                          (p.tier === "signature" ? "★ " : "") +
                          localized(p.name, locale)
                      )
                      .join(", ")}
                    {pkgs.length > 2 &&
                      (locale === "en"
                        ? ` +${pkgs.length - 2}`
                        : ` 외 ${pkgs.length - 2}`)}
                  </div>
                );
              })()}

              {/* 작년 이 자리 산 회사 — 사회적 증거 */}
              {c.lastYear?.buyers && c.lastYear.buyers.length > 0 && (
                <div className="mt-3 text-[10.5px] text-ink-500 leading-snug">
                  <span className="font-num font-bold text-ink-700">
                    {locale === "en" ? "Last year: " : "작년: "}
                  </span>
                  {c.lastYear.buyers.slice(0, 3).join(", ")}
                  {c.lastYear.buyers.length > 3 &&
                    (locale === "en"
                      ? ` +${c.lastYear.buyers.length - 3}`
                      : ` 외 ${c.lastYear.buyers.length - 3}곳`)}
                </div>
              )}
              {c.lastYear?.soldOutDate && (
                <div className="text-[10.5px] text-amber-700 font-num font-semibold mt-1">
                  {locale === "en" ? "Sold out: " : "작년 매진: "}
                  {c.lastYear.soldOutDate}
                </div>
              )}

              <div className="mt-auto pt-4 flex items-center justify-between text-[11.5px] font-num">
                <span>
                  {c.minPrice > 0 ? (
                    <>
                      <span className="text-ink-500">{t("spons.minPrice", locale)} </span>
                      <span className="text-ink-900 font-bold">
                        {locale === "en" ? "₩" : ""}
                        {c.minPrice.toLocaleString()}
                        {locale === "en" ? "" : "원"}
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
          </div>
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
  onOpenDetail,
  typeLayouts,
  bundledPerks,
}: {
  items: EnrichedCategory[];
  subcategories: Subcategory[];
  slots: Slot[];
  totalCount: number;
  onCardMode: () => void;
  onOpenFilter: () => void;
  hasActiveFilter: boolean;
  eventId: string;
  onOpenDetail: (slug: string) => void;
  typeLayouts?: SiteSettings["typeLayouts"];
  bundledPerks?: SiteSettings["bundledPerks"];
}) {
  const locale = useLocale((s) => s.locale);
  return (
    <>
      {/* 상단 고정 바 — 모바일은 핵심만 (홈 아이콘 / 카운트 / 필터 / 카드형) */}
      <div className="fixed top-0 inset-x-0 z-20 bg-white/90 backdrop-blur border-b border-ink-100 px-3 md:px-8 h-14 flex items-center gap-2 md:gap-3 overflow-hidden">
        <Link
          href={`/${eventId}`}
          className="text-[12px] text-ink-500 hover:text-ink-900 flex items-center gap-1 shrink-0"
          title={t("common.home", locale)}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("common.home", locale)}</span>
        </Link>
        <span className="text-ink-300 hidden sm:inline">/</span>
        <span className="text-[13px] font-bold text-ink-900 hidden sm:inline">
          {t("spons.title", locale)}
        </span>
        {/* 카운트 — 모바일 짧게 X/Y, 데스크톱 상세 */}
        <span className="text-[12px] text-ink-500 truncate min-w-0">
          <span className="md:hidden font-num">
            <strong className="text-brand-700">{items.length}</strong>
            <span className="text-ink-300 mx-0.5">/</span>
            <strong className="text-ink-900">{totalCount}</strong>
          </span>
          <span className="hidden md:inline">
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
        </span>
        <span className="ml-auto" />
        {/* 데스크톱 전용 — 로케일 / PDF */}
        <div className="hidden md:flex items-center gap-3">
          <LocaleSwitch size="sm" />
          <Link
            href={`/${eventId}/print/full`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-btn border border-ink-100 hover:border-ink-900 text-[12px] font-semibold flex items-center gap-1"
            title="전체 PDF 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
            전체 PDF
          </Link>
        </div>
        <button
          type="button"
          onClick={onOpenFilter}
          className="px-2.5 py-1.5 rounded-btn border border-ink-100 text-[12px] font-semibold flex items-center gap-1 shrink-0"
          title={t("spons.filter", locale)}
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("spons.filter", locale)}</span>
          {hasActiveFilter && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onCardMode}
          className="px-2.5 py-1.5 rounded-btn bg-ink-900 text-white hover:bg-brand-500 hover:text-ink-900 text-[12px] font-semibold flex items-center gap-1 shrink-0"
          title={t("spons.viewCard", locale)}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {t("spons.viewCard", locale)}
          </span>
        </button>
      </div>

      {items.length === 0 ? (
        <main className="h-dvh pt-14 grid place-items-center bg-canvas">
          <div className="text-center text-sm text-ink-500">
            {t("spons.filterEmpty", locale)}
          </div>
        </main>
      ) : (
        // 데스크톱·모바일 모두 한 화면당 1 슬라이드 snap.
        // h-dvh 사용 — 모바일 브라우저 toolbar 등장/숨김 시 실제 보이는 영역에 정확히 맞춤.
        // (h-screen 은 100vh 고정이라 사파리에서 toolbar 영역만큼 잘림.)
        <main className="bg-canvas h-dvh overflow-y-scroll snap-y snap-mandatory scroll-smooth">
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
                onOpenDetail={onOpenDetail}
                typeLayouts={typeLayouts}
                bundledPerks={bundledPerks}
                // 슬라이드 모드는 이미 풀스크린이라 '자세히 보기' 버튼이 같은 화면을 한 번 더 모달로
                // 띄우는 중복이 됨. 데스크톱·모바일 모두 자세히 보기 숨김.
                inModal
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
  onOpenDetail,
  inModal = false,
  typeLayouts,
  bundledPerks,
}: {
  item: EnrichedCategory;
  subcategories: Subcategory[];
  slots: Slot[];
  index: number;
  total: number;
  onOpenDetail: (slug: string) => void;
  /** 모달 컨텍스트에서 렌더될 때는 "자세히 보기" 버튼 숨김 — 이미 자세히 본 상태이므로 의미 없음 */
  inModal?: boolean;
  /** SiteSettings.typeLayouts — 유형별 스펙 행 순서/노출 override */
  typeLayouts?: SiteSettings["typeLayouts"];
  /** SiteSettings.bundledPerks — 스폰서십 신청 시 동봉되는 추가 혜택 */
  bundledPerks?: SiteSettings["bundledPerks"];
}) {
  const locale = useLocale((s) => s.locale);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const hero = item.heroImages?.images?.[0]?.url;
  // 도면 보기 가능 — floor_plan / xpace 타입 + 도면 이미지가 있을 때만 노출
  const hasFloorImages =
    (item.type === "floor_plan" || item.type === "xpace") &&
    !!item.floorImages &&
    item.floorImages.length > 0;
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

  // 게재 위치 — subcategory 이름 목록 (도면형/XPACE 처럼 위치 의미가 있는 타입만 표시)
  const showsLocation =
    item.type === "floor_plan" || item.type === "xpace";
  const locationLabel = showsLocation
    ? subcategories
        .map((s) => localized(s.name, locale))
        .filter(Boolean)
        .join(", ")
    : "";

  // 세부사항 — 각 subcategory 의 (이름 + 해당 슬롯 수 + 단위)
  // 예: "A1 출입구 5구좌, A2 출입구 4구좌, B홀 2구좌, ..."
  const detailLabel = (() => {
    if (subcategories.length === 0) return "";
    return subcategories
      .map((s) => {
        const count = slots.filter((sl) => sl.subcategoryId === s.id).length;
        if (count === 0) return null;
        const unit = localized(s.unit, locale) || "구좌";
        return `${localized(s.name, locale)} ${count}${unit}`;
      })
      .filter(Boolean)
      .join(", ");
  })();

  // 해시태그 — 채널만 (예: '오프라인'). 카테고리.tags 는 너무 잡다해서 슬라이드에서는 제외.
  const hashTags: string[] = [channelLabel(item.channel, locale)];

  // 유형별 레이아웃 옵션 (해시태그·작년 데이터·혜택 배너·제목 크기·커스텀 행)
  const layout = getTypeLayout(item.type, typeLayouts);
  const showHashtags = layout.showHashtags !== false;
  const showLastYear = layout.showLastYear !== false;
  const showPerksBanner = layout.showPerksBanner !== false;
  const titleSize = layout.titleSize ?? "large";
  const titleMaxPx =
    titleSize === "small" ? 36 : titleSize === "medium" ? 44 : 56;

  return (
    <>
      {/* ─── 모바일 전용 컴팩트 슬라이드 (한 화면당 1구좌 snap) ─── */}
      {/* h-dvh 로 모바일 브라우저 toolbar 영역 제외한 실제 보이는 viewport 에 정확히 맞춤. */}
      <section className="md:hidden h-dvh snap-start bg-canvas pt-14 relative overflow-hidden flex flex-col">
        {/* 이미지 — 상단 30vh (toolbar 등장 시에도 잘림 없게 보수적으로) */}
        <div className="h-[30dvh] bg-ink-100 relative overflow-hidden shrink-0">
          <HeroMedia
            videoUrl={item.heroVideoUrl}
            imageUrl={hero}
            alt={localized(item.name, locale)}
            locale={locale}
          />
          {/* 채널 + 코드 — 이미지 위 우측 상단 */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider bg-white/95 text-ink-900 px-2 py-0.5 rounded font-bold">
              {channelLabel(item.channel, locale)}
            </span>
            <span className="text-[10px] font-num tracking-wider bg-ink-900/85 text-white px-2 py-0.5 rounded font-bold">
              #{item.code}
            </span>
          </div>
          {/* 잔여 자리 — 한정일 때만, 좌하단 */}
          {item.slotTotal > 0 && item.slotAvailable > 0 && (
            <div className="absolute bottom-3 left-3">
              <span className="px-2 py-1 rounded-pill bg-ink-900 text-white text-[10.5px] font-num font-bold shadow-card">
                잔여 {item.slotAvailable}/{item.slotTotal}
              </span>
            </div>
          )}
        </div>

        {/* 정보 — 하단 나머지, 컴팩트 */}
        <div className="flex-1 min-h-0 flex flex-col px-4 py-3 overflow-hidden">
          {/* 제목 */}
          <h2 className="text-[20px] font-bold text-ink-900 leading-[1.15] tracking-tight">
            {localized(item.name, locale)}
          </h2>
          {item.shortDesc && (
            <p className="text-[11.5px] text-ink-500 mt-1 leading-snug line-clamp-1">
              {item.shortDesc}
            </p>
          )}

          {/* 스펙 — 어드민 type-layout 의 specFields 따라 최대 3개, 각 행 한 줄 truncate */}
          {(() => {
            const rows: Array<{ label: string; value: string }> = [];
            for (const field of layout.specFields) {
              if (rows.length >= 3) break;
              switch (field) {
                case "location":
                  if (locationLabel)
                    rows.push({ label: "위치", value: locationLabel });
                  break;
                case "size":
                  if (item.size)
                    rows.push({ label: "사이즈", value: item.size });
                  break;
                case "fileFormat":
                  if (item.fileFormat)
                    rows.push({ label: "파일", value: item.fileFormat });
                  break;
                case "deadline":
                  if (deadlineStr)
                    rows.push({ label: "마감", value: deadlineStr });
                  break;
                case "detail":
                  if (detailLabel)
                    rows.push({ label: "세부", value: detailLabel });
                  break;
                case "slots":
                  if (item.slotTotal > 0)
                    rows.push({
                      label: "구좌",
                      value: `${item.slotAvailable}/${item.slotTotal} 가능`,
                    });
                  break;
                case "video":
                  if (item.videoSpec) {
                    const v = item.videoSpec;
                    const parts: string[] = [];
                    if (v.duration) parts.push(`${v.duration}초`);
                    if (v.resolution) parts.push(v.resolution);
                    if (v.plays)
                      parts.push(`${v.plays.toLocaleString()}회`);
                    if (parts.length)
                      rows.push({ label: "영상", value: parts.join(" · ") });
                  }
                  break;
                case "mailing":
                  if (item.mailingSpec) {
                    const m = item.mailingSpec;
                    const parts: string[] = [];
                    if (m.audience)
                      parts.push(`${m.audience.toLocaleString()}명`);
                    if (m.sendDates?.length)
                      parts.push(m.sendDates.join(", "));
                    if (parts.length)
                      rows.push({ label: "발송", value: parts.join(" · ") });
                  }
                  break;
                case "content":
                  if (item.contentSpec) {
                    const c = item.contentSpec;
                    const val = [c.channel, c.format]
                      .filter(Boolean)
                      .join(" · ");
                    if (val) rows.push({ label: "콘텐츠", value: val });
                  }
                  break;
              }
            }
            // 어드민 커스텀 행도 끝에 (총 3개 한도 내)
            (layout.customRows ?? []).forEach((c) => {
              if (rows.length >= 3) return;
              if (c.label.trim() || c.value.trim()) {
                rows.push({ label: c.label, value: c.value });
              }
            });
            if (rows.length === 0) return null;
            return (
              <dl className="mt-2.5 space-y-1 text-[11px]">
                {rows.map((r, i) => (
                  <div key={i} className="flex gap-2 min-w-0">
                    <dt className="text-ink-500 w-10 shrink-0 font-semibold">
                      {r.label}
                    </dt>
                    <dd className="text-ink-900 font-semibold truncate min-w-0 flex-1">
                      {r.value}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          })()}

          {/* 가격 — 강조 */}
          <div className="mt-auto pt-2.5 border-t border-ink-100">
            <div className="flex items-end justify-between gap-3">
              {item.minPrice > 0 ? (
                <div>
                  <div className="text-[10px] text-ink-500 font-semibold">
                    1구좌당
                  </div>
                  <div className="font-num text-[22px] font-bold text-ink-900 leading-none">
                    {item.minPrice.toLocaleString()}
                    <span className="text-[12px] ml-1 font-bold">
                      {t("common.won", locale)}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-[14px] text-ink-500 font-semibold">
                  {t("common.priceNegotiable", locale)}
                </span>
              )}
              {/* 페이지 인디케이터 */}
              <div className="font-mono tracking-widest text-ink-300 text-[10.5px]">
                <span className="text-ink-700 font-bold">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mx-0.5">/</span>
                {String(total).padStart(2, "0")}
              </div>
            </div>
          </div>

          {/* CTA — 도면 있으면 위치 보기, 없고 모달 외부면 자세히 보기 */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="h-10 rounded-btn bg-ink-900 text-white font-bold text-[12.5px]"
            >
              구좌 선택
            </button>
            {hasFloorImages ? (
              <button
                type="button"
                onClick={() => setFloorOpen(true)}
                className="h-10 rounded-btn border-2 border-ink-900 text-ink-900 font-bold text-[12.5px]"
              >
                위치 보기
              </button>
            ) : !inModal ? (
              <button
                type="button"
                onClick={() => onOpenDetail(item.slug)}
                className="h-10 rounded-btn border-2 border-ink-900 text-ink-900 font-bold text-[12.5px]"
              >
                자세히 보기
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── 데스크톱 전용 (md+) 풀 슬라이드 ──────────────── */}
      {/* inModal 일 때는 모달 컨테이너(max-h 92vh)에 맞춰 자연 height — h-screen/snap/overflow 제거 */}
      <section
        className={
          "hidden md:block bg-canvas pt-14 relative " +
          (inModal ? "" : "h-screen snap-start overflow-hidden")
        }
      >
        <div
          className={
            "max-w-7xl mx-auto px-6 md:px-12 py-6 md:py-8 grid lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-12 items-stretch " +
            (inModal ? "" : "h-full")
          }
        >
          {/* LEFT: 정보 — 세로 중앙 정렬하여 빈공간 분산 */}
          <div className="flex flex-col justify-center min-w-0 min-h-0">
            {/* 해시태그 — layout.showHashtags 가 false 면 숨김 */}
            {showHashtags && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] md:text-[14px] tracking-wide text-brand-500 font-bold mb-4 font-num">
                {hashTags.map((tag, i) => (
                  <span key={i}>#{tag}</span>
                ))}
              </div>
            )}

            {/* 거대한 카테고리 명 + 코드 — 제목은 너비에 맞춰 자동 축소 (한 줄 유지) */}
            <div className="flex items-baseline gap-3 min-w-0">
              <AutoFitHeading
                text={localized(item.name, locale)}
                maxPx={titleMaxPx}
                minPx={18}
                className="flex-1 font-bold leading-[0.95] tracking-tight text-ink-900"
              />
              <span className="text-[14px] md:text-[18px] text-ink-300 font-num shrink-0">
                #{item.code}
              </span>
            </div>

            {/* 한 줄 설명 */}
            {item.shortDesc && (
              <p className="text-[13px] md:text-[14px] text-ink-700 mt-3 leading-relaxed max-w-xl">
                {item.shortDesc}
              </p>
            )}

            <hr className="border-ink-100 my-6" />

            {/* 스펙 표 — 어드민의 typeLayouts 설정 (또는 기본 레이아웃) 기반으로 행 노출.
                /admin/settings/type-layouts 에서 유형별로 어떤 행을 어떤 순서로 보일지 조정 가능. */}
            <dl className="space-y-3">
              {(() => {
                const layout = getTypeLayout(item.type, typeLayouts);
                const rows: React.ReactNode[] = [];
                for (const field of layout.specFields) {
                  switch (field) {
                    case "location": {
                      if (locationLabel)
                        rows.push(
                          <SpecRow
                            key="location"
                            label="게재 위치"
                            value={locationLabel}
                          />
                        );
                      break;
                    }
                    case "size": {
                      if (item.size)
                        rows.push(
                          <SpecRow
                            key="size"
                            label={t("spons.size", locale)}
                            value={item.size}
                          />
                        );
                      break;
                    }
                    case "fileFormat": {
                      if (item.fileFormat)
                        rows.push(
                          <SpecRow
                            key="fileFormat"
                            label={t("spons.fileFormat", locale)}
                            value={item.fileFormat}
                          />
                        );
                      break;
                    }
                    case "deadline": {
                      if (deadlineStr)
                        rows.push(
                          <SpecRow
                            key="deadline"
                            label={t("spons.submitDeadline", locale)}
                            value={deadlineStr}
                          />
                        );
                      break;
                    }
                    case "detail": {
                      if (detailLabel)
                        rows.push(
                          <SpecRow
                            key="detail"
                            label="세부사항"
                            value={
                              <span>
                                {detailLabel}
                                {item.slotTotal > 0 && (
                                  <span className="ml-2 text-ink-500 font-medium">
                                    (잔여{" "}
                                    <span className="text-brand-500 font-bold">
                                      {item.slotAvailable}
                                    </span>
                                    )
                                  </span>
                                )}
                              </span>
                            }
                          />
                        );
                      break;
                    }
                    case "slots": {
                      rows.push(
                        <SpecRow
                          key="slots"
                          label={t("spons.slots", locale)}
                          value={
                            <>
                              <span className="text-brand-500 font-bold">
                                {item.slotAvailable}
                              </span>
                              <span className="text-ink-500">
                                {" "}
                                / {item.slotTotal}{" "}
                                {t("spons.slotsAvailable", locale)}
                              </span>
                            </>
                          }
                        />
                      );
                      break;
                    }
                    case "video": {
                      const v = item.videoSpec;
                      if (v && (v.duration || v.resolution || v.plays)) {
                        const parts: string[] = [];
                        if (v.duration) parts.push(`${v.duration}초`);
                        if (v.resolution) parts.push(v.resolution);
                        if (v.plays)
                          parts.push(`${v.plays.toLocaleString()}회 송출`);
                        rows.push(
                          <SpecRow
                            key="video"
                            label="영상 스펙"
                            value={parts.join(" · ")}
                          />
                        );
                      }
                      break;
                    }
                    case "mailing": {
                      const m = item.mailingSpec;
                      if (m && (m.audience || m.sendDates?.length)) {
                        const parts: string[] = [];
                        if (m.audience)
                          parts.push(
                            `${m.audience.toLocaleString()}명${
                              m.audienceLabel ? ` (${m.audienceLabel})` : ""
                            }`
                          );
                        if (m.sendDates?.length)
                          parts.push(`발송: ${m.sendDates.join(", ")}`);
                        rows.push(
                          <SpecRow
                            key="mailing"
                            label="발송 스펙"
                            value={parts.join(" · ")}
                          />
                        );
                      }
                      break;
                    }
                    case "content": {
                      const c = item.contentSpec;
                      if (c && (c.channel || c.format)) {
                        rows.push(
                          <SpecRow
                            key="content"
                            label="콘텐츠 스펙"
                            value={[c.channel, c.format]
                              .filter(Boolean)
                              .join(" · ")}
                          />
                        );
                      }
                      break;
                    }
                  }
                }
                // 커스텀 정적 행들 — 어드민이 type-layout 에서 추가한 행
                (layout.customRows ?? []).forEach((c, ci) => {
                  if (!c.label.trim() && !c.value.trim()) return;
                  rows.push(
                    <SpecRow
                      key={`custom-${ci}`}
                      label={c.label}
                      value={c.value}
                    />
                  );
                });
                return rows;
              })()}
            </dl>

            {/* 잔여 강조 + 작년 데이터 — layout.showLastYear 가 false 면 숨김 */}
            {showLastYear &&
              (item.lastYear?.buyers?.length ||
                item.lastYear?.soldOutDate) && (
                <div className="mt-4 text-[11.5px] text-ink-500 leading-snug">
                  {item.lastYear?.buyers &&
                    item.lastYear.buyers.length > 0 && (
                      <div>
                        <span className="font-num font-bold text-ink-700">
                          작년:{" "}
                        </span>
                        {item.lastYear.buyers.slice(0, 3).join(", ")}
                        {item.lastYear.buyers.length > 3 &&
                          ` 외 ${item.lastYear.buyers.length - 3}곳`}
                      </div>
                    )}
                  {item.lastYear?.soldOutDate && (
                    <div className="text-amber-700 font-num font-semibold mt-0.5">
                      작년 매진: {item.lastYear.soldOutDate}
                    </div>
                  )}
                </div>
              )}

            {/* 동봉 혜택 미니 배너 — layout.showPerksBanner 가 false 면 숨김 */}
            {showPerksBanner &&
              (() => {
              const allPerks = bundledPerks ?? DEFAULT_BUNDLED_PERKS;
              const perks = filterPerksForContext(allPerks, item.code);
              if (perks.length === 0) return null;
              const totalValue = calcPerksTotalValue(perks);
              return (
                <div className="mt-5 px-3.5 py-2.5 rounded-btn bg-gradient-to-r from-brand-50 to-canvas border border-brand-100 flex items-center gap-3 text-[12px]">
                  <span className="text-brand-700 font-bold flex items-center gap-1.5 shrink-0">
                    <span aria-hidden>🎁</span>
                    스폰서십 신청 시
                  </span>
                  <span className="text-ink-700 flex-1 truncate">
                    <strong className="text-ink-900">
                      추가 혜택 {perks.length}개
                    </strong>
                    {totalValue > 0 && (
                      <span className="ml-1.5 text-ink-500">
                        · 총 {totalValue.toLocaleString()}원 상당
                      </span>
                    )}{" "}
                    자동 동봉
                  </span>
                </div>
              );
            })()}

            {/* 버튼: 구좌 선택 / [위치 보기 (도면 있을 때만)] / [자세히 보기 — 모달 외부에서만] / 가이드 다운로드.
                모바일은 세로 스택, 데스크톱은 가로 */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex-1 h-12 rounded-btn bg-ink-900 text-white hover:bg-ink-700 font-bold text-[13.5px] transition-colors"
              >
                구좌 선택하기
              </button>
              {hasFloorImages && (
                <button
                  type="button"
                  onClick={() => setFloorOpen(true)}
                  className="flex-1 h-12 rounded-btn border-2 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white font-bold text-[13.5px] transition-colors"
                >
                  위치 보기
                </button>
              )}
              {!inModal && (
                <button
                  type="button"
                  onClick={() => onOpenDetail(item.slug)}
                  className="flex-1 h-12 rounded-btn border-2 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white font-bold text-[13.5px] transition-colors"
                >
                  자세히 보기
                </button>
              )}
              {item.designGuideFileUrl && (
                <a
                  href={item.designGuideFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-12 rounded-btn border-2 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white font-bold text-[13.5px] transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  가이드 다운로드
                </a>
              )}
            </div>

            {/* 가격 — 큰 텍스트 (타겟 레이아웃) */}
            <div className="mt-6 pt-6 border-t border-ink-100 flex items-end justify-end gap-3">
              {item.minPrice > 0 ? (
                <div className="text-right">
                  <div className="font-num text-[28px] md:text-[36px] font-bold text-ink-900 leading-none">
                    <span className="text-[16px] md:text-[18px] font-semibold mr-2">
                      {locale === "en" ? "Per slot" : "1구좌당"}
                    </span>
                    {item.minPrice.toLocaleString()}
                    <span className="text-[18px] md:text-[20px] ml-1 font-bold">
                      {t("common.won", locale)}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-ink-500 mt-2">
                    {locale === "en"
                      ? "(Production & install included, VAT excluded)"
                      : "(제작설치비 포함, 부가세 별도)"}
                  </p>
                </div>
              ) : (
                <span className="text-[16px] text-ink-500 font-semibold">
                  {t("common.priceNegotiable", locale)}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: 큰 hero 영역 — heroVideoUrl 가 있으면 영상, 없으면 첫 이미지 */}
          <div className="flex items-center min-h-0">
            <div
              className="w-full rounded-card bg-ink-100 overflow-hidden border border-ink-100 relative shadow-card"
              style={{ aspectRatio: "4 / 3" }}
            >
              <HeroMedia
                videoUrl={item.heroVideoUrl}
                imageUrl={hero}
                alt={localized(item.name, locale)}
                locale={locale}
              />
            </div>
          </div>
        </div>

        {/* 페이지 번호 */}
        <div className="absolute bottom-3 right-6 md:right-12 font-mono tracking-widest text-ink-300 text-[12px] pointer-events-none">
          <span className="text-ink-700 font-bold">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="mx-1">/</span>
          {String(total).padStart(2, "0")}
        </div>
      </section>

      {/* 구좌 선택 모달 — 16:9 슬라이드 밖에서 처리 */}
      {pickerOpen && subcategories.length > 0 && (
        <SlotPickerModal
          item={item}
          subcategories={subcategories}
          slots={slots}
          onClose={() => setPickerOpen(false)}
          onOpenDetail={(slug) => {
            setPickerOpen(false);
            onOpenDetail(slug);
          }}
        />
      )}

      {/* 도면 위치 모달 — floor_plan / xpace 카테고리에서 floorImages 있으면 */}
      {floorOpen && hasFloorImages && (
        <FloorMapModal
          item={item}
          subcategories={subcategories}
          slots={slots}
          onClose={() => setFloorOpen(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// FloorMapModal — floor_plan / xpace 카테고리의 도면(들) + 핀 위치 미리보기.
// 슬라이드/카드의 '위치 보기' 버튼에서 진입. PinOverlay 는 cart 와 묶여있어
// 무겁고, 여기서는 가벼운 이미지 + 핀 표시만으로 충분.
// ============================================================================

function FloorMapModal({
  item,
  subcategories,
  slots,
  onClose,
}: {
  item: EnrichedCategory;
  subcategories: Subcategory[];
  slots: Slot[];
  onClose: () => void;
}) {
  const locale = useLocale((s) => s.locale);
  // 첫번째 도면을 기본 노출. 도면이 여러 장이면 탭으로.
  const floorImages = item.floorImages ?? [];
  const [active, setActive] = useState(0);
  const current = floorImages[active];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!current) return null;

  // 도면별 소분류 (탭 라벨용)
  const subById = new Map(subcategories.map((s) => [s.id, s]));
  // 도면의 핀 — 슬롯 status 별로 색상
  const slotById = new Map(slots.map((s) => [s.id, s]));

  return (
    <div
      className="fixed inset-0 z-[70] bg-ink-900/80 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-canvas w-full h-full md:rounded-card md:shadow-2xl md:max-w-[1024px] md:max-h-[88vh] flex flex-col overflow-hidden"
      >
        <header className="px-5 py-3 border-b border-ink-100 bg-white flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="font-num text-[10.5px] uppercase tracking-[0.3em] text-brand-500 font-bold">
              위치 / 도면
            </div>
            <h3 className="text-[15px] font-bold text-ink-900 truncate">
              {localized(item.name, locale)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-ink-50 text-ink-500"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* 도면이 여러 장이면 탭 */}
        {floorImages.length > 1 && (
          <div className="px-5 py-2 border-b border-ink-100 bg-white flex flex-wrap gap-1.5 shrink-0">
            {floorImages.map((fi, i) => {
              const sub = subById.get(fi.subcategoryId);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={
                    "px-3 py-1 rounded-pill text-[12px] font-semibold border transition-colors " +
                    (i === active
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white text-ink-700 border-ink-100 hover:border-ink-700")
                  }
                >
                  {sub ? localized(sub.name, locale) : `도면 ${i + 1}`}
                </button>
              );
            })}
          </div>
        )}

        {/* 도면 이미지 + 핀 */}
        <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
          <div className="relative w-full mx-auto bg-ink-50 rounded-card overflow-hidden border border-ink-100 aspect-[4/3] max-w-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={`${localized(item.name, locale)} 도면`}
              className="absolute inset-0 w-full h-full object-contain block select-none"
              draggable={false}
            />
            {/* 핀 — 슬롯 상태별 색상 */}
            {current.pins.map((pin, i) => {
              const slot = slotById.get(pin.slotId);
              const isAvailable = slot?.status === "available";
              return (
                <span
                  key={i}
                  className={
                    "absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full grid place-items-center text-[10px] font-num font-bold shadow-card border-2 " +
                    (isAvailable
                      ? "bg-brand-500 text-white border-white"
                      : "bg-ink-300 text-white border-white")
                  }
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  title={slot?.code ?? pin.slotId}
                >
                  {i + 1}
                </span>
              );
            })}
          </div>
          <div className="mt-4 text-[12px] text-ink-500 leading-relaxed text-center">
            <span className="inline-flex items-center gap-1.5 mr-3">
              <span className="w-3 h-3 rounded-full bg-brand-500" />
              가용
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-ink-300" />
              매진/예약
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotPickerModal({
  item,
  subcategories,
  slots,
  onClose,
  onOpenDetail,
}: {
  item: EnrichedCategory;
  subcategories: Subcategory[];
  slots: Slot[];
  onClose: () => void;
  onOpenDetail: (slug: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full max-w-3xl max-h-[88vh] rounded-card shadow-2xl overflow-hidden flex flex-col"
      >
        <header className="px-6 py-4 border-b border-ink-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold flex items-center gap-2">
              <span className="w-4 h-px bg-brand-500" />
              구좌 선택
            </div>
            <h3 className="text-[20px] md:text-[24px] font-bold text-ink-900 mt-1 tracking-tight">
              {item.name.ko}
              <span className="ml-2 text-[14px] text-ink-300 font-num">
                #{item.code}
              </span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-btn hover:bg-ink-50 text-ink-500 shrink-0"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <SlotPicker
            categoryId={item.id}
            eventId={item.eventId}
            subcategories={subcategories}
            slots={slots}
          />
        </div>
        <footer className="px-6 py-4 border-t border-ink-100 flex items-center justify-between gap-3 flex-wrap shrink-0">
          <p className="text-[11.5px] text-ink-500">
            구좌를 클릭하면 카트에 담기고, 우상단에서 확인할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => onOpenDetail(item.slug)}
            className="text-[12.5px] font-num font-bold text-brand-500 hover:text-brand-700 flex items-center gap-1"
          >
            자세히 보기
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </footer>
      </div>
    </div>
  );
}

// 슬라이드 히어로 영역 — 영상 URL 있으면 영상, 없으면 이미지 fallback.
// YouTube / Vimeo / Drive / Firebase Storage / 직접 mp4 등 모두 지원.
function HeroMedia({
  videoUrl,
  imageUrl,
  alt,
  locale,
}: {
  videoUrl?: string;
  imageUrl?: string;
  alt: string;
  locale: "ko" | "en";
}) {
  const embed = videoUrl ? heroVideoEmbed(videoUrl) : null;
  if (embed?.kind === "iframe") {
    return (
      <iframe
        src={embed.url}
        title={alt}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  if (embed?.kind === "video") {
    return (
      <video
        src={embed.url}
        controls
        playsInline
        className="absolute inset-0 w-full h-full object-cover bg-black"
      />
    );
  }
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
      />
    );
  }
  return (
    <div className="w-full h-full grid place-items-center text-ink-300 text-sm">
      {locale === "en" ? "Image coming soon" : "이미지 준비 중"}
    </div>
  );
}

// URL 을 iframe / video / null 로 분류 — 다른 곳의 toEmbedUrl 과 동일한 패턴
function heroVideoEmbed(
  url: string
): { kind: "iframe" | "video"; url: string } | null {
  if (!url) return null;
  const u = url.trim();
  const yt = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/
  );
  if (yt) {
    return {
      kind: "iframe",
      url: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`,
    };
  }
  const v = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v) {
    return { kind: "iframe", url: `https://player.vimeo.com/video/${v[1]}` };
  }
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
  const pathPart = u.split("?")[0];
  if (/\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(pathPart)) {
    return { kind: "video", url: u };
  }
  if (
    u.includes("firebasestorage.googleapis.com") ||
    u.includes("storage.googleapis.com")
  ) {
    return { kind: "video", url: u };
  }
  return { kind: "iframe", url: u };
}

function SpecRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-6 border-b border-ink-100 pb-2.5">
      <dt className="w-20 shrink-0 text-[12px] md:text-[13px] text-ink-500 font-semibold">
        {label}
      </dt>
      <dd className="text-[13px] md:text-[14px] text-ink-900 font-bold flex-1 break-words">
        {value}
      </dd>
    </div>
  );
}

// 컨테이너 너비에 맞춰 폰트 크기를 자동 축소하는 한 줄 헤딩.
// 제목이 길어도 줄바꿈하지 않고 글씨가 작아져 한 줄을 유지함.
function AutoFitHeading({
  text,
  maxPx,
  minPx,
  className = "",
}: {
  text: string;
  maxPx: number;
  minPx: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLHeadingElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(maxPx);

  useEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      const measure = measureRef.current;
      if (!wrap || !measure) return;
      const wrapWidth = wrap.clientWidth;
      const naturalWidth = measure.scrollWidth;
      // 아직 레이아웃이 잡히지 않았으면 (둘 다 0) skip
      if (wrapWidth === 0 || naturalWidth === 0) return;
      if (naturalWidth <= wrapWidth) {
        setSize(maxPx);
      } else {
        const next = Math.max(
          minPx,
          Math.floor((wrapWidth / naturalWidth) * maxPx)
        );
        setSize(next);
      }
    };

    fit();
    const wrap = wrapRef.current;
    let ro: ResizeObserver | null = null;
    if (wrap) {
      ro = new ResizeObserver(fit);
      ro.observe(wrap);
    }

    // 웹폰트 로드 후에도 한 번 더 측정 (한글 폰트는 늦게 적용되기 쉬움)
    let cancelled = false;
    if (
      typeof document !== "undefined" &&
      "fonts" in document &&
      document.fonts
    ) {
      document.fonts.ready.then(() => {
        if (!cancelled) fit();
      });
    }
    // 안전망: 한 번 더 큰 지연 후 재측정
    const t = setTimeout(fit, 100);

    return () => {
      cancelled = true;
      clearTimeout(t);
      ro?.disconnect();
    };
  }, [text, maxPx, minPx]);

  return (
    <h2
      ref={wrapRef}
      className={`min-w-0 overflow-hidden relative ${className}`}
    >
      <span
        className="block whitespace-nowrap"
        style={{ fontSize: `${size}px` }}
      >
        {text}
      </span>
      {/* 항상 maxPx 기준으로 텍스트 자연 너비를 측정하기 위한 hidden span */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="block whitespace-nowrap pointer-events-none"
        style={{
          position: "absolute",
          left: "-99999px",
          top: 0,
          visibility: "hidden",
          fontSize: `${maxPx}px`,
        }}
      >
        {text}
      </span>
    </h2>
  );
}
