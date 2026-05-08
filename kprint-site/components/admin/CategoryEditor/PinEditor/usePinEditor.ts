"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Category, FloorImage, Pin, Slot } from "@/lib/types";

/** 모달 내부에서만 쓰는 핀 표현 — slotId + 좌표만 */
export type LocalPin = {
  slotId: string;
  x: number;
  y: number;
};

export type UsePinEditorArgs = {
  category: Category;
  subcategoryId: string;
  slots: Slot[]; // 이 소분류의 슬롯들
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function usePinEditor({ category, subcategoryId, slots }: UsePinEditorArgs) {
  const floorImage = (category.floorImages ?? []).find(
    (fi) => fi.subcategoryId === subcategoryId
  );

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => a.order - b.order),
    [slots]
  );

  // 초기 핀 (floorImage.pins 기반)
  const initialPins: LocalPin[] = useMemo(
    () =>
      (floorImage?.pins ?? []).map((p) => ({
        slotId: p.slotId,
        x: p.x,
        y: p.y,
      })),
    [floorImage]
  );

  // 초기 메모 (slot.note 기반)
  const initialNotes = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of slots) m.set(s.id, s.note ?? "");
    return m;
  }, [slots]);

  const [pins, setPins] = useState<LocalPin[]>(initialPins);
  const [notes, setNotes] = useState<Map<string, string>>(
    () => new Map(initialNotes)
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // 카테고리/소분류 바뀌면 초기화
  useEffect(() => {
    setPins(initialPins);
    setNotes(new Map(initialNotes));
    setSelectedSlotId(null);
  }, [initialPins, initialNotes, subcategoryId]);

  const isDirty = useMemo(() => {
    if (pins.length !== initialPins.length) return true;
    const init = new Map(initialPins.map((p) => [p.slotId, p]));
    for (const p of pins) {
      const i = init.get(p.slotId);
      if (!i || i.x !== p.x || i.y !== p.y) return true;
    }
    let dirty = false;
    notes.forEach((v, k) => {
      if ((initialNotes.get(k) ?? "") !== v) dirty = true;
    });
    return dirty;
  }, [pins, notes, initialPins, initialNotes]);

  /** 다음 미배치 슬롯에 자동 배정. 모두 배치됐으면 false 반환. */
  const addPinAt = (x: number, y: number): boolean => {
    const placed = new Set(pins.map((p) => p.slotId));
    const next = sortedSlots.find((s) => !placed.has(s.id));
    if (!next) return false;
    setPins((prev) => [...prev, { slotId: next.id, x: clamp(x), y: clamp(y) }]);
    setSelectedSlotId(next.id);
    return true;
  };

  const removePin = (slotId: string) => {
    setPins((prev) => prev.filter((p) => p.slotId !== slotId));
    if (selectedSlotId === slotId) setSelectedSlotId(null);
  };

  const movePin = (slotId: string, x: number, y: number) => {
    setPins((prev) =>
      prev.map((p) =>
        p.slotId === slotId ? { ...p, x: clamp(x), y: clamp(y) } : p
      )
    );
  };

  const updateNote = (slotId: string, note: string) => {
    setNotes((prev) => {
      const next = new Map(prev);
      next.set(slotId, note);
      return next;
    });
  };

  /** floorImages 배열의 해당 entry 갱신 + slot.note batch 갱신. */
  const save = async () => {
    if (!floorImage) {
      throw new Error("저장 대상 도면이 없어요.");
    }
    const db = getDb();

    const newFloorImage: FloorImage = {
      ...floorImage,
      pins: pins.map<Pin>((p) => {
        const note = notes.get(p.slotId) ?? "";
        const pin: Pin = { slotId: p.slotId, x: p.x, y: p.y };
        if (note) pin.note = note;
        return pin;
      }),
    };

    const newFloorImages = (category.floorImages ?? []).map((fi) =>
      fi.subcategoryId === subcategoryId ? newFloorImage : fi
    );

    await updateDoc(doc(db, "categories", category.id), {
      floorImages: newFloorImages,
      updatedAt: Timestamp.fromDate(new Date()),
    });

    // 슬롯 메모 변경분만 batch
    const batch = writeBatch(db);
    let changes = 0;
    for (const s of slots) {
      const newNote = notes.get(s.id) ?? "";
      const oldNote = s.note ?? "";
      if (newNote !== oldNote) {
        batch.update(doc(db, "slots", s.id), {
          note: newNote || undefined,
        });
        changes++;
      }
    }
    if (changes > 0) await batch.commit();
  };

  return {
    pins,
    notes,
    sortedSlots,
    selectedSlotId,
    setSelectedSlotId,
    isDirty,
    addPinAt,
    removePin,
    movePin,
    updateNote,
    save,
  };
}
