"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Printer } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useCartStore } from "@/lib/cart/cartStore";
import type {
  CartItem,
  Category,
  Channel,
  Package,
  SiteSettings,
  Slot,
  Subcategory,
} from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = {
  offline: "오프라인",
  online: "온라인",
  package: "패키지",
};

export default function CartPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-ink-500">불러오는 중…</div>
      }
    >
      <CartPrintContent />
    </Suspense>
  );
}

function CartPrintContent() {
  const search = useSearchParams();
  const idsParam = search.get("ids") ?? "";
  const items = useCartStore((s) => s.items);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [subcategories, setSubcategories] = useState<Map<string, Subcategory>>(new Map());
  const [slots, setSlots] = useState<Map<string, Slot>>(new Map());
  const [packages, setPackages] = useState<Map<string, Package>>(new Map());
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        // 공개 사이트 — isPublished=true만 읽기 가능 (firestore rules)
        const [c, s, sl, p, st] = await Promise.all([
          getDocs(query(collection(db, "categories"), where("isPublished", "==", true))),
          getDocs(collection(db, "subcategories")),
          getDocs(collection(db, "slots")),
          getDocs(query(collection(db, "packages"), where("isPublished", "==", true))),
          getDoc(doc(db, "siteSettings", "main")),
        ]);
        const cm = new Map<string, Category>();
        c.docs.forEach((d) => cm.set(d.id, { ...(d.data() as Category), id: d.id }));
        const sm = new Map<string, Subcategory>();
        s.docs.forEach((d) => sm.set(d.id, { ...(d.data() as Subcategory), id: d.id }));
        const slm = new Map<string, Slot>();
        sl.docs.forEach((d) => slm.set(d.id, { ...(d.data() as Slot), id: d.id }));
        const pm = new Map<string, Package>();
        p.docs.forEach((d) => pm.set(d.id, { ...(d.data() as Package), id: d.id }));
        setCategories(cm);
        setSubcategories(sm);
        setSlots(slm);
        setPackages(pm);
        if (st.exists()) setSettings(st.data() as SiteSettings);
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const selected = useMemo<CartItem[]>(() => {
    if (!idsParam) return items;
    const ids = new Set(idsParam.split(","));
    return items.filter((it) =>
      it.type === "slot" ? ids.has(`slot:${it.slotId}`) : ids.has(`pkg:${it.packageId}`)
    );
  }, [idsParam, items]);

  // 슬롯/패키지 → 카테고리별 묶음 (같은 카테고리의 슬롯들은 1페이지에 합침)
  type Page =
    | { kind: "category"; category: Category; pickedSlots: Slot[]; subcategoryById: Map<string, Subcategory> }
    | { kind: "package"; pkg: Package; included: string[] }
    | { kind: "missing"; label: string; codes: string[] };

  const pages = useMemo<Page[]>(() => {
    const result: Page[] = [];
    const slotsByCategory = new Map<string, Slot[]>();
    const missingSlotCodes: string[] = [];

    selected.forEach((it) => {
      if (it.type === "slot") {
        const slot = slots.get(it.slotId);
        if (!slot) {
          missingSlotCodes.push(it.code);
          return;
        }
        const arr = slotsByCategory.get(slot.categoryId) ?? [];
        arr.push(slot);
        slotsByCategory.set(slot.categoryId, arr);
      } else {
        const pkg = packages.get(it.packageId);
        if (!pkg) return;
        result.push({
          kind: "package",
          pkg,
          included: (pkg.includedItems ?? []).map((x) => x.label),
        });
      }
    });

    slotsByCategory.forEach((slotList, catId) => {
      const cat = categories.get(catId);
      if (!cat) {
        missingSlotCodes.push(...slotList.map((s) => s.code));
        return;
      }
      result.push({
        kind: "category",
        category: cat,
        pickedSlots: slotList.sort((a, b) => a.order - b.order),
        subcategoryById: subcategories,
      });
    });

    if (missingSlotCodes.length > 0) {
      result.push({
        kind: "missing",
        label: "기타 항목",
        codes: missingSlotCodes,
      });
    }

    return result;
  }, [selected, slots, packages, categories, subcategories]);

  // 데이터 로드 + 카트 hydrate 완료 후 자동 인쇄 다이얼로그
  useEffect(() => {
    if (!ready || !hydrated) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [ready, hydrated]);

  const eventName = settings?.event?.nameKo ?? "K-PRINT 2026";

  if (!ready || !hydrated) {
    return <div className="p-12 text-center text-sm text-ink-500">불러오는 중…</div>;
  }

  return (
    <div className="bg-ink-50 min-h-screen print:bg-white">
      {/* 인쇄 안내 */}
      <div className="print:hidden bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <p className="text-[13px] text-ink-700">
          관심 항목 {pages.length}페이지 미리보기 — 자동으로 인쇄 다이얼로그가 열립니다. PDF로 저장하려면 [PDF로 저장]을 선택하세요.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" />
          인쇄 / PDF
        </button>
      </div>

      <div className="print:m-0">
        {pages.length === 0 && (
          <div className="bg-white mx-auto my-6 w-[297mm] min-h-[210mm] p-12 grid place-items-center text-sm text-ink-500">
            출력할 항목이 없습니다.
          </div>
        )}

        {pages.map((p, i) => {
          if (p.kind === "category") {
            return (
              <CategorySlide
                key={`c-${p.category.id}-${i}`}
                category={p.category}
                pickedSlots={p.pickedSlots}
                subcategoryById={p.subcategoryById}
                index={i}
                total={pages.length}
                eventName={eventName}
              />
            );
          }
          if (p.kind === "package") {
            return (
              <PackageSlide
                key={`p-${p.pkg.id}-${i}`}
                pkg={p.pkg}
                index={i}
                total={pages.length}
                eventName={eventName}
              />
            );
          }
          return (
            <MissingSlide
              key={`m-${i}`}
              codes={p.codes}
              index={i}
              total={pages.length}
              eventName={eventName}
            />
          );
        })}
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
// CategorySlide — /sponsorships 슬라이드 페이지와 동일한 브로셔 레이아웃 (A4 가로)
// ============================================================================

function CategorySlide({
  category,
  pickedSlots,
  subcategoryById,
  index,
  total,
  eventName,
}: {
  category: Category;
  pickedSlots: Slot[];
  subcategoryById: Map<string, Subcategory>;
  index: number;
  total: number;
  eventName: string;
}) {
  const hero = category.heroImages?.images?.[0]?.url;
  const deadlineStr = category.deadline
    ? category.deadline.toDate().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // 선택된 슬롯에 연결된 소분류만 추출
  const pickedSubIds = new Set(pickedSlots.map((s) => s.subcategoryId));
  const pickedSubs = Array.from(pickedSubIds)
    .map((id) => subcategoryById.get(id))
    .filter((s): s is Subcategory => !!s)
    .sort((a, b) => a.order - b.order);
  const minPrice = pickedSubs.length > 0
    ? Math.min(...pickedSubs.map((s) => s.priceKRW).filter((p) => p > 0))
    : 0;

  const hashTags: string[] = [
    CHANNEL_LABELS[category.channel],
    ...(category.tags ?? []).slice(0, 2),
  ];

  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-12 py-10 grid grid-cols-[1.1fr_1fr] gap-10 items-stretch">
        {/* LEFT */}
        <div className="flex flex-col min-w-0">
          {/* 행사명 (작게, 상단) */}
          <div className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold mb-1">
            {eventName} · 관심 항목
          </div>

          {/* 해시태그 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] tracking-wide text-mint-700 font-semibold mb-4">
            {hashTags.map((t, i) => (
              <span key={i}>#{t}</span>
            ))}
          </div>

          {/* 거대한 카테고리 명 + 코드 */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[48px] font-bold leading-[0.95] tracking-tight text-ink-900">
              {category.name.ko}
            </h2>
            <span className="text-[15px] text-ink-300 font-mono">#{category.code}</span>
          </div>

          {/* 한 줄 설명 */}
          {category.shortDesc && (
            <p className="text-[13px] text-ink-700 mt-3 leading-relaxed">
              {category.shortDesc}
            </p>
          )}

          <hr className="border-ink-100 my-5" />

          {/* 스펙 표 */}
          <dl className="space-y-2.5">
            {category.size && <SpecRow label="사이즈" value={category.size} />}
            {category.fileFormat && <SpecRow label="파일 형식" value={category.fileFormat} />}
            {deadlineStr && <SpecRow label="제출 마감" value={deadlineStr} />}
            <SpecRow
              label="선택한 구좌"
              value={
                <span className="font-mono">
                  {pickedSlots.map((s) => s.code).join(", ")}{" "}
                  <span className="text-ink-500">({pickedSlots.length}개)</span>
                </span>
              }
            />
          </dl>

          {/* 가격 */}
          <div className="mt-auto pt-4">
            <hr className="border-ink-100 mb-4" />
            <div className="flex items-baseline justify-end gap-2">
              <div className="text-right">
                {minPrice > 0 ? (
                  <>
                    <div className="text-[14px] text-ink-500 mb-1">최저가</div>
                    <div className="text-[34px] font-bold text-ink-900 leading-none tracking-tight">
                      {minPrice.toLocaleString()}
                      <span className="text-[16px] ml-1 font-semibold">원</span>
                    </div>
                    <div className="text-[10.5px] text-ink-500 mt-1">(부가세 별도)</div>
                  </>
                ) : (
                  <div className="text-[14px] text-ink-500">가격 협의</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="relative flex flex-col min-h-0">
          <div className="flex-1 rounded-card bg-ink-100 overflow-hidden border border-ink-100 relative">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={category.name.ko}
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

      {/* 페이지 번호 */}
      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">{String(index + 1).padStart(2, "0")}</span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

// ============================================================================
// PackageSlide — 패키지 항목 출력
// ============================================================================

function PackageSlide({
  pkg,
  index,
  total,
  eventName,
}: {
  pkg: Package;
  index: number;
  total: number;
  eventName: string;
}) {
  const hero = pkg.heroImages?.images?.[0]?.url;
  const hasDiscount = pkg.originalPrice > pkg.discountPrice && pkg.originalPrice > 0;

  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-12 py-10 grid grid-cols-[1.1fr_1fr] gap-10 items-stretch">
        <div className="flex flex-col min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold mb-1">
            {eventName} · 관심 항목
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] tracking-wide text-mint-700 font-semibold mb-4">
            <span>#패키지</span>
            <span>#{pkg.tier === "signature" ? "시그니처" : "스탠다드"}</span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[48px] font-bold leading-[0.95] tracking-tight text-ink-900">
              {pkg.name.ko}
            </h2>
            <span className="text-[15px] text-ink-300 font-mono">#{pkg.code}</span>
          </div>

          {pkg.tagline && (
            <p className="text-[13px] text-ink-700 mt-3 leading-relaxed">
              {pkg.tagline}
            </p>
          )}

          <hr className="border-ink-100 my-5" />

          {/* 포함 항목 */}
          {pkg.includedItems && pkg.includedItems.length > 0 && (
            <div>
              <div className="text-[12px] font-bold text-ink-900 mb-2">포함 항목</div>
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

          {/* 가격 */}
          <div className="mt-auto pt-4">
            <hr className="border-ink-100 mb-4" />
            <div className="flex items-baseline justify-end gap-2">
              <div className="text-right">
                {hasDiscount && (
                  <div className="text-[14px] text-ink-500 line-through font-mono mb-1">
                    {pkg.originalPrice.toLocaleString()}원
                  </div>
                )}
                {pkg.discountPrice > 0 ? (
                  <>
                    <div className="text-[34px] font-bold text-mint-700 leading-none tracking-tight">
                      {pkg.discountPrice.toLocaleString()}
                      <span className="text-[16px] ml-1 font-semibold text-ink-900">원</span>
                    </div>
                    <div className="text-[10.5px] text-ink-500 mt-1">(부가세 별도)</div>
                  </>
                ) : (
                  <div className="text-[14px] text-ink-500">가격 협의</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col min-h-0">
          <div className="flex-1 rounded-card bg-ink-100 overflow-hidden border border-ink-100 relative">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={pkg.name.ko}
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

      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">{String(index + 1).padStart(2, "0")}</span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

// ============================================================================
// MissingSlide — 카테고리/슬롯 정보를 못 찾은 항목 (보호용)
// ============================================================================

function MissingSlide({
  codes,
  index,
  total,
  eventName,
}: {
  codes: string[];
  index: number;
  total: number;
  eventName: string;
}) {
  return (
    <section className="a4-page bg-white shadow print:shadow-none mx-auto print:mx-0 my-4 print:my-0 w-[297mm] h-[210mm] relative overflow-hidden">
      <div className="h-full px-12 py-10 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500 font-bold mb-1">
          {eventName} · 관심 항목
        </div>
        <h2 className="text-[36px] font-bold tracking-tight text-ink-900">
          데이터 미연결 항목
        </h2>
        <p className="text-[13px] text-ink-500 mt-2">
          상세 정보를 불러오지 못한 항목들입니다. 사무국에 문의하시면 안내드립니다.
        </p>
        <ul className="mt-6 grid grid-cols-3 gap-2 text-[13px] font-mono text-ink-700">
          {codes.map((c, i) => (
            <li key={i} className="px-3 py-1.5 bg-ink-50 rounded">
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute bottom-3 right-12 font-mono tracking-widest text-ink-300 text-[12px]">
        <span className="text-ink-700 font-bold">{String(index + 1).padStart(2, "0")}</span>
        <span className="mx-1">/</span>
        {String(total).padStart(2, "0")}
      </div>
    </section>
  );
}

// ============================================================================
// SpecRow
// ============================================================================

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <dt className="text-[13px] font-bold text-ink-900 w-24 shrink-0">{label}</dt>
      <dd className="text-[13px] text-ink-700 flex-1 min-w-0 break-words">{value}</dd>
    </div>
  );
}
