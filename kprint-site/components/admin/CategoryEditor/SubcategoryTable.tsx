"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
            <th className="text-right px-3 py-2 font-semibold">구좌</th>
            <th className="text-right px-3 py-2 font-semibold">가능</th>
            <th className="text-right px-3 py-2 font-semibold">마감</th>
            <th className="text-right px-3 py-2 font-semibold">단가</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {[...subcategories]
            .sort((a, b) => a.order - b.order)
            .map((sub) => {
              const subSlots = slots.filter((s) => s.subcategoryId === sub.id);
              const available = subSlots.filter((s) => s.status === "available").length;
              const sold = subSlots.filter((s) => s.status === "sold").length;
              return (
                <tr key={sub.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="px-3 py-2.5">
                    <div className="text-ink-900">{sub.name.ko || "(기본)"}</div>
                    <div className="text-[10px] text-ink-500 mt-0.5 font-mono">
                      {sub.unit.ko}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px]">{subSlots.length}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-brand-700 font-semibold">
                    {available}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink-500">{sold}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px]">
                    {sub.priceKRW.toLocaleString()}원
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
            })}
        </tbody>
      </table>
    </div>
  );
}
