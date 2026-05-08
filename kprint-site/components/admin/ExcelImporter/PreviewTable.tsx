"use client";

import type { ParseResult } from "@/lib/excel/parser";

const PREVIEW_LIMIT = 10;

type Props = { result: ParseResult };

export function PreviewTable({ result }: Props) {
  const rows = result.rows.slice(0, PREVIEW_LIMIT);
  const errorRowSet = new Set(
    result.errors
      .map((e) => e.rowIndex)
      .filter((r): r is number => r !== null && r !== undefined)
  );
  const warningRowSet = new Set(
    result.warnings
      .map((w) => w.rowIndex)
      .filter((r): r is number => r !== null && r !== undefined)
  );

  if (result.rows.length === 0) {
    return (
      <div className="text-sm text-ink-500 py-8 text-center bg-ink-50 rounded-btn">
        파싱된 행이 없습니다. (오류로 모두 제외됨)
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto border border-ink-100 rounded-btn">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-ink-50 text-ink-700">
              <Th>행</Th>
              <Th>채널</Th>
              <Th>대분류</Th>
              <Th>코드</Th>
              <Th>유형</Th>
              <Th>소분류</Th>
              <Th align="right">단가</Th>
              <Th>마감</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isError = errorRowSet.has(row.rowIndex);
              const isWarning = !isError && warningRowSet.has(row.rowIndex);
              const rowClass = isError
                ? "bg-red-50"
                : isWarning
                  ? "bg-amber-50/60"
                  : "hover:bg-ink-50";
              return (
                <tr
                  key={row.rowIndex}
                  className={`border-t border-ink-100 ${rowClass}`}
                >
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-ink-500">
                    {row.rowIndex}
                  </td>
                  <td className="px-2.5 py-1.5 text-ink-700">{row.channel}</td>
                  <td className="px-2.5 py-1.5 text-ink-900">
                    {row.categoryNameKo}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-ink-900">
                    {row.slotCode}
                  </td>
                  <td className="px-2.5 py-1.5 text-ink-500 font-mono text-[11px]">
                    {row.categoryType}
                  </td>
                  <td className="px-2.5 py-1.5 text-ink-700">
                    {row.subcategoryNameKo || (
                      <span className="text-ink-300">(기본)</span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-ink-900 text-right">
                    {row.priceKRW.toLocaleString()}원
                  </td>
                  <td className="px-2.5 py-1.5">
                    {row.isSold ? (
                      <span className="text-ink-500">마감</span>
                    ) : (
                      <span className="text-mint-700 font-semibold">가능</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {result.rows.length > PREVIEW_LIMIT && (
        <div className="text-[11px] text-ink-500 mt-2 text-right">
          전체 {result.rows.length}개 중 {PREVIEW_LIMIT}개 표시
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-2.5 py-2 font-semibold uppercase tracking-wide text-[10px] ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}
