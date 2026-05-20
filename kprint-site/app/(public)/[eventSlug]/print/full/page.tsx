"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Printer } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { CanvasRenderer } from "@/components/public/canvas/CanvasRenderer";
import type {
  CanvasPageBlock,
  Category,
  Channel,
  LandingBlock,
  Package,
  SiteSettings,
  Subcategory,
} from "@/lib/types";
import { useLocale, localized as localizedHelper } from "@/lib/i18n/locale";

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
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const [c, s, p, st] = await Promise.all([
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
            query(
              collection(db, "packages"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDoc(doc(db, "siteSettings", eventId)),
        ]);
        setCategories(
          c.docs.map((d) => ({ ...(d.data() as Category), id: d.id }))
        );
        setSubcategories(
          s.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id }))
        );
        setPackages(
          p.docs.map((d) => ({ ...(d.data() as Package), id: d.id }))
        );
        if (st.exists()) setSettings(st.data() as SiteSettings);
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

  // 추가 혜택(perks) 페이지는 어드민이 랜딩 빌더에서 직접 만들어 넣는 방향으로 변경 —
  // PDF 자동 생성 페이지에서는 제외.

  // 마지막 — 클로징 슬라이드 (KPRINT 외부 신청 + Contact). 랜딩 페이지와 동일 흐름.
  const totalPages =
    coverPagesCount + sortedPackages.length + sortedCategories.length + 1;

  // 데이터 로드 완료 후 자동 인쇄 다이얼로그
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [ready]);

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
      <div className="print:hidden bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <p className="text-[13px] text-ink-700">
          {locale === "en"
            ? `Full sponsorship PDF preview — ${totalPages} pages total. The print dialog opens automatically. Choose "Save as PDF" to download.`
            : `전체 패키지 PDF 미리보기 — 총 ${totalPages}페이지. 자동으로 인쇄 다이얼로그가 열립니다. PDF로 저장하려면 [PDF로 저장]을 선택하세요.`}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" />
          {locale === "en" ? "Print / PDF" : "인쇄 / PDF"}
        </button>
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

        {/* 2) 패키지 슬라이드 — 단품(카테고리) 앞에 배치 */}
        {sortedPackages.map((pkg, i) => (
          <PackageSlide
            key={`p-${pkg.id}`}
            pkg={pkg}
            index={coverPagesCount + i}
            total={totalPages}
            eventName={eventName}
            locale={locale}
          />
        ))}

        {/* 3) 카테고리(단품) 슬라이드 */}
        {sortedCategories.map((c, i) => (
          <CategorySlide
            key={`c-${c.id}`}
            category={c}
            subs={subByCat.get(c.id) ?? []}
            index={coverPagesCount + sortedPackages.length + i}
            total={totalPages}
            eventName={eventName}
            locale={locale}
          />
        ))}

        {/* 4) 클로징 — 외부 신청 링크 + Contact (랜딩 페이지와 동일 흐름) */}
        <ClosingSlide
          settings={settings}
          index={
            coverPagesCount + sortedPackages.length + sortedCategories.length
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
  const contact = settings?.contact;
  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-20 py-14 flex flex-col items-center justify-center text-center">
        <div className="font-bold text-[44px] tracking-tight text-brand-500 leading-none mb-10">
          K·print
        </div>

        <h2 className="text-[32px] font-bold tracking-tight text-ink-900 leading-[1.25] mb-10">
          {locale === "en" ? (
            <>
              Reach decision-makers in the
              <br />
              print &amp; digital industry — start now.
            </>
          ) : (
            <>
              인쇄·디지털프린팅 산업 전문가가 모이는 자리에서
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

        {contact && (
          <div className="mt-2">
            <div className="font-bold text-[12px] text-ink-700 mb-1.5">
              Contact.
            </div>
            <div className="text-[12px] text-ink-500 leading-relaxed font-num">
              {contact.phone}
              {contact.phone && contact.email && (
                <span className="mx-2 text-ink-300">|</span>
              )}
              {contact.email}
            </div>
            {contact.address && (
              <div className="text-[11px] text-ink-500 mt-1">
                {contact.address}
              </div>
            )}
          </div>
        )}
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
              ? "Final quotes are sent within 1 business day after secretariat review."
              : "정식 견적은 사무국 문의 후 1영업일 내 회신됩니다."}
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
  index,
  total,
  eventName: _eventName,
  locale,
}: {
  category: Category;
  subs: Subcategory[];
  index: number;
  total: number;
  eventName: string;
  locale: "ko" | "en";
}) {
  void _eventName;
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

  const validPrices = subs.map((s) => s.priceKRW).filter((p) => p > 0);
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

  const hashTags: string[] = [
    CHANNEL_LABELS[category.channel][locale === "en" ? "en" : "ko"],
    ...(category.tags ?? []).slice(0, 2),
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

          {category.shortDesc && (
            <p className="text-[13px] text-ink-700 mt-3 leading-relaxed">
              {category.shortDesc}
            </p>
          )}

          <hr className="border-ink-100 my-6" />

          <dl className="space-y-3">
            {category.size && (
              <SpecRow
                label={locale === "en" ? "Size" : "사이즈"}
                value={category.size}
              />
            )}
            {category.fileFormat && (
              <SpecRow
                label={locale === "en" ? "File format" : "파일 형식"}
                value={category.fileFormat}
              />
            )}
            {deadlineStr && (
              <SpecRow
                label={locale === "en" ? "Deadline" : "제출 마감"}
                value={deadlineStr}
              />
            )}
            {subs.length > 0 && (
              <SpecRow
                label={locale === "en" ? "Composition" : "구성"}
                value={subs
                  .map((s) => localizedHelper(s.name, locale))
                  .join(", ")}
              />
            )}
          </dl>

          <div className="mt-auto pt-6">
            <hr className="border-ink-100 mb-5" />
            <div className="flex items-end justify-end">
              {minPrice > 0 ? (
                <div className="text-right">
                  <div className="font-num text-[32px] font-bold text-ink-900 leading-none tracking-tight">
                    <span className="text-[16px] font-semibold mr-2">
                      {locale === "en" ? "Per slot" : "1구좌당"}
                    </span>
                    {minPrice.toLocaleString()}
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

// ============================================================================
// PackageSlide — 패키지 1개당 1페이지
// ============================================================================

function PackageSlide({
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

          {pkg.tagline && (
            <p className="text-[13px] text-ink-700 mt-3 leading-relaxed">
              {pkg.tagline}
            </p>
          )}

          <hr className="border-ink-100 my-6" />

          {pkg.includedItems && pkg.includedItems.length > 0 && (
            <div>
              <div className="text-[12px] font-bold text-ink-900 mb-2">
                {locale === "en" ? "Included" : "포함 항목"}
              </div>
              <ul className="space-y-1 text-[12.5px] text-ink-700">
                {pkg.includedItems.map((it, i) => (
                  <li key={i}>· {it.label}</li>
                ))}
              </ul>
            </div>
          )}

          {pkg.priceNote && (
            <p className="text-[11px] text-ink-500 mt-3 leading-relaxed whitespace-pre-line">
              {pkg.priceNote}
            </p>
          )}

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
