"use client";

import { Check, AlertTriangle } from "lucide-react";
import type { Category } from "@/lib/types";

type Props = {
  category: Category | null;
};

type CheckItem = {
  label: string;
  ok: boolean;
  hint?: string;
};

export function CompletenessCheck({ category }: Props) {
  if (!category) return null;

  const items: CheckItem[] = [
    {
      label: "기본 정보",
      ok: !!(category.name.ko && category.name.en && category.code && category.shortDesc),
      hint: !category.shortDesc ? "한 줄 설명이 비어있어요" : undefined,
    },
    {
      label: "히어로 이미지",
      ok: (category.heroImages?.images?.length ?? 0) > 0,
      hint: "STEP 7 이미지 슬롯에서 업로드",
    },
    {
      label: "도면 핀",
      ok:
        category.type === "floor_plan" || category.type === "xpace"
          ? (category.floorImages ?? []).every((fi) => fi.pins.length > 0)
          : true,
      hint:
        category.type === "floor_plan" || category.type === "xpace"
          ? "도면형/XPACE는 STEP 11 핀 편집기에서"
          : "해당 없음",
    },
    {
      label: "가이드 PDF",
      ok: !!category.designGuideFileUrl,
      hint: "STEP 7 가이드 업로드",
    },
    {
      label: "태그",
      ok: (category.tags ?? []).length > 0,
      hint: "최소 1개 권장",
    },
  ];

  const missing = items.filter((i) => !i.ok);
  const isFloorType = category.type === "floor_plan" || category.type === "xpace";
  const missingPinFloors = isFloorType
    ? (category.floorImages ?? []).filter((fi) => fi.pins.length === 0).length
    : 0;

  return (
    <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-ink-100 bg-ink-50">
        <h3 className="text-[12px] font-bold text-ink-700 uppercase tracking-wide">완성도 체크</h3>
      </div>
      <ul className="p-3 space-y-1.5">
        {items.map((it) => (
          <li
            key={it.label}
            className={
              "flex items-start gap-2 px-2 py-1.5 rounded-btn " +
              (it.ok ? "" : "bg-amber-50/50")
            }
          >
            <span
              className={
                "w-4 h-4 rounded-full grid place-items-center shrink-0 mt-0.5 " +
                (it.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
              }
            >
              {it.ok ? <Check className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className={"text-[12px] " + (it.ok ? "text-ink-700" : "text-ink-900 font-semibold")}>
                {it.label}
              </div>
              {!it.ok && it.hint && (
                <div className="text-[10px] text-ink-500 mt-0.5">{it.hint}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {missingPinFloors > 0 && (
        <div className="mx-3 mb-3 p-2.5 rounded-btn bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
          ⚠ 도면 {missingPinFloors}개에 핀이 없습니다. STEP 11 핀 편집기에서 마저 채워주세요.
        </div>
      )}
      {missing.length === 0 && (
        <div className="mx-3 mb-3 p-2.5 rounded-btn bg-brand-50 border border-brand-100 text-[11px] text-brand-700">
          ✓ 모든 항목 채움
        </div>
      )}
    </div>
  );
}
