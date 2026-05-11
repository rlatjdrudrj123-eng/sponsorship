"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Check, MapPin, X } from "lucide-react";
import { useCartStore } from "@/lib/cart/cartStore";
import type { Slot, Subcategory } from "@/lib/types";

type Props = {
  categoryId: string;
  eventId: string;
  subcategories: Subcategory[];
  slots: Slot[];
};

type SelectedSlot = { slot: Slot; sub: Subcategory } | null;

export function SlotPicker({ categoryId, eventId, subcategories, slots }: Props) {
  const hasSlot = useCartStore((s) => s.hasSlot);
  const addSlot = useCartStore((s) => s.addSlot);
  const removeSlot = useCartStore((s) => s.removeSlot);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const [picked, setPicked] = useState<SelectedSlot>(null);

  const sortedSubs = [...subcategories].sort((a, b) => a.order - b.order);

  return (
    <>
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
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={isSold}
                      aria-pressed={inCart}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isSold) return;
                        setPicked({ slot, sub });
                      }}
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

      {picked && (
        <SlotConfirmModal
          slot={picked.slot}
          sub={picked.sub}
          inCart={hydrated && hasSlot(picked.slot.id)}
          onClose={() => setPicked(null)}
          onAdd={() => {
            addSlot({
              type: "slot",
              eventId,
              slotId: picked.slot.id,
              categoryId,
              subcategoryId: picked.sub.id,
              code: picked.slot.code,
              price: picked.sub.priceKRW,
            });
            setPicked(null);
          }}
          onRemove={() => {
            removeSlot(picked.slot.id);
            setPicked(null);
          }}
        />
      )}
    </>
  );
}

// ============================================================================
// Slot 확인 모달
// ============================================================================

function SlotConfirmModal({
  slot,
  sub,
  inCart,
  onClose,
  onAdd,
  onRemove,
}: {
  slot: Slot;
  sub: Subcategory;
  inCart: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  // ESC 닫기
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
              구좌 상세
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <h3 className="text-[22px] font-bold text-ink-900 leading-tight font-mono">
                {slot.code}
              </h3>
              <span className="text-[12px] text-ink-500">{sub.name.ko || "기본"}</span>
            </div>
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
          {slot.note && (
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-mint-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-ink-500 mb-0.5">위치</div>
                <div className="text-[14px] text-ink-900">{slot.note}</div>
              </div>
            </div>
          )}
          <div>
            <div className="text-[11px] text-ink-500 mb-0.5">단가</div>
            <div className="text-[18px] font-bold text-ink-900 font-mono">
              {sub.priceKRW.toLocaleString()}
              <span className="text-[12px] ml-1 font-semibold">원</span>
              <span className="text-[11px] ml-2 text-ink-500 font-sans">
                / {sub.unit?.ko ?? "구좌당"}
              </span>
            </div>
            <div className="text-[10.5px] text-ink-500 mt-0.5">
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
