"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BookmarkCheck, Check, Gift, X } from "lucide-react";
import type { Category, Package, SiteSettings, Slot } from "@/lib/types";
import { useCartStore } from "@/lib/cart/cartStore";
import { Footer } from "@/components/public/Footer";
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
};

export function PackageType({ pkg, resolvedSlots, categories, settings }: Props) {
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const hasPackage = useCartStore((s) => s.hasPackage);
  const addPackage = useCartStore((s) => s.addPackage);
  const removePackage = useCartStore((s) => s.removePackage);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const inCart = hydrated && hasPackage(pkg.id);
  const discount =
    pkg.originalPrice > 0
      ? Math.round((1 - pkg.discountPrice / pkg.originalPrice) * 100)
      : 0;

  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <main className="min-h-screen bg-canvas">
        <div className="border-b border-ink-100 bg-surface">
          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-12 md:pt-16 pb-10">
            <Link
              href={eventId ? `/${eventId}` : "/"}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-6 font-num font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              홈으로
            </Link>
            <div className="font-num text-[11px] uppercase tracking-[0.3em] font-bold mb-3 flex items-center gap-3 text-brand-500">
              <span className="w-6 h-px bg-brand-500" />
              <span>{pkg.tier === "signature" ? "Signature" : "Standard"}</span>
              <span className="text-ink-300">·</span>
              <span className="text-ink-500">{pkg.code}</span>
            </div>
            <h1 className="text-[36px] md:text-[64px] font-bold tracking-tight leading-[1.05] text-ink-900">
              {pkg.name.ko}
            </h1>
            {pkg.tagline && (
              <p className="text-[14px] md:text-[16px] text-ink-500 mt-4 max-w-3xl leading-relaxed">
                {pkg.tagline}
              </p>
            )}
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
                포함 항목
              </div>
              <ul className="space-y-3">
                {(pkg.includedItems ?? []).map((it, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-ink-900">
                    <Check className="w-4 h-4 text-brand-500 shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="font-semibold">{it.label}</div>
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
                  <li className="text-[12px] text-ink-500">포함 항목이 없습니다.</li>
                )}
              </ul>
            </div>

            {/* 동봉 혜택 — 스폰서십 신청 시 추가로 제공되는 노출 권리 */}
            <BundledPerksCard settings={settings} packageCode={pkg.code} />

            <div className="bg-surface border border-ink-100 rounded-card p-6 shadow-card">
              <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                <span className="text-[40px] md:text-[44px] font-bold font-num leading-none text-ink-900">
                  {pkg.discountPrice.toLocaleString()}
                </span>
                <span className="text-[18px] font-bold text-ink-900">원</span>
                {discount > 0 && (
                  <span className="ml-auto text-[12px] font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-pill font-num">
                    {discount}% OFF
                  </span>
                )}
              </div>
              {pkg.originalPrice > pkg.discountPrice && (
                <div className="text-[13px] text-ink-500 line-through font-num">
                  {pkg.originalPrice.toLocaleString()}원
                </div>
              )}
              {pkg.priceNote && (
                <p className="text-[12px] text-ink-500 mt-3 leading-relaxed">
                  {pkg.priceNote}
                </p>
              )}
              <button
                type="button"
                aria-pressed={inCart}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirming(true);
                }}
                className={
                  "mt-5 w-full py-3.5 rounded-pill font-bold flex items-center justify-center gap-2 transition-colors " +
                  (inCart
                    ? "bg-ink-900 text-white hover:bg-ink-700"
                    : "bg-ink-900 text-white hover:bg-brand-500 hover:text-ink-900")
                }
              >
                {inCart ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
                {inCart ? "담김 · 빼기" : "담기"}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer settings={settings} />

      {confirming && (
        <PackageConfirmModal
          pkg={pkg}
          inCart={inCart}
          discount={discount}
          onClose={() => setConfirming(false)}
          onAdd={() => {
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
}: {
  pkg: Package;
  categories: Category[];
}) {
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
        categoryName: cat?.name?.ko ?? cat?.code,
        caption: it.label,
      });
    }
    if (fromIncluded.length > 0) return fromIncluded;
    // fallback: 패키지 자체 hero
    return (pkg.heroImages?.images ?? []).map((img) => ({
      url: img.url,
      caption: img.caption,
      categoryName: undefined as string | undefined,
    }));
  }, [pkg, categories]);

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
      <div className="aspect-[16/10] bg-ink-100 rounded-card grid place-items-center text-ink-300 text-sm">
        이미지 준비 중
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="aspect-[16/10] bg-ink-100 rounded-card overflow-hidden relative">
        {slides.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={s.url}
            alt={s.caption ?? s.categoryName ?? ""}
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
                  aria-label={`${i + 1}번 이미지`}
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
}: {
  settings: SiteSettings | null;
  /** 현재 패키지 코드 — 적용 범위 필터링용 */
  packageCode: string;
}) {
  const allPerks = settings?.bundledPerks ?? DEFAULT_BUNDLED_PERKS;
  const perks = filterPerksForContext(allPerks, packageCode);
  if (perks.length === 0) return null;

  const totalValue = calcPerksTotalValue(perks);

  return (
    <div className="bg-gradient-to-br from-brand-50 to-canvas border border-brand-100 rounded-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold flex items-center gap-2">
            <Gift className="w-3.5 h-3.5" />
            2026 리뉴얼 기념 추가 혜택
          </div>
          <p className="text-[12px] text-ink-700 mt-1 leading-relaxed">
            아래 매체들이 비용 없이 함께 제공됩니다 (일부 항목은 신청 시 택1).
          </p>
        </div>
        {totalValue > 0 && (
          <div className="text-right shrink-0">
            <div className="text-[10px] text-ink-500 font-semibold">총 상당 가치</div>
            <div className="text-[20px] font-bold text-brand-700 font-num leading-tight">
              {totalValue.toLocaleString()}
              <span className="text-[12px] ml-0.5">원</span>
            </div>
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {perks.map((perk, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[13px] text-ink-900"
          >
            <Check className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold">{perk.label}</span>
                {perk.condition && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-100 text-ink-500">
                    {perk.condition}
                  </span>
                )}
                {perk.valueKRW && (
                  <span className="text-[11px] text-ink-500 font-num ml-auto">
                    {perk.valueKRW.toLocaleString()}원 상당
                  </span>
                )}
              </div>
              {perk.description && (
                <p className="text-[11.5px] text-ink-500 mt-0.5 leading-snug">
                  {perk.description}
                </p>
              )}
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
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-card sm:rounded-card shadow-2xl overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-brand-700 font-bold">
              패키지 상세
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <h3 className="text-[18px] font-bold text-ink-900 leading-tight">
                {pkg.name.ko}
              </h3>
              <span className="text-[10px] text-brand-700 font-bold">
                {pkg.tier === "signature" ? "시그니처" : "스탠다드"}
              </span>
            </div>
            <span className="text-[10px] text-ink-500 font-mono mt-0.5 block">{pkg.code}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-btn hover:bg-ink-50 text-ink-500 shrink-0"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          {(pkg.includedItems ?? []).length > 0 && (
            <div>
              <div className="text-[11px] text-ink-500 mb-1.5">포함 항목</div>
              <ul className="space-y-1">
                {(pkg.includedItems ?? []).map((it, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-[13px] text-ink-900 leading-snug"
                  >
                    <Check className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                    <span>{it.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-2 border-t border-ink-100">
            <div className="text-[11px] text-ink-500 mb-0.5">가격</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-brand-700 font-mono">
                {pkg.discountPrice.toLocaleString()}
                <span className="text-[14px] ml-1">원</span>
              </span>
              {discount > 0 && (
                <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                  {discount}% OFF
                </span>
              )}
            </div>
            {pkg.originalPrice > pkg.discountPrice && (
              <div className="text-[11px] text-ink-500 line-through font-mono mt-0.5">
                {pkg.originalPrice.toLocaleString()}원
              </div>
            )}
            <div className="text-[10.5px] text-ink-500 mt-1">
              (정식 견적은 사무국 회신 시 안내드립니다)
            </div>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-ink-100 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            취소
          </button>
          {inCart ? (
            <button
              type="button"
              onClick={onRemove}
              className="px-4 py-2.5 rounded-btn bg-ink-900 text-brand-500 text-[13px] font-bold hover:bg-ink-700 flex items-center justify-center gap-1.5"
            >
              <BookmarkCheck className="w-4 h-4" />
              빼기
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="px-4 py-2.5 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-bold hover:bg-brand-700 hover:text-white flex items-center justify-center gap-1.5"
            >
              <Bookmark className="w-4 h-4" />
              담기
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
