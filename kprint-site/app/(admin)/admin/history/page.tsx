"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { History, RefreshCw, Search } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import { isAdminAccess, useAccess } from "@/lib/admin/access";
import {
  COL_LABEL,
  fieldLabel,
  groupLogs,
  type AuditGroup,
  type AuditLog,
} from "@/lib/admin/audit";
import { GroupRow } from "@/components/admin/AuditList";

const PAGE = 150;

type Scope = "event" | "members";

/**
 * 변경 이력 — 선택한 행사에서 누가 언제 무엇을 바꿨는지.
 * 기록은 Cloud Functions 가 문서 변경 시 자동으로 남긴다 (화면은 읽기만).
 */
export default function HistoryPage() {
  const { eventId, ready } = useEventFilter();
  const access = useAccess();
  const admin = isAdminAccess(access);

  const [scope, setScope] = useState<Scope>("event");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [colFilter, setColFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [search, setSearch] = useState("");

  // 멤버·권한 이력은 행사와 무관(eventId 없음) — 관리자만
  const scopeEventId = scope === "members" ? null : eventId;

  const load = useCallback(
    async (after: QueryDocumentSnapshot | null) => {
      if (scope === "event" && !scopeEventId) return;
      setLoading(true);
      setError(null);
      try {
        const base = [
          collection(getDb(), "auditLogs"),
          where("eventId", "==", scopeEventId),
          orderBy("at", "desc"),
        ] as const;
        const q = after
          ? query(base[0], base[1], base[2], startAfter(after), limit(PAGE))
          : query(base[0], base[1], base[2], limit(PAGE));
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ ...(d.data() as AuditLog), id: d.id }));
        setLogs((prev) => (after ? [...prev, ...rows] : rows));
        setCursor(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === PAGE);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [scope, scopeEventId]
  );

  useEffect(() => {
    if (!ready) return;
    setLogs([]);
    setCursor(null);
    void load(null);
  }, [ready, load]);

  const actors = useMemo(() => {
    const m = new Map<string, string>();
    logs.forEach((l) => m.set(l.actorUid ?? "_none", l.actorName));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], "ko"));
  }, [logs]);

  const cols = useMemo(() => Array.from(new Set(logs.map((l) => l.col))), [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (colFilter === "all" || l.col === colFilter) &&
        (actorFilter === "all" || (l.actorUid ?? "_none") === actorFilter) &&
        (!q ||
          l.label.toLowerCase().includes(q) ||
          l.actorName.toLowerCase().includes(q) ||
          (l.changedFields ?? []).some((f) => fieldLabel(f).toLowerCase().includes(q)))
    );
  }, [logs, colFilter, actorFilter, search]);

  // 날짜별 → 연속 묶음
  const byDay = useMemo(() => {
    const days: { day: string; groups: AuditGroup[] }[] = [];
    const dayOf = (l: AuditLog) => {
      const d = l.at?.toDate?.();
      if (!d) return "-";
      const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
        d.getDate()
      ).padStart(2, "0")} (${w})`;
    };
    let cur: { day: string; logs: AuditLog[] } | null = null;
    const buckets: { day: string; logs: AuditLog[] }[] = [];
    for (const l of filtered) {
      const day = dayOf(l);
      if (!cur || cur.day !== day) {
        cur = { day, logs: [] };
        buckets.push(cur);
      }
      cur.logs.push(l);
    }
    for (const b of buckets) days.push({ day: b.day, groups: groupLogs(b.logs) });
    return days;
  }, [filtered]);

  return (
    <div className="space-y-5 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
            <History className="w-5 h-5 text-brand-700" />
            변경 이력
          </h1>
          <p className="text-[13px] text-ink-700 mt-1 break-keep">
            누가 언제 무엇을 바꿨는지 자동으로 기록됩니다. 엑셀 업로드처럼 한꺼번에 바뀐 건은 묶어서
            보여 줍니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(null)}
          disabled={loading}
          className="px-3 py-2 rounded-btn border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={"w-3.5 h-3.5 " + (loading ? "animate-spin" : "")} />
          새로고침
        </button>
      </header>

      <div className="bg-white border border-ink-100 rounded-card p-4 flex items-center gap-3 flex-wrap">
        {admin && (
          <div className="flex items-center gap-1 bg-ink-50 rounded-btn p-1">
            {(
              [
                ["event", "이 행사"],
                ["members", "멤버·권한"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setScope(k)}
                className={
                  "px-3 py-1.5 rounded text-[12.5px] font-semibold " +
                  (scope === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900")
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·코드·회사명·작업자 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
          />
        </div>
        <select
          value={colFilter}
          onChange={(e) => setColFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white"
        >
          <option value="all">전체 종류</option>
          {cols.map((c) => (
            <option key={c} value={c}>
              {COL_LABEL[c] ?? c}
            </option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white"
        >
          <option value="all">전체 작업자</option>
          {actors.map(([uid, name]) => (
            <option key={uid} value={uid}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-btn p-3 break-keep">
          이력을 불러오지 못했습니다: {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white border border-ink-100 rounded-card p-10 text-center text-sm text-ink-500">
          {logs.length === 0 ? "아직 기록된 변경이 없습니다." : "조건에 맞는 기록이 없습니다."}
        </div>
      )}

      <div className="space-y-4">
        {byDay.map(({ day, groups }) => (
          <section key={day}>
            <h2 className="text-[12px] font-bold text-ink-500 mb-1.5 px-1">{day}</h2>
            <ul className="bg-white border border-ink-100 rounded-card divide-y divide-ink-100">
              {groups.map((g) => (
                <GroupRow key={g.key} group={g} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {loading && <div className="text-center text-sm text-ink-500 py-4">불러오는 중…</div>}
      {!loading && hasMore && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => void load(cursor)}
            className="px-4 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-900 hover:bg-ink-50"
          >
            이전 기록 더 보기
          </button>
        </div>
      )}
    </div>
  );
}
