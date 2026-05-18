"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Slot, Subcategory } from "@/lib/types";

type Props = {
  categoryId: string;
  subcategories: Subcategory[];
  slots: Slot[];
};

export function SubcategoryTable({ categoryId, subcategories, slots }: Props) {
  if (subcategories.length === 0) {
    return (
      <div className="text-sm text-ink-500 py-6 text-center bg-ink-50 rounded-btn">
        소분류가 없습니다. 엑셀 업로드로 생성하세요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-ink-100 rounded-btn">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
            <th className="text-left px-3 py-2 font-semibold">소분류</th>
            <th className="text-left px-3 py-2 font-semibold">단위</th>
            <th className="text-right px-3 py-2 font-semibold">구좌</th>
            <th className="text-right px-3 py-2 font-semibold">가능</th>
            <th className="text-right px-3 py-2 font-semibold">마감</th>
            <th className="text-right px-3 py-2 font-semibold">가격 KRW</th>
            <th className="text-right px-3 py-2 font-semibold">가격 USD</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {[...subcategories]
            .sort((a, b) => a.order - b.order)
            .map((sub) => {
              const subSlots = slots.filter((s) => s.subcategoryId === sub.id);
              const available = subSlots.filter(
                (s) => s.status === "available"
              ).length;
              const sold = subSlots.filter((s) => s.status === "sold").length;
              return (
                <SubcategoryRow
                  key={sub.id}
                  categoryId={categoryId}
                  sub={sub}
                  total={subSlots.length}
                  available={available}
                  sold={sold}
                />
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

// 행 1줄 — 단위·가격 KRW/USD 인라인 편집.
// 엑셀 임포트로만 가능하던 값을 이제 어드민 표에서 직접 수정 (디바운스 저장).
function SubcategoryRow({
  categoryId,
  sub,
  total,
  available,
  sold,
}: {
  categoryId: string;
  sub: Subcategory;
  total: number;
  available: number;
  sold: number;
}) {
  return (
    <tr className="border-t border-ink-100 hover:bg-ink-50/40">
      <td className="px-3 py-2.5">
        <div className="text-ink-900">{sub.name.ko || "(기본)"}</div>
      </td>
      <td className="px-3 py-2.5">
        <InlineEdit
          subcategoryId={sub.id}
          field="unit.ko"
          value={sub.unit?.ko ?? ""}
          placeholder="구좌"
          width="w-20"
        />
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px]">{total}</td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-brand-700 font-semibold">
        {available}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink-500">
        {sold}
      </td>
      <td className="px-3 py-2.5 text-right">
        <InlineEdit
          subcategoryId={sub.id}
          field="priceKRW"
          value={sub.priceKRW ?? 0}
          numeric
          suffix="원"
          width="w-28"
          align="right"
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <InlineEdit
          subcategoryId={sub.id}
          field="priceUSD"
          value={sub.priceUSD ?? ""}
          numeric
          suffix="$"
          width="w-24"
          align="right"
          placeholder="—"
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link
          href={`/admin/categories/${categoryId}/slots`}
          className="text-[11px] text-brand-700 font-semibold hover:underline inline-flex items-center"
        >
          관리
          <ChevronRight className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

// 인라인 편집 셀 — focus 시 input 처럼 보이고 blur·1초 디바운스로 저장.
function InlineEdit({
  subcategoryId,
  field,
  value,
  numeric = false,
  placeholder,
  suffix,
  width = "w-24",
  align = "left",
}: {
  subcategoryId: string;
  field: "priceKRW" | "priceUSD" | "unit.ko";
  value: number | string;
  numeric?: boolean;
  placeholder?: string;
  suffix?: string;
  width?: string;
  align?: "left" | "right";
}) {
  const [local, setLocal] = useState<string>(
    value === null || value === undefined ? "" : String(value)
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(true);

  // 외부에서 value 가 갱신되면 (예: 다른 곳에서 저장) local 도 동기화
  useEffect(() => {
    setLocal(value === null || value === undefined ? "" : String(value));
    initRef.current = true;
  }, [value]);

  const save = async (raw: string) => {
    setStatus("saving");
    try {
      let payload: Record<string, unknown>;
      if (numeric) {
        const num = raw === "" ? 0 : Number(raw);
        if (Number.isNaN(num)) {
          setStatus("error");
          return;
        }
        // priceUSD 는 빈 값일 때 필드 제거
        if (field === "priceUSD" && raw === "") {
          payload = { priceUSD: null };
        } else {
          payload = { [field]: num };
        }
      } else if (field === "unit.ko") {
        // nested field — dot notation 으로 부분 업데이트
        payload = { "unit.ko": raw };
      } else {
        payload = { [field]: raw };
      }
      payload.updatedAt = Timestamp.fromDate(new Date());
      await updateDoc(doc(getDb(), "subcategories", subcategoryId), payload);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      console.error("inline save failed", e);
      setStatus("error");
    }
  };

  const onChange = (v: string) => {
    setLocal(v);
    if (initRef.current) {
      initRef.current = false;
    }
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => save(v), 1000);
  };

  const onBlur = () => {
    // 디바운스 보류 중이면 즉시 저장
    if (tRef.current) {
      clearTimeout(tRef.current);
      tRef.current = null;
      save(local);
    }
  };

  return (
    <div
      className={
        "inline-flex items-center gap-1 " +
        (align === "right" ? "justify-end" : "justify-start")
      }
    >
      <input
        value={local}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode={numeric ? "numeric" : "text"}
        placeholder={placeholder}
        className={
          width +
          " px-1.5 py-1 text-[12px] font-mono bg-transparent border border-transparent hover:border-ink-100 focus:border-brand-500 focus:bg-white rounded outline-none " +
          (align === "right" ? "text-right" : "text-left")
        }
      />
      {suffix && (
        <span className="text-[11px] text-ink-500 shrink-0">{suffix}</span>
      )}
      <span className="w-3 h-3 shrink-0">
        {status === "saving" && (
          <Loader2 className="w-3 h-3 text-ink-400 animate-spin" />
        )}
        {status === "saved" && <Check className="w-3 h-3 text-emerald-600" />}
        {status === "error" && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        )}
      </span>
    </div>
  );
}
