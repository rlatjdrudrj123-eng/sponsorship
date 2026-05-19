"use client";

import { useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Upload,
  X,
} from "lucide-react";
import {
  buildStoragePath,
  deleteFile,
  uploadFile,
} from "@/lib/firebase/storage";

type Props = {
  categoryId: string;
  fileUrl: string | undefined;
  filePath: string | undefined;
  onChange: (next: { url: string; path?: string } | null) => Promise<void>;
};

export function PdfUpload({ categoryId, fileUrl, filePath, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("PDF 파일만 업로드 가능합니다.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("PDF는 20MB 이하만 가능합니다. 큰 파일은 외부 링크를 사용하세요.");
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

  const saveUrl = async () => {
    const v = urlInput.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) {
      setError("http(s):// 로 시작하는 URL 만 가능합니다.");
      return;
    }
    setError(null);
    try {
      if (filePath) await deleteFile(filePath).catch(() => undefined);
      await onChange({ url: v });
      setUrlInput("");
    } catch (e) {
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
    const isExternal = !filePath;
    const filename = isExternal
      ? fileUrl
      : filePath
        ? filePath.split("/").slice(-1)[0].replace(/^[a-z0-9-]+_/, "")
        : "design-guide.pdf";
    return (
      <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-100 rounded-btn">
        {isExternal ? (
          <ExternalLink className="w-5 h-5 text-brand-700 shrink-0" />
        ) : (
          <FileText className="w-5 h-5 text-brand-700 shrink-0" />
        )}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-[13px] font-mono text-ink-900 hover:underline truncate"
        >
          {filename}
        </a>
        {!isExternal && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[11px] px-2 py-1 rounded border border-ink-100 text-ink-700 hover:bg-white"
          >
            교체
          </button>
        )}
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
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className="w-full p-4 border-[1.5px] border-dashed border-ink-300 rounded-btn flex items-center justify-center gap-2 text-[13px] text-ink-500 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 transition-colors relative overflow-hidden"
      >
        {pct !== null ? (
          <>
            <span className="font-mono text-ink-700">{pct}%</span>
            <div
              className="absolute bottom-0 left-0 h-1 bg-brand-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            <span>가이드 PDF 업로드 (.pdf, 20MB 이하)</span>
          </>
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

      <div className="flex items-center gap-2 text-[11px] text-ink-300">
        <span className="flex-1 h-px bg-ink-100" />
        또는 외부 링크 (Drive 등)
        <span className="flex-1 h-px bg-ink-100" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveUrl();
              }
            }}
            placeholder="https://drive.google.com/..."
            className="w-full pl-8 pr-3 py-2 border border-ink-100 rounded-btn text-[12.5px] font-mono focus:outline-none focus:border-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={saveUrl}
          disabled={!urlInput.trim()}
          className="px-3 py-2 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          저장
        </button>
      </div>

      <p className="text-[10.5px] text-ink-500 leading-relaxed">
        Drive 링크는 <strong>&apos;링크가 있는 모든 사용자&apos; 보기 권한</strong>으로 공유 설정해야
        참가업체가 열 수 있어요.
      </p>

      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
