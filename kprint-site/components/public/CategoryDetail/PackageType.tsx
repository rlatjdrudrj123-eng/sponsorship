"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
              href={eventId ? `/${eventId}/packages` : "/"}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-6 font-num font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              전체 패키지
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
          <ImageCarousel slot={pkg.heroImages} aspectRatio="aspect-[16/10]" />

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

            <div className="bg-brand-grad rounded-card p-6 text-white shadow-glow-sm">
              <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                <span className="text-[40px] md:text-[44px] font-bold font-num leading-none">
                  {pkg.discountPrice.toLocaleString()}
                </span>
                <span className="text-[18px] font-bold">원</span>
                {discount > 0 && (
                  <span className="ml-auto text-[12px] font-bold text-brand-500 bg-white px-2.5 py-1 rounded-pill font-num">
                    {discount}% OFF
                  </span>
                )}
              </div>
              {pkg.originalPrice > pkg.discountPrice && (
                <div className="text-[13px] text-white/70 line-through font-num">
                  {pkg.originalPrice.toLocaleString()}원
                </div>
              )}
              {pkg.priceNote && (
                <p className="text-[12px] text-white/90 mt-3 leading-relaxed">
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
                    : "bg-white text-brand-500 hover:bg-canvas")
                }
              >
                {inCart ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
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
              관심 해제
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="px-4 py-2.5 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-bold hover:bg-brand-700 hover:text-white flex items-center justify-center gap-1.5"
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
