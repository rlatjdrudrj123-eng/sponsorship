"use client";

import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  buildStoragePath,
  deleteFile,
  uploadFile,
} from "@/lib/firebase/storage";
import type { ImageDisplayMode, ImageItem, ImageSlot as ImageSlotType } from "@/lib/types";

const MAX_PARALLEL = 3;
const MAX_FILE_SIZE_MB = 10;

type Props = {
  label: string;
  required?: boolean;
  storagePathPrefix: string; // e.g., "categories/{id}/hero"
  value: ImageSlotType | undefined;
  onChange: (next: ImageSlotType) => Promise<void>;
  modes?: ImageDisplayMode[]; // default all 3
};

type UploadState = {
  id: string;
  filename: string;
  pct: number;
  error?: string;
};

export function ImageSlot({
  label,
  required,
  storagePathPrefix,
  value,
  onChange,
  modes = ["single", "carousel", "gallery"],
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<UploadState[]>([]);

  const slot: ImageSlotType = value ?? { mode: modes[0], images: [] };
  const images = slot.images ?? [];

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    // 사이즈 검사
    const oversized = list.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      alert(
        `${oversized.length}개 파일이 ${MAX_FILE_SIZE_MB}MB를 초과합니다.\n` +
          oversized.map((f) => f.name).join(", ")
      );
      return;
    }

    // 동시 업로드 제한 (MAX_PARALLEL)
    const queue = [...list];
    const newImages: ImageItem[] = [];
    const baseOrder = images.length;

    const runOne = async (): Promise<void> => {
      while (queue.length > 0) {
        const file = queue.shift();
        if (!file) break;
        const localId = `${Date.now()}-${file.name}`;
        setUploading((prev) => [
          ...prev,
          { id: localId, filename: file.name, pct: 0 },
        ]);
        try {
          const path = buildStoragePath(storagePathPrefix, file.name);
          const result = await uploadFile(file, path, (pct) => {
            setUploading((prev) =>
              prev.map((u) => (u.id === localId ? { ...u, pct } : u))
            );
          });
          newImages.push({
            url: result.url,
            storagePath: result.storagePath,
            caption: "",
            order: baseOrder + newImages.length,
          });
          setUploading((prev) => prev.filter((u) => u.id !== localId));
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          setUploading((prev) =>
            prev.map((u) => (u.id === localId ? { ...u, error: reason } : u))
          );
          // 실패 항목은 큐에서 제거되었지만 표시는 유지
          // 사용자가 직접 dismiss 가능
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MAX_PARALLEL, list.length) }, () => runOne())
    );

    if (newImages.length > 0) {
      const next: ImageSlotType = {
        mode: slot.mode,
        images: [...images, ...newImages].map((img, i) => ({ ...img, order: i })),
      };
      try {
        await onChange(next);
      } catch (e) {
        alert(`이미지 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  const removeImage = async (idx: number) => {
    const target = images[idx];
    if (!target) return;
    const ok = confirm("이 이미지를 삭제할까요?");
    if (!ok) return;
    const next: ImageSlotType = {
      mode: slot.mode,
      images: images
        .filter((_, i) => i !== idx)
        .map((img, i) => ({ ...img, order: i })),
    };
    try {
      await onChange(next);
      await deleteFile(target.storagePath).catch(() => undefined); // Storage 실패는 swallow
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const moveImage = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= images.length) return;
    const arr = [...images];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await onChange({
      mode: slot.mode,
      images: arr.map((img, i) => ({ ...img, order: i })),
    });
  };

  const updateCaption = async (idx: number, caption: string) => {
    const arr = images.map((img, i) => (i === idx ? { ...img, caption } : img));
    await onChange({ mode: slot.mode, images: arr });
  };

  const changeMode = async (mode: ImageDisplayMode) => {
    await onChange({ mode, images });
  };

  return (
    <div className="bg-ink-50/60 border border-ink-100 rounded-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-bold flex items-center gap-2">
          <span>{label}</span>
          {required && (
            <span className="text-[10px] bg-mint-500 text-ink-900 px-1.5 py-0.5 rounded-full font-bold">
              필수
            </span>
          )}
          <span className="text-[11px] text-ink-500 font-normal">
            ({images.length}장)
          </span>
        </h4>
        {modes.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-500">표시:</span>
            <select
              value={slot.mode}
              onChange={(e) => changeMode(e.target.value as ImageDisplayMode)}
              className="text-[12px] px-2 py-1 border border-ink-100 rounded bg-white"
            >
              {modes.map((m) => (
                <option key={m} value={m}>
                  {modeLabel(m)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {images.map((img, i) => (
          <ImageTile
            key={img.storagePath}
            image={img}
            onRemove={() => removeImage(i)}
            onMoveLeft={i > 0 ? () => moveImage(i, -1) : undefined}
            onMoveRight={i < images.length - 1 ? () => moveImage(i, 1) : undefined}
            onCaptionChange={(c) => updateCaption(i, c)}
          />
        ))}

        {uploading.map((u) => (
          <div
            key={u.id}
            className="aspect-[4/3] rounded-btn border border-ink-100 bg-white grid place-items-center text-[11px] text-ink-500 relative overflow-hidden"
          >
            <div className="text-center px-2">
              {u.error ? (
                <>
                  <div className="text-red-700 font-semibold">실패</div>
                  <div className="text-ink-500 mt-1 break-all">{u.filename}</div>
                  <button
                    type="button"
                    onClick={() =>
                      setUploading((prev) => prev.filter((x) => x.id !== u.id))
                    }
                    className="mt-1 text-mint-700 hover:underline text-[10px]"
                  >
                    닫기
                  </button>
                </>
              ) : (
                <>
                  <div className="font-mono text-ink-700">{u.pct}%</div>
                  <div className="text-ink-500 mt-1 truncate">{u.filename}</div>
                </>
              )}
            </div>
            {!u.error && (
              <div
                className="absolute bottom-0 left-0 h-1 bg-mint-500 transition-all"
                style={{ width: `${u.pct}%` }}
              />
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          className={
            "aspect-[4/3] rounded-btn border-[1.5px] border-dashed flex flex-col items-center justify-center gap-1.5 text-[11px] transition-colors " +
            (dragOver
              ? "border-mint-500 bg-mint-50 text-mint-700"
              : "border-ink-300 text-ink-500 hover:border-mint-500 hover:bg-mint-50 hover:text-mint-700")
          }
        >
          {images.length === 0 && uploading.length === 0 ? (
            <>
              <Upload className="w-5 h-5" strokeWidth={1.5} />
              <span>업로드 / 끌어놓기</span>
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" strokeWidth={1.5} />
              <span>추가</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function modeLabel(m: ImageDisplayMode): string {
  return m === "single" ? "단일" : m === "carousel" ? "캐러셀" : "갤러리";
}

function ImageTile({
  image,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onCaptionChange,
}: {
  image: ImageItem;
  onRemove: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onCaptionChange: (caption: string) => void;
}) {
  return (
    <div className="rounded-btn border border-ink-100 bg-white overflow-hidden flex flex-col">
      <div className="aspect-[4/3] bg-ink-100 relative group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.caption ?? ""}
          className="w-full h-full object-cover"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink-900/70 text-white grid place-items-center hover:bg-red-500 transition-colors"
          title="삭제"
        >
          <X className="w-3 h-3" />
        </button>
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={!onMoveLeft}
            className="w-6 h-6 rounded-full bg-ink-900/70 text-white grid place-items-center hover:bg-ink-900 disabled:opacity-30 disabled:cursor-not-allowed"
            title="앞으로"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={!onMoveRight}
            className="w-6 h-6 rounded-full bg-ink-900/70 text-white grid place-items-center hover:bg-ink-900 disabled:opacity-30 disabled:cursor-not-allowed"
            title="뒤로"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      <input
        type="text"
        value={image.caption ?? ""}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="캡션 (선택)"
        className="text-[11px] px-2 py-1.5 border-t border-ink-100 focus:outline-none focus:bg-mint-50"
      />
    </div>
  );
}
