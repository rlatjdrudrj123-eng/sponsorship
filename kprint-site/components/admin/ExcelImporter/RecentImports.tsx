"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { ImportHistory } from "@/lib/types";

type Props = { reloadKey?: number };

const MODE_LABEL: Record<ImportHistory["mode"], string> = {
  overwrite: "덮어쓰기",
  merge: "병합",
  add_only: "신규만",
};

export function RecentImports({ reloadKey }: Props) {
  const [items, setItems] = useState<ImportHistory[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(getDb(), "importHistory"),
            orderBy("createdAt", "desc"),
            limit(3)
          )
        );
        if (cancelled) return;
        setItems(
          snap.docs.map((d) => ({
            ...(d.data() as ImportHistory),
            id: d.id,
          }))
        );
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="bg-white border border-ink-100 rounded-card p-5">
      <h3 className="text-[13px] font-bold text-ink-900 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-ink-500" />
        최근 업로드
      </h3>
      {items === null && <div className="text-xs text-ink-500">불러오는 중…</div>}
      {items?.length === 0 && (
        <div className="text-xs text-ink-500 py-2">
          아직 업로드 이력이 없어요.
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="border-l-2 border-brand-500 pl-2.5 text-[12px]"
            >
              <div className="font-mono text-ink-900 truncate" title={it.fileName}>
                {it.fileName}
              </div>
              <div className="text-ink-500 mt-0.5">
                {fmtDate(it.createdAt)} · {MODE_LABEL[it.mode] ?? it.mode}
              </div>
              <div className="text-ink-500 mt-0.5">
                카테고리 {it.counts.categories} · 슬롯 {it.counts.slots}
                {it.counts.errors > 0 && (
                  <span className="text-red-700 ml-1">· 오류 {it.counts.errors}</span>
                )}
              </div>
              <div className="text-ink-500 text-[11px] mt-0.5 truncate">
                {it.uploadedBy}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtDate(ts: Timestamp | undefined | null): string {
  if (!ts) return "—";
  try {
    const d = ts.toDate();
    return d.toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
