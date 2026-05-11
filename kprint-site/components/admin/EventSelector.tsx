"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarDays, ChevronDown } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import type { Event as EventDoc } from "@/lib/types";

/**
 * 어드민 상단의 행사 셀렉터.
 * - events 콜렉션 onSnapshot으로 실시간 반영
 * - 행사 1개면 그걸로 자동 선택
 * - 선택한 행사가 사라지면 활성 행사로 자동 교체
 */
export function EventSelector() {
  const selectedEventId = useAdminEvent((s) => s.selectedEventId);
  const setSelectedEventId = useAdminEvent((s) => s.setSelectedEventId);
  const hydrated = useAdminEvent((s) => s.hasHydrated);

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => {
        const list = s.docs.map((d) => ({ ...(d.data() as EventDoc), id: d.id }));
        setEvents(list);
      }
    );
    return () => u();
  }, []);

  // 선택 자동 교체 — 없거나 비활성화된 행사면 활성 행사로
  useEffect(() => {
    if (!hydrated || events.length === 0) return;
    const current = events.find((e) => e.id === selectedEventId);
    if (current) return;
    const fallback = events.find((e) => e.isActive) ?? events[0];
    if (fallback) setSelectedEventId(fallback.id);
  }, [hydrated, events, selectedEventId, setSelectedEventId]);

  const current = events.find((e) => e.id === selectedEventId);

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-btn border border-amber-200 bg-amber-50 text-amber-700 text-[12px]">
        <CalendarDays className="w-3.5 h-3.5" />
        <span>행사 미등록 — /admin/events 에서 생성</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-btn border border-ink-100 bg-white hover:bg-ink-50 text-[13px] font-semibold text-ink-900 min-w-[160px]"
      >
        <CalendarDays className="w-3.5 h-3.5 text-mint-700 shrink-0" />
        <span className="flex-1 text-left truncate">
          {current?.name ?? "행사 선택"}
        </span>
        <ChevronDown
          className={
            "w-3.5 h-3.5 text-ink-500 transition-transform " +
            (open ? "rotate-180" : "")
          }
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-ink-100 rounded-card shadow-xl min-w-[220px] py-1">
            {events.map((e) => {
              const active = e.id === selectedEventId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setSelectedEventId(e.id);
                    setOpen(false);
                  }}
                  className={
                    "w-full text-left px-3 py-2 text-[13px] hover:bg-mint-50 flex items-center gap-2 " +
                    (active ? "bg-mint-50 text-mint-700 font-bold" : "text-ink-900")
                  }
                >
                  <span className="flex-1 truncate">{e.name}</span>
                  {!e.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 text-ink-500 font-semibold">
                      숨김
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
