"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Category, Package, Slot } from "@/lib/types";

/**
 * 판매 현황 — 선택한 행사의 구좌 판매 상태를 매체별로 한눈에.
 * (예전 '구좌 관리'. 금액 합계는 스폰서 관리 화면 기준을 그대로 쓴다)
 */
export default function SalesStatusPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const { eventId, ready } = useEventFilter();

  useEffect(() => {
    if (!ready || !eventId) return;
    const db = getDb();
    const u1 = onSnapshot(
      query(collection(db, "categories"), where("eventId", "==", eventId)),
      (s) => setCategories(s.docs.map((d) => ({ ...(d.data() as Category), id: d.id })))
    );
    const u2 = onSnapshot(
      query(collection(db, "slots"), where("eventId", "==", eventId)),
      (s) => setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })))
    );
    const u3 = onSnapshot(
      query(collection(db, "packages"), where("eventId", "==", eventId)),
      (s) => setPackages(s.docs.map((d) => ({ ...(d.data() as Package), id: d.id })))
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, [ready, eventId]);

  const rows = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.order - b.order)
      .map((c) => {
        const cs = slots.filter((s) => s.categoryId === c.id);
        const sold = cs.filter((s) => s.status === "sold").length;
        const reserved = cs.filter((s) => s.status === "reserved").length;
        return {
          ...c,
          total: cs.length,
          sold,
          reserved,
          available: cs.length - sold - reserved,
        };
      })
      .filter((r) => r.total > 0);
  }, [categories, slots]);

  const sum = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.total, 0);
    const sold = rows.reduce((a, r) => a + r.sold, 0);
    const reserved = rows.reduce((a, r) => a + r.reserved, 0);
    const published = packages.filter((p) => p.isPublished);
    return {
      total,
      sold,
      reserved,
      available: total - sold - reserved,
      rate: total > 0 ? Math.round(((sold + reserved) / total) * 100) : 0,
      soldOutCats: rows.filter((r) => r.available === 0).length,
      pkgTotal: published.length,
      pkgSoldOut: published.filter((p) => p.soldOut).length,
    };
  }, [rows, packages]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">판매 현황</h1>
          <p className="text-[13px] text-ink-700 mt-1">
            매체별 구좌 판매 상태입니다. 금액 합계는{" "}
            <Link href="/admin/sponsors" className="text-brand-700 font-semibold hover:underline">
              스폰서 관리
            </Link>
            에서 봅니다.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="판매율" value={`${sum.rate}%`} sub={`판매·예약 ${sum.sold + sum.reserved} / 전체 ${sum.total}`} />
        <Stat label="판매 가능" value={`${sum.available}`} sub="남은 구좌" />
        <Stat label="매진된 매체" value={`${sum.soldOutCats}`} sub={`매체 ${rows.length}개 중`} />
        <Stat label="매진 패키지" value={`${sum.pkgSoldOut}`} sub={`공개 패키지 ${sum.pkgTotal}개 중`} />
      </div>

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              <th className="text-left px-4 py-2.5 font-semibold">매체</th>
              <th className="text-left px-4 py-2.5 font-semibold w-[34%]">판매</th>
              <th className="text-right px-4 py-2.5 font-semibold">전체</th>
              <th className="text-right px-4 py-2.5 font-semibold">판매</th>
              <th className="text-right px-4 py-2.5 font-semibold">예약</th>
              <th className="text-right px-4 py-2.5 font-semibold">가능</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-500">
                  구좌가 있는 매체가 없습니다.{" "}
                  <Link href="/admin/import" className="text-brand-700 font-semibold hover:underline">
                    엑셀 일괄 등록 →
                  </Link>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const soldPct = (r.sold / r.total) * 100;
              const resPct = (r.reserved / r.total) * 100;
              return (
                <tr key={r.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="px-4 py-2.5">
                    <div className="text-ink-900 font-semibold">{r.name.ko}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5 font-mono">{r.code}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div
                      className="h-2 rounded-full bg-ink-100 overflow-hidden flex"
                      role="img"
                      aria-label={`판매 ${r.sold}, 예약 ${r.reserved}, 가능 ${r.available}`}
                    >
                      <div className="bg-ink-900" style={{ width: `${soldPct}%` }} />
                      <div className="bg-brand-500" style={{ width: `${resPct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px]">{r.total}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-900">{r.sold}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-brand-700">{r.reserved}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] font-semibold">
                    {r.available === 0 ? <span className="text-red-700">매진</span> : r.available}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/admin/categories/${r.id}/slots`}
                      className="text-[12px] text-brand-700 font-semibold hover:underline inline-flex items-center"
                    >
                      구좌
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-500 flex items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-ink-900" /> 판매(스폰서 확보 포함)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" /> 예약
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-ink-100" /> 판매 가능
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-ink-100 rounded-card px-4 py-3">
      <div className="text-[12px] text-ink-500">{label}</div>
      <div className="text-[24px] font-bold text-ink-900 leading-tight mt-0.5 font-mono">{value}</div>
      <div className="text-[11px] text-ink-500 mt-0.5 truncate">{sub}</div>
    </div>
  );
}
