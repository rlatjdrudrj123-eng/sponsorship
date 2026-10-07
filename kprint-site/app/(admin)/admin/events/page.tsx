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
import { filterAccessibleEvents, isAdminAccess, useAccess } from "@/lib/admin/access";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import { cloneEvent } from "@/lib/admin/cloneEvent";
import type { CloneInclude, ClonePlan } from "@/lib/admin/clonePlan";
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
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const access = useAccess();
  // 행사 추가·삭제·순서·노출(활성)은 공개 사이트 전체에 영향 → 관리자만.
  // 담당자는 배정된 행사의 이름·연도 등 기본 정보만 고칠 수 있다.
  const admin = isAdminAccess(access);
  const events = useMemo(() => filterAccessibleEvents(access, allEvents), [access, allEvents]);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => {
        setAllEvents(s.docs.map((d) => ({ ...(d.data() as Event), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => u();
  }, []);

  // Auto-seed default events if collection is empty
  useEffect(() => {
    if (!admin || loading || seeded) return;
    if (allEvents.length > 0) return;
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
  }, [admin, allEvents, loading, seeded]);

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
            {admin
              ? "연도·행사별로 스폰서를 분리해 관리합니다 (예: K-PRINT 2026, K-PRINT 2027)."
              : "배정된 행사만 표시됩니다. 행사 추가·삭제·공개 여부는 관리자에게 요청하세요."}
          </p>
        </div>
        {admin && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[13px] font-semibold hover:bg-ink-700 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />새 행사
          </button>
        )}
      </header>

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              {admin && <th className="text-center px-2 py-2.5 font-semibold w-16">순서</th>}
              <th className="text-left px-4 py-2.5 font-semibold">행사명</th>
              <th className="text-left px-4 py-2.5 font-semibold">단축명</th>
              <th className="text-right px-4 py-2.5 font-semibold w-24">연도</th>
              <th className="text-right px-4 py-2.5 font-semibold w-40">작년 합계</th>
              <th className="text-center px-4 py-2.5 font-semibold w-20">활성</th>
              {admin && <th className="px-4 py-2.5 w-20"></th>}
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
                  {admin ? "등록된 행사가 없습니다." : "배정된 행사가 없습니다."}
                </td>
              </tr>
            )}
            {events.map((e, i) => (
              <tr key={e.id} className="border-t border-ink-100">
                {admin && (
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
                )}
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
                  <div className="px-2 text-[10.5px] text-ink-400 font-mono mt-0.5">
                    /{e.id}
                  </div>
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
                    disabled={!admin}
                    title={admin ? undefined : "공개 여부는 관리자만 바꿀 수 있습니다"}
                    className={
                      "px-2.5 py-1 rounded-full text-[11px] font-semibold border disabled:cursor-default " +
                      (e.isActive
                        ? "bg-brand-500 text-ink-900 border-brand-500"
                        : "bg-ink-100 text-ink-500 border-ink-100")
                    }
                  >
                    {e.isActive ? "활성" : "숨김"}
                  </button>
                </td>
                {admin && (
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
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-ink-500">
        팁: 셀을 클릭해 직접 수정하면 자동으로 저장됩니다.
        {admin && " 활성 토글은 사이드바·스폰서 페이지의 기본 행사 후보에 영향을 줍니다."}
      </p>

      {showAdd && admin && (
        <AddEventModal events={allEvents} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

const DEFAULT_INCLUDE: CloneInclude = {
  catalog: true,
  packages: true,
  personas: true,
  site: true,
  quote: true,
};

function AddEventModal({ events, onClose }: { events: Event[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [year, setYear] = useState<string>(String(new Date().getFullYear() + 1));
  const [slug, setSlug] = useState("");
  // 사용자가 slug 칸을 직접 손대면 자동 채움 중지 (사용자 의도 보존).
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  // 기존 행사 복사해서 시작 — 비어 있으면 빈 행사
  const [sourceId, setSourceId] = useState("");
  const [include, setInclude] = useState<CloneInclude>(DEFAULT_INCLUDE);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [cloned, setCloned] = useState<{ id: string; plan: ClonePlan } | null>(null);
  const setSelectedEventId = useAdminEvent((s) => s.setSelectedEventId);

  const nextOrder = useMemo(() => {
    if (events.length === 0) return 0;
    return Math.max(...events.map((e) => e.order)) + 1;
  }, [events]);

  // 자동 slug — "단축명-연도" 패턴. 단축명 하이픈은 제거, 공백은 하이픈으로.
  const autoSlug = useMemo(() => {
    const s = shortName.trim();
    const y = year.trim();
    if (!s || !y) return "";
    return slugifyShort(s) + "-" + y;
  }, [shortName, year]);

  const effectiveSlug = slugTouched ? slug : autoSlug;
  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectiveSlug);
  const slugDuplicate = events.some((e) => e.id === effectiveSlug);

  const submit = async () => {
    const n = name.trim();
    const s = shortName.trim();
    const y = parseInt(year, 10);
    if (!n || !s || isNaN(y)) {
      alert("행사명·단축명·연도를 모두 입력해주세요.");
      return;
    }
    if (!effectiveSlug || !slugValid) {
      alert("URL 은 영문 소문자·숫자·하이픈만 가능합니다.");
      return;
    }
    if (slugDuplicate) {
      alert("같은 URL 의 행사가 이미 있습니다.");
      return;
    }
    setSaving(true);
    try {
      if (sourceId) {
        const plan = await cloneEvent({
          sourceEventId: sourceId,
          target: { id: effectiveSlug, name: n, shortName: s, year: y, order: nextOrder },
          include,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        setCloned({ id: effectiveSlug, plan });
        setSaving(false);
        return;
      }
      await setDoc(doc(getDb(), "events", effectiveSlug), {
        id: effectiveSlug,
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
      alert(
        `저장 실패: ${e instanceof Error ? e.message : String(e)}` +
          (sourceId ? "\n\n일부만 복사됐을 수 있습니다. 행사 목록에서 확인 후 필요하면 삭제하고 다시 시도하세요." : "")
      );
      setSaving(false);
    }
  };

  if (cloned) {
    const c = cloned.plan.counts;
    return (
      <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
        <div className="bg-white rounded-card w-full max-w-md p-5 shadow-xl">
          <h2 className="text-[16px] font-bold text-ink-900 mb-1">복사 완료</h2>
          <p className="text-[13px] text-ink-700 break-keep">
            매체 {c.categories}개 · 소분류 {c.subcategories}개 · 구좌 {c.slots}개 · 패키지 {c.packages}개 ·
            페르소나 {c.personas}개를 새 행사로 복사했습니다.
          </p>
          <div className="mt-4">
            <div className="text-[12px] font-bold text-ink-900 mb-1.5">공개 전에 확인할 것</div>
            <ul className="space-y-1 text-[12.5px] text-ink-700 list-disc pl-4 break-keep">
              {cloned.plan.checklist.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedEventId(cloned.id);
                onClose();
              }}
              className="px-3.5 py-2 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-semibold hover:bg-brand-700"
            >
              새 행사로 전환
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          <div className="block">
            <span className="text-[12px] text-ink-700 font-semibold mb-1 flex items-baseline gap-2">
              URL
              <span className="text-[10.5px] text-ink-400 font-normal">
                (사이트 주소의 슬래시 뒤. 한 번 정하면 바꾸기 어려움)
              </span>
            </span>
            <div className="flex items-stretch gap-1">
              <div className="px-2.5 grid place-items-center bg-ink-50 border border-ink-100 rounded-btn text-[12px] text-ink-500 font-mono">
                /
              </div>
              <input
                type="text"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                placeholder="kprint-2026"
                className={
                  "flex-1 px-3 py-2 text-sm border rounded-btn focus:outline-none bg-white font-mono " +
                  (slugDuplicate || (effectiveSlug && !slugValid)
                    ? "border-red-300 focus:border-red-500"
                    : "border-ink-100 focus:border-brand-500")
                }
              />
              {slugTouched && (
                <button
                  type="button"
                  onClick={() => {
                    setSlugTouched(false);
                    setSlug("");
                  }}
                  className="px-2.5 text-[11px] text-ink-500 hover:text-brand-700 rounded-btn border border-ink-100 hover:border-brand-300"
                  title="자동 생성으로 복원"
                >
                  자동
                </button>
              )}
            </div>
            <div className="mt-1 text-[11px] leading-snug">
              {!effectiveSlug ? (
                <span className="text-ink-400">단축명·연도를 입력하면 자동 채워집니다.</span>
              ) : slugDuplicate ? (
                <span className="text-red-700">이미 존재하는 URL 입니다.</span>
              ) : !slugValid ? (
                <span className="text-red-700">
                  영문 소문자·숫자·하이픈만 가능 (예: kprint-2026)
                </span>
              ) : (
                <span className="text-ink-500 font-mono">
                  사이트: /{effectiveSlug}
                </span>
              )}
            </div>
          </div>

          {/* 시작 방법 — 빈 행사 / 기존 행사 복사 */}
          <label className="block">
            <span className="text-[12px] text-ink-700 font-semibold mb-1 block">시작 방법</span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
            >
              <option value="">빈 행사로 시작</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} 복사해서 시작
                </option>
              ))}
            </select>
          </label>

          {sourceId && (
            <div className="bg-ink-50 border border-ink-100 rounded-btn p-3 space-y-2">
              {(
                [
                  ["catalog", "스폰서십 매체 (카테고리·소분류·구좌)", "구좌는 모두 '판매 중'으로"],
                  ["packages", "패키지", "매진 표시는 해제"],
                  ["personas", "페르소나·분류(태그)", ""],
                  ["site", "사이트 설정·메인 디자인", "전체 PDF는 제외"],
                  ["quote", "견적서 설정", "회사 정보만, 행사 문구는 새 행사명으로"],
                ] as const
              ).map(([key, label, note]) => {
                const disabled = saving || (key === "packages" && !include.catalog);
                return (
                  <label
                    key={key}
                    className={"flex items-start gap-2 text-[12.5px] " + (disabled ? "opacity-50" : "")}
                  >
                    <input
                      type="checkbox"
                      checked={include[key] && !(key === "packages" && !include.catalog)}
                      disabled={disabled}
                      onChange={(e) => setInclude((p) => ({ ...p, [key]: e.target.checked }))}
                      className="accent-brand-500 w-4 h-4 mt-0.5"
                    />
                    <span>
                      <span className="font-semibold text-ink-900">{label}</span>
                      {note && <span className="text-ink-500"> — {note}</span>}
                    </span>
                  </label>
                );
              })}
              <p className="text-[11.5px] text-ink-500 leading-relaxed break-keep pt-1">
                스폰서·문의·업로드 이력은 복사하지 않습니다. 이미지·PDF 파일은 원본 파일을 함께 쓰며,
                새 행사에서 교체해도 원본 행사는 바뀌지 않습니다.
              </p>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end items-center gap-2">
          {progress && saving && (
            <span className="text-[12px] text-ink-500 mr-auto">
              복사 중 {progress.done}/{progress.total}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !effectiveSlug || !slugValid || slugDuplicate}
            className="px-3.5 py-2 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? (sourceId ? "복사 중…" : "저장 중…") : sourceId ? "복사해서 추가" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// "K-PRINT" → "kprint", "ABC 2026 Pro" → "abc-2026-pro"
function slugifyShort(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^-+|-+$/g, "");
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
