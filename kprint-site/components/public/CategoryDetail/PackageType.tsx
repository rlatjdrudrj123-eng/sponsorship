"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BookmarkCheck, Check, Gift, X } from "lucide-react";
import type { Category, Package, SiteSettings, Slot } from "@/lib/types";
import { useCartStore } from "@/lib/cart/cartStore";
import { Footer } from "@/components/public/Footer";
import { useLocale, localized, localizedField } from "@/lib/i18n/locale";
import { getDisplayPackagePrice, formatPrice } from "@/lib/price";
import {
  DEFAULT_BUNDLED_PERKS,
  calcPerksTotalValue,
  filterPerksForContext,
} from "@/lib/perks";

type Props = {
  pkg: Package;
  resolvedSlots?: Map<string, Slot>;
  categories?: Category[];
  settings: SiteSettings | null;
  /** 모달 컨텍스트 — Footer 안 그리고 main 대신 div 로 (외부 모달 wrapper 가 viewport 처리) */
  inModal?: boolean;
};

export function PackageType({
  pkg,
  resolvedSlots,
  categories,
  settings,
  inModal = false,
}: Props) {
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const hasPackage = useCartStore((s) => s.hasPackage);
  const addPackage = useCartStore((s) => s.addPackage);
  const removePackage = useCartStore((s) => s.removePackage);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const locale = useLocale((s) => s.locale);
  const price = getDisplayPackagePrice(pkg, locale);
  const inCart = hydrated && hasPackage(pkg.id);
  // 매진 — 노출은 유지하되 카트 담기만 차단 (이미 담긴 경우 빼기는 허용)
  const soldOut = !!pkg.soldOut;
  const discount =
    pkg.originalPrice > 0
      ? Math.round((1 - pkg.discountPrice / pkg.originalPrice) * 100)
      : 0;

  const [confirming, setConfirming] = useState(false);

  const Container = inModal ? "div" : "main";

  // 모달 안에서는 컴팩트 2열 (image 좌 / 정보 우) — viewport 내 모두 노출.
  // 풀 페이지에서는 기존 hero 헤더 + 2열 본문 유지.
  if (inModal) {
    return (
      <>
        <Container className="bg-canvas">
          <div className="px-5 md:px-8 py-5 md:py-6 grid lg:grid-cols-[1.1fr_1fr] gap-5 md:gap-7 items-start">
            {/* LEFT — 4:3 이미지 carousel */}
            <PackageHeroAutoCarousel
              pkg={pkg}
              categories={categories ?? []}
              aspectClass="aspect-[4/3]"
            />

            {/* RIGHT — 헤더 + 포함 항목 + 가격/CTA */}
            <div className="space-y-4 min-w-0">
              <div>
                <div className="font-num text-[10.5px] uppercase tracking-[0.3em] font-bold flex items-center gap-2 text-brand-500">
                  <span className="w-4 h-px bg-brand-500" />
                  <span>{pkg.tier === "signature" ? "Signature" : "Standard"}</span>
                  <span className="text-ink-300">·</span>
                  <span className="text-ink-500">{pkg.code}</span>
                  {soldOut && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-ink-300 text-white">
                      {locale === "en" ? "Sold out" : "매진"}
                    </span>
                  )}
                </div>
                <h1 className="text-[24px] md:text-[28px] font-bold tracking-tight leading-[1.2] text-ink-900 break-keep mt-2">
                  {locale === "en"
                    ? pkg.name.en?.trim() || pkg.name.ko
                    : pkg.name.ko}
                </h1>
                {(() => {
                  const tg = localizedField(pkg.tagline, pkg.taglineEn, locale);
                  return tg ? (
                    <p className="text-[12.5px] text-ink-500 mt-2 leading-relaxed">
                      {tg}
                    </p>
                  ) : null;
                })()}
              </div>

              {/* 포함 항목 — 컴팩트 리스트 (카드 외곽 없이) */}
              <div className="border-t border-ink-100 pt-3">
                <div className="font-num text-[10.5px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-2 flex items-center gap-2">
                  <span className="w-3 h-px bg-brand-500" />
                  {locale === "en" ? "Included items" : "포함 항목"}
                </div>
                <ul className="space-y-1.5">
                  {(pkg.includedItems ?? []).map((it, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] text-ink-900 leading-snug"
                    >
                      <Check className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-1" />
                      <span className="flex-1">{localizedField(it.label, it.labelEn, locale)}</span>
                    </li>
                  ))}
                  {(pkg.includedItems ?? []).length === 0 && (
                    <li className="text-[12px] text-ink-500">
                      {locale === "en"
                        ? "No included items."
                        : "포함 항목이 없습니다."}
                    </li>
                  )}
                </ul>
              </div>

              {/* 동봉 혜택 — 컴팩트 변형 */}
              <BundledPerksCard
                settings={settings}
                packageCode={pkg.code}
                compact
              />

              {/* 가격 + CTA */}
              <div className="border-t border-ink-100 pt-4 flex items-end justify-between gap-3 flex-wrap">
                <div>
                  {price.original.value > price.discount.value && (
                    <div className="text-[12px] text-ink-500 line-through font-num leading-none">
                      {formatPrice(price.original.value, price.original.currency)}
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-[28px] md:text-[32px] font-bold font-num leading-none text-ink-900">
                      {formatPrice(price.discount.value, price.discount.currency)}
                    </span>
                    {discount > 0 && (
                      <span className="text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-pill font-num">
                        {discount}% OFF
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={inCart}
                  disabled={soldOut && !inCart}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (soldOut && !inCart) return;
                    setConfirming(true);
                  }}
                  className={
                    "px-6 h-11 rounded-pill font-bold text-[13.5px] flex items-center justify-center gap-2 transition-colors " +
                    (soldOut && !inCart
                      ? "bg-ink-300 text-white cursor-not-allowed"
                      : inCart
                        ? "bg-ink-900 text-white hover:bg-ink-700"
                        : "bg-ink-900 text-white hover:bg-brand-500 hover:text-ink-900")
                  }
                >
                  {soldOut && !inCart ? (
                    locale === "en" ? "Sold out" : "매진"
                  ) : (
                    <>
                      {inCart ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                      {locale === "en"
                        ? inCart
                          ? "Added · Remove"
                          : "Add to cart"
                        : inCart
                          ? "담김 · 빼기"
                          : "담기"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Container>

        {confirming && (
          <PackageConfirmModal
            pkg={pkg}
            inCart={inCart}
            discount={discount}
            onClose={() => setConfirming(false)}
            onAdd={() => {
              if (pkg.soldOut) return; // 매진 — 담기 차단
              addPackage({
                type: "package",
                eventId: pkg.eventId,
                packageId: pkg.id,
                code: pkg.code,
                price: pkg.discountPrice,
              });
              setConfirming(false);
            }}
            onRemove={() => {
              removePackage(pkg.id);
              setConfirming(false);
            }}
          />
        )}
      </>
    );
  }

  // ─── 풀 페이지 (기존) ─────────────────────────────────────
  return (
    <>
      <Container className="min-h-screen bg-canvas">
        <div className="border-b border-ink-100 bg-surface">
          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-12 md:pt-16 pb-10">
            <Link
              href={eventId ? `/${eventId}` : "/"}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-6 font-num font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {locale === "en" ? "Home" : "홈으로"}
            </Link>
            <div className="font-num text-[11px] uppercase tracking-[0.3em] font-bold mb-3 flex items-center gap-3 text-brand-500">
              <span className="w-6 h-px bg-brand-500" />
              <span>{pkg.tier === "signature" ? "Signature" : "Standard"}</span>
              <span className="text-ink-300">·</span>
              <span className="text-ink-500">{pkg.code}</span>
              {soldOut && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-ink-300 text-white">
                  {locale === "en" ? "Sold out" : "매진"}
                </span>
              )}
            </div>
            <h1 className="text-[32px] md:text-[56px] font-bold tracking-tight leading-[1.15] text-ink-900 break-keep">
              {locale === "en" ? (pkg.name.en?.trim() || pkg.name.ko) : pkg.name.ko}
            </h1>
            {(() => {
              const tg = localizedField(pkg.tagline, pkg.taglineEn, locale);
              return tg ? (
                <p className="text-[14px] md:text-[16px] text-ink-500 mt-4 max-w-3xl leading-relaxed">
                  {tg}
                </p>
              ) : null;
            })()}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10 grid lg:grid-cols-[1.4fr_1fr] gap-10 items-start">
          <PackageHeroAutoCarousel
            pkg={pkg}
            categories={categories ?? []}
          />

          <div className="space-y-5">
            <div className="bg-surface border border-ink-100 rounded-card p-6 shadow-card">
              <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-brand-500" />
                {locale === "en" ? "Included items" : "포함 항목"}
              </div>
              <ul className="space-y-3">
                {(pkg.includedItems ?? []).map((it, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-ink-900">
                    <Check className="w-4 h-4 text-brand-500 shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="font-semibold">{localizedField(it.label, it.labelEn, locale)}</div>
                      {resolvedSlots &&
                        it.referencedSlotIds &&
                        it.referencedSlotIds.length > 0 && (
                          <div className="text-[11px] text-ink-500 mt-1 font-num">
                            {it.referencedSlotIds
                              .map((id) => resolvedSlots.get(id)?.code)
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        )}
                    </div>
                  </li>
                ))}
                {(pkg.includedItems ?? []).length === 0 && (
                  <li className="text-[12px] text-ink-500">
                    {locale === "en" ? "No included items." : "포함 항목이 없습니다."}
                  </li>
                )}
              </ul>
            </div>

            {/* 동봉 혜택 — 스폰서십 신청 시 추가로 제공되는 노출 권리 */}
            <BundledPerksCard settings={settings} packageCode={pkg.code} />

            <div className="bg-surface border border-ink-100 rounded-card p-6 shadow-card">
              <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                <span className="text-[40px] md:text-[44px] font-bold font-num leading-none text-ink-900">
                  {formatPrice(price.discount.value, price.discount.currency)}
                </span>
                {discount > 0 && (
                  <span className="ml-auto text-[12px] font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-pill font-num">
                    {discount}% OFF
                  </span>
                )}
              </div>
              {price.original.value > price.discount.value && (
                <div className="text-[13px] text-ink-500 line-through font-num">
                  {formatPrice(price.original.value, price.original.currency)}
                </div>
              )}
              {(() => {
                const pn = localizedField(pkg.priceNote, pkg.priceNoteEn, locale);
                return pn ? (
                  <p className="text-[12px] text-ink-500 mt-3 leading-relaxed">
                    {pn}
                  </p>
                ) : null;
              })()}
              <button
                type="button"
                aria-pressed={inCart}
                disabled={soldOut && !inCart}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (soldOut && !inCart) return;
                  setConfirming(true);
                }}
                className={
                  "mt-5 w-full py-3.5 rounded-pill font-bold flex items-center justify-center gap-2 transition-colors " +
                  (soldOut && !inCart
                    ? "bg-ink-300 text-white cursor-not-allowed"
                    : inCart
                      ? "bg-ink-900 text-white hover:bg-ink-700"
                      : "bg-ink-900 text-white hover:bg-brand-500 hover:text-ink-900")
                }
              >
                {soldOut && !inCart ? (
                  locale === "en" ? "Sold out" : "매진"
                ) : (
                  <>
                    {inCart ? (
                      <BookmarkCheck className="w-4 h-4" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                    {locale === "en"
                      ? inCart
                        ? "Added · Remove"
                        : "Add to cart"
                      : inCart
                        ? "담김 · 빼기"
                        : "담기"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Container>
      <Footer settings={settings} />

      {confirming && (
        <PackageConfirmModal
          pkg={pkg}
          inCart={inCart}
          discount={discount}
          onClose={() => setConfirming(false)}
          onAdd={() => {
            if (pkg.soldOut) return; // 매진 — 담기 차단
            addPackage({
              type: "package",
              eventId: pkg.eventId,
              packageId: pkg.id,
              code: pkg.code,
              price: pkg.discountPrice,
            });
            setConfirming(false);
          }}
          onRemove={() => {
            removePackage(pkg.id);
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}

// ============================================================================
// PackageHeroAutoCarousel — 패키지에 포함된 카테고리들의 hero 이미지를 모아
// 자동 회전하는 좌측 큰 이미지 영역. 카테고리 매핑이 없으면 pkg.heroImages 사용.
// ============================================================================

function PackageHeroAutoCarousel({
  pkg,
  categories,
  aspectClass = "aspect-[16/10]",
}: {
  pkg: Package;
  categories: Category[];
  aspectClass?: string;
}) {
  const locale = useLocale((s) => s.locale);
  const isEn = locale === "en";
  const slides = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const fromIncluded: Array<{
      url: string;
      caption?: string;
      categoryName?: string;
    }> = [];
    const seen = new Set<string>();
    for (const it of pkg.includedItems ?? []) {
      if (!it.categoryId) continue;
      if (seen.has(it.categoryId)) continue;
      seen.add(it.categoryId);
      const cat = byId.get(it.categoryId);
      const url = cat?.heroImages?.images?.[0]?.url;
      if (!url) continue;
      fromIncluded.push({
        url,
        categoryName: localized(cat?.name, locale) || cat?.code,
        caption: localizedField(it.label, it.labelEn, locale),
      });
    }
    if (fromIncluded.length > 0) return fromIncluded;
    // fallback: 패키지 자체 hero
    return (pkg.heroImages?.images ?? []).map((img) => ({
      url: img.url,
      caption: img.caption,
      categoryName: undefined as string | undefined,
    }));
  }, [pkg, categories, locale]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, 3500);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <div
        className={`${aspectClass} bg-ink-100 rounded-card grid place-items-center text-ink-300 text-sm`}
      >
        {isEn ? "Images coming soon" : "이미지 준비 중"}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={`${aspectClass} bg-ink-100 rounded-card overflow-hidden relative`}
      >
        {slides.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={s.url}
            alt={s.caption ?? s.categoryName ?? ""}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "auto"}
            className={
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-700 " +
              (i === idx ? "opacity-100" : "opacity-0")
            }
          />
        ))}
        {slides.length > 1 && (
          <>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={
                    "w-1.5 h-1.5 rounded-full transition-colors " +
                    (idx === i ? "bg-white" : "bg-white/40 hover:bg-white/70")
                  }
                  aria-label={isEn ? `Image ${i + 1}` : `${i + 1}번 이미지`}
                />
              ))}
            </div>
            {slides[idx]?.categoryName && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-pill bg-ink-900/85 text-white text-[11px] font-semibold">
                {slides[idx].categoryName}
              </div>
            )}
          </>
        )}
      </div>
      {slides[idx]?.caption && (
        <p className="mt-2 text-[11.5px] text-ink-500">{slides[idx].caption}</p>
      )}
    </div>
  );
}

// ============================================================================
// BundledPerksCard — 스폰서십 신청 시 모든 사람에게 동봉되는 혜택 카드
// ============================================================================

function BundledPerksCard({
  settings,
  packageCode,
  compact = false,
}: {
  settings: SiteSettings | null;
  /** 현재 패키지 코드 — 적용 범위 필터링용 */
  packageCode: string;
  /** 모달용 컴팩트 — 패딩·폰트 축소, 설명문 생략 */
  compact?: boolean;
}) {
  const locale = useLocale((s) => s.locale);
  const allPerks = settings?.bundledPerks ?? DEFAULT_BUNDLED_PERKS;
  const perks = filterPerksForContext(allPerks, packageCode);
  if (perks.length === 0) return null;

  const totalValue = calcPerksTotalValue(perks);
  const isEn = locale === "en";

  return (
    <div
      className={
        compact
          ? "bg-brand-50/60 border border-brand-100 rounded-btn p-3"
          : "bg-gradient-to-br from-brand-50 to-canvas border border-brand-100 rounded-card p-6 shadow-card"
      }
    >
      <div
        className={
          "flex items-start justify-between gap-3 " + (compact ? "mb-2" : "mb-4")
        }
      >
        <div className="min-w-0">
          <div className="font-num text-[10.5px] uppercase tracking-[0.3em] text-brand-500 font-bold flex items-center gap-1.5">
            <Gift className="w-3 h-3" />
            {isEn ? "2026 bonus perks" : "2026 추가 혜택"}
          </div>
          {!compact && (
            <p className="text-[12px] text-ink-700 mt-1 leading-relaxed">
              {isEn
                ? "The following items are included at no extra cost (some may require a pick-one at signup)."
                : "아래 매체들이 비용 없이 함께 제공됩니다 (일부 항목은 신청 시 택1)."}
            </p>
          )}
        </div>
        {totalValue > 0 && (
          <div className="text-right shrink-0">
            <div className="text-[10px] text-ink-500 font-semibold">
              {isEn ? "Total value" : "총 상당 가치"}
            </div>
            <div
              className={
                "font-bold text-brand-700 font-num leading-tight " +
                (compact ? "text-[15px]" : "text-[20px]")
              }
            >
              {isEn
                ? `$${Math.round(totalValue / 1000).toLocaleString()}`
                : (
                    <>
                      {totalValue.toLocaleString()}
                      <span className="text-[11px] ml-0.5">원</span>
                    </>
                  )}
            </div>
          </div>
        )}
      </div>
      <ul className={compact ? "space-y-1" : "space-y-2"}>
        {perks.map((perk, i) => (
          <li
            key={i}
            className={
              "flex items-start gap-2 text-ink-900 " +
              (compact ? "text-[12px]" : "text-[13px]")
            }
          >
            <Check
              className={
                "text-brand-500 shrink-0 mt-0.5 " +
                (compact ? "w-3 h-3" : "w-4 h-4")
              }
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold">
                  {localizedField(perk.label, perk.labelEn, locale)}
                </span>
                {(() => {
                  const cn = localizedField(perk.condition, perk.conditionEn, locale);
                  return cn ? (
                    <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-ink-100 text-ink-500">
                      {cn}
                    </span>
                  ) : null;
                })()}
                {perk.valueKRW && !compact && (
                  <span className="text-[11px] text-ink-500 font-num ml-auto">
                    {isEn
                      ? `~$${Math.round(perk.valueKRW / 1000).toLocaleString()} value`
                      : `${perk.valueKRW.toLocaleString()}원 상당`}
                  </span>
                )}
              </div>
              {!compact &&
                (() => {
                  const pd = localizedField(perk.description, perk.descriptionEn, locale);
                  return pd ? (
                    <p className="text-[11.5px] text-ink-500 mt-0.5 leading-snug">
                      {pd}
                    </p>
                  ) : null;
                })()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Package 확인 모달
// ============================================================================

function PackageConfirmModal({
  pkg,
  inCart,
  discount,
  onClose,
  onAdd,
  onRemove,
}: {
  pkg: Package;
  inCart: boolean;
  discount: number;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const locale = useLocale((s) => s.locale);
  const isEn = locale === "en";
  const price = getDisplayPackagePrice(pkg, locale);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => {
        // backdrop 자체 mouseDown 일 때만 닫기 — input 드래그가 backdrop 에서
        // mouseUp 되어도 close 발화 안 함
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white w-full sm:max-w-md rounded-t-card sm:rounded-card shadow-2xl overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-brand-700 font-bold">
              {isEn ? "Package detail" : "패키지 상세"}
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <h3 className="text-[18px] font-bold text-ink-900 leading-tight">
                {isEn ? (pkg.name.en?.trim() || pkg.name.ko) : pkg.name.ko}
              </h3>
              <span className="text-[10px] text-brand-700 font-bold">
                {pkg.tier === "signature"
                  ? isEn
                    ? "Signature"
                    : "시그니처"
                  : isEn
                    ? "Standard"
                    : "스탠다드"}
              </span>
              {pkg.soldOut && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-ink-300 text-white">
                  {isEn ? "Sold out" : "매진"}
                </span>
              )}
            </div>
            <span className="text-[10px] text-ink-500 font-mono mt-0.5 block">{pkg.code}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-btn hover:bg-ink-50 text-ink-500 shrink-0"
            aria-label={isEn ? "Close" : "닫기"}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          {(pkg.includedItems ?? []).length > 0 && (
            <div>
              <div className="text-[11px] text-ink-500 mb-1.5">
                {isEn ? "Included items" : "포함 항목"}
              </div>
              <ul className="space-y-1">
                {(pkg.includedItems ?? []).map((it, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-[13px] text-ink-900 leading-snug"
                  >
                    <Check className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                    <span>{localizedField(it.label, it.labelEn, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-2 border-t border-ink-100">
            <div className="text-[11px] text-ink-500 mb-0.5">
              {isEn ? "Price" : "가격"}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-brand-700 font-mono">
                {formatPrice(price.discount.value, price.discount.currency)}
              </span>
              {discount > 0 && (
                <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                  {discount}% OFF
                </span>
              )}
            </div>
            {price.original.value > price.discount.value && (
              <div className="text-[11px] text-ink-500 line-through font-mono mt-0.5">
                {formatPrice(price.original.value, price.original.currency)}
              </div>
            )}
            <div className="text-[10.5px] text-ink-500 mt-1">
              {isEn
                ? "(Final quote follows secretariat reply.)"
                : "(정식 견적은 사무국 회신 시 안내드립니다)"}
            </div>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-ink-100 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            {isEn ? "Cancel" : "취소"}
          </button>
          {inCart ? (
            <button
              type="button"
              onClick={onRemove}
              className="px-4 py-2.5 rounded-btn bg-ink-900 text-brand-500 text-[13px] font-bold hover:bg-ink-700 flex items-center justify-center gap-1.5"
            >
              <BookmarkCheck className="w-4 h-4" />
              {isEn ? "Remove" : "빼기"}
            </button>
          ) : pkg.soldOut ? (
            <button
              type="button"
              disabled
              className="px-4 py-2.5 rounded-btn bg-ink-300 text-white text-[13px] font-bold cursor-not-allowed"
            >
              {isEn ? "Sold out" : "매진"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="px-4 py-2.5 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-bold hover:bg-brand-700 hover:text-white flex items-center justify-center gap-1.5"
            >
              <Bookmark className="w-4 h-4" />
              {isEn ? "Add" : "담기"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
