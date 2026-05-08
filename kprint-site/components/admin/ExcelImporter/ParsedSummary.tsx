"use client";

import type { ParseResult } from "@/lib/excel/parser";
import type { ImportMode } from "@/lib/excel/importer";

type Props = {
  result: ParseResult;
  mode: ImportMode;
  onModeChange: (mode: ImportMode) => void;
};

export function ParsedSummary({ result, mode, onModeChange }: Props) {
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  return (
    <div className="bg-white border border-ink-100 rounded-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-ink-900">파싱 결과</h2>
        {hasErrors ? (
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 font-semibold">
            ⨉ 오류 {result.errors.length}건
          </span>
        ) : hasWarnings ? (
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
            ⚠ 경고 {result.warnings.length}건
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full bg-mint-50 text-mint-700 border border-mint-100 font-semibold">
            ✓ 인식 완료
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <SummaryBox label="대분류" value={result.summary.categories} variant="ok" />
        <SummaryBox label="소분류" value={result.summary.subcategories} variant="ok" />
        <SummaryBox label="구좌" value={result.summary.slots} variant="ok" />
        <SummaryBox
          label="경고/오류"
          value={result.summary.errors + result.summary.warnings}
          variant={hasErrors ? "err" : hasWarnings ? "warn" : "ok"}
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold text-ink-700 mb-2 uppercase tracking-wide">
          동기화 모드
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <ModeRadio
            value="overwrite"
            checked={mode === "overwrite"}
            onChange={onModeChange}
            label="덮어쓰기"
            desc="엑셀 카테고리 전체 교체. 이미지·도면·잠금해제 필드는 보존."
          />
          <ModeRadio
            value="merge"
            checked={mode === "merge"}
            onChange={onModeChange}
            label="병합"
            desc="가격·마감·사이즈만 갱신. 이미지·텍스트는 안 건드림."
          />
          <ModeRadio
            value="add_only"
            checked={mode === "add_only"}
            onChange={onModeChange}
            label="신규만 추가"
            desc="기존 코드 무시, 새 코드만 추가. 가장 안전."
          />
        </div>
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "ok" | "warn" | "err";
}) {
  const colors =
    variant === "err"
      ? { iconBg: "bg-red-100", iconText: "text-red-700", icon: "!", numText: "text-red-700" }
      : variant === "warn"
        ? { iconBg: "bg-amber-100", iconText: "text-amber-700", icon: "!", numText: "text-amber-700" }
        : { iconBg: "bg-emerald-100", iconText: "text-emerald-700", icon: "✓", numText: "text-ink-900" };

  return (
    <div className="rounded-btn border border-ink-100 p-3 flex items-center gap-2.5">
      <div
        className={`w-7 h-7 rounded-full grid place-items-center ${colors.iconBg} ${colors.iconText} text-xs font-bold shrink-0`}
      >
        {colors.icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13px]">
          <span className={`font-bold ${colors.numText}`}>{value}</span>
          <span className="text-ink-500 ml-1">{label}</span>
        </div>
      </div>
    </div>
  );
}

function ModeRadio({
  value,
  checked,
  onChange,
  label,
  desc,
}: {
  value: ImportMode;
  checked: boolean;
  onChange: (v: ImportMode) => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={
        "text-left p-3 rounded-btn border-2 transition-colors " +
        (checked
          ? "border-mint-500 bg-mint-50"
          : "border-ink-100 hover:border-ink-300 bg-white")
      }
    >
      <div className="flex items-center gap-2 font-semibold text-[13px] text-ink-900">
        <span
          className={
            "w-3.5 h-3.5 rounded-full border-2 grid place-items-center shrink-0 " +
            (checked ? "border-mint-500" : "border-ink-300")
          }
        >
          {checked && <span className="w-1.5 h-1.5 rounded-full bg-mint-500" />}
        </span>
        <span>{label}</span>
      </div>
      <div className="text-[11px] text-ink-500 mt-1.5 leading-snug">{desc}</div>
    </button>
  );
}
