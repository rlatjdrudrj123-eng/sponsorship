"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Printer } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { cachedFetch } from "@/lib/firebase/cache";

// Reveal/Lazy 이미지가 viewport 밖 슬라이드에서 발화 안 되는 이슈 회피 —
// 이 파일을 import 한 클라이언트에서만 IntersectionObserver 를 즉시 발화 mock 으로 교체.
if (typeof window !== "undefined") {
  const w = window as unknown as { __ioPrintMocked?: boolean };
  if (!w.__ioPrintMocked) {
    w.__ioPrintMocked = true;
    class ImmediateIO {
      private cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
      }
      observe(target: Element) {
        Promise.resolve().then(() => {
          this.cb(
            [
              {
                isIntersecting: true,
                target,
                intersectionRatio: 1,
                time: 0,
                boundingClientRect: target.getBoundingClientRect(),
                intersectionRect: target.getBoundingClientRect(),
                rootBounds: null,
              } as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver
          );
        });
      }
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds: ReadonlyArray<number> = [];
    }
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      ImmediateIO;
  }
}
import { CanvasRenderer } from "@/components/public/canvas/CanvasRenderer";
import type {
  CanvasPageBlock,
  Category,
  CategoryType,
  Channel,
  LandingBlock,
  Package,
  Persona,
  SiteSettings,
  Slot,
  Subcategory,
  TypeLayout,
} from "@/lib/types";
import { useLocale, localized as localizedHelper, localizedField } from "@/lib/i18n/locale";
import { getDisplayPackagePrice, formatPrice } from "@/lib/price";
import { getTypeLayout } from "@/lib/typeLayouts";

// 전체 패키지 PDF — 행사 랜딩 캔버스(표지/패키지 안내 등) + 모든 카테고리 +
// 모든 패키지를 A4 가로 슬라이드로 출력하여 브라우저 인쇄(→PDF 저장) 으로
// 받을 수 있게 함. 데이터가 바뀌면 자동 반영되므로 별도 PDF 업로드/동기화 불필요.

const CHANNEL_LABELS: Record<Channel, { ko: string; en: string }> = {
  offline: { ko: "오프라인", en: "Offline" },
  online: { ko: "온라인", en: "Online" },
  package: { ko: "패키지", en: "Package" },
};

export default function FullPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-ink-500">Loading…</div>
      }
    >
      <FullPrintContent />
    </Suspense>
  );
}

function FullPrintContent() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;
  const locale = useLocale((s) => s.locale);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [imgProgress, setImgProgress] = useState<{
    loaded: number;
    total: number;
    printing: boolean;
  }>({ loaded: 0, total: 0, printing: false });

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const [c, s, sl, p, pr, st] = await Promise.all([
          cachedFetch(`pub:cat:${eventId}`, async () => {
            const r = await getDocs(
              query(
                collection(db, "categories"),
                where("eventId", "==", eventId),
                where("isPublished", "==", true)
              )
            );
            return r.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
          }),
          cachedFetch(`pub:sub:${eventId}`, async () => {
            const r = await getDocs(
              query(collection(db, "subcategories"), where("eventId", "==", eventId))
            );
            return r.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id }));
          }),
          cachedFetch(`pub:slot:${eventId}`, async () => {
            const r = await getDocs(
              query(collection(db, "slots"), where("eventId", "==", eventId))
            );
            return r.docs.map((d) => ({ ...(d.data() as Slot), id: d.id }));
          }),
          cachedFetch(`pub:pkg:${eventId}`, async () => {
            const r = await getDocs(
              query(
                collection(db, "packages"),
                where("eventId", "==", eventId),
                where("isPublished", "==", true)
              )
            );
            return r.docs.map((d) => ({ ...(d.data() as Package), id: d.id }));
          }),
          cachedFetch(`pub:persona:${eventId}`, async () => {
            const r = await getDocs(
              query(collection(db, "personas"), where("eventId", "==", eventId))
            );
            return r.docs.map((d) => ({ ...(d.data() as Persona), id: d.id }));
          }),
          cachedFetch(`pub:settings:${eventId}`, async () => {
            const r = await getDoc(doc(db, "siteSettings", eventId));
            return r.exists() ? (r.data() as SiteSettings) : null;
          }),
        ]);
        setCategories(c);
        setSubcategories(s);
        setSlots(sl);
        setPackages(p);
        setPersonas(pr);
        if (st) setSettings(st);
        setReady(true);
      } catch (e) {
        console.error("full print fetch failed", e);
        setReady(true);
      }
    })();
  }, [eventId]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.channel !== b.channel) {
        const order: Channel[] = ["offline", "online", "package"];
        return order.indexOf(a.channel) - order.indexOf(b.channel);
      }
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [categories]);

  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [packages]);

  const slotsByCat = useMemo(() => {
    const m = new Map<string, Slot[]>();
    slots.forEach((s) => {
      const arr = m.get(s.categoryId) ?? [];
      arr.push(s);
      m.set(s.categoryId, arr);
    });
    return m;
  }, [slots]);

  const subByCat = useMemo(() => {
    const m = new Map<string, Subcategory[]>();
    subcategories.forEach((s) => {
      const arr = m.get(s.categoryId) ?? [];
      arr.push(s);
      m.set(s.categoryId, arr);
    });
    m.forEach((arr) => arr.sort((a, b) => a.order - b.order));
    return m;
  }, [subcategories]);

  // 랜딩 블록 중 canvasPage 만 추출 (다른 블록은 print 친화 아님)
  // 어드민이 [랜딩 빌더] 에서 만든 표지·패키지 안내·소개 슬라이드들이 자동으로 PDF 앞쪽에 들어감
  const canvasBlocks = useMemo<CanvasPageBlock[]>(() => {
    const blocks: LandingBlock[] = settings?.landing ?? [];
    return blocks.filter(
      (b): b is CanvasPageBlock => b.type === "canvasPage"
    );
  }, [settings?.landing]);

  // 표지 페이지 수 — 랜딩 캔버스가 있으면 그 개수, 없으면 fallback Cover 1장
  const coverPagesCount = canvasBlocks.length > 0 ? canvasBlocks.length : 1;

  // 한눈에 보기 페이지 수 — 페르소나마다 한 페이지. 페르소나 없으면 전체 카테고리 1페이지.
  const atGlancePageCount = personas.length > 0 ? personas.length : 1;
  // 패키지 광고 안내 — 패키지 있을 때만 1페이지 (모든 패키지를 한 화면에 그룹별 카드).
  const packageOverviewPageCount = sortedPackages.length > 0 ? 1 : 0;

  // 전체 페이지: 표지 + 한눈에보기(페르소나별) + 패키지광고안내 + 단품카테고리 + 클로징
  const totalPages =
    coverPagesCount +
    atGlancePageCount +
    packageOverviewPageCount +
    sortedCategories.length +
    1;

  // 데이터 로드 완료 후 — 모든 이미지가 받아진 다음에 자동 인쇄
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const waitAllImages = async () => {
      // IO mock 의 microtask + Reveal/캔버스 마운트 완료 대기
      await new Promise((r) => setTimeout(r, 800));
      window.dispatchEvent(new Event("resize")); // 캔버스 스케일 재계산
      await new Promise((r) => setTimeout(r, 300));

      // lazy 이미지를 eager 로 강제 변환 — viewport 밖 슬라이드도 즉시 fetch 시작
      document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        if (img.loading === "lazy") img.loading = "eager";
      });
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const imgs = Array.from(document.images);
      let loaded = 0;
      const total = imgs.length;
      setImgProgress({ loaded: 0, total, printing: false });
      await Promise.all(
        imgs.map((img) => {
          const tick = () => {
            loaded++;
            setImgProgress({ loaded, total, printing: false });
          };
          if (img.complete && img.naturalWidth > 0) {
            tick();
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            const done = () => {
              tick();
              resolve();
            };
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            // 35페이지 PDF — 느린 네트워크 + 많은 이미지 고려해 40초로 확장
            setTimeout(done, 40000);
          });
        })
      );
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          /* noop */
        }
      }
      // 이미지 로드 후 캔버스 스케일/레이아웃 한 번 더 재계산 (이미지 dimension 변동분)
      window.dispatchEvent(new Event("resize"));
      await new Promise((r) => setTimeout(r, 400));
      // 페인트 2 프레임 — 캔버스 transform: scale 적용 + 렌더링 안정화
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (!cancelled) {
        setImgProgress((p) => ({ ...p, printing: true }));
        window.print();
      }
    };

    void waitAllImages();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // print CSS — landing/print 와 동일 패턴.
  // styled-jsx 가 @page at-rule 을 삼키는 이슈 회피용 직접 삽입.
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-full-print", "1");
    style.textContent = `
      @page {
        size: A4 landscape;
        margin: 0;
      }
      @media print {
        html, body {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        html, body, .a4-page, .a4-page * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const eventName =
    (locale === "en"
      ? settings?.event?.nameEn
      : settings?.event?.nameKo) ??
    settings?.event?.nameKo ??
    eventId ??
    (locale === "en" ? "Event" : "행사");
  const eventVenue = settings?.event?.venue ?? "";
  const eventDateRange = settings?.event?.dateRange ?? "";

  if (!ready) {
    return (
      <div className="p-12 text-center text-sm text-ink-500">
        {locale === "en" ? "Loading…" : "불러오는 중…"}
      </div>
    );
  }

  return (
    <div className="bg-ink-50 min-h-screen print:bg-white">
      {/* 인쇄 안내 */}
      <div className="print:hidden bg-white border-b border-ink-100 px-6 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-ink-700">
              {imgProgress.printing
                ? locale === "en"
                  ? "Print dialog opened — confirm [Orientation: Landscape] · [Background graphics: On] before saving."
                  : "인쇄 다이얼로그가 열렸어요 — [방향: 가로]·[배경 그래픽: 켜기] 확인 후 저장하세요."
                : imgProgress.total > 0 && imgProgress.loaded < imgProgress.total
                  ? locale === "en"
                    ? `Loading images ${imgProgress.loaded} / ${imgProgress.total}… (print dialog opens automatically once all images load)`
                    : `이미지 ${imgProgress.loaded} / ${imgProgress.total}장 로딩 중… (전부 받은 후 자동으로 인쇄 다이얼로그가 열립니다)`
                  : locale === "en"
                    ? `Full sponsorship PDF preview — ${totalPages} pages total. The print dialog will open shortly.`
                    : `전체 패키지 PDF 미리보기 — 총 ${totalPages}페이지. 곧 인쇄 다이얼로그가 자동으로 열립니다.`}
            </p>
            {imgProgress.total > 0 && imgProgress.loaded < imgProgress.total && (
              <div className="mt-2 h-1 bg-ink-100 rounded overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{
                    width: `${(imgProgress.loaded / imgProgress.total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 flex items-center gap-1.5 shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            {locale === "en" ? "Print now" : "지금 인쇄"}
          </button>
        </div>
      </div>

      <div className="print:m-0">
        {/* 1) 랜딩 캔버스 슬라이드 (어드민이 빌더에서 만든 표지·패키지 안내 등) */}
        {canvasBlocks.length === 0 ? (
          <CoverSlide
            eventName={eventName}
            venue={eventVenue}
            dateRange={eventDateRange}
            totalPages={totalPages || 1}
            totalCategories={sortedCategories.length}
            totalPackages={sortedPackages.length}
            locale={locale}
          />
        ) : (
          canvasBlocks.map((block, i) => (
            <CanvasSlide
              key={`canvas-${block.id}`}
              block={block}
              eventId={eventId}
              settings={settings}
              index={i}
              total={totalPages}
            />
          ))
        )}

        {/* 2) 한눈에 보기 — 페르소나마다 한 페이지. 페르소나 없으면 전체 카테고리 1페이지. */}
        {personas.length > 0 ? (
          personas.map((p, i) => (
            <AtAGlancePrintSlide
              key={`atg-${p.id}`}
              persona={p}
              categories={sortedCategories.filter((c) =>
                (c.personas ?? []).includes(p.id)
              )}
              eventName={eventName}
              index={coverPagesCount + i}
              total={totalPages}
              locale={locale}
            />
          ))
        ) : (
          <AtAGlancePrintSlide
            persona={null}
            categories={sortedCategories}
            eventName={eventName}
            index={coverPagesCount}
            total={totalPages}
            locale={locale}
          />
        )}

        {/* 3) 패키지 광고 안내 — 한 페이지에 Signature·Standard 그룹 */}
        {sortedPackages.length > 0 && (
          <PackageOverviewPrintSlide
            packages={sortedPackages}
            index={coverPagesCount + atGlancePageCount}
            total={totalPages}
            locale={locale}
          />
        )}

        {/* 4) 단품 카테고리 슬라이드 */}
        {sortedCategories.map((c, i) => (
          <CategorySlide
            key={`c-${c.id}`}
            category={c}
            subs={subByCat.get(c.id) ?? []}
            slots={slotsByCat.get(c.id) ?? []}
            typeLayouts={settings?.typeLayouts}
            index={
              coverPagesCount +
              atGlancePageCount +
              packageOverviewPageCount +
              i
            }
            total={totalPages}
            eventName={eventName}
            locale={locale}
          />
        ))}

        {/* 5) 클로징 — 외부 신청 링크 + Contact (랜딩 페이지와 동일 흐름) */}
        <ClosingSlide
          settings={settings}
          index={
            coverPagesCount +
            atGlancePageCount +
            packageOverviewPageCount +
            sortedCategories.length
          }
          total={totalPages}
          locale={locale}
        />
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html,
          body {
            background: white !important;
          }
          .a4-page {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .a4-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// AtAGlancePrintSlide — PDF 한눈에 보기 (페르소나별 한 페이지).
// 페르소나 헤더 + 매핑된 카테고리 그리드. 슬라이드 모드와 동일 톤.
// ============================================================================

function AtAGlancePrintSlide({
  persona,
  categories,
  eventName,
  index,
  total,
  locale,
}: {
  persona: Persona | null;
  categories: Category[];
  eventName: string;
  index: number;
  total: number;
  locale: "ko" | "en";
}) {
  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-16 py-12 flex flex-col">
        <h2 className="text-[28px] font-bold tracking-tight text-ink-900 text-center mb-4">
          {eventName}{" "}
          <span className="text-brand-500">
            {locale === "en" ? "at a glance" : "스폰서십 한눈에 보기"}
          </span>
        </h2>

        {persona && (
          <div className="text-center mb-6">
            <div className="inline-flex items-baseline gap-2 text-[16px] font-bold text-ink-900 pb-1.5 border-b-2 border-ink-900">
              {persona.emoji && <span className="text-[18px]">{persona.emoji}</span>}
              {persona.title}
            </div>
            {persona.description && (
              <p className="text-[11.5px] text-ink-500 mt-2 leading-snug max-w-2xl mx-auto">
                {persona.description}
              </p>
            )}
          </div>
        )}

        {/* 우상단 범례 */}
        <div className="flex items-center justify-end gap-3 mb-3 text-[10.5px] text-ink-500 font-num">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-100" />
            {locale === "en" ? "online" : "온라인"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            {locale === "en" ? "offline" : "오프라인"}
          </span>
        </div>

        <div className="flex-1 min-h-0">
          {categories.length === 0 ? (
            <div className="h-full grid place-items-center text-[12.5px] text-ink-500">
              {locale === "en"
                ? "No items in this persona."
                : "이 상황에 매칭된 항목이 아직 없어요."}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-ink-100 rounded-card px-4 py-3 flex items-center justify-between gap-3 shadow-sm"
                >
                  <span className="text-[12.5px] font-semibold text-ink-900 truncate">
                    {localizedHelper(c.name, locale)}
                  </span>
                  <span
                    className={
                      "w-2 h-2 rounded-full shrink-0 " +
                      (c.channel === "online" ? "bg-brand-100" : "bg-brand-500")
                    }
                    aria-hidden
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

// ============================================================================
// PackageOverviewPrintSlide — PDF 패키지 광고 안내 (한 페이지에 Signature·Standard 그룹).
// 슬라이드 모드 PackageOverviewSlide 와 동일 디자인.
// ============================================================================

function PackageOverviewPrintSlide({
  packages,
  index,
  total,
  locale,
}: {
  packages: Package[];
  index: number;
  total: number;
  locale: "ko" | "en";
}) {
  const signaturePkgs = packages.filter((p) => p.tier === "signature");
  const standardPkgs = packages.filter((p) => p.tier === "standard");

  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-16 py-10 flex flex-col">
        <div className="text-center mb-4">
          <h2 className="text-[28px] font-bold tracking-tight text-ink-900">
            {locale === "en" ? "Package deals" : "패키지 광고 안내"}
          </h2>
          <p className="text-[12px] text-ink-500 mt-1.5 leading-relaxed max-w-2xl mx-auto">
            {locale === "en"
              ? "Discounted bundles — premium packages combining key on-floor traffic and exposure channels."
              : "단품을 묶어 할인된 가격에 — 전시회 핵심 동선 + 노출 채널을 통합 구성한 프리미엄 패키지입니다."}
          </p>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-hidden">
          {signaturePkgs.length > 0 && (
            <PrintPackageGroup
              label="Signature Package"
              tagline={
                locale === "en"
                  ? "Premium bundles built around key on-floor traffic and high-visibility channels"
                  : "전시회 핵심 동선과 주요 노출 지면을 중심으로 구성된 프리미엄 패키지"
              }
              packages={signaturePkgs}
              locale={locale}
            />
          )}
          {standardPkgs.length > 0 && (
            <PrintPackageGroup
              label="Standard Package"
              tagline={
                locale === "en"
                  ? "Flexible bundles you can adapt to your specific goal"
                  : "선택 가능한 스폰서십 항목을 유연하게 구성한 실속형 패키지"
              }
              packages={standardPkgs}
              locale={locale}
            />
          )}
        </div>
      </div>
      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

function PrintPackageGroup({
  label,
  tagline,
  packages,
  locale,
}: {
  label: string;
  tagline: string;
  packages: Package[];
  locale: "ko" | "en";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2 border-b border-ink-100 pb-1.5">
        <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold">
          {label}
        </div>
        <p className="text-[10.5px] text-ink-300 leading-tight">{tagline}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {packages.map((pkg) => (
          <PrintPackageCard key={pkg.id} pkg={pkg} locale={locale} />
        ))}
      </div>
    </div>
  );
}

function PrintPackageCard({
  pkg,
  locale,
}: {
  pkg: Package;
  locale: "ko" | "en";
}) {
  const discount =
    pkg.originalPrice > 0
      ? Math.round((1 - pkg.discountPrice / pkg.originalPrice) * 100)
      : 0;
  const items = (pkg.includedItems ?? []).slice(0, 5);
  const price = getDisplayPackagePrice(pkg, locale);
  return (
    <div className="bg-surface border border-ink-100 rounded-card p-3">
      <div className="grid grid-cols-[1.4fr_1fr] gap-3 items-start">
        <div className="min-w-0">
          {(() => {
            const tg = localizedField(pkg.tagline, pkg.taglineEn, locale);
            return tg ? (
              <p className="text-[10.5px] text-brand-500 font-semibold leading-snug mb-1 line-clamp-1">
                {tg}
              </p>
            ) : null;
          })()}
          <div className="text-[16px] font-bold text-ink-900 leading-tight mb-2">
            {localizedHelper(pkg.name, locale)}
          </div>
          {items.length > 0 && (
            <ul className="space-y-0.5 text-[10.5px] text-ink-700 leading-snug">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-brand-500 shrink-0 mt-0.5">•</span>
                  <span className="line-clamp-1">{it.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-right shrink-0 self-center">
          {price.original.value > price.discount.value && (
            <div className="text-[10px] text-ink-300 line-through font-num leading-none">
              {locale === "en" ? "Was " : "기존 "}
              {formatPrice(price.original.value, price.original.currency)}
            </div>
          )}
          {discount > 0 && (
            <div className="text-[11px] font-num font-bold text-brand-500 mt-1">
              {discount}% OFF
            </div>
          )}
          <div className="mt-1.5 leading-none">
            <span className="text-[9.5px] text-ink-500 mr-1">
              {locale === "en" ? "Now" : "할인가"}
            </span>
            <span className="text-[18px] font-bold text-ink-900 font-num">
              {formatPrice(price.discount.value, price.discount.currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ClosingSlide — PDF 마지막 페이지. 랜딩 ClosingSlide 와 동일 흐름.
// 외부 신청 링크(인쇄해도 URL 보이도록 노출) + Contact + K·print 브랜드.
// ============================================================================

const APPLY_URL = "https://kprint.kr/ko/mypage/exhibitor/advertise";

function ClosingSlide({
  settings,
  index,
  total,
  locale,
}: {
  settings: SiteSettings | null;
  index: number;
  total: number;
  locale: "ko" | "en";
}) {
  const phone = settings?.contact?.phone || "02-551-0102";
  const email = settings?.contact?.email || "kprint@kprint.kr";
  const address = settings?.contact?.address;
  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-20 py-14 flex flex-col items-center justify-center text-center break-keep">
        <div className="font-bold text-[44px] tracking-tight text-brand-500 leading-none mb-10">
          K·print
        </div>

        <h2 className="text-[30px] font-bold tracking-tight text-ink-900 leading-[1.3] mb-10 break-keep">
          {locale === "en" ? (
            <>
              Reach decision-makers in the
              <br />
              print &amp; digital industry — start now.
            </>
          ) : (
            <>
              인쇄·디지털프린팅 전문가가 모이는 자리,
              <br />
              지금 바로 브랜드를 알리세요!
            </>
          )}
        </h2>

        {/* PDF 인쇄용 — URL 직접 노출 (탭 동작 X, 종이에 URL 인쇄) */}
        <div className="flex items-center gap-3 mb-3">
          <div className="px-7 py-3 rounded-btn bg-brand-500 text-white text-[14px] font-bold inline-flex items-center gap-2">
            {locale === "en" ? "Apply online" : "온라인 신청 바로가기"}
          </div>
          <div className="px-7 py-3 rounded-btn bg-ink-900 text-white text-[14px] font-bold inline-flex items-center gap-2">
            {locale === "en" ? "Full PDF" : "PDF 다운로드"}
          </div>
        </div>
        <div className="text-[10.5px] text-ink-500 font-mono mb-12">
          {APPLY_URL}
        </div>

        <div className="mt-2">
          <div className="font-bold text-[12px] text-ink-700 mb-1.5">
            Contact.
          </div>
          <div className="text-[12px] text-ink-500 leading-relaxed font-num">
            {phone}
            <span className="mx-2 text-ink-300">|</span>
            {email}
          </div>
          {address && (
            <div className="text-[11px] text-ink-500 mt-1">{address}</div>
          )}
        </div>
      </div>

      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

// ============================================================================
// CanvasSlide — 랜딩 빌더 캔버스 페이지 1개를 A4 가로로 렌더
// ============================================================================

function CanvasSlide({
  block,
  eventId,
  settings,
  index,
  total,
}: {
  block: CanvasPageBlock;
  eventId: string;
  settings: SiteSettings | null;
  index: number;
  total: number;
}) {
  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      {/* CanvasRenderer 는 부모의 폭/높이에 맞춰 contain 스케일.
          forceDesktop=true 로 모바일 스택 모드 비활성화 (PDF 는 항상 가로). */}
      <CanvasRenderer
        page={block.data.page}
        eventId={eventId}
        settings={settings}
        forceDesktop
      />
      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px] pointer-events-none">
        <span className="text-ink-700 font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

// ============================================================================
// CoverSlide — 행사 표지 (랜딩 빌더 캔버스가 비어있을 때만 fallback 으로 사용)
// ============================================================================

function CoverSlide({
  eventName,
  venue,
  dateRange,
  totalPages,
  totalCategories,
  totalPackages,
  locale,
}: {
  eventName: string;
  venue: string;
  dateRange: string;
  totalPages: number;
  totalCategories: number;
  totalPackages: number;
  locale: "ko" | "en";
}) {
  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-20 py-16 flex flex-col">
        <div className="text-[11px] uppercase tracking-[0.35em] text-brand-700 font-bold flex items-center gap-2">
          <span className="w-8 h-px bg-brand-700" />
          Sponsorship Package
        </div>

        <h1 className="mt-12 text-[88px] font-bold leading-[0.98] tracking-tight text-ink-900">
          {eventName}
          <br />
          <span className="text-brand-500">
            {locale === "en" ? "Sponsorship Deck" : "스폰서십 안내"}
          </span>
        </h1>

        {(dateRange || venue) && (
          <p className="mt-8 text-[18px] text-ink-700 leading-relaxed max-w-2xl font-num">
            {dateRange}
            {dateRange && venue && " · "}
            {venue}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between">
          <div className="text-[12.5px] text-ink-500 leading-relaxed">
            {locale === "en"
              ? "This deck is auto-generated from the data."
              : "본 자료는 데이터를 기반으로 자동 생성되었습니다."}
            <br />
            {locale === "en"
              ? "Final quotes are sent shortly after secretariat review."
              : "정식 견적은 사무국 문의 후 빠르게 회신드립니다."}
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.25em] text-ink-500 font-bold">
              Contents
            </div>
            <div className="text-[16px] text-ink-900 font-bold mt-1">
              {locale === "en"
                ? `${totalCategories} categories${totalPackages > 0 ? ` · ${totalPackages} packages` : ""}`
                : `카테고리 ${totalCategories}개${totalPackages > 0 ? ` · 패키지 ${totalPackages}개` : ""}`}
            </div>
            <div className="text-[11px] text-ink-500 font-num mt-1">
              {locale === "en"
                ? `${totalPages} pages`
                : `총 ${totalPages} 페이지`}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CategorySlide — 카테고리 1개당 1페이지 (sponsorships 슬라이드와 동일 톤)
// ============================================================================

function CategorySlide({
  category,
  subs,
  slots,
  typeLayouts,
  index,
  total,
  eventName: _eventName,
  locale,
}: {
  category: Category;
  subs: Subcategory[];
  slots: Slot[];
  typeLayouts?: Partial<Record<CategoryType, TypeLayout>>;
  index: number;
  total: number;
  eventName: string;
  locale: "ko" | "en";
}) {
  void _eventName;
  const layout = getTypeLayout(category.type, typeLayouts);

  // 위치(소분류 이름 join) — sponsorships 페이지와 동일 패턴
  const locationLabel = subs
    .map((s) => localizedHelper(s.name, locale))
    .filter(Boolean)
    .join(", ");

  // 세부사항 — subcategory 이름 + 슬롯 수 + 단위. 예: "표4 (국/영문) 1면, 표4 (국문) 1면, …"
  const detailLabel = subs
    .map((s) => {
      const count = slots.filter((sl) => sl.subcategoryId === s.id).length;
      if (count === 0) return null;
      const unit = localizedHelper(s.unit, locale) || (locale === "en" ? "slot" : "구좌");
      return `${localizedHelper(s.name, locale)} ${count}${unit}`;
    })
    .filter(Boolean)
    .join(", ");

  const slotTotal = slots.length;
  const slotAvailable = slots.filter((sl) => sl.status === "available").length;
  const hero = category.heroImages?.images?.[0]?.url;
  const deadlineStr = category.deadline
    ? category.deadline.toDate().toLocaleDateString(
        locale === "en" ? "en-US" : "ko-KR",
        {
          year: "numeric",
          month: locale === "en" ? "short" : "long",
          day: "numeric",
        }
      )
    : null;

  // KRW + USD 최저가 둘 다. USD 는 priceUSD 우선, 없으면 1USD=1000KRW 변환.
  const validPrices = subs.map((s) => s.priceKRW).filter((p) => p > 0);
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const usdPrices = subs
    .map((s) =>
      typeof s.priceUSD === "number" && s.priceUSD > 0
        ? s.priceUSD
        : s.priceKRW > 0
          ? Math.round(s.priceKRW / 1000)
          : 0
    )
    .filter((p) => p > 0);
  const minPriceUSD = usdPrices.length > 0 ? Math.min(...usdPrices) : 0;

  // 가격이 subcategory 별로 다른지 — 다양하면 우하단에 리스트로 표시.
  // 영업 데크라 가격 정보 누락 없어야 함.
  const pricedSubs = subs.filter((s) => s.priceKRW > 0);
  const uniqueKrwPrices = new Set(pricedSubs.map((s) => s.priceKRW));
  const hasVariedPricing = uniqueKrwPrices.size >= 2;

  // 사이트 카테고리 상세 페이지와 동일하게 channel 만 표시 (해시태그 통일).
  // 카테고리 자체 tags 는 PDF 슬라이드 헤더에서 제거 (정보 과잉 + 사이트와 다름).
  const hashTags: string[] = [
    CHANNEL_LABELS[category.channel][locale === "en" ? "en" : "ko"],
  ];

  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-12 py-10 grid grid-cols-[1.1fr_1fr] gap-10 items-stretch">
        {/* LEFT */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] tracking-wide text-brand-700 font-bold mb-4 font-num">
            {hashTags.map((t, i) => (
              <span key={i}>#{t}</span>
            ))}
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[44px] font-bold leading-[0.95] tracking-tight text-ink-900 break-keep">
              {localizedHelper(category.name, locale)}
            </h2>
            <span className="text-[15px] text-ink-300 font-num">
              #{category.code}
            </span>
          </div>

          {(() => {
            const sd = localizedField(category.shortDesc, category.shortDescEn, locale);
            return sd ? (
              <p className="text-[13px] text-ink-700 mt-3 leading-relaxed">
                {sd}
              </p>
            ) : null;
          })()}

          <hr className="border-ink-100 my-6" />

          {/* 스펙 표 — 사이트 카테고리 상세 페이지와 동일하게
              어드민의 typeLayouts (또는 기본 레이아웃) 기반 행 노출.
              한 PDF 안에서 사이트 / PDF 정보 불일치 안 나게 한 곳에서 가공. */}
          <dl className="space-y-3">
            {(() => {
              const rows: React.ReactNode[] = [];
              for (const field of layout.specFields) {
                switch (field) {
                  case "location": {
                    if (locationLabel)
                      rows.push(
                        <SpecRow
                          key="location"
                          label={locale === "en" ? "Location" : "게재 위치"}
                          value={locationLabel}
                        />
                      );
                    break;
                  }
                  case "size": {
                    const sz = localizedHelper(
                      { ko: category.size, en: category.sizeEn },
                      locale
                    );
                    if (sz)
                      rows.push(
                        <SpecRow
                          key="size"
                          label={locale === "en" ? "Size" : "규격"}
                          value={sz}
                        />
                      );
                    break;
                  }
                  case "fileFormat": {
                    const ff = localizedHelper(
                      { ko: category.fileFormat, en: category.fileFormatEn },
                      locale
                    );
                    if (ff)
                      rows.push(
                        <SpecRow
                          key="fileFormat"
                          label={locale === "en" ? "File format" : "파일 형식"}
                          value={ff}
                        />
                      );
                    break;
                  }
                  case "deadline": {
                    if (deadlineStr)
                      rows.push(
                        <SpecRow
                          key="deadline"
                          label={locale === "en" ? "Deadline" : "제출 마감"}
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
                          label={locale === "en" ? "Detail" : "세부사항"}
                          value={
                            slotTotal > 0
                              ? `${detailLabel} (${
                                  locale === "en" ? "remaining " : "잔여 "
                                }${slotAvailable})`
                              : detailLabel
                          }
                        />
                      );
                    break;
                  }
                  case "slots": {
                    rows.push(
                      <SpecRow
                        key="slots"
                        label={locale === "en" ? "Slots" : "구좌"}
                        value={`${slotAvailable} / ${slotTotal} ${
                          locale === "en" ? "available" : "가능"
                        }`}
                      />
                    );
                    break;
                  }
                  case "video": {
                    const v = category.videoSpec;
                    if (v && (v.duration || v.resolution || v.plays)) {
                      const parts: string[] = [];
                      if (v.duration)
                        parts.push(
                          locale === "en" ? `${v.duration}s` : `${v.duration}초`
                        );
                      if (v.resolution) parts.push(v.resolution);
                      if (v.plays)
                        parts.push(
                          locale === "en"
                            ? `${v.plays.toLocaleString()} plays`
                            : `${v.plays.toLocaleString()}회 송출`
                        );
                      rows.push(
                        <SpecRow
                          key="video"
                          label={locale === "en" ? "Video spec" : "영상 스펙"}
                          value={parts.join(" · ")}
                        />
                      );
                    }
                    break;
                  }
                  case "mailing": {
                    const m = category.mailingSpec;
                    if (m && (m.audience || m.sendDates?.length)) {
                      const parts: string[] = [];
                      if (m.audience)
                        parts.push(
                          locale === "en"
                            ? `${m.audience.toLocaleString()} recipients${
                                m.audienceLabel ? ` (${m.audienceLabel})` : ""
                              }`
                            : `${m.audience.toLocaleString()}명${
                                m.audienceLabel ? ` (${m.audienceLabel})` : ""
                              }`
                        );
                      if (m.sendDates?.length)
                        parts.push(
                          locale === "en"
                            ? `Send: ${m.sendDates.join(", ")}`
                            : `발송: ${m.sendDates.join(", ")}`
                        );
                      rows.push(
                        <SpecRow
                          key="mailing"
                          label={locale === "en" ? "Send spec" : "발송 스펙"}
                          value={parts.join(" · ")}
                        />
                      );
                    }
                    break;
                  }
                  case "content": {
                    const c = category.contentSpec;
                    if (c && (c.channel || c.format)) {
                      rows.push(
                        <SpecRow
                          key="content"
                          label={locale === "en" ? "Content spec" : "콘텐츠 스펙"}
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
              // 어드민이 type-layout 에서 추가한 커스텀 행
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

          <div className="mt-auto pt-6">
            <hr className="border-ink-100 mb-5" />
            <div className="flex items-end justify-end">
              {(locale === "en" ? minPriceUSD : minPrice) > 0 ? (
                hasVariedPricing ? (
                  // subcategory 별 가격 다양 — 모든 가격을 리스트로 노출
                  <div className="text-right">
                    <div className="space-y-1.5">
                      {pricedSubs.map((s) => {
                        const priceUsd =
                          typeof s.priceUSD === "number" && s.priceUSD > 0
                            ? s.priceUSD
                            : Math.round(s.priceKRW / 1000);
                        return (
                          <div
                            key={s.id}
                            className="flex items-baseline justify-end gap-4"
                          >
                            <span className="text-[12px] text-ink-500 truncate max-w-[180px]">
                              {localizedHelper(s.name, locale)}
                            </span>
                            <span className="font-num text-[20px] font-bold text-ink-900 leading-none tracking-tight">
                              {locale === "en" && (
                                <span className="text-[15px] mr-0.5">$</span>
                              )}
                              {(locale === "en"
                                ? priceUsd
                                : s.priceKRW
                              ).toLocaleString()}
                              {locale !== "en" && (
                                <span className="text-[13px] ml-1 font-bold">
                                  원
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-ink-500 mt-3">
                      {locale === "en"
                        ? "(Production & install included, VAT excluded)"
                        : "(제작설치비 포함, 부가세 별도)"}
                    </p>
                  </div>
                ) : (
                  // 가격 단일 — 기존 큰 글씨 한 줄
                  <div className="text-right">
                    <div className="font-num text-[32px] font-bold text-ink-900 leading-none tracking-tight">
                      <span className="text-[16px] font-semibold mr-2">
                        {locale === "en" ? "Per slot" : "1구좌당"}
                      </span>
                      {locale === "en" && (
                        <span className="text-[22px] mr-0.5">$</span>
                      )}
                      {(locale === "en"
                        ? minPriceUSD
                        : minPrice
                      ).toLocaleString()}
                      {locale !== "en" && (
                        <span className="text-[18px] ml-1 font-bold">원</span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-500 mt-2">
                      {locale === "en"
                        ? "(Production & install included, VAT excluded)"
                        : "(제작설치비 포함, 부가세 별도)"}
                    </p>
                  </div>
                )
              ) : (
                <div className="text-[14px] text-ink-500 font-semibold">
                  {locale === "en" ? "Negotiable" : "가격 협의"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — 슬라이드 페이지 hero 와 같은 패턴: 4:3 비율 박스 + cover */}
        <div className="flex items-center justify-center min-h-0">
          <div
            className="w-full rounded-card bg-ink-100 overflow-hidden border border-ink-100 relative shadow-card"
            style={{ aspectRatio: "4 / 3" }}
          >
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={localizedHelper(category.name, locale)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-ink-300 text-sm">
                {locale === "en" ? "Image coming soon" : "이미지 준비 중"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

// 옛 PackageSlide(패키지 1개당 1페이지) 는 PackageOverviewPrintSlide 로 통합되어 사용 안 함.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LegacyPackageSlide({
  pkg,
  index,
  total,
  eventName: _eventName,
  locale,
}: {
  pkg: Package;
  index: number;
  total: number;
  eventName: string;
  locale: "ko" | "en";
}) {
  void _eventName;
  const hero = pkg.heroImages?.images?.[0]?.url;
  const hasDiscount =
    pkg.originalPrice > pkg.discountPrice && pkg.originalPrice > 0;

  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-12 py-10 grid grid-cols-[1.1fr_1fr] gap-10 items-stretch">
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] tracking-wide text-brand-700 font-bold mb-4 font-num">
            <span>#{locale === "en" ? "Package" : "패키지"}</span>
            <span>
              #
              {pkg.tier === "signature"
                ? locale === "en"
                  ? "Signature"
                  : "시그니처"
                : locale === "en"
                  ? "Standard"
                  : "스탠다드"}
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[44px] font-bold leading-[0.95] tracking-tight text-ink-900 break-keep">
              {localizedHelper(pkg.name, locale)}
            </h2>
            <span className="text-[15px] text-ink-300 font-num">#{pkg.code}</span>
          </div>

          {(() => {
            const tg = localizedField(pkg.tagline, pkg.taglineEn, locale);
            return tg ? (
              <p className="text-[13px] text-ink-700 mt-3 leading-relaxed">
                {tg}
              </p>
            ) : null;
          })()}

          <hr className="border-ink-100 my-6" />

          {pkg.includedItems && pkg.includedItems.length > 0 && (
            <div>
              <div className="text-[12px] font-bold text-ink-900 mb-2">
                {locale === "en" ? "Included" : "포함 항목"}
              </div>
              <ul className="space-y-1 text-[12.5px] text-ink-700">
                {pkg.includedItems.map((it, i) => (
                  <li key={i}>
                    · {localizedField(it.label, it.labelEn, locale)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(() => {
            const pn = localizedField(pkg.priceNote, pkg.priceNoteEn, locale);
            return pn ? (
              <p className="text-[11px] text-ink-500 mt-3 leading-relaxed whitespace-pre-line">
                {pn}
              </p>
            ) : null;
          })()}

          <div className="mt-auto pt-6">
            <hr className="border-ink-100 mb-5" />
            <div className="flex items-end justify-end">
              {pkg.discountPrice > 0 ? (
                <div className="text-right">
                  {hasDiscount && (
                    <div className="text-[14px] text-ink-500 line-through font-num mb-1">
                      {locale === "en" ? "₩" : ""}
                      {pkg.originalPrice.toLocaleString()}
                      {locale === "en" ? "" : "원"}
                    </div>
                  )}
                  <div className="font-num text-[32px] font-bold text-ink-900 leading-none tracking-tight">
                    <span className="text-[16px] font-semibold mr-2">
                      {locale === "en" ? "Package price" : "패키지가"}
                    </span>
                    {pkg.discountPrice.toLocaleString()}
                    <span className="text-[18px] ml-1 font-bold">
                      {locale === "en" ? " KRW" : "원"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-2">
                    {locale === "en"
                      ? "(Production & install included, VAT excluded)"
                      : "(제작설치비 포함, 부가세 별도)"}
                  </p>
                </div>
              ) : (
                <div className="text-[14px] text-ink-500 font-semibold">
                  {locale === "en" ? "Negotiable" : "가격 협의"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-0">
          <div
            className="w-full rounded-card bg-ink-100 overflow-hidden border border-ink-100 relative shadow-card"
            style={{ aspectRatio: "4 / 3" }}
          >
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={localizedHelper(pkg.name, locale)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-ink-300 text-sm">
                {locale === "en" ? "Image coming soon" : "이미지 준비 중"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
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
    <div className="flex items-baseline gap-6 border-b border-ink-100 pb-2.5">
      <dt className="w-20 shrink-0 text-[12.5px] text-ink-500 font-semibold">
        {label}
      </dt>
      <dd className="text-[14px] text-ink-900 font-bold flex-1 min-w-0 break-words">
        {value}
      </dd>
    </div>
  );
}
