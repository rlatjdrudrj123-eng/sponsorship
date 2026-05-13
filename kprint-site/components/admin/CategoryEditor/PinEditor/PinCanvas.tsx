"use client";

import { useEffect, useRef, useState } from "react";
import type { Slot } from "@/lib/types";
import type { LocalPin } from "./usePinEditor";

type Props = {
  imageUrl: string;
  pins: LocalPin[];
  sortedSlots: Slot[];
  selectedSlotId: string | null;
  onSelect: (slotId: string | null) => void;
  onAdd: (x: number, y: number) => void;
  onMove: (slotId: string, x: number, y: number) => void;
};

export function PinCanvas({
  imageUrl,
  pins,
  sortedSlots,
  selectedSlotId,
  onSelect,
  onAdd,
  onMove,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ slotId: string | null; moved: boolean }>({
    slotId: null,
    moved: false,
  });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const slotIndexMap = new Map<string, number>();
  sortedSlots.forEach((s, i) => slotIndexMap.set(s.id, i + 1));
  const slotByIdMap = new Map(sortedSlots.map((s) => [s.id, s]));

  // 드래그 중 document 레벨 이벤트
  useEffect(() => {
    if (!draggingSlotId) return;
    const handleMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      dragRef.current.moved = true;
      onMove(draggingSlotId, x, y);
    };
    const handleUp = () => setDraggingSlotId(null);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [draggingSlotId, onMove]);

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingSlotId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setHover({ x, y });
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // 드래그 직후의 click 이벤트는 무시
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    // 핀 자체 클릭은 onPinClick에서 처리
    if ((e.target as HTMLElement).closest("[data-pin]")) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAdd(x, y);
  };

  return (
    <div className="bg-[#0a0f1c] p-6 flex items-center justify-center relative min-h-[520px]">
      <div
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleCanvasClick}
        className="relative max-w-[700px] w-full aspect-[4/3] rounded-md overflow-hidden bg-white cursor-crosshair shadow-2xl"
      >
        {!imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="도면"
            className="w-full h-full object-contain bg-ink-50 select-none"
            draggable={false}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-ink-500 text-sm">
            이미지를 불러올 수 없어요
          </div>
        )}

        {hover && !draggingSlotId && (
          <>
            <div
              className="absolute top-0 bottom-0 w-px bg-brand-500/60 pointer-events-none"
              style={{ left: `${hover.x}%` }}
            />
            <div
              className="absolute left-0 right-0 h-px bg-brand-500/60 pointer-events-none"
              style={{ top: `${hover.y}%` }}
            />
          </>
        )}

        {pins.map((p) => {
          const slot = slotByIdMap.get(p.slotId);
          const num = slotIndexMap.get(p.slotId) ?? "?";
          const isSelected = selectedSlotId === p.slotId;
          return (
            <button
              type="button"
              key={p.slotId}
              data-pin
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                dragRef.current = { slotId: p.slotId, moved: false };
                setDraggingSlotId(p.slotId);
                onSelect(p.slotId);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!dragRef.current.moved) onSelect(p.slotId);
                dragRef.current.moved = false;
              }}
              className={
                "absolute w-7 h-7 rounded-full border-[3px] grid place-items-center text-[11px] font-bold cursor-move shadow-lg group " +
                (isSelected
                  ? "bg-ink-900 text-brand-500 border-brand-500 z-20"
                  : "bg-brand-500 text-ink-900 border-white z-10 hover:scale-110 transition-transform")
              }
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: `translate(-50%, -50%)${isSelected ? " scale(1.15)" : ""}`,
              }}
              title={slot?.code ?? ""}
            >
              {num}
              {slot && (
                <span className="absolute left-1/2 -translate-x-1/2 -top-7 px-1.5 py-0.5 bg-ink-900 text-white text-[10px] rounded font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                  {slot.code}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {hover && !draggingSlotId && (
        <div className="absolute top-8 right-8 bg-ink-900/85 text-white px-2.5 py-1.5 rounded font-mono text-[11px] pointer-events-none">
          X: <span className="text-brand-500">{hover.x.toFixed(1)}%</span> · Y:{" "}
          <span className="text-brand-500">{hover.y.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
