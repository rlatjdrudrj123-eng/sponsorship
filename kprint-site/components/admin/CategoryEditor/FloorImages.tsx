"use client";

import { useRef, useState } from "react";
import { MapPin, Upload, X } from "lucide-react";
import {
  buildStoragePath,
  deleteFile,
  uploadFile,
} from "@/lib/firebase/storage";
import type { FloorImage, Subcategory } from "@/lib/types";

type Props = {
  categoryId: string;
  subcategories: Subcategory[];
  floorImages: FloorImage[] | undefined;
  onChange: (next: FloorImage[]) => Promise<void>;
  onOpenPinEditor?: (subcategoryId: string) => void;
};

export function FloorImages({
  categoryId,
  subcategories,
  floorImages,
  onChange,
  onOpenPinEditor,
}: Props) {
  const list = floorImages ?? [];
  const sortedSubs = [...subcategories].sort((a, b) => a.order - b.order);

  if (sortedSubs.length === 0) {
    return (
      <div className="text-sm text-ink-500 py-6 text-center bg-ink-50 rounded-btn">
        도면을 올리려면 먼저 소분류가 있어야 합니다.
      </div>
    );
  }

  const updateOne = async (subId: string, next: FloorImage | null) => {
    const others = list.filter((fi) => fi.subcategoryId !== subId);
    if (next === null) {
      await onChange(others);
    } else {
      await onChange([...others, next]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {sortedSubs.map((sub) => {
        const existing = list.find((fi) => fi.subcategoryId === sub.id);
        return (
          <FloorTile
            key={sub.id}
            categoryId={categoryId}
            subcategory={sub}
            floorImage={existing}
            onChange={(fi) => updateOne(sub.id, fi)}
            onOpenPinEditor={
              onOpenPinEditor ? () => onOpenPinEditor(sub.id) : undefined
            }
          />
        );
      })}
    </div>
  );
}

function FloorTile({
  categoryId,
  subcategory,
  floorImage,
  onChange,
  onOpenPinEditor,
}: {
  categoryId: string;
  subcategory: Subcategory;
  floorImage: FloorImage | undefined;
  onChange: (next: FloorImage | null) => Promise<void>;
  onOpenPinEditor?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }
    setError(null);
    setPct(0);
    try {
      const path = buildStoragePath(
        `categories/${categoryId}/floor`,
        file.name
      );
      const result = await uploadFile(file, path, (p) => setPct(p));
      // 기존 도면 storage 삭제 (replace)
      if (floorImage?.storagePath) {
        await deleteFile(floorImage.storagePath).catch(() => undefined);
      }
      await onChange({
        subcategoryId: subcategory.id,
        url: result.url,
        storagePath: result.storagePath,
        pins: floorImage?.pins ?? [], // 핀은 보존
      });
      setPct(null);
    } catch (e) {
      setPct(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    if (!floorImage) return;
    if (!confirm(`${subcategory.name.ko} 도면을 삭제할까요? (핀 ${floorImage.pins.length}개도 함께)`)) return;
    try {
      await onChange(null);
      await deleteFile(floorImage.storagePath).catch(() => undefined);
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="bg-ink-50/60 border border-ink-100 rounded-btn p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-bold text-ink-900">
          {subcategory.name.ko || "(기본)"}
        </div>
        {floorImage && onOpenPinEditor && (
          <button
            type="button"
            onClick={onOpenPinEditor}
            title="핀 좌표 편집"
            className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-brand-200 text-brand-700 flex items-center gap-1 hover:bg-brand-50 hover:border-brand-500 transition-colors font-semibold"
          >
            <MapPin className="w-2.5 h-2.5" /> 핀 {floorImage.pins.length}
          </button>
        )}
        {floorImage && !onOpenPinEditor && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-ink-100 text-ink-500 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" /> 핀 {floorImage.pins.length}
          </span>
        )}
      </div>

      {floorImage ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={floorImage.url}
            alt={`${subcategory.name.ko} 도면`}
            className="w-full aspect-[4/3] object-cover rounded border border-ink-100"
          />
          <button
            type="button"
            onClick={remove}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink-900/70 text-white grid place-items-center hover:bg-red-500"
            title="제거"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className="w-full aspect-[4/3] border-[1.5px] border-dashed border-ink-300 rounded flex flex-col items-center justify-center text-[11px] text-ink-500 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 transition-colors relative overflow-hidden"
        >
          {pct !== null ? (
            <>
              <div className="font-mono text-ink-700">{pct}%</div>
              <div
                className="absolute bottom-0 left-0 h-1 bg-brand-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" strokeWidth={1.5} />
              <span>도면 업로드</span>
            </>
          )}
        </button>
      )}
      {error && <p className="text-[10px] text-red-700 mt-1">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
