"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Category, Slot } from "@/lib/types";
import { usePinEditor } from "./usePinEditor";
import { PinCanvas } from "./PinCanvas";
import { PinSidebar } from "./PinSidebar";

type Props = {
  open: boolean;
  onClose: () => void;
  category: Category;
  subcategoryId: string;
  subcategoryName: string;
  slots: Slot[];
};

export function PinEditor({
  open,
  onClose,
  category,
  subcategoryId,
  subcategoryName,
  slots,
}: Props) {
  const editor = usePinEditor({ category, subcategoryId, slots });
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const floorImage = (category.floorImages ?? []).find(
    (fi) => fi.subcategoryId === subcategoryId
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const attemptClose = () => {
    if (editor.isDirty) {
      const ok = confirm("저장하지 않은 변경사항이 있어요. 닫으시겠어요?");
      if (!ok) return;
    }
    onClose();
  };

  // 키보드: ESC, Delete, 화살표
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        e.preventDefault();
        attemptClose();
        return;
      }
      if (isInput) return;

      if (e.key === "Delete" && editor.selectedSlotId) {
        editor.removePin(editor.selectedSlotId);
        return;
      }
      if (
        editor.selectedSlotId &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        const pin = editor.pins.find((p) => p.slotId === editor.selectedSlotId);
        if (!pin) return;
        const step = 0.5;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        editor.movePin(editor.selectedSlotId, pin.x + dx, pin.y + dy);
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editor.selectedSlotId, editor.pins, editor.isDirty]);

  if (!open) return null;

  // 엣지 케이스: 슬롯 없음
  if (slots.length === 0) {
    return (
      <Backdrop onClose={onClose}>
        <div
          className="bg-white rounded-card max-w-md p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-ink-700">
            이 소분류에 슬롯이 없어요. 엑셀로 먼저 추가하세요.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-btn bg-brand-500 text-ink-900 font-semibold text-[13px]"
          >
            닫기
          </button>
        </div>
      </Backdrop>
    );
  }

  // 엣지 케이스: 도면 없음
  if (!floorImage?.url) {
    return (
      <Backdrop onClose={onClose}>
        <div
          className="bg-white rounded-card max-w-md p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-ink-700">
            도면 이미지가 없어요. 먼저 도면을 업로드하세요.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-btn bg-brand-500 text-ink-900 font-semibold text-[13px]"
          >
            닫기
          </button>
        </div>
      </Backdrop>
    );
  }

  const handleAdd = (x: number, y: number) => {
    const ok = editor.addPinAt(x, y);
    if (!ok) showToast("모든 슬롯이 배치됐습니다");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await editor.save();
      showToast(`핀 ${editor.pins.length}개 저장됨`);
      setTimeout(onClose, 700);
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Backdrop onClose={attemptClose}>
      <div
        className="bg-ink-900 rounded-card max-w-[1100px] w-full overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bg-[#1e293b] text-white px-5 py-3.5 flex items-center gap-3 border-b border-black/30">
          <h3 className="font-bold text-[14px]">핀 좌표 편집</h3>
          <span className="text-[11px] text-ink-300 font-mono">
            {category.code} · {subcategoryName}
          </span>
          <span className="ml-auto" />
          <button
            type="button"
            onClick={attemptClose}
            className="w-8 h-8 rounded-btn bg-white/10 hover:bg-white/20 grid place-items-center text-white"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="grid grid-cols-[1fr_320px] min-h-[520px]">
          <PinCanvas
            imageUrl={floorImage.url}
            pins={editor.pins}
            sortedSlots={editor.sortedSlots}
            selectedSlotId={editor.selectedSlotId}
            onSelect={editor.setSelectedSlotId}
            onAdd={handleAdd}
            onMove={editor.movePin}
          />
          <PinSidebar
            sortedSlots={editor.sortedSlots}
            pins={editor.pins}
            notes={editor.notes}
            selectedSlotId={editor.selectedSlotId}
            onSelect={editor.setSelectedSlotId}
            onRemove={editor.removePin}
            onUpdateNote={editor.updateNote}
            onUpdateCoord={editor.movePin}
          />
        </div>

        <footer className="bg-[#1e293b] px-5 py-3 flex items-center justify-between border-t border-black/30">
          <div className="text-[11px] text-ink-300">
            도면 클릭 = 핀 추가 · 핀 클릭 = 선택 · 드래그 = 이동 · ESC / Delete / 방향키
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={attemptClose}
              className="px-3.5 py-2 rounded-btn text-white/70 hover:text-white text-[13px]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !editor.isDirty}
              className={
                "px-4 py-2 rounded-btn font-semibold text-[13px] transition-colors " +
                (saving || !editor.isDirty
                  ? "bg-white/10 text-white/50 cursor-not-allowed"
                  : "bg-brand-500 text-ink-900 hover:bg-brand-700 hover:text-white")
              }
            >
              {saving ? "저장 중…" : `저장 (${editor.pins.length}개 핀)`}
            </button>
          </div>
        </footer>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink-900 text-white px-4 py-2.5 rounded-btn text-[13px] shadow-lg border border-brand-500 z-[60] font-semibold">
          {toast}
        </div>
      )}
    </Backdrop>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-4 py-8 overflow-y-auto"
    >
      {children}
    </div>
  );
}
