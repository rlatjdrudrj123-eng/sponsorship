"use client";

import { Check } from "lucide-react";
import { useCartStore } from "@/lib/cart/cartStore";
import type { FloorImage, Slot, Subcategory } from "@/lib/types";

type Props = {
  floorImage: FloorImage;
  categoryId: string;
  eventId: string;
  subcategory: Subcategory;
  slots: Slot[];
};

export function PinOverlay({ floorImage, categoryId, eventId, subcategory, slots }: Props) {
  const hasSlot = useCartStore((s) => s.hasSlot);
  const addSlot = useCartStore((s) => s.addSlot);
  const removeSlot = useCartStore((s) => s.removeSlot);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const slotById = new Map(slots.map((s) => [s.id, s]));
  const sortedSlots = [...slots].sort((a, b) => a.order - b.order);
  const slotIndexMap = new Map<string, number>();
  sortedSlots.forEach((s, i) => slotIndexMap.set(s.id, i + 1));

  return (
    <div className="relative w-full">
      <div className="rounded-card overflow-hidden bg-ink-50 border border-ink-100 aspect-[4/3] relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={floorImage.url}
          alt={`${subcategory.name.ko} 도면`}
          className="absolute inset-0 w-full h-full object-contain block select-none"
          draggable={false}
        />
        {(floorImage.pins ?? []).map((pin) => {
          const slot = slotById.get(pin.slotId);
          if (!slot) return null;
          const num = slotIndexMap.get(pin.slotId) ?? "?";
          const isSold = slot.status !== "available";
          const inCart = hydrated && hasSlot(slot.id);
          const onClickPin = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (isSold) return;
            if (hasSlot(slot.id)) {
              removeSlot(slot.id);
            } else {
              addSlot({
                type: "slot",
                eventId,
                slotId: slot.id,
                categoryId,
                subcategoryId: subcategory.id,
                code: slot.code,
                price: subcategory.priceKRW,
              });
            }
          };
          return (
            <button
              key={pin.slotId}
              type="button"
              disabled={isSold}
              aria-pressed={inCart}
              onClick={onClickPin}
              title={`${slot.code}${pin.note ? ` · ${pin.note}` : ""}`}
              className={
                "absolute w-8 h-8 rounded-full border-[3px] grid place-items-center text-[11px] font-bold shadow-lg transition-all group " +
                (isSold
                  ? "bg-ink-300 text-white border-white opacity-60 cursor-not-allowed"
                  : inCart
                    ? "bg-ink-900 text-mint-500 border-mint-500 ring-4 ring-mint-200"
                    : "bg-mint-500 text-ink-900 border-white hover:scale-110 cursor-pointer")
              }
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: `translate(-50%, -50%)${inCart ? " scale(1.15)" : ""}`,
              }}
            >
              {inCart ? <Check className="w-4 h-4" strokeWidth={3} /> : num}
              <span className="absolute left-1/2 -translate-x-1/2 -top-7 px-1.5 py-0.5 bg-ink-900 text-white text-[10px] rounded font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                {slot.code}
                {inCart ? " · 관심 표시됨" : pin.note ? ` · ${pin.note}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
