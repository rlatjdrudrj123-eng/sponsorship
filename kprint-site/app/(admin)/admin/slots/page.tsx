"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Category, Slot } from "@/lib/types";

export default function SlotsHubPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const { eventId, ready } = useEventFilter();

  useEffect(() => {
    if (!ready || !eventId) return;
    const u1 = onSnapshot(
      query(collection(getDb(), "categories"), where("eventId", "==", eventId)),
      (s) =>
        setCategories(s.docs.map((d) => ({ ...(d.data() as Category), id: d.id })))
    );
    const u2 = onSnapshot(
      query(collection(getDb(), "slots"), where("eventId", "==", eventId)),
      (s) => setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })))
    );
    return () => {
      u1();
      u2();
    };
  }, [ready, eventId]);

  const rows = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.order - b.order)
      .map((c) => {
        const cs = slots.filter((s) => s.categoryId === c.id);
        return {
          ...c,
          total: cs.length,
          available: cs.filter((s) => s.status === "available").length,
          sold: cs.filter((s) => s.status === "sold").length,
        };
      })
      .filter((r) => r.total > 0);
  }, [categories, slots]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-bold text-ink-900 leading-tight">구좌 관리</h1>
        <p className="text-[13px] text-ink-700 mt-1">
          스폰서십 매체별로 구좌 마감을 일괄 처리합니다.
        </p>
      </header>

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              <th className="text-left px-4 py-2.5 font-semibold">카테고리</th>
              <th className="text-right px-4 py-2.5 font-semibold">전체</th>
              <th className="text-right px-4 py-2.5 font-semibold">가능</th>
              <th className="text-right px-4 py-2.5 font-semibold">마감</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-500">
                  슬롯이 있는 카테고리가 없습니다.{" "}
                  <Link href="/admin/import" className="text-brand-700 font-semibold hover:underline">
                    엑셀 업로드부터 →
                  </Link>
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ink-100 hover:bg-ink-50">
                <td className="px-4 py-2.5">
                  <div className="text-ink-900 font-semibold">{r.name.ko}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5 font-mono">{r.code}</div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px]">{r.total}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] text-brand-700 font-semibold">
                  {r.available}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-500">
                  {r.sold}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/categories/${r.id}/slots`}
                    className="text-[12px] text-brand-700 font-semibold hover:underline inline-flex items-center"
                  >
                    관리
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
