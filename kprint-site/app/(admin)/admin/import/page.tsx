"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { onAuthChange } from "@/lib/firebase/auth";
import {
  parseExcelBuffer,
  type ParseResult,
  type ExcelHeader,
} from "@/lib/excel/parser";
import { downloadTemplate } from "@/lib/excel/template";
import {
  importParsedData,
  type ImportMode,
  type ImportPhase,
  type ImportResult,
} from "@/lib/excel/importer";

import { DropZone } from "@/components/admin/ExcelImporter/DropZone";
import { ParsedSummary } from "@/components/admin/ExcelImporter/ParsedSummary";
import { PreviewTable } from "@/components/admin/ExcelImporter/PreviewTable";
import { ProgressOverlay } from "@/components/admin/ExcelImporter/ProgressOverlay";
import { RecentImports } from "@/components/admin/ExcelImporter/RecentImports";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("overwrite");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{
    phase: ImportPhase;
    current: number;
    total: number;
  } | null>(null);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [historyKey, setHistoryKey] = useState(0);

  // 어드민 이메일 (importHistory.uploadedBy 용)
  useEffect(() => {
    return onAuthChange((u) => setAdminEmail(u?.email ?? ""));
  }, []);

  // 파일 선택 즉시 파싱
  useEffect(() => {
    if (!file) {
      setParseResult(null);
      setParseError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        if (cancelled) return;
        const result = parseExcelBuffer(buf);
        setParseResult(result);
        setParseError(null);
      } catch (e) {
        if (cancelled) return;
        setParseError(e instanceof Error ? e.message : String(e));
        setParseResult(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const reset = () => {
    setFile(null);
    setParseResult(null);
    setParseError(null);
    setUploadResult(null);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!file || !parseResult) return;
    if (!adminEmail) {
      setUploadError("로그인 정보가 없습니다. 다시 로그인하세요.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setProgress({ phase: "preserve", current: 0, total: 1 });

    try {
      const result = await importParsedData(
        parseResult,
        mode,
        adminEmail,
        file.name,
        file.size,
        (phase, current, total) => setProgress({ phase, current, total })
      );
      setUploadResult(result);
      if (result.errors.length > 0) {
        setUploadError(
          result.errors.map((e) => `[${e.phase}] ${e.reason}`).join("\n")
        );
      } else {
        setHistoryKey((k) => k + 1);
        // 성공 메시지 잠깐 보여주고 카테고리 페이지로 이동
        setTimeout(() => router.push("/admin/categories"), 1500);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const canUpload =
    file !== null &&
    parseResult !== null &&
    parseResult.ok &&
    parseResult.summary.slots > 0 &&
    !uploading;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
            엑셀 일괄 업로드
          </h1>
          <p className="text-[13px] text-ink-700 mt-1">
            기존 사무국 엑셀 양식 그대로 올리면 카테고리·소분류·구좌가 한 번에 생성됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadTemplate()}
          className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-4 h-4" />
          엑셀 양식 다운로드
        </button>
      </header>

      <div className="grid grid-cols-[1fr_320px] gap-5 items-start">
        {/* 좌측 메인 */}
        <div className="space-y-4 min-w-0">
          <DropZone file={file} onFileSelect={setFile} disabled={uploading} />

          {parseError && (
            <div className="bg-red-50 border border-red-100 rounded-btn p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                파일 파싱 실패:{" "}
                <span className="font-mono text-xs break-all">{parseError}</span>
              </div>
            </div>
          )}

          {parseResult && (
            <>
              <ParsedSummary
                result={parseResult}
                mode={mode}
                onModeChange={setMode}
              />

              {parseResult.errors.length > 0 && (
                <IssueList
                  title="오류 (먼저 수정하세요)"
                  variant="error"
                  total={parseResult.errors.length}
                  items={parseResult.errors.slice(0, 5).map((e) => ({
                    row: e.rowIndex,
                    column: e.column,
                    reason: e.reason,
                  }))}
                />
              )}

              {parseResult.warnings.length > 0 && (
                <IssueList
                  title="경고 (계속 진행 가능)"
                  variant="warn"
                  total={parseResult.warnings.length}
                  items={parseResult.warnings.slice(0, 5).map((w) => ({
                    row: w.rowIndex ?? null,
                    column: w.column,
                    reason: w.reason,
                  }))}
                />
              )}

              <div className="bg-white border border-ink-100 rounded-card p-5">
                <h3 className="text-[15px] font-bold text-ink-900 mb-3">
                  데이터 미리보기
                </h3>
                <PreviewTable result={parseResult} />
              </div>

              <div className="bg-white border border-ink-100 rounded-card px-5 py-4 flex items-center justify-between gap-4">
                <div className="text-[13px] text-ink-700">
                  전체{" "}
                  <strong className="text-ink-900">
                    {parseResult.summary.slots}
                  </strong>
                  개 항목
                  {parseResult.errors.length > 0 && (
                    <span className="ml-2 text-red-700">
                      / 오류 {parseResult.errors.length}개
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={uploading}
                    className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] text-ink-700 hover:bg-ink-50 disabled:opacity-40"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!canUpload}
                    className={
                      "px-4 py-2 rounded-btn font-semibold text-[13px] flex items-center gap-1.5 transition-colors " +
                      (canUpload
                        ? "bg-mint-500 text-ink-900 hover:bg-mint-700 hover:text-white"
                        : "bg-ink-100 text-ink-500 cursor-not-allowed")
                    }
                  >
                    {parseResult.summary.slots}개 항목 업로드
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {parseResult.errors.length > 0 && (
                <p className="text-[12px] text-red-700 -mt-2 px-1">
                  파싱 오류를 먼저 수정한 뒤 다시 업로드하세요.
                </p>
              )}

              {uploadError && (
                <div className="bg-red-50 border border-red-100 rounded-btn p-3 text-sm text-red-700 whitespace-pre-line">
                  업로드 실패: {uploadError}
                </div>
              )}

              {uploadResult && uploadResult.errors.length === 0 && (
                <div className="bg-mint-50 border border-mint-100 rounded-btn p-4 text-sm text-mint-700">
                  ✓ 업로드 완료 — 카테고리{" "}
                  {uploadResult.counts.categoriesCreated +
                    uploadResult.counts.categoriesUpdated}
                  개, 소분류 {uploadResult.counts.subcategoriesWritten}개, 슬롯{" "}
                  {uploadResult.counts.slotsWritten}개. 잠시 후 카테고리 페이지로 이동합니다.
                </div>
              )}
            </>
          )}
        </div>

        {/* 우측 사이드 */}
        <aside className="space-y-4 sticky top-[72px]">
          <div className="bg-white border border-ink-100 rounded-card p-5">
            <h3 className="text-[13px] font-bold text-ink-900 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-mint-500" />
              엑셀 양식 가이드
            </h3>
            <ul className="space-y-1.5 text-[12px] text-ink-700">
              <GuideItem>1행은 헤더 — 수정 금지</GuideItem>
              <GuideItem>대분류 코드는 영문 3자리 (CBA, BGE…)</GuideItem>
              <GuideItem>유형은 9가지 영문 키 중 하나만</GuideItem>
              <GuideItem>마감 컬럼은 TRUE/FALSE 또는 마감/가능</GuideItem>
              <GuideItem>가격은 숫자만 (콤마 OK)</GuideItem>
              <GuideItem>핀 좌표는 어드민 화면에서 직접 찍습니다</GuideItem>
            </ul>
            <div className="mt-3 p-3 rounded-btn bg-ink-900 text-white text-[12px]">
              매년 행사 마감 후 엑셀만 새로 받아 재업로드하면 끝.
              <button
                type="button"
                onClick={() => downloadTemplate()}
                className="block mt-1.5 text-mint-500 font-semibold hover:underline"
              >
                양식 다운로드 →
              </button>
            </div>
          </div>

          <RecentImports reloadKey={historyKey} />
        </aside>
      </div>

      {uploading && progress && (
        <ProgressOverlay
          phase={progress.phase}
          current={progress.current}
          total={progress.total}
        />
      )}
    </div>
  );
}

function GuideItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="w-1 h-1 rounded-full bg-mint-500 mt-1.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function IssueList({
  title,
  items,
  variant,
  total,
}: {
  title: string;
  items: Array<{ row: number | null; column?: ExcelHeader; reason: string }>;
  variant: "error" | "warn";
  total: number;
}) {
  const colors =
    variant === "error"
      ? { bg: "bg-red-50", border: "border-red-100", text: "text-red-700" }
      : { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" };

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-btn p-4`}>
      <div className={`text-[13px] font-bold ${colors.text} mb-2`}>
        {title} · {items.length === total ? `${total}건` : `상위 ${items.length}건 / 총 ${total}건`}
      </div>
      <ul className={`space-y-1 text-[12px] ${colors.text}`}>
        {items.map((it, i) => (
          <li key={i} className="font-mono leading-relaxed">
            {it.row && it.row > 0 ? `행 ${it.row}` : "파일 레벨"}
            {it.column ? ` · ${it.column}` : ""}: {it.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
