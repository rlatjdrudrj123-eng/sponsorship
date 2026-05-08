"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, BookmarkCheck, Check, X } from "lucide-react";
import type { Package, SiteSettings, Slot } from "@/lib/types";
import { ImageCarousel } from "./_shared/ImageCarousel";
import { useCartStore } from "@/lib/cart/cartStore";
import { Footer } from "@/components/public/Footer";

type Props = {
  pkg: Package;
  resolvedSlots?: Map<string, Slot>;
  settings: SiteSettings | null;
};

export function PackageType({ pkg, resolvedSlots, settings }: Props) {
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
      <main className="min-h-screen bg-white">
        <div className="border-b border-ink-100">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-8">
            <Link
              href="/packages"
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              전체 패키지
            </Link>
            <div className="flex items-baseline gap-3 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest font-mono text-ink-500">
                {pkg.code}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-mint-700 font-bold">
                {pkg.tier === "signature" ? "시그니처" : "스탠다드"}
              </span>
            </div>
            <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
              {pkg.name.ko}
            </h1>
            {pkg.tagline && (
              <p className="text-[14px] text-ink-700 mt-3 max-w-3xl leading-relaxed">
                {pkg.tagline}
              </p>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10 grid lg:grid-cols-[1.4fr_1fr] gap-10 items-start">
          <ImageCarousel slot={pkg.heroImages} aspectRatio="aspect-[16/10]" />

          <div className="space-y-6">
            <div className="bg-[#fafaf7] border border-ink-100 rounded-card p-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold mb-3">
                포함 항목
              </div>
              <ul className="space-y-2.5">
                {(pkg.includedItems ?? []).map((it, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-ink-900">
                    <Check className="w-4 h-4 text-mint-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div>{it.label}</div>
                      {resolvedSlots &&
                        it.referencedSlotIds &&
                        it.referencedSlotIds.length > 0 && (
                          <div className="text-[11px] text-ink-500 mt-0.5 font-mono">
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

            <div className="bg-mint-50 border border-mint-100 rounded-card p-6">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-[32px] font-bold text-mint-700">
                  {pkg.discountPrice.toLocaleString()}원
                </span>
                {discount > 0 && (
                  <span className="text-[14px] font-bold text-mint-700 bg-white px-2 py-0.5 rounded">
                    {discount}% OFF
                  </span>
                )}
              </div>
              {pkg.originalPrice > pkg.discountPrice && (
                <div className="text-[13px] text-ink-500 line-through font-mono">
                  {pkg.originalPrice.toLocaleString()}원
                </div>
              )}
              {pkg.priceNote && (
                <p className="text-[12px] text-ink-700 mt-3 leading-relaxed">
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
                  "mt-4 w-full py-3 rounded-btn font-semibold flex items-center justify-center gap-2 transition-colors " +
                  (inCart
                    ? "bg-ink-900 text-mint-500 hover:bg-ink-700 ring-2 ring-mint-200"
                    : "bg-mint-500 text-ink-900 hover:bg-mint-700 hover:text-white")
                }
              >
                {inCart ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                {inCart ? "관심 표시됨 · 해제하기" : "관심 표시"}
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
            <div className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold">
              패키지 상세
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <h3 className="text-[18px] font-bold text-ink-900 leading-tight">
                {pkg.name.ko}
              </h3>
              <span className="text-[10px] text-mint-700 font-bold">
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
                    <Check className="w-3.5 h-3.5 text-mint-500 shrink-0 mt-0.5" />
                    <span>{it.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-2 border-t border-ink-100">
            <div className="text-[11px] text-ink-500 mb-0.5">가격</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-mint-700 font-mono">
                {pkg.discountPrice.toLocaleString()}
                <span className="text-[14px] ml-1">원</span>
              </span>
              {discount > 0 && (
                <span className="text-[11px] font-bold text-mint-700 bg-mint-50 px-2 py-0.5 rounded">
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
              className="px-4 py-2.5 rounded-btn bg-ink-900 text-mint-500 text-[13px] font-bold hover:bg-ink-700 flex items-center justify-center gap-1.5"
            >
              <BookmarkCheck className="w-4 h-4" />
              관심 해제
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="px-4 py-2.5 rounded-btn bg-mint-500 text-ink-900 text-[13px] font-bold hover:bg-mint-700 hover:text-white flex items-center justify-center gap-1.5"
            >
              <Bookmark className="w-4 h-4" />
              관심 표시
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
