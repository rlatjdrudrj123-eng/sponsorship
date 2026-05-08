"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import {
  buildStoragePath,
  deleteFile,
  uploadFile,
} from "@/lib/firebase/storage";

type Props = {
  categoryId: string;
  fileUrl: string | undefined;
  filePath: string | undefined;
  onChange: (next: { url: string; path: string } | null) => Promise<void>;
};

export function PdfUpload({ categoryId, fileUrl, filePath, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("PDF 파일만 업로드 가능합니다.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("PDF는 20MB 이하만 가능합니다.");
      return;
    }
    setError(null);
    setPct(0);
    try {
      const path = buildStoragePath(
        `categories/${categoryId}/guide`,
        file.name
      );
      const result = await uploadFile(file, path, (p) => setPct(p));
      if (filePath) await deleteFile(filePath).catch(() => undefined);
      await onChange({ url: result.url, path: result.storagePath });
      setPct(null);
    } catch (e) {
      setPct(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    if (!confirm("가이드 PDF를 제거할까요?")) return;
    try {
      await onChange(null);
      if (filePath) await deleteFile(filePath).catch(() => undefined);
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (fileUrl) {
    const filename = filePath ? filePath.split("/").slice(-1)[0].replace(/^[a-z0-9-]+_/, "") : "design-guide.pdf";
    return (
      <div className="flex items-center gap-3 p-3 bg-mint-50 border border-mint-100 rounded-btn">
        <FileText className="w-5 h-5 text-mint-700 shrink-0" />
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-[13px] font-mono text-ink-900 hover:underline truncate"
        >
          {filename}
        </a>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[11px] px-2 py-1 rounded border border-ink-100 text-ink-700 hover:bg-white"
        >
          교체
        </button>
        <button
          type="button"
          onClick={remove}
          className="text-[11px] px-2 py-1 rounded border border-red-100 text-red-700 hover:bg-red-50 flex items-center gap-1"
        >
          <X className="w-3 h-3" /> 제거
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
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

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className="w-full p-4 border-[1.5px] border-dashed border-ink-300 rounded-btn flex items-center justify-center gap-2 text-[13px] text-ink-500 hover:border-mint-500 hover:text-mint-700 hover:bg-mint-50 transition-colors relative overflow-hidden"
    >
      {pct !== null ? (
        <>
          <span className="font-mono text-ink-700">{pct}%</span>
          <div
            className="absolute bottom-0 left-0 h-1 bg-mint-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </>
      ) : (
        <>
          <Upload className="w-4 h-4" />
          <span>가이드 PDF 업로드 (.pdf, 20MB 이하)</span>
        </>
      )}
      {error && (
        <p className="text-[10px] text-red-700 absolute bottom-1 left-2">{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}
