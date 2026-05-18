"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Category, Slot, Subcategory } from "@/lib/types";

export default function CategorySlotsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  const [filterSubcategory, setFilterSubcategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "sold">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Subscribe
  useEffect(() => {
    const u1 = onSnapshot(doc(getDb(), "categories", id), (s) => {
      if (s.exists()) setCategory({ ...(s.data() as Category), id: s.id });
    });
    const u2 = onSnapshot(
      query(collection(getDb(), "subcategories"), where("categoryId", "==", id)),
      (s) =>
        setSubcategories(s.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id })))
    );
    const u3 = onSnapshot(
      query(collection(getDb(), "slots"), where("categoryId", "==", id)),
      (s) => setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })))
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, [id]);

  const subById = useMemo(() => {
    const m = new Map<string, Subcategory>();
    subcategories.forEach((s) => m.set(s.id, s));
    return m;
  }, [subcategories]);

  const filtered = useMemo(() => {
    let rows = slots;
    if (filterSubcategory !== "all") {
      rows = rows.filter((s) => s.subcategoryId === filterSubcategory);
    }
    if (filterStatus !== "all") {
      rows = rows.filter((s) => s.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          (s.note ?? "").toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => a.order - b.order);
  }, [slots, filterSubcategory, filterStatus, search]);

  const totalCount = slots.length;
  const availCount = slots.filter((s) => s.status === "available").length;
  const soldCount = slots.filter((s) => s.status === "sold").length;

  const toggleSelected = (slotId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (filtered.every((s) => selected.has(s.id))) {
      const next = new Set(selected);
      filtered.forEach((s) => next.delete(s.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((s) => next.add(s.id));
      setSelected(next);
    }
  };

  const updateOneStatus = async (slotId: string, status: Slot["status"]) => {
    // 낙관적 — 실패 시 onSnapshot이 다시 정정해줌
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status } : s))
    );
    try {
      await updateDoc(doc(getDb(), "slots", slotId), { status });
    } catch (e) {
      alert(`상태 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const updateOneNote = async (slotId: string, note: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, note: note || undefined } : s))
    );
    try {
      await updateDoc(doc(getDb(), "slots", slotId), {
        note: note || undefined,
      });
    } catch (e) {
      alert(`메모 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const updateOneCode = async (slotId: string, code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, code: trimmed } : s))
    );
    try {
      await updateDoc(doc(getDb(), "slots", slotId), { code: trimmed });
    } catch (e) {
      alert(`코드 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** 새 슬롯 1개 생성 — 해당 소분류에서 다음 번호로 코드 자동 생성 */
  const createSlot = async (subId: string) => {
    if (!category) return;
    const sub = subById.get(subId);
    if (!sub) return;
    // 코드 패턴: <카테고리 code>-<순번> (단일 sub 인 경우) 또는 <카테고리>-<sub idx>-<seq>
    const existingCodes = new Set(slots.map((s) => s.code));
    let seq = slots.filter((s) => s.subcategoryId === subId).length + 1;
    let newCode = `${category.code}-${seq}`;
    while (existingCodes.has(newCode)) {
      seq++;
      newCode = `${category.code}-${seq}`;
    }
    try {
      await addDoc(collection(getDb(), "slots"), {
        eventId: category.eventId,
        categoryId: category.id,
        subcategoryId: subId,
        code: newCode,
        status: "available",
        order: slots.filter((s) => s.subcategoryId === subId).length,
      });
    } catch (e) {
      alert(`슬롯 생성 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** 슬롯 1개 영구 삭제 (마감 처리 아님) */
  const deleteOne = async (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    if (
      !confirm(
        `슬롯 ${slot.code} 을(를) 영구 삭제할까요? (마감 처리가 아니라 완전 제거 — 복구 불가)`
      )
    )
      return;
    try {
      await deleteDoc(doc(getDb(), "slots", slotId));
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** 선택된 슬롯 일괄 삭제 */
  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !confirm(
        `선택한 ${ids.length}개 슬롯을 영구 삭제할까요? (마감 처리가 아니라 완전 제거 — 복구 불가)`
      )
    )
      return;
    try {
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(getDb());
        for (const slotId of ids.slice(i, i + 500)) {
          batch.delete(doc(getDb(), "slots", slotId));
        }
        await batch.commit();
      }
      setSelected(new Set());
    } catch (e) {
      alert(`일괄 삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const bulkUpdate = async (status: Slot["status"]) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}개 슬롯을 ${status === "sold" ? "마감" : "가능"} 상태로 변경할까요?`)) return;
    try {
      // 500개씩 batch
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(getDb());
        for (const slotId of ids.slice(i, i + 500)) {
          batch.update(doc(getDb(), "slots", slotId), { status });
        }
        await batch.commit();
      }
      setSelected(new Set());
    } catch (e) {
      alert(`일괄 업데이트 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (!category) {
    return <div className="text-sm text-ink-500 text-center py-12">불러오는 중…</div>;
  }

  return (
    <div className="space-y-5 pb-24">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/categories/${id}`}
            className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
            aria-label="편집으로"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
              {category.name.ko} 슬롯 관리
            </h1>
            <div className="text-[12px] text-ink-500 mt-0.5">
              전체 <strong className="text-ink-900">{totalCount}</strong> · 가능{" "}
              <strong className="text-brand-700">{availCount}</strong> · 마감{" "}
              <strong className="text-ink-700">{soldCount}</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border border-ink-100 rounded-card p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="코드·위치 메모 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
          />
        </div>
        <select
          value={filterSubcategory}
          onChange={(e) => setFilterSubcategory(e.target.value)}
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-brand-500"
        >
          <option value="all">전체 소분류</option>
          {subcategories.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name.ko || "(기본)"}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-brand-500"
        >
          <option value="all">전체 상태</option>
          <option value="available">가능</option>
          <option value="sold">마감</option>
        </select>
      </div>

      {/* 소분류별 슬롯 추가 — 1구좌씩 늘리기 */}
      {subcategories.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-card p-4">
          <div className="text-[11px] uppercase tracking-wide font-bold text-ink-700 mb-2">
            슬롯 1개씩 추가
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {subcategories.map((sub) => {
              const count = slots.filter((s) => s.subcategoryId === sub.id).length;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => createSlot(sub.id)}
                  className="px-3 py-1.5 rounded-btn border border-ink-100 hover:border-brand-500 hover:bg-brand-50 text-[12px] text-ink-700 flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  {sub.name.ko || "(기본)"}
                  <span className="font-num text-[10.5px] text-ink-400">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] text-ink-500 mt-2 leading-snug">
            클릭 1번에 슬롯 1개 추가. 다음 번호 자동 생성. 줄이려면 우측 행
            휴지통 버튼으로 영구 삭제 (마감 처리 X).
          </p>
        </div>
      )}

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              <th className="text-left px-4 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 &&
                    filtered.every((s) => selected.has(s.id))
                  }
                  onChange={toggleAllVisible}
                  className="accent-brand-500"
                />
              </th>
              <th className="text-left px-4 py-2.5 font-semibold">코드</th>
              <th className="text-left px-4 py-2.5 font-semibold">소분류</th>
              <th className="text-left px-4 py-2.5 font-semibold">위치 메모</th>
              <th className="text-center px-4 py-2.5 font-semibold">상태</th>
              <th className="text-right px-4 py-2.5 font-semibold">단가</th>
              <th className="text-center px-2 py-2.5 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-500">
                  표시할 슬롯이 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((slot) => {
              const sub = subById.get(slot.subcategoryId);
              return (
                <tr key={slot.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="px-4 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selected.has(slot.id)}
                      onChange={() => toggleSelected(slot.id)}
                      className="accent-brand-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      defaultValue={slot.code}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== slot.code) updateOneCode(slot.id, v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-24 px-1.5 py-1 font-mono text-[12px] text-ink-900 bg-transparent border border-transparent hover:border-ink-100 focus:border-brand-500 focus:bg-white rounded outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-[12px] text-ink-700">
                    {sub?.name.ko || "(기본)"}
                  </td>
                  <td className="px-4 py-2">
                    <NoteCell
                      value={slot.note ?? ""}
                      onSave={(v) => updateOneNote(slot.id, v)}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <StatusToggle
                      status={slot.status}
                      onChange={(s) => updateOneStatus(slot.id, s)}
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[12px] text-ink-700">
                    {sub ? `${sub.priceKRW.toLocaleString()}원` : "—"}
                  </td>
                  <td className="px-2 py-2 text-center w-10">
                    <button
                      type="button"
                      onClick={() => deleteOne(slot.id)}
                      className="w-7 h-7 grid place-items-center rounded text-ink-400 hover:text-red-700 hover:bg-red-50"
                      title="영구 삭제 (마감 X)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-ink-900 text-white rounded-card px-5 py-3 flex items-center gap-4 shadow-2xl">
          <span className="text-[13px]">
            선택된 <strong className="text-brand-500">{selected.size}</strong>개
          </span>
          <button
            type="button"
            onClick={() => bulkUpdate("sold")}
            className="px-3 py-1.5 rounded-btn bg-white/10 hover:bg-white/20 text-[13px] font-semibold"
          >
            일괄 마감
          </button>
          <button
            type="button"
            onClick={() => bulkUpdate("available")}
            className="px-3 py-1.5 rounded-btn bg-brand-500 text-ink-900 hover:bg-brand-700 hover:text-white text-[13px] font-semibold"
          >
            일괄 가능
          </button>
          <span className="w-px h-5 bg-white/20" />
          <button
            type="button"
            onClick={() => void bulkDelete()}
            className="px-3 py-1.5 rounded-btn bg-red-500/20 hover:bg-red-500 hover:text-white text-red-300 text-[13px] font-semibold flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            영구 삭제
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[12px] text-ink-300 hover:text-white"
          >
            선택 해제
          </button>
        </div>
      )}
    </div>
  );
}

function StatusToggle({
  status,
  onChange,
}: {
  status: Slot["status"];
  onChange: (next: Slot["status"]) => void;
}) {
  const isAvail = status === "available";
  return (
    <button
      type="button"
      onClick={() => onChange(isAvail ? "sold" : "available")}
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors " +
        (isAvail
          ? "bg-brand-50 border-brand-100 text-brand-700 hover:bg-brand-100"
          : "bg-ink-100 border-ink-100 text-ink-700 hover:bg-ink-50")
      }
    >
      <span
        className={
          "w-1.5 h-1.5 rounded-full " + (isAvail ? "bg-brand-500" : "bg-ink-500")
        }
      />
      {isAvail ? "가능" : "마감"}
    </button>
  );
}

function NoteCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onSave(local);
      }}
      placeholder="—"
      className="w-full px-2 py-1 text-[12px] border border-transparent hover:border-ink-100 focus:border-brand-500 focus:outline-none rounded bg-transparent focus:bg-white"
    />
  );
}
