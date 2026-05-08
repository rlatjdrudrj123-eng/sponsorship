"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";

const MAX_SIZE_MB = 20;

type Props = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
};

export function DropZone({ file, onFileSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reject, setReject] = useState<string | null>(null);

  const handleSelect = (f: File | null | undefined) => {
    setReject(null);
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) {
      setReject("xlsx 또는 xls 파일만 지원합니다.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setReject(`파일이 ${MAX_SIZE_MB}MB를 초과합니다.`);
      return;
    }
    onFileSelect(f);
  };

  if (file) {
    return (
      <div className="rounded-card border-2 border-mint-200 bg-gradient-to-b from-mint-50 to-white p-6 flex items-center gap-4">
        <FileSpreadsheet className="w-10 h-10 text-mint-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-ink-900 truncate">{file.name}</div>
          <div className="text-xs text-ink-500 mt-1">
            {(file.size / 1024).toFixed(1)} KB
          </div>
        </div>
        <button
          type="button"
          onClick={() => onFileSelect(null)}
          disabled={disabled}
          className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="파일 제거"
          title="파일 제거"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          handleSelect(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={
          "rounded-card border-2 border-dashed bg-gradient-to-b from-mint-50 to-white p-10 flex flex-col items-center text-center gap-2 cursor-pointer transition-colors " +
          (dragOver ? "border-mint-500 bg-mint-100/50" : "border-mint-500") +
          (disabled ? " opacity-60 cursor-not-allowed" : "")
        }
      >
        <Upload className="w-9 h-9 text-mint-500" strokeWidth={1.5} />
        <h3 className="text-base font-semibold text-ink-900">
          엑셀 파일을 여기에 끌어다 놓으세요
        </h3>
        <p className="text-sm text-ink-700">
          또는{" "}
          <span className="text-mint-700 font-semibold underline-offset-2 hover:underline">
            파일 선택
          </span>{" "}
          · .xlsx / .xls 지원, 최대 {MAX_SIZE_MB}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0])}
        />
      </div>
      {reject && (
        <p className="text-xs text-red-700 px-1">{reject}</p>
      )}
    </div>
  );
}
