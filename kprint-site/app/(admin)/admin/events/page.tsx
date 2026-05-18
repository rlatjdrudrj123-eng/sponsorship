"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Event } from "@/lib/types";

const DEFAULT_EVENTS: Array<Omit<Event, "createdAt" | "updatedAt">> = [
  {
    id: "kprint-2026",
    name: "K-PRINT 2026",
    shortName: "K-PRINT",
    year: 2026,
    isActive: true,
    order: 0,
    note: "",
  },
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => {
        setEvents(s.docs.map((d) => ({ ...(d.data() as Event), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => u();
  }, []);

  // Auto-seed default events if collection is empty
  useEffect(() => {
    if (loading || seeded) return;
    if (events.length > 0) return;
    setSeeded(true);
    (async () => {
      try {
        const snap = await getDocs(collection(getDb(), "events"));
        if (!snap.empty) return;
        const batch = writeBatch(getDb());
        DEFAULT_EVENTS.forEach((e) => {
          const ref = doc(getDb(), "events", e.id);
          batch.set(ref, { ...e, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        await batch.commit();
      } catch (err) {
        console.error("event seed failed", err);
      }
    })();
  }, [events, loading, seeded]);

  const updateField = async <K extends keyof Event>(id: string, field: K, value: Event[K]) => {
    try {
      await updateDoc(doc(getDb(), "events", id), {
        [field]: value,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`수정 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const moveBy = async (id: string, dir: -1 | 1) => {
    const sorted = [...events].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((e) => e.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[next];
    const batch = writeBatch(getDb());
    batch.update(doc(getDb(), "events", a.id), { order: b.order, updatedAt: Timestamp.fromDate(new Date()) });
    batch.update(doc(getDb(), "events", b.id), { order: a.order, updatedAt: Timestamp.fromDate(new Date()) });
    await batch.commit();
  };

  const removeEvent = async (e: Event) => {
    if (!confirm(`'${e.name}' 행사를 삭제할까요?\n연결된 스폰서는 삭제되지 않지만 다른 행사로 옮겨야 합니다.`)) return;
    try {
      await deleteDoc(doc(getDb(), "events", e.id));
    } catch (err) {
      alert(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand-700" />
            행사 관리
          </h1>
          <p className="text-[13px] text-ink-700 mt-1">
            연도·행사별로 스폰서를 분리해 관리합니다 (예: K-PRINT 2026, K-PRINT 2027).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[13px] font-semibold hover:bg-ink-700 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />새 행사
        </button>
      </header>

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              <th className="text-center px-2 py-2.5 font-semibold w-16">순서</th>
              <th className="text-left px-4 py-2.5 font-semibold">행사명</th>
              <th className="text-left px-4 py-2.5 font-semibold">단축명</th>
              <th className="text-right px-4 py-2.5 font-semibold w-24">연도</th>
              <th className="text-right px-4 py-2.5 font-semibold w-40">작년 합계</th>
              <th className="text-center px-4 py-2.5 font-semibold w-20">활성</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-500">
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-500">
                  등록된 행사가 없습니다.
                </td>
              </tr>
            )}
            {events.map((e, i) => (
              <tr key={e.id} className="border-t border-ink-100">
                <td className="px-2 py-2 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveBy(e.id, -1)}
                      disabled={i === 0}
                      className="w-6 h-5 rounded text-[10px] text-ink-700 hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBy(e.id, 1)}
                      disabled={i === events.length - 1}
                      className="w-6 h-5 rounded text-[10px] text-ink-700 hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    defaultValue={e.name}
                    onBlur={(ev) => {
                      const v = ev.target.value.trim();
                      if (v && v !== e.name) updateField(e.id, "name", v);
                    }}
                    className="w-full px-2 py-1.5 text-[13px] border border-transparent hover:border-ink-100 focus:border-brand-500 rounded-btn bg-transparent focus:bg-white focus:outline-none font-semibold text-ink-900"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    defaultValue={e.shortName}
                    onBlur={(ev) => {
                      const v = ev.target.value.trim();
                      if (v !== e.shortName) updateField(e.id, "shortName", v);
                    }}
                    className="w-full px-2 py-1.5 text-[13px] border border-transparent hover:border-ink-100 focus:border-brand-500 rounded-btn bg-transparent focus:bg-white focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    defaultValue={e.year}
                    onBlur={(ev) => {
                      const v = parseInt(ev.target.value, 10);
                      if (!isNaN(v) && v !== e.year) updateField(e.id, "year", v);
                    }}
                    className="w-full px-2 py-1.5 text-[13px] border border-transparent hover:border-ink-100 focus:border-brand-500 rounded-btn bg-transparent focus:bg-white focus:outline-none text-right font-mono"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    defaultValue={e.lastYearTotal ?? ""}
                    placeholder="—"
                    onBlur={(ev) => {
                      const v = ev.target.value.trim();
                      const n = v === "" ? undefined : parseInt(v, 10);
                      if (n === undefined) {
                        if (e.lastYearTotal !== undefined)
                          updateDoc(doc(getDb(), "events", e.id), {
                            lastYearTotal: null,
                            updatedAt: Timestamp.fromDate(new Date()),
                          });
                      } else if (!isNaN(n) && n !== e.lastYearTotal) {
                        updateField(e.id, "lastYearTotal", n);
                      }
                    }}
                    className="w-full px-2 py-1.5 text-[13px] border border-transparent hover:border-ink-100 focus:border-brand-500 rounded-btn bg-transparent focus:bg-white focus:outline-none text-right font-mono"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => updateField(e.id, "isActive", !e.isActive)}
                    className={
                      "px-2.5 py-1 rounded-full text-[11px] font-semibold border " +
                      (e.isActive
                        ? "bg-brand-500 text-ink-900 border-brand-500"
                        : "bg-ink-100 text-ink-500 border-ink-100")
                    }
                  >
                    {e.isActive ? "활성" : "숨김"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeEvent(e)}
                    className="p-1.5 rounded text-ink-500 hover:text-red-700 hover:bg-red-50"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-ink-500">
        팁: 셀을 클릭해 직접 수정하면 자동으로 저장됩니다. 활성 토글은 사이드바·스폰서 페이지의 기본 행사 후보에 영향을 줍니다.
      </p>

      {showAdd && <AddEventModal events={events} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddEventModal({ events, onClose }: { events: Event[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [year, setYear] = useState<string>(String(new Date().getFullYear() + 1));
  const [saving, setSaving] = useState(false);

  const nextOrder = useMemo(() => {
    if (events.length === 0) return 0;
    return Math.max(...events.map((e) => e.order)) + 1;
  }, [events]);

  const submit = async () => {
    const n = name.trim();
    const s = shortName.trim();
    const y = parseInt(year, 10);
    if (!n || !s || isNaN(y)) {
      alert("행사명·단축명·연도를 모두 입력해주세요.");
      return;
    }
    const id = slugify(`${s} ${y}`);
    if (events.some((e) => e.id === id)) {
      alert("같은 단축명+연도의 행사가 이미 있습니다.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(getDb(), "events", id), {
        id,
        name: n,
        shortName: s,
        year: y,
        isActive: true,
        order: nextOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="bg-white rounded-card w-full max-w-md p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-ink-900">새 행사 추가</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-ink-100" type="button">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="행사명" placeholder="K-PRINT 2026" value={name} onChange={setName} />
          <Field label="단축명" placeholder="K-PRINT" value={shortName} onChange={setShortName} />
          <Field label="연도" placeholder="2026" value={year} onChange={setYear} type="number" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-3.5 py-2 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "저장 중…" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-ink-700 font-semibold mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
      />
    </label>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
