"use client";

import { Check } from "lucide-react";
import { useCartStore } from "@/lib/cart/cartStore";
import type { Slot, Subcategory } from "@/lib/types";

type Props = {
  categoryId: string;
  subcategories: Subcategory[];
  slots: Slot[];
};

export function SlotPicker({ categoryId, subcategories, slots }: Props) {
  const hasSlot = useCartStore((s) => s.hasSlot);
  const addSlot = useCartStore((s) => s.addSlot);
  const removeSlot = useCartStore((s) => s.removeSlot);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const sortedSubs = [...subcategories].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      {sortedSubs.map((sub) => {
        const subSlots = slots
          .filter((s) => s.subcategoryId === sub.id)
          .sort((a, b) => a.order - b.order);
        const total = subSlots.length;
        const available = subSlots.filter((s) => s.status === "available").length;

        return (
          <div key={sub.id}>
            <div className="flex items-baseline justify-between mb-2.5">
              <div>
                <h4 className="font-bold text-[14px] text-ink-900">
                  {sub.name.ko || "기본"}
                </h4>
                <div className="text-[11px] text-ink-500 mt-0.5">
                  <span className="text-mint-700 font-semibold">{available}</span>
                  <span> / {total} 가능</span>
                </div>
              </div>
            </div>
            {sub.priceNote && (
              <div className="text-[11px] text-ink-500 mb-2 italic">{sub.priceNote}</div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
              {subSlots.map((slot) => {
                const isSold = slot.status !== "available";
                const inCart = hydrated && hasSlot(slot.id);
                const onClickSlot = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSold) return;
                  // 중복 방지 — 명시적 add/remove 분기
                  if (hasSlot(slot.id)) {
                    removeSlot(slot.id);
                  } else {
                    addSlot({
                      type: "slot",
                      slotId: slot.id,
                      categoryId,
                      subcategoryId: sub.id,
                      code: slot.code,
                      price: sub.priceKRW,
                    });
                  }
                };
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={isSold}
                    aria-pressed={inCart}
                    onClick={onClickSlot}
                    title={slot.note ?? slot.code}
                    className={
                      "relative px-2.5 py-2 rounded-btn text-[11px] font-mono transition-colors text-left border-2 " +
                      (isSold
                        ? "bg-ink-100 text-ink-300 border-ink-100 cursor-not-allowed"
                        : inCart
                          ? "bg-mint-500 text-ink-900 border-mint-700 ring-2 ring-mint-200 shadow-sm"
                          : "bg-white text-ink-900 border-ink-100 hover:border-mint-500 hover:bg-mint-50")
                    }
                  >
                    {inCart && (
                      <span
                        aria-hidden
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink-900 text-mint-500 grid place-items-center shadow"
                      >
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                    )}
                    <div className="font-bold truncate">{slot.code}</div>
                    {isSold ? (
                      <div className="text-[10px] mt-0.5 text-ink-300">마감</div>
                    ) : inCart ? (
                      <div className="text-[10px] mt-0.5 font-bold opacity-80">관심 표시됨</div>
                    ) : slot.note ? (
                      <div className="text-[10px] mt-0.5 truncate opacity-70">
                        {slot.note}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
