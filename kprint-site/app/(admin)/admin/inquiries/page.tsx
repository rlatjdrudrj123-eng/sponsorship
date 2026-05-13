"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ChevronRight, Search } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Inquiry } from "@/lib/types";

type StatusFilter = "all" | "new" | "in_progress" | "closed";
type PeriodFilter = "all" | "7" | "30";

const STATUS_LABELS: Record<Inquiry["status"], string> = {
  new: "신규",
  in_progress: "진행 중",
  closed: "종료",
};

export default function InquiriesListPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const { eventId, ready } = useEventFilter();

  useEffect(() => {
    if (!ready || !eventId) {
      setLoading(false);
      return;
    }
    const u = onSnapshot(
      query(
        collection(getDb(), "inquiries"),
        where("eventId", "==", eventId),
        orderBy("createdAt", "desc")
      ),
      (s) => {
        setInquiries(s.docs.map((d) => ({ ...(d.data() as Inquiry), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => u();
  }, [ready, eventId]);

  const filtered = useMemo(() => {
    let rows = inquiries;
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    if (filterPeriod !== "all") {
      const days = filterPeriod === "7" ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      rows = rows.filter((r) => {
        const ts = r.createdAt?.toDate?.()?.getTime() ?? 0;
        return ts >= cutoff;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.companyName.toLowerCase().includes(q) ||
          r.contactName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [inquiries, filterStatus, filterPeriod, search]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-bold text-ink-900 leading-tight">문의</h1>
        <p className="text-[13px] text-ink-700 mt-1">
          공개 사이트에서 들어온 견적 문의를 관리합니다.
        </p>
      </header>

      <div className="bg-white border border-ink-100 rounded-card p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회사·담당자·이메일 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white"
        >
          <option value="all">전체 상태</option>
          <option value="new">신규</option>
          <option value="in_progress">진행 중</option>
          <option value="closed">종료</option>
        </select>
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value as PeriodFilter)}
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white"
        >
          <option value="all">전체 기간</option>
          <option value="7">최근 7일</option>
          <option value="30">최근 30일</option>
        </select>
      </div>

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              <th className="text-left px-4 py-2.5 font-semibold">상태</th>
              <th className="text-left px-4 py-2.5 font-semibold">회사</th>
              <th className="text-left px-4 py-2.5 font-semibold">담당자</th>
              <th className="text-right px-4 py-2.5 font-semibold">카트 합계</th>
              <th className="text-left px-4 py-2.5 font-semibold">접수일</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-500">
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-500">
                  {inquiries.length === 0
                    ? "아직 문의가 없어요."
                    : "필터 조건에 맞는 문의가 없습니다."}
                </td>
              </tr>
            )}
            {filtered.map((inq) => (
              <tr
                key={inq.id}
                className="border-t border-ink-100 hover:bg-ink-50 cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button")) return;
                  window.location.href = `/admin/inquiries/${inq.id}`;
                }}
              >
                <td className="px-4 py-2.5">
                  <StatusBadge status={inq.status} />
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/inquiries/${inq.id}`}
                    className="text-ink-900 font-semibold hover:text-brand-700"
                  >
                    {inq.companyName}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-ink-700">{inq.contactName}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">{inq.email}</div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-900">
                  {inq.cartTotal?.toLocaleString() ?? 0}원
                </td>
                <td className="px-4 py-2.5 text-[12px] text-ink-500">
                  {fmtDate(inq.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/inquiries/${inq.id}`}
                    className="text-brand-700 inline-flex items-center text-[12px] font-semibold hover:underline"
                  >
                    상세
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

function StatusBadge({ status }: { status: Inquiry["status"] }) {
  const colors =
    status === "new"
      ? "bg-red-50 text-red-700 border-red-100"
      : status === "in_progress"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-ink-100 text-ink-700 border-ink-100";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${colors}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function fmtDate(ts: Inquiry["createdAt"] | undefined): string {
  if (!ts) return "—";
  try {
    const d = ts.toDate();
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
