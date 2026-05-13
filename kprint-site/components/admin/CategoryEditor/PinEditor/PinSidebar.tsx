"use client";

import { Trash2 } from "lucide-react";
import type { Slot } from "@/lib/types";
import type { LocalPin } from "./usePinEditor";

type Props = {
  sortedSlots: Slot[];
  pins: LocalPin[];
  notes: Map<string, string>;
  selectedSlotId: string | null;
  onSelect: (slotId: string | null) => void;
  onRemove: (slotId: string) => void;
  onUpdateNote: (slotId: string, note: string) => void;
  onUpdateCoord: (slotId: string, x: number, y: number) => void;
};

export function PinSidebar({
  sortedSlots,
  pins,
  notes,
  selectedSlotId,
  onSelect,
  onRemove,
  onUpdateNote,
  onUpdateCoord,
}: Props) {
  const placedById = new Map(pins.map((p) => [p.slotId, p]));
  const selectedPin = selectedSlotId ? placedById.get(selectedSlotId) : null;
  const selectedSlot = selectedSlotId
    ? sortedSlots.find((s) => s.id === selectedSlotId) ?? null
    : null;

  return (
    <aside className="bg-white border-l border-ink-100 flex flex-col p-4 gap-3 overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="bg-brand-50 border border-brand-100 rounded-btn p-3 text-[12px] text-brand-700 leading-relaxed">
        도면을 클릭하면 다음 미배치 구좌가 자동 배정돼요. 핀을 드래그해서 위치를 조정할 수 있어요.
      </div>

      <div>
        <h4 className="text-[10px] uppercase tracking-wide text-ink-500 mb-2 font-semibold">
          구좌 목록 ({pins.length} / {sortedSlots.length} 배치)
        </h4>
        <ul className="space-y-1">
          {sortedSlots.map((slot, i) => {
            const pin = placedById.get(slot.id);
            const isSelected = selectedSlotId === slot.id;
            return (
              <li key={slot.id}>
                <div
                  onClick={() => onSelect(slot.id)}
                  className={
                    "flex items-center gap-2 p-2 rounded-btn border cursor-pointer text-[12px] transition-colors " +
                    (isSelected
                      ? "border-brand-500 bg-brand-50"
                      : "border-ink-100 hover:bg-ink-50")
                  }
                >
                  <div
                    className={
                      "w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0 " +
                      (pin
                        ? "bg-brand-500 text-ink-900"
                        : "bg-ink-100 text-ink-300 border border-dashed border-ink-300")
                    }
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-ink-900 truncate">{slot.code}</div>
                    {pin ? (
                      <div className="text-[10px] text-ink-500 font-mono mt-0.5">
                        {pin.x.toFixed(1)}, {pin.y.toFixed(1)}
                      </div>
                    ) : (
                      <div className="text-[10px] text-ink-300 mt-0.5">미배치</div>
                    )}
                  </div>
                  {pin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(slot.id);
                      }}
                      className="w-6 h-6 grid place-items-center text-ink-300 hover:text-red-700 hover:bg-red-50 rounded shrink-0"
                      title="핀 제거"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {selectedSlot && (
        <div className="bg-ink-50 rounded-btn p-3 mt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[12px] text-ink-900 font-bold">
              {selectedSlot.code}
            </span>
            <span
              className={
                "text-[10px] px-1.5 py-0.5 rounded font-semibold " +
                (selectedSlot.status === "available"
                  ? "bg-brand-50 text-brand-700 border border-brand-100"
                  : "bg-ink-100 text-ink-500")
              }
            >
              {selectedSlot.status === "available" ? "가능" : "마감"}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-ink-500 mb-1 font-semibold">
                위치 메모
              </label>
              <input
                type="text"
                value={notes.get(selectedSlot.id) ?? ""}
                onChange={(e) => onUpdateNote(selectedSlot.id, e.target.value)}
                placeholder="A1 출입구 좌측"
                className="w-full px-2 py-1.5 text-[12px] border border-ink-100 rounded bg-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {selectedPin && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-ink-500 mb-1 font-semibold">X (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={Number(selectedPin.x.toFixed(1))}
                    onChange={(e) =>
                      onUpdateCoord(
                        selectedSlot.id,
                        Number(e.target.value),
                        selectedPin.y
                      )
                    }
                    className="w-full px-2 py-1.5 text-[12px] font-mono border border-ink-100 rounded bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-ink-500 mb-1 font-semibold">Y (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={Number(selectedPin.y.toFixed(1))}
                    onChange={(e) =>
                      onUpdateCoord(
                        selectedSlot.id,
                        selectedPin.x,
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-2 py-1.5 text-[12px] font-mono border border-ink-100 rounded bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
