"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
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
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Copy,
  FileDown,
  MessageSquare,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useCartStore } from "@/lib/cart/cartStore";
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
import { localized, useLocale, localeHref } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import {
  getDisplayPrice,
  getDisplayPackagePrice,
  formatPrice,
} from "@/lib/price";

/**
 * 비교 페이지 — 카트에 담은 후보(또는 URL에 인코딩된 ids)를 나란히 비교.
 *
 * URL 패턴:
 *   /[eventSlug]/compare                 → 현재 카트 항목 비교
 *   /[eventSlug]/compare?ids=slot:abc,pkg:xyz  → 공유 URL (로그인 불요)
 *
 * 보여주는 것:
 *   - 컬럼별 카드 (이미지·이름·가격·신청 마감·목적·시점·위치)
 *   - 예산 합계
 *   - 노출 시점 타임라인
 *   - 위치 분포
 *   - 작년 구매사 (있는 경우)
 *
 * 열마다: 비교에서 빼기(ids 쿼리에서 제거 → router.replace, 공유 URL 유지),
 *   패키지는 카트 담기/빼기(매진이면 담기 차단), 카테고리·구좌는 구좌 선택 링크.
 *
 * 결재용 도구: 복사 가능한 URL · PDF 출력 · 정식 견적 요청.
 */
export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-ink-500">…</div>
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
  const locale = useLocale((s) => s.locale);
  const router = useRouter();
  const pathname = usePathname();

  // 패키지 열 카트 담기/빼기 — items 를 구독해야 토글 직후 버튼 상태가 바뀐다
  const cartItems = useCartStore((s) => s.items);
  const cartHydrated = useCartStore((s) => s.hasHydrated);
  const addPackage = useCartStore((s) => s.addPackage);
  const removePackage = useCartStore((s) => s.removePackage);
  const cartPackageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const it of cartItems) if (it.type === "package") ids.add(it.packageId);
    return ids;
  }, [cartItems]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  // 비교에서 뺀 뒤 포커스 이동 대상 — 다음 열의 '빼기' 버튼 key, "" 면 제목, null 이면 없음
  const focusAfterRemove = useRef<string | null>(null);

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
    soldOut?: boolean;
    /** 신청 마감일 "YYYY.MM.DD" — 없으면 "-" (패키지는 항상 "-") */
    deadlineLabel: string;
    /** 패키지 열만 — 카트 담기용 원본 */
    pkg?: Package;
  };

  const columns = useMemo<Column[]>(() => {
    if (!loaded) return [];
    const cols: Column[] = [];
    const isEn = locale === "en";
    const unitDefault = isEn ? "per slot" : "구좌당";
    const negotiable = isEn ? "Contact us" : "협의";
    const labelSlot = (sub: Subcategory | undefined): string => {
      if (!sub || !sub.priceKRW) return negotiable;
      const dp = getDisplayPrice(sub, locale);
      const unit = localized(sub.unit, locale) || unitDefault;
      return `${formatPrice(dp.value, dp.currency)} / ${unit}`;
    };
    const labelPkg = (pkg: Package): string => {
      const dp = getDisplayPackagePrice(pkg, locale);
      const main = formatPrice(dp.discount.value, dp.discount.currency);
      if (dp.original.value > dp.discount.value) {
        const orig = formatPrice(dp.original.value, dp.original.currency);
        return isEn ? `${main} (was ${orig})` : `${main} (정가 ${orig})`;
      }
      return main;
    };
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
          title: localized(cat.name, locale),
          code: slot.code,
          kind: "slot",
          imageUrl: cat.heroImages?.images?.[0]?.url,
          priceKRW: sub?.priceKRW ?? 0,
          priceLabel: labelSlot(sub),
          purposeLabels: purps.map((p) =>
            isEn ? PURPOSE_META[p].en ?? PURPOSE_META[p].ko : PURPOSE_META[p].ko
          ),
          timing: cat.timingOverride ?? [],
          location: cat.locationOverride ?? [],
          href: localeHref(
            eventId,
            `/sponsorships?view=card&detail=${cat.slug}`,
            locale
          ),
          lastYearBuyers: cat.lastYear?.buyers,
          deadlineLabel: formatDeadline(cat.deadline),
        });
      } else if (it.kind === "cat") {
        const cat = categories.get(it.id);
        if (!cat) continue;
        const catSubs = Array.from(subcategories.values())
          .filter((s) => s.categoryId === cat.id)
          .sort((a, b) => a.priceKRW - b.priceKRW);
        const sub = catSubs[0];
        const purps = derivePurposes(cat);
        cols.push({
          key: `cat:${cat.id}`,
          title: localized(cat.name, locale),
          code: cat.code,
          kind: "slot",
          imageUrl: cat.heroImages?.images?.[0]?.url,
          priceKRW: sub?.priceKRW ?? 0,
          priceLabel: labelSlot(sub),
          purposeLabels: purps.map((p) =>
            isEn ? PURPOSE_META[p].en ?? PURPOSE_META[p].ko : PURPOSE_META[p].ko
          ),
          timing: cat.timingOverride ?? [],
          location: cat.locationOverride ?? [],
          href: localeHref(
            eventId,
            `/sponsorships?view=card&detail=${cat.slug}`,
            locale
          ),
          lastYearBuyers: cat.lastYear?.buyers,
          deadlineLabel: formatDeadline(cat.deadline),
        });
      } else {
        const pkg = packages.get(it.id);
        if (!pkg) continue;
        cols.push({
          key: `pkg:${pkg.id}`,
          title: localized(pkg.name, locale),
          code: pkg.code,
          kind: "pkg",
          imageUrl: pkg.heroImages?.images?.[0]?.url,
          priceKRW: pkg.discountPrice,
          priceLabel: labelPkg(pkg),
          purposeLabels: [pkg.tier === "signature" ? "Signature" : "Standard"],
          timing: [],
          location: [],
          href: localeHref(eventId, `/packages/${pkg.id}`, locale),
          soldOut: !!pkg.soldOut,
          deadlineLabel: "-",
          pkg,
        });
      }
    }
    return cols;
  }, [loaded, items, categories, subcategories, slots, packages, eventId, locale]);

  const totalKRW = columns.reduce((sum, c) => sum + c.priceKRW, 0);

  // 비교에서 빼기 — ids 쿼리에서 해당 항목만 제거하고 URL 교체 (공유 URL 그대로 유지).
  // 0개가 되면 ids 를 지워 빈 상태로.
  const removeFromCompare = (key: string) => {
    const idx = columns.findIndex((c) => c.key === key);
    const remaining = columns.filter((c) => c.key !== key);
    focusAfterRemove.current =
      remaining.length > 0
        ? remaining[Math.max(0, Math.min(idx, remaining.length - 1))].key
        : "";

    const nextIds = items
      .map((it) => `${it.kind}:${it.id}`)
      .filter((k) => k !== key);
    const sp = new URLSearchParams(search.toString());
    if (nextIds.length > 0) sp.set("ids", nextIds.join(","));
    else sp.delete("ids");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // 뺀 열 자리로 포커스 이동 (키보드 사용자가 맨 위로 튕기지 않게)
  useEffect(() => {
    const target = focusAfterRemove.current;
    if (target === null) return;
    focusAfterRemove.current = null;
    const btn = target
      ? document.querySelector<HTMLButtonElement>(
          `[data-compare-remove="${target}"]`
        )
      : null;
    if (btn) btn.focus();
    else headingRef.current?.focus({ preventScroll: true });
  }, [columns]);

  // 패키지 열 카트 토글 — PackageType 의 담기와 같은 값. 매진이면 담기만 차단(빼기는 허용).
  const togglePackageInCart = (pkg: Package) => {
    if (cartPackageIds.has(pkg.id)) {
      removePackage(pkg.id);
      return;
    }
    if (pkg.soldOut) return;
    addPackage({
      type: "package",
      eventId: pkg.eventId,
      packageId: pkg.id,
      code: pkg.code,
      price: pkg.discountPrice,
    });
  };

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

  // columns.key 는 이미 'slot:xxx' / 'cat:xxx' / 'pkg:xxx' 접두사 포함 — 그대로 전달.
  const compareIdsAsString = useMemo(
    () => columns.map((c) => c.key).join(","),
    [columns]
  );

  const printPdf = () => {
    if (typeof window === "undefined") return;
    if (!compareIdsAsString) return;
    // 영문 비교 화면에서는 /en/cart/print 로 (영문 PDF)
    window.open(
      localeHref(
        eventId,
        `/cart/print?ids=${encodeURIComponent(compareIdsAsString)}`,
        locale
      ),
      "_blank"
    );
  };

  if (!loaded) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-ink-500">
        {t("common.loading", locale)}
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-canvas">
        <header className="px-6 md:px-16 pt-16 md:pt-20 pb-8 md:pb-10 border-b border-ink-100 bg-surface">
          <div className="max-w-7xl mx-auto">
            <Link
              href={localeHref(eventId, "/sponsorships", locale)}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-4 font-num font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("spons.title", locale)}
            </Link>
            <div className="font-num text-[11px] md:text-[12px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-px bg-brand-500" />
              compare
            </div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-[32px] md:text-[48px] font-bold tracking-tight leading-[1.15] text-ink-900 break-keep outline-none"
            >
              {locale === "en"
                ? `Comparing ${columns.length} items`
                : `${columns.length}개 항목 비교`}
            </h1>
            <p className="text-[14px] md:text-[16px] text-ink-500 mt-3 leading-relaxed max-w-2xl">
              {locale === "en"
                ? "Selected candidates side-by-side. Share this URL — execs can view without login."
                : "선택한 후보들을 나란히 봅니다. 이 URL을 그대로 공유하면 임원이 로그인 없이 볼 수 있어요. 사내 결재용으로 그대로 활용."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyShareUrl}
                className="px-4 py-2 rounded-pill border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:border-ink-900 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied
                  ? locale === "en"
                    ? "Copied!"
                    : "복사됨!"
                  : locale === "en"
                    ? "Copy share URL"
                    : "공유 URL 복사"}
              </button>
              <button
                type="button"
                onClick={printPdf}
                disabled={columns.length === 0}
                className="px-4 py-2 rounded-pill border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:border-ink-900 flex items-center gap-1.5 disabled:opacity-40"
              >
                <FileDown className="w-3.5 h-3.5" />
                {t("cart.print", locale)}
              </button>
              <Link
                href={localeHref(
                  eventId,
                  compareIdsAsString
                    ? `/contact?ids=${encodeURIComponent(compareIdsAsString)}`
                    : "/contact",
                  locale
                )}
                className="px-4 py-2 rounded-pill bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm flex items-center gap-1.5 transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {locale === "en" ? "Request quote" : "정식 견적 요청"}
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
          {columns.length === 0 ? (
            <div className="bg-surface border border-ink-100 rounded-card py-20 text-center">
              <p className="text-[15px] text-ink-700 font-semibold">
                {locale === "en"
                  ? "Nothing to compare yet."
                  : "비교할 항목이 없습니다."}
              </p>
              <p className="text-[13px] text-ink-500 mt-2">
                {locale === "en"
                  ? "Select items from your cart to compare."
                  : "카트에 담은 항목을 선택해 비교할 수 있어요."}
              </p>
              <Link
                href={localeHref(eventId, "/sponsorships", locale)}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 hover:shadow-glow-sm transition-all"
              >
                {locale === "en" ? "Browse sponsorships" : "스폰서십 둘러보기"}
              </Link>
            </div>
          ) : (
            <>
              {/* 합계 */}
              <div className="bg-surface border border-ink-100 rounded-card p-5 mb-6 shadow-card flex items-baseline justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-1">
                    {locale === "en" ? "Budget total" : "예산 합계"}
                  </div>
                  <div className="font-num text-[28px] md:text-[36px] font-bold text-ink-900 leading-none">
                    {locale === "en" ? (
                      formatPrice(Math.round(totalKRW / 1000), "USD")
                    ) : (
                      <>
                        {totalKRW.toLocaleString()}
                        <span className="text-[16px] ml-1 font-semibold">
                          {t("common.won", locale)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-ink-500">
                  {locale === "en"
                    ? "(VAT excluded · final quote after secretariat review)"
                    : "(부가세 별도 · 정식 견적은 사무국 검토 후 회신)"}
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
                  <article
                    key={col.key}
                    className="bg-surface border border-ink-100 rounded-card overflow-hidden hover:border-brand-500 hover:shadow-card transition-all flex flex-col"
                  >
                    <div className="aspect-[4/3] bg-ink-100 relative shrink-0">
                      {/* 이미지 클릭 → 상세 (키보드·스크린리더는 제목 링크 사용) */}
                      <Link
                        href={col.href}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="absolute inset-0 block"
                      >
                        {col.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={col.imageUrl}
                            alt={col.title}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-ink-300 text-xs">
                            {locale === "en" ? "No image" : "이미지 없음"}
                          </div>
                        )}
                      </Link>
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-pill bg-white/95 text-[10px] font-num font-bold text-ink-900 pointer-events-none">
                        {col.kind === "pkg"
                          ? locale === "en"
                            ? "Package"
                            : "패키지"
                          : locale === "en"
                            ? "Slot"
                            : "슬롯"}{" "}
                        · {col.code}
                      </div>
                      {col.soldOut && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-ink-300 text-white pointer-events-none">
                          {locale === "en" ? "Sold out" : "매진"}
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-3 text-[12.5px]">
                      <h2 className="font-bold text-[15px] text-ink-900 leading-tight tracking-tight">
                        <Link
                          href={col.href}
                          className="hover:text-brand-500 transition-colors"
                        >
                          {col.title}
                        </Link>
                      </h2>

                      <Row label={locale === "en" ? "Price" : "가격"}>
                        <span className="font-num font-bold text-ink-900">
                          {col.priceLabel}
                        </span>
                      </Row>

                      <Row label={locale === "en" ? "Deadline" : "신청 마감"}>
                        <span className="font-num text-ink-700">
                          {col.deadlineLabel}
                        </span>
                      </Row>

                      {col.purposeLabels.length > 0 && (
                        <Row label={locale === "en" ? "Purpose" : "목적"}>
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
                        <Row label={locale === "en" ? "Timing" : "시점"}>
                          <span className="text-ink-700">
                            {col.timing
                              .map((t) =>
                                locale === "en"
                                  ? t === "pre"
                                    ? "Pre"
                                    : t === "onsite"
                                      ? "Onsite"
                                      : "Post"
                                  : t === "pre"
                                    ? "사전"
                                    : t === "onsite"
                                      ? "현장"
                                      : "사후"
                              )
                              .join(" · ")}
                          </span>
                        </Row>
                      )}

                      {col.location.length > 0 && (
                        <Row label={locale === "en" ? "Location" : "위치"}>
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
                                          ? locale === "en"
                                            ? "Outdoor"
                                            : "옥외"
                                          : locale === "en"
                                            ? "Online"
                                            : "온라인"
                              )
                              .join(" · ")}
                          </span>
                        </Row>
                      )}

                      {col.lastYearBuyers && col.lastYearBuyers.length > 0 && (
                        <Row
                          label={
                            locale === "en" ? "Last year" : "작년 구매"
                          }
                        >
                          <span className="text-ink-700">
                            {col.lastYearBuyers.slice(0, 2).join(", ")}
                            {col.lastYearBuyers.length > 2 &&
                              (locale === "en"
                                ? ` +${col.lastYearBuyers.length - 2}`
                                : ` 외 ${col.lastYearBuyers.length - 2}곳`)}
                          </span>
                        </Row>
                      )}
                    </div>

                    {/* 열 액션 — 패키지: 카트 담기/빼기 · 카테고리/구좌: 구좌 선택 */}
                    <div className="px-4 pb-4 flex flex-col gap-2">
                      {col.pkg ? (
                        <PackageCartToggle
                          title={col.title}
                          inCart={cartHydrated && cartPackageIds.has(col.pkg.id)}
                          soldOut={!!col.pkg.soldOut}
                          ready={cartHydrated}
                          isEn={locale === "en"}
                          onToggle={() => {
                            if (col.pkg) togglePackageInCart(col.pkg);
                          }}
                        />
                      ) : (
                        <Link
                          href={col.href}
                          className="w-full py-2.5 rounded-pill bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm flex items-center justify-center gap-1.5 transition-all"
                        >
                          <span className="sr-only">{col.title} </span>
                          {locale === "en" ? "Select slots" : "구좌 선택"}
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      )}
                      <button
                        type="button"
                        data-compare-remove={col.key}
                        onClick={() => removeFromCompare(col.key)}
                        className="w-full py-2 rounded-pill border border-ink-100 text-[12px] font-semibold text-ink-700 hover:border-ink-900 hover:text-ink-900 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="sr-only">{col.title} </span>
                        {locale === "en" ? "Remove from compare" : "비교에서 빼기"}
                      </button>
                    </div>
                  </article>
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

/** 패키지 열 카트 담기/빼기 — 매진이면 담기만 막고, 이미 담긴 건 빼기 허용 (PackageType 과 동일) */
function PackageCartToggle({
  title,
  inCart,
  soldOut,
  ready,
  isEn,
  onToggle,
}: {
  title: string;
  inCart: boolean;
  soldOut: boolean;
  /** 카트 hydrate 전에는 비활성 (저장된 카트를 덮어쓰지 않도록) */
  ready: boolean;
  isEn: boolean;
  onToggle: () => void;
}) {
  const blocked = soldOut && !inCart;
  return (
    <button
      type="button"
      aria-pressed={inCart}
      disabled={!ready || blocked}
      onClick={onToggle}
      className={
        "w-full py-2.5 rounded-pill text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:cursor-not-allowed " +
        (blocked
          ? "bg-ink-300 text-white"
          : inCart
            ? "bg-ink-900 text-white hover:bg-ink-700"
            : "bg-ink-900 text-white hover:bg-brand-500 hover:text-ink-900")
      }
    >
      <span className="sr-only">{title} </span>
      {blocked ? (
        isEn ? "Sold out" : "매진"
      ) : (
        <>
          {inCart ? (
            <BookmarkCheck className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Bookmark className="w-4 h-4" aria-hidden="true" />
          )}
          {isEn
            ? inCart
              ? "Added · Remove"
              : "Add to cart"
            : inCart
              ? "담김 · 빼기"
              : "담기"}
        </>
      )}
    </button>
  );
}

/** 카테고리 신청 마감일 → "YYYY.MM.DD" (없으면 "-") */
function formatDeadline(deadline: Category["deadline"]): string {
  const d = deadline?.toDate?.();
  if (!d || Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
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
