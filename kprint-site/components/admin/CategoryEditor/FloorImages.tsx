"use client";

import { useRef, useState } from "react";
import { AlertTriangle, MapPin, Trash2, Upload, X } from "lucide-react";
import {
  buildStoragePath,
  deleteFileIfOwned,
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

  // 고아 도면 — subcategoryId 가 현재 소분류 중 어디에도 없는 도면.
  // 엑셀 임포트(소분류 재생성)·행사 복제 등으로 발생하며, 위 타일 그리드에는
  // 렌더되지 않아 삭제 버튼도 없다. 아래 별도 섹션에서 삭제만 가능하게 노출.
  const subIds = new Set(sortedSubs.map((s) => s.id));
  const orphans = list.filter((fi) => !subIds.has(fi.subcategoryId));

  const removeOrphan = async (fi: FloorImage) => {
    if (
      !confirm(
        `연결이 끊긴 도면을 삭제할까요? (핀 ${fi.pins?.length ?? 0}개 포함)\n` +
          `현재 소분류에 연결되지 않아 공개 사이트 "위치보기"에 잘못 노출되던 도면입니다.`
      )
    )
      return;
    await onChange(list.filter((x) => x !== fi));
    // 내 소유 경로일 때만 파일 삭제 — 복제로 공유된 타 행사 파일은 참조만 제거
    await deleteFileIfOwned(
      fi.storagePath,
      `categories/${categoryId}/floor`
    ).catch(() => undefined);
  };

  return (
    <div className="space-y-4">
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

      {orphans.length > 0 && (
        <div className="rounded-btn border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[12.5px] font-bold text-amber-800">
              연결이 끊긴 도면 {orphans.length}개
            </span>
          </div>
          <p className="text-[11px] text-amber-700 mb-3 leading-relaxed">
            엑셀 임포트나 행사 복제로 소분류가 바뀌어, 현재 소분류에 연결되지
            않은 도면입니다. 공개 사이트 &quot;위치보기&quot;에 잘못 노출될 수
            있으니 삭제하세요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {orphans.map((fi, i) => (
              <div
                key={fi.storagePath || i}
                className="bg-white border border-amber-200 rounded-btn p-2 flex items-center gap-2"
              >
                <div className="w-14 h-10 bg-ink-100 rounded overflow-hidden shrink-0 grid place-items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fi.url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-ink-700 font-semibold">
                    핀 {fi.pins?.length ?? 0}개
                  </div>
                  <div className="text-[10px] text-ink-400 truncate font-mono">
                    {fi.subcategoryId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeOrphan(fi)}
                  className="px-2 py-1.5 rounded text-red-700 hover:bg-red-50 shrink-0"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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
      // 기존 도면 storage 삭제 (replace) — 내 소유 경로일 때만 (복제 참조 보호)
      if (floorImage?.storagePath) {
        await deleteFileIfOwned(
          floorImage.storagePath,
          `categories/${categoryId}/floor`
        ).catch(() => undefined);
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
      await deleteFileIfOwned(
        floorImage.storagePath,
        `categories/${categoryId}/floor`
      ).catch(() => undefined);
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
