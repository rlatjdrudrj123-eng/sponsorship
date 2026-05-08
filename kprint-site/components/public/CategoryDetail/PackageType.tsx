"use client";

import Link from "next/link";
import { ArrowLeft, Check, ShoppingCart } from "lucide-react";
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
  const togglePackage = useCartStore((s) => s.togglePackage);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const inCart = hydrated && hasPackage(pkg.id);
  const discount =
    pkg.originalPrice > 0
      ? Math.round((1 - pkg.discountPrice / pkg.originalPrice) * 100)
      : 0;

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
                onClick={() =>
                  togglePackage({
                    type: "package",
                    packageId: pkg.id,
                    code: pkg.code,
                    price: pkg.discountPrice,
                  })
                }
                className={
                  "mt-4 w-full py-3 rounded-btn font-semibold flex items-center justify-center gap-2 transition-colors " +
                  (inCart
                    ? "bg-ink-900 text-white hover:bg-ink-700"
                    : "bg-mint-500 text-ink-900 hover:bg-mint-700 hover:text-white")
                }
              >
                <ShoppingCart className="w-4 h-4" />
                {inCart ? "카트에서 빼기" : "카트에 담기"}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}
