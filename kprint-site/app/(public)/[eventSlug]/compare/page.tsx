"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  Copy,
  FileDown,
  MessageSquare,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type {
  Category,
  Package,
  SiteSettings,
  Slot,
  Subcategory,
} from "@/lib/types";
import { derivePurposes } from "@/lib/purposes";
import { PURPOSE_META } from "@/lib/types";
import { Footer } from "@/components/public/Footer";

/**
 * 비교 페이지 — 카트에 담은 후보(또는 URL에 인코딩된 ids)를 나란히 비교.
 *
 * URL 패턴:
 *   /[eventSlug]/compare                 → 현재 카트 항목 비교
 *   /[eventSlug]/compare?ids=slot:abc,pkg:xyz  → 공유 URL (로그인 불요, read-only)
 *
 * 보여주는 것:
 *   - 컬럼별 카드 (이미지·이름·가격·잔여·목적·시점·위치)
 *   - 예산 합계
 *   - 노출 시점 타임라인
 *   - 위치 분포
 *   - 작년 구매사 (있는 경우)
 *
 * 결재용 도구: 복사 가능한 URL · PDF 출력 · 정식 견적 요청.
 */
export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-ink-500">불러오는 중…</div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;
  const search = useSearchParams();
  const idsParam = search.get("ids") ?? "";

  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [subcategories, setSubcategories] = useState<Map<string, Subcategory>>(
    new Map()
  );
  const [slots, setSlots] = useState<Map<string, Slot>>(new Map());
  const [packages, setPackages] = useState<Map<string, Package>>(new Map());
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // URL이 지정되어 있으면 그 ID들만, 아니면 빈 셋
  // 지원 형식:
  //   slot:slotId     — 명시 슬롯
  //   pkg:packageId   — 패키지
  //   slot-cat:catId  — 카테고리 대표 슬롯 (compare time 에 가용 슬롯 선정)
  //   cat:catId       — 같음 (alias)
  type Item =
    | { kind: "slot"; id: string }
    | { kind: "pkg"; id: string }
    | { kind: "cat"; id: string };
  const items = useMemo<Item[]>(() => {
    if (!idsParam) return [];
    return idsParam
      .split(",")
      .map((s) => {
        if (s.startsWith("slot-cat:")) {
          return { kind: "cat", id: s.slice("slot-cat:".length) } as Item;
        }
        if (s.startsWith("cat:")) {
          return { kind: "cat", id: s.slice("cat:".length) } as Item;
        }
        if (s.startsWith("pkg:")) {
          return { kind: "pkg", id: s.slice("pkg:".length) } as Item;
        }
        if (s.startsWith("slot:")) {
          return { kind: "slot", id: s.slice("slot:".length) } as Item;
        }
        return null;
      })
      .filter((x): x is Item => !!x);
  }, [idsParam]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const [cs, ss, sl, ps, st] = await Promise.all([
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
          getDocs(query(collection(db, "slots"), where("eventId", "==", eventId))),
          getDocs(
            query(
              collection(db, "packages"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDoc(doc(db, "siteSettings", eventId)),
        ]);
        const cm = new Map<string, Category>();
        cs.docs.forEach((d) => cm.set(d.id, { ...(d.data() as Category), id: d.id }));
        const sm = new Map<string, Subcategory>();
        ss.docs.forEach((d) =>
          sm.set(d.id, { ...(d.data() as Subcategory), id: d.id })
        );
        const slm = new Map<string, Slot>();
        sl.docs.forEach((d) => slm.set(d.id, { ...(d.data() as Slot), id: d.id }));
        const pm = new Map<string, Package>();
        ps.docs.forEach((d) => pm.set(d.id, { ...(d.data() as Package), id: d.id }));
        setCategories(cm);
        setSubcategories(sm);
        setSlots(slm);
        setPackages(pm);
        if (st.exists()) setSettings(st.data() as SiteSettings);
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [eventId]);

  // 비교 컬럼 데이터
  type Column = {
    key: string;
    title: string;
    code: string;
    kind: "slot" | "pkg";
    imageUrl?: string;
    priceKRW: number;
    priceLabel: string;
    purposeLabels: string[];
    timing: string[];
    location: string[];
    href: string;
    lastYearBuyers?: string[];
  };

  const columns = useMemo<Column[]>(() => {
    if (!loaded) return [];
    const cols: Column[] = [];
    for (const it of items) {
      if (it.kind === "slot") {
        const slot = slots.get(it.id);
        if (!slot) continue;
        const cat = categories.get(slot.categoryId);
        const sub = subcategories.get(slot.subcategoryId);
        if (!cat) continue;
        const purps = derivePurposes(cat);
        cols.push({
          key: `slot:${slot.id}`,
          title: cat.name.ko,
          code: slot.code,
          kind: "slot",
          imageUrl: cat.heroImages?.images?.[0]?.url,
          priceKRW: sub?.priceKRW ?? 0,
          priceLabel: sub?.priceKRW
            ? `${sub.priceKRW.toLocaleString()}원 / ${sub.unit?.ko ?? "구좌당"}`
            : "협의",
          purposeLabels: purps.map((p) => PURPOSE_META[p].ko),
          timing: cat.timingOverride ?? [],
          location: cat.locationOverride ?? [],
          href: `/${eventId}/sponsorships?view=card&detail=${cat.slug}`,
          lastYearBuyers: cat.lastYear?.buyers,
        });
      } else if (it.kind === "cat") {
        const cat = categories.get(it.id);
        if (!cat) continue;
        // 가용한 슬롯 + 최저가 소분류 자동 선정
        const catSubs = Array.from(subcategories.values())
          .filter((s) => s.categoryId === cat.id)
          .sort((a, b) => a.priceKRW - b.priceKRW);
        const sub = catSubs[0];
        const purps = derivePurposes(cat);
        cols.push({
          key: `cat:${cat.id}`,
          title: cat.name.ko,
          code: cat.code,
          kind: "slot",
          imageUrl: cat.heroImages?.images?.[0]?.url,
          priceKRW: sub?.priceKRW ?? 0,
          priceLabel: sub?.priceKRW
            ? `${sub.priceKRW.toLocaleString()}원 / ${sub.unit?.ko ?? "구좌당"}`
            : "협의",
          purposeLabels: purps.map((p) => PURPOSE_META[p].ko),
          timing: cat.timingOverride ?? [],
          location: cat.locationOverride ?? [],
          href: `/${eventId}/sponsorships?view=card&detail=${cat.slug}`,
          lastYearBuyers: cat.lastYear?.buyers,
        });
      } else {
        const pkg = packages.get(it.id);
        if (!pkg) continue;
        cols.push({
          key: `pkg:${pkg.id}`,
          title: pkg.name.ko,
          code: pkg.code,
          kind: "pkg",
          imageUrl: pkg.heroImages?.images?.[0]?.url,
          priceKRW: pkg.discountPrice,
          priceLabel: `${pkg.discountPrice.toLocaleString()}원${
            pkg.originalPrice > pkg.discountPrice
              ? ` (정가 ${pkg.originalPrice.toLocaleString()}원)`
              : ""
          }`,
          purposeLabels: [pkg.tier === "signature" ? "Signature" : "Standard"],
          timing: [],
          location: [],
          href: `/${eventId}/packages/${pkg.id}`,
        });
      }
    }
    return cols;
  }, [loaded, items, categories, subcategories, slots, packages, eventId]);

  const totalKRW = columns.reduce((sum, c) => sum + c.priceKRW, 0);

  const copyShareUrl = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const printPdf = () => {
    if (typeof window === "undefined") return;
    const slotIds = columns
      .filter((c) => c.kind === "slot")
      .map((c) => `slot:${c.key.replace(/^slot:/, "")}`);
    const pkgIds = columns
      .filter((c) => c.kind === "pkg")
      .map((c) => `pkg:${c.key.replace(/^pkg:/, "")}`);
    const ids = [...slotIds, ...pkgIds].join(",");
    window.open(
      `/${eventId}/cart/print?ids=${encodeURIComponent(ids)}`,
      "_blank"
    );
  };

  if (!loaded) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-ink-500">
        불러오는 중…
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-canvas">
        <header className="px-6 md:px-16 pt-16 md:pt-20 pb-8 md:pb-10 border-b border-ink-100 bg-surface">
          <div className="max-w-7xl mx-auto">
            <Link
              href={`/${eventId}/sponsorships`}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-4 font-num font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              스폰서십으로
            </Link>
            <div className="font-num text-[11px] md:text-[12px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-px bg-brand-500" />
              compare
            </div>
            <h1 className="text-[36px] md:text-[56px] font-bold tracking-tight leading-[1.05] text-ink-900">
              {columns.length}개 항목 비교
            </h1>
            <p className="text-[14px] md:text-[16px] text-ink-500 mt-3 leading-relaxed max-w-2xl">
              선택한 후보들을 나란히 봅니다. 이 URL을 그대로 공유하면 임원이 로그인
              없이 볼 수 있어요. 사내 결재용으로 그대로 활용.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyShareUrl}
                className="px-4 py-2 rounded-pill border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:border-ink-900 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "복사됨!" : "공유 URL 복사"}
              </button>
              <button
                type="button"
                onClick={printPdf}
                disabled={columns.length === 0}
                className="px-4 py-2 rounded-pill border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:border-ink-900 flex items-center gap-1.5 disabled:opacity-40"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF로 저장
              </button>
              <Link
                href={`/${eventId}/contact`}
                className="px-4 py-2 rounded-pill bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm flex items-center gap-1.5 transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                정식 견적 요청
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
          {columns.length === 0 ? (
            <div className="bg-surface border border-ink-100 rounded-card py-20 text-center">
              <p className="text-[15px] text-ink-700 font-semibold">
                비교할 항목이 없습니다.
              </p>
              <p className="text-[13px] text-ink-500 mt-2">
                카트에 담은 항목을 선택해 비교할 수 있어요.
              </p>
              <Link
                href={`/${eventId}/sponsorships`}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 hover:shadow-glow-sm transition-all"
              >
                스폰서십 둘러보기
              </Link>
            </div>
          ) : (
            <>
              {/* 합계 */}
              <div className="bg-surface border border-ink-100 rounded-card p-5 mb-6 shadow-card flex items-baseline justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-1">
                    예산 합계
                  </div>
                  <div className="font-num text-[28px] md:text-[36px] font-bold text-ink-900 leading-none">
                    {totalKRW.toLocaleString()}
                    <span className="text-[16px] ml-1 font-semibold">원</span>
                  </div>
                </div>
                <div className="text-[11px] text-ink-500">
                  (부가세 별도 · 정식 견적은 사무국 검토 후 회신)
                </div>
              </div>

              {/* 컬럼 그리드 */}
              <div
                className="grid gap-4 overflow-x-auto pb-3"
                style={{
                  gridTemplateColumns: `repeat(${columns.length}, minmax(280px, 1fr))`,
                }}
              >
                {columns.map((col) => (
                  <Link
                    key={col.key}
                    href={col.href}
                    className="bg-surface border border-ink-100 rounded-card overflow-hidden hover:border-brand-500 hover:shadow-card transition-all flex flex-col"
                  >
                    <div className="aspect-[4/3] bg-ink-100 relative shrink-0">
                      {col.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={col.imageUrl}
                          alt={col.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-ink-300 text-xs">
                          이미지 없음
                        </div>
                      )}
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-pill bg-white/95 text-[10px] font-num font-bold text-ink-900">
                        {col.kind === "pkg" ? "패키지" : "슬롯"} · {col.code}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-3 text-[12.5px]">
                      <div>
                        <div className="font-bold text-[15px] text-ink-900 leading-tight tracking-tight">
                          {col.title}
                        </div>
                      </div>

                      <Row label="가격">
                        <span className="font-num font-bold text-ink-900">
                          {col.priceLabel}
                        </span>
                      </Row>

                      {col.purposeLabels.length > 0 && (
                        <Row label="목적">
                          <div className="flex flex-wrap gap-1">
                            {col.purposeLabels.map((p) => (
                              <span
                                key={p}
                                className="text-[10px] font-num font-semibold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-pill"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </Row>
                      )}

                      {col.timing.length > 0 && (
                        <Row label="시점">
                          <span className="text-ink-700">
                            {col.timing
                              .map((t) =>
                                t === "pre" ? "사전" : t === "onsite" ? "현장" : "사후"
                              )
                              .join(" · ")}
                          </span>
                        </Row>
                      )}

                      {col.location.length > 0 && (
                        <Row label="위치">
                          <span className="text-ink-700">
                            {col.location
                              .map((l) =>
                                l === "hall_a"
                                  ? "Hall A"
                                  : l === "hall_b"
                                    ? "Hall B"
                                    : l === "hall_c"
                                      ? "Hall C"
                                      : l === "hall_d"
                                        ? "Hall D"
                                        : l === "outdoor"
                                          ? "옥외"
                                          : "온라인"
                              )
                              .join(" · ")}
                          </span>
                        </Row>
                      )}

                      {col.lastYearBuyers && col.lastYearBuyers.length > 0 && (
                        <Row label="작년 구매">
                          <span className="text-ink-700">
                            {col.lastYearBuyers.slice(0, 2).join(", ")}
                            {col.lastYearBuyers.length > 2 &&
                              ` 외 ${col.lastYearBuyers.length - 2}곳`}
                          </span>
                        </Row>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 border-t border-ink-100 pt-2.5">
      <span className="text-[10px] uppercase tracking-wider text-ink-500 font-num font-semibold w-14 shrink-0 mt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
