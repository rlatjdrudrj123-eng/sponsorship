"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import {
  ChevronRight,
  Download,
  Filter,
  Handshake,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Event, Sponsor, SponsorStatus } from "@/lib/types";

const STATUS_LABELS: Record<SponsorStatus, string> = {
  in_progress: "진행중",
  reviewing: "검토중",
  declined: "진행X",
  in_kind: "협찬",
};

const STATUS_COLORS: Record<SponsorStatus, string> = {
  in_progress: "bg-brand-50 text-brand-700 border-brand-100",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200",
  declined: "bg-ink-100 text-ink-500 border-ink-100",
  in_kind: "bg-blue-50 text-blue-700 border-blue-100",
};

type StatusFilter = SponsorStatus | "all";

export default function SponsorsListPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { eventId: globalEventId, ready } = useEventFilter();
  const eventId = globalEventId ?? "";

  // Events 로드 (헤더에 표시용 — 셀렉터는 글로벌 Topbar에 있음)
  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => {
        setEvents(s.docs.map((d) => ({ ...(d.data() as Event), id: d.id })));
      }
    );
    return () => u();
  }, []);

  // Sponsors 로드 — 글로벌 선택 행사 기준
  useEffect(() => {
    if (!ready || !eventId) {
      setSponsors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const u = onSnapshot(
      query(
        collection(getDb(), "sponsors"),
        where("eventId", "==", eventId),
        orderBy("createdAt", "desc")
      ),
      (s) => {
        setSponsors(s.docs.map((d) => ({ ...(d.data() as Sponsor), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => u();
  }, [ready, eventId]);

  const event = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: sponsors.length,
      in_progress: 0,
      reviewing: 0,
      declined: 0,
      in_kind: 0,
    };
    sponsors.forEach((s) => {
      c[s.status]++;
    });
    return c;
  }, [sponsors]);

  const filtered = useMemo(() => {
    let rows = sponsors;
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.companyName.toLowerCase().includes(q) ||
          r.contacts.some(
            (ct) =>
              ct.name.toLowerCase().includes(q) ||
              (ct.email ?? "").toLowerCase().includes(q)
          )
      );
    }
    return rows;
  }, [sponsors, statusFilter, search]);

  // 합계 (KRW 기준, 협찬·진행X 제외)
  const totals = useMemo(() => {
    const sum = { in_progress: 0, reviewing: 0, all: 0 };
    sponsors.forEach((s) => {
      if (s.currency !== "KRW") return; // USD는 합계 제외 (별도 표시)
      if (s.status === "declined" || s.status === "in_kind") return;
      sum.all += s.amount;
      if (s.status === "in_progress") sum.in_progress += s.amount;
      if (s.status === "reviewing") sum.reviewing += s.amount;
    });
    const usd = sponsors
      .filter((s) => s.currency === "USD" && s.status !== "declined" && s.status !== "in_kind")
      .reduce((acc, s) => acc + s.amount, 0);
    return { ...sum, usd };
  }, [sponsors]);

  const yoyDiff = event?.lastYearTotal ? totals.all - event.lastYearTotal : null;
  const yoyPct = event?.lastYearTotal && event.lastYearTotal > 0
    ? ((totals.all - event.lastYearTotal) / event.lastYearTotal) * 100
    : null;

  const exportXlsx = () => {
    if (filtered.length === 0) {
      alert("내보낼 스폰서가 없습니다.");
      return;
    }
    const rows = filtered.map((s) => ({
      상태: STATUS_LABELS[s.status],
      기업명: s.companyName,
      비용: s.amount,
      통화: s.currency,
      비용메모: s.amountNote ?? "",
      품목: s.items.map((it) => it.label).join(" / "),
      "이벤트안내": s.benefits?.eventNotice ? "✓" : "",
      "상위고정": s.benefits?.topPin ? "✓" : "",
      "뱃지": s.benefits?.badge ? "✓" : "",
      "로고배너": s.benefits?.logoBanner ? "✓" : "",
      "로고배너종류": s.bannerType ?? "",
      "로고배너메모": s.bannerNote ?? "",
      "디자인물": s.designItems
        .map((d) => `${d.label}${d.deadline ? ` (${d.deadline})` : ""}${d.status === "done" ? " ✓" : ""}`)
        .join(" / "),
      담당자: s.contacts.map((c) => c.name).join(", "),
      이메일: s.contacts.map((c) => c.email ?? "").filter(Boolean).join(", "),
      전화: s.contacts.map((c) => c.phone ?? "").filter(Boolean).join(", "),
      메모: s.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // column widths
    ws["!cols"] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 12 },
      { wch: 6 },
      { wch: 12 },
      { wch: 36 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 14 },
      { wch: 16 },
      { wch: 30 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "스폰서");
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `sponsors_${event?.shortName ?? eventId}_${date}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
            <Handshake className="w-5 h-5 text-brand-700" />
            스폰서 관리
          </h1>
          <p className="text-[13px] text-ink-700 mt-1">
            행사별로 스폰서 진행 상황을 트래킹합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportXlsx}
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-ink-900 text-[13px] font-semibold hover:bg-ink-50 flex items-center gap-1.5"
            title="현재 필터 결과를 엑셀로 내보내기"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
          <Link
            href={`/admin/sponsors/new${eventId ? `?event=${eventId}` : ""}`}
            className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[13px] font-semibold hover:bg-ink-700 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />새 스폰서
          </Link>
        </div>
      </header>

      {!eventId && events.length === 0 && (
        <div className="bg-white border border-ink-100 rounded-card p-8 text-center">
          <p className="text-sm text-ink-700 mb-3">먼저 행사를 등록해주세요.</p>
          <Link
            href="/admin/events"
            className="text-brand-700 font-semibold hover:underline text-sm"
          >
            행사 관리로 이동 →
          </Link>
        </div>
      )}

      {eventId && (
        <>
          {/* 합계 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SumCard
              label="진행중 합계"
              value={totals.in_progress}
              currency="KRW"
              count={counts.in_progress}
              accent
            />
            <SumCard
              label="검토중 합계"
              value={totals.reviewing}
              currency="KRW"
              count={counts.reviewing}
            />
            <SumCard
              label="총 합계 (KRW)"
              value={totals.all}
              currency="KRW"
              count={counts.in_progress + counts.reviewing}
              note="진행중 + 검토중 (진행X·협찬 제외)"
            />
            {event?.lastYearTotal !== undefined && event.lastYearTotal > 0 ? (
              <YoyCard
                lastYear={event.lastYearTotal}
                diff={yoyDiff ?? 0}
                pct={yoyPct ?? 0}
              />
            ) : (
              <SumCard
                label="USD 합계"
                value={totals.usd}
                currency="USD"
                count={sponsors.filter((s) => s.currency === "USD").length}
                note="해외 스폰서"
              />
            )}
          </div>

          {/* 필터 */}
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
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-ink-500 mr-1" />
              {(["all", "in_progress", "reviewing", "declined", "in_kind"] as StatusFilter[]).map(
                (k) => {
                  const active = statusFilter === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setStatusFilter(k)}
                      className={
                        "px-3 py-1.5 rounded-btn text-[12px] font-semibold border " +
                        (active
                          ? "bg-brand-500 text-ink-900 border-brand-500"
                          : "bg-white text-ink-700 border-ink-100 hover:bg-ink-50")
                      }
                    >
                      {k === "all" ? "전체" : STATUS_LABELS[k]}
                      <span className="ml-1.5 text-ink-500">{counts[k]}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* 테이블 */}
          <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
                    <th className="text-left px-3 py-2.5 font-semibold w-20">상태</th>
                    <th className="text-left px-3 py-2.5 font-semibold">기업명</th>
                    <th className="text-right px-3 py-2.5 font-semibold w-32">비용</th>
                    <th className="text-left px-3 py-2.5 font-semibold w-56">품목</th>
                    <th className="text-center px-2 py-2.5 font-semibold w-32" title="이벤트안내·상위고정·뱃지·로고배너">
                      혜택
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold w-36">로고/배너</th>
                    <th className="text-left px-3 py-2.5 font-semibold w-44">담당자</th>
                    <th className="px-3 py-2.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-ink-500">
                        불러오는 중…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-ink-500">
                        {sponsors.length === 0
                          ? "아직 등록된 스폰서가 없습니다. 우측 상단 [새 스폰서]를 눌러 추가하세요."
                          : "조건에 맞는 스폰서가 없습니다."}
                      </td>
                    </tr>
                  )}
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-ink-100 hover:bg-ink-50 cursor-pointer"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a,button")) return;
                        window.location.href = `/admin/sponsors/${s.id}`;
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            "text-[11px] px-2 py-0.5 rounded-full border font-semibold " +
                            STATUS_COLORS[s.status]
                          }
                        >
                          {STATUS_LABELS[s.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/sponsors/${s.id}`}
                          className="text-ink-900 font-semibold hover:text-brand-700"
                        >
                          {s.companyName}
                        </Link>
                        {s.amountNote && (
                          <span className="ml-1.5 text-[10px] text-ink-500">{s.amountNote}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[13px] text-ink-900">
                        {formatAmount(s.amount, s.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-700">
                        <div className="line-clamp-2 leading-tight">
                          {s.items.length === 0 ? (
                            <span className="text-ink-300">—</span>
                          ) : (
                            s.items.map((it) => it.label).join(" / ")
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <BenefitDots benefits={s.benefits} />
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-700">
                        {s.bannerType ?? <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[12px]">
                        {s.contacts[0] ? (
                          <>
                            <div className="text-ink-900">{s.contacts[0].name}</div>
                            {s.contacts[0].email && (
                              <div className="text-[10px] text-ink-500 truncate">
                                {s.contacts[0].email}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/admin/sponsors/${s.id}`}
                          className="text-brand-700 inline-flex items-center text-[12px] font-semibold hover:underline"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BenefitDots({ benefits }: { benefits: Sponsor["benefits"] }) {
  const items: Array<{ key: keyof Sponsor["benefits"]; label: string; short: string }> = [
    { key: "eventNotice", label: "이벤트 안내", short: "이" },
    { key: "topPin", label: "상위고정", short: "상" },
    { key: "badge", label: "뱃지", short: "뱃" },
    { key: "logoBanner", label: "로고/배너", short: "로" },
  ];
  return (
    <div className="flex items-center justify-center gap-1">
      {items.map(({ key, label, short }) => {
        const on = benefits?.[key] ?? false;
        return (
          <span
            key={key}
            title={label}
            className={
              "w-6 h-6 grid place-items-center rounded-full text-[10px] font-bold " +
              (on ? "bg-brand-500 text-ink-900" : "bg-ink-100 text-ink-300")
            }
          >
            {short}
          </span>
        );
      })}
    </div>
  );
}

function SumCard({
  label,
  value,
  currency,
  count,
  note,
  accent,
}: {
  label: string;
  value: number;
  currency: "KRW" | "USD";
  count: number;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-card p-4 border " +
        (accent ? "bg-brand-50 border-brand-100" : "bg-white border-ink-100")
      }
    >
      <div className="text-[11px] text-ink-700 font-semibold uppercase tracking-wide">{label}</div>
      <div
        className={
          "mt-1 font-mono font-bold tabular-nums " +
          (accent ? "text-[22px] text-brand-700" : "text-[18px] text-ink-900")
        }
      >
        {formatAmount(value, currency)}
      </div>
      <div className="mt-1 text-[11px] text-ink-500">
        {count}건{note ? <span> · {note}</span> : null}
      </div>
    </div>
  );
}

function YoyCard({ lastYear, diff, pct }: { lastYear: number; diff: number; pct: number }) {
  const positive = diff >= 0;
  return (
    <div className="rounded-card p-4 border bg-white border-ink-100">
      <div className="text-[11px] text-ink-700 font-semibold uppercase tracking-wide flex items-center gap-1">
        <TrendingUp className="w-3.5 h-3.5" />
        작년 대비
      </div>
      <div className="mt-1 font-mono font-bold tabular-nums text-[18px] text-ink-900">
        {formatAmount(lastYear, "KRW")}
      </div>
      <div
        className={
          "mt-1 text-[11px] font-semibold " +
          (positive ? "text-brand-700" : "text-red-700")
        }
      >
        {positive ? "▲" : "▼"} {formatAmount(Math.abs(diff), "KRW")} ({pct.toFixed(1)}%)
      </div>
    </div>
  );
}

function formatAmount(value: number, currency: "KRW" | "USD"): string {
  if (currency === "USD") return `$${value.toLocaleString()}`;
  return `${value.toLocaleString()}원`;
}
