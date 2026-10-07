"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { groupLogs, type AuditLog } from "@/lib/admin/audit";
import { GroupRow } from "./AuditList";

type Props = {
  /** auditLogs.col — categories / packages / sponsors / inquiries … */
  col: string;
  docId: string;
  /** 문서가 속한 행사 — 담당자 권한 규칙상 쿼리에 꼭 필요 */
  eventId: string | null | undefined;
  /** 카테고리처럼 하위(구좌·소분류) 변경까지 함께 볼 때 */
  includeChildren?: boolean;
};

/**
 * 문서별 변경 이력 — 펼칠 때만 불러온다 (읽기 비용 절약).
 * 전체 이력은 어드민 > 변경 이력.
 */
export function DocHistory({ col, docId, eventId, includeChildren = false }: Props) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !eventId || logs !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const base = collection(getDb(), "auditLogs");
        const own = getDocs(
          query(
            base,
            where("eventId", "==", eventId),
            where("col", "==", col),
            where("docId", "==", docId),
            orderBy("at", "desc"),
            limit(50)
          )
        );
        const children = includeChildren
          ? getDocs(
              query(
                base,
                where("eventId", "==", eventId),
                where("parentId", "==", docId),
                orderBy("at", "desc"),
                limit(150)
              )
            )
          : null;
        const [a, b] = await Promise.all([own, children]);
        const rows = [...a.docs, ...(b?.docs ?? [])].map(
          (d) => ({ ...(d.data() as AuditLog), id: d.id })
        );
        rows.sort((x, y) => (y.at?.toMillis?.() ?? 0) - (x.at?.toMillis?.() ?? 0));
        if (!cancelled) setLogs(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId, col, docId, includeChildren, logs]);

  const groups = useMemo(() => groupLogs(logs ?? []), [logs]);

  return (
    <section className="bg-white border border-ink-100 rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-ink-50"
        aria-expanded={open}
      >
        <History className="w-4 h-4 text-ink-500" />
        <span className="text-[13px] font-bold text-ink-900">변경 이력</span>
        <span className="text-[12px] text-ink-500">
          {includeChildren ? "이 항목과 구좌·소분류를 누가 언제 바꿨는지" : "누가 언제 무엇을 바꿨는지"}
        </span>
        <span className="flex-1" />
        {open ? (
          <ChevronDown className="w-4 h-4 text-ink-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-ink-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-ink-100">
          {error && (
            <p className="px-4 py-3 text-[12px] text-red-700 break-keep">
              이력을 불러오지 못했습니다: {error}
            </p>
          )}
          {!error && logs === null && (
            <p className="px-4 py-3 text-[12px] text-ink-500">불러오는 중…</p>
          )}
          {!error && logs?.length === 0 && (
            <p className="px-4 py-3 text-[12px] text-ink-500 break-keep">
              기록된 변경이 없습니다. (변경 이력은 기능 도입 이후 변경부터 기록됩니다)
            </p>
          )}
          {groups.length > 0 && (
            <ul className="divide-y divide-ink-100">
              {groups.map((g) => (
                <GroupRow key={g.key} group={g} withDate showLink={false} />
              ))}
            </ul>
          )}
          <div className="px-4 py-2 border-t border-ink-100 text-right">
            <Link href="/admin/history" className="text-[12px] font-semibold text-brand-700 hover:underline">
              전체 변경 이력 보기
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
