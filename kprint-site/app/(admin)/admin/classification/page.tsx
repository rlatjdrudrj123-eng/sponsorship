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
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit2,
  Layers,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import { PersonaEditModal } from "@/components/admin/PersonaEditModal";
import type { Category, CategoryType, Event, Persona, Taxonomy } from "@/lib/types";
import { CATEGORY_TYPE_LABELS } from "@/lib/categoryTypeLabels";

type Tab = "persona" | "media" | "timing" | "location";

type Bucket = {
  id: string;
  label: string;
  labelEn?: string;
  description?: string;
};

// 단일 진실원 — lib/categoryTypeLabels.ts 에서 import (사이트와 일관).
// "media" / "package" 는 분류 그룹에 안 노출하므로 명시 7개만.
const MEDIA_BUCKETS: Bucket[] = (
  [
    "floor_plan",
    "xpace",
    "digital_banner",
    "mailing",
    "print_page",
    "content",
    "quantity",
  ] as const
).map((id) => ({ id, label: CATEGORY_TYPE_LABELS[id].ko }));

const TIMING_BUCKETS: Bucket[] = [
  { id: "pre", label: "사전 (행사 전)" },
  { id: "onsite", label: "현장 (행사 중)" },
  { id: "post", label: "사후 (행사 후)" },
];

const LOCATION_BUCKETS: Bucket[] = [
  { id: "hall_a", label: "Hall A" },
  { id: "hall_b", label: "Hall B" },
  { id: "hall_c", label: "Hall C" },
  { id: "hall_d", label: "Hall D" },
  { id: "outdoor", label: "옥외" },
  { id: "online", label: "온라인" },
];

export default function ClassificationPage() {
  const { eventId, ready } = useEventFilter();
  const [tab, setTab] = useState<Tab>("persona");
  const [categories, setCategories] = useState<Category[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [editPersona, setEditPersona] = useState<Persona | null>(null);
  const [addingPersona, setAddingPersona] = useState(false);
  const [editingBuckets, setEditingBuckets] = useState(false);
  // 행사 간 추천 매핑 복사용 — 다른 행사 목록
  const [events, setEvents] = useState<Event[]>([]);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => setEvents(s.docs.map((d) => ({ ...(d.data() as Event), id: d.id })))
    );
    return u;
  }, []);

  useEffect(() => {
    if (!ready || !eventId) return;
    const u1 = onSnapshot(
      query(collection(getDb(), "categories"), where("eventId", "==", eventId)),
      (s) =>
        setCategories(s.docs.map((d) => ({ ...(d.data() as Category), id: d.id })))
    );
    const u2 = onSnapshot(
      query(collection(getDb(), "personas"), where("eventId", "==", eventId)),
      (s) => setPersonas(s.docs.map((d) => ({ ...(d.data() as Persona), id: d.id })))
    );
    const u3 = onSnapshot(doc(getDb(), "taxonomy", eventId), (s) => {
      setTaxonomy(s.exists() ? (s.data() as Taxonomy) : null);
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, [ready, eventId]);

  // 첫 로드 시 활성 버킷 자동 선택
  useEffect(() => {
    const buckets = getBuckets(tab, personas, taxonomy);
    if (buckets.length > 0 && !buckets.some((b) => b.id === activeBucket)) {
      setActiveBucket(buckets[0].id);
    }
  }, [tab, personas, taxonomy, activeBucket]);

  const buckets = getBuckets(tab, personas, taxonomy);

  // 버킷 저장 (taxonomy 도큐먼트에 머지)
  const saveBuckets = async (
    kind: "media" | "timing" | "location",
    next: Bucket[]
  ) => {
    if (!eventId) return;
    const field =
      kind === "media"
        ? "mediaBuckets"
        : kind === "timing"
          ? "timingBuckets"
          : "locationBuckets";
    try {
      await setDoc(
        doc(getDb(), "taxonomy", eventId),
        { eventId, [field]: next, updatedAt: Timestamp.fromDate(new Date()) },
        { merge: true }
      );
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 카테고리 분류: 활성 버킷에 속한 것 / 안 속한 것
  const { inBucket, unassigned } = useMemo(() => {
    if (!activeBucket) return { inBucket: [], unassigned: categories };
    const inB: Category[] = [];
    const un: Category[] = [];
    categories
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((c) => {
        if (isInBucket(c, tab, activeBucket)) inB.push(c);
        else un.push(c);
      });
    return { inBucket: inB, unassigned: un };
  }, [categories, tab, activeBucket]);

  const handleDrop = async (categoryId: string, bucketId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    try {
      const updates = computeBucketUpdate(cat, tab, bucketId, "add");
      await updateDoc(doc(getDb(), "categories", cat.id), {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`이동 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleRemove = async (categoryId: string, bucketId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    try {
      const updates = computeBucketUpdate(cat, tab, bucketId, "remove");
      await updateDoc(doc(getDb(), "categories", cat.id), {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`제거 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 다른 행사의 추천 매핑을 코드 기준으로 이식.
  // 배경: 엑셀 덮어쓰기 임포트는 카테고리를 재생성하면서 아래 추천 필드를
  // 담지 못해 추천 로직(한눈에 보기 탭·추천코스·1분 진단·함께 보면 좋은)이 초기화된다.
  // 복사 대상: goalAffinity(진단 0~3점) · recommendBoost · personas · synergyTargets · timingOverride
  // - 카테고리 매칭: code 동일 (예: CBA ↔ CBA)
  // - 페르소나 ID 변환: 소스 페르소나 title ↔ 타깃 페르소나 title 매칭
  // - 시너지 ID 변환: 소스 카테고리 id → code → 타깃의 같은 code 카테고리 id
  // - locationOverride 는 행사장(홀 배치)이 다르므로 복사하지 않음
  const copyRecoFromEvent = async (sourceEventId: string) => {
    const sourceEvent = events.find((e) => e.id === sourceEventId);
    if (!sourceEvent || !eventId || copying) return;
    setCopying(true);
    try {
      const db = getDb();
      const [srcCatSnap, srcPerSnap] = await Promise.all([
        getDocs(query(collection(db, "categories"), where("eventId", "==", sourceEventId))),
        getDocs(query(collection(db, "personas"), where("eventId", "==", sourceEventId))),
      ]);
      const srcCats = srcCatSnap.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
      const srcPersonas = srcPerSnap.docs.map((d) => ({ ...(d.data() as Persona), id: d.id }));

      // 페르소나 ID 변환표 — title(trim) 매칭
      const srcPersonaTitle = new Map(srcPersonas.map((p) => [p.id, p.title.trim()]));
      const targetPersonaByTitle = new Map(personas.map((p) => [p.title.trim(), p.id]));
      // 시너지 변환표 — 소스 id → code, 타깃 code → id
      const srcCodeById = new Map(srcCats.map((c) => [c.id, c.code]));
      const targetIdByCode = new Map(categories.map((c) => [c.code, c.id]));
      const srcByCode = new Map(srcCats.map((c) => [c.code, c]));

      let matched = 0;
      let personaLinks = 0;
      let synergyLinks = 0;
      let affinityFilled = 0;
      const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

      for (const target of categories) {
        const src = srcByCode.get(target.code);
        if (!src) continue;
        matched++;
        const mappedPersonas = (src.personas ?? [])
          .map((pid) => targetPersonaByTitle.get(srcPersonaTitle.get(pid) ?? ""))
          .filter((v): v is string => Boolean(v));
        const mappedSynergy = (src.synergyTargets ?? [])
          .map((cid) => targetIdByCode.get(srcCodeById.get(cid) ?? ""))
          .filter((v): v is string => Boolean(v) && v !== target.id);
        personaLinks += mappedPersonas.length;
        synergyLinks += mappedSynergy.length;
        const srcAffinity = src.goalAffinity ?? {};
        if (Object.keys(srcAffinity).length > 0) affinityFilled++;
        const data: Record<string, unknown> = {
          // 1분 진단 점수(0~3) — 진단 챗봇 추천의 핵심. 비어있으면 {} 로 명시 저장.
          goalAffinity: srcAffinity,
          personas: mappedPersonas,
          synergyTargets: mappedSynergy,
          updatedAt: Timestamp.fromDate(new Date()),
        };
        if (src.recommendBoost != null) data.recommendBoost = src.recommendBoost;
        if (src.timingOverride) data.timingOverride = src.timingOverride;
        updates.push({ id: target.id, data });
      }

      if (updates.length === 0) {
        alert(`「${sourceEvent.name}」와 코드가 일치하는 카테고리가 없습니다.`);
        return;
      }
      if (
        !confirm(
          `「${sourceEvent.name}」의 추천 매핑을 복사할까요?\n\n` +
            `· 코드 일치 카테고리: ${matched}개 (이 행사 ${categories.length}개 중)\n` +
            `· 1분 진단 점수(0~3): ${affinityFilled}개 카테고리\n` +
            `· 페르소나 연결: ${personaLinks}건 (페르소나는 이름으로 자동 변환)\n` +
            `· 함께 보면 좋은(시너지) 연결: ${synergyLinks}건\n\n` +
            `일치하는 카테고리의 기존 진단 점수·페르소나·시너지 연결은 덮어씁니다.\n` +
            `(위치 분류는 행사장이 달라 복사하지 않습니다)`
        )
      )
        return;

      const batch = writeBatch(db);
      updates.forEach((u) => batch.update(doc(db, "categories", u.id), u.data));
      await batch.commit();
      alert(
        `복사 완료 — 카테고리 ${updates.length}개에 진단점수 ${affinityFilled}개 · 페르소나 ${personaLinks}건 · 시너지 ${synergyLinks}건 적용.\n"참가 상황" 탭 및 각 카테고리 편집에서 결과를 확인하세요.`
      );
    } catch (e) {
      alert(`복사 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCopying(false);
    }
  };

  if (!ready || !eventId) {
    return (
      <div className="bg-white border border-ink-100 rounded-card p-8 text-center">
        <p className="text-sm text-ink-700">먼저 상단 셀렉터에서 행사를 선택해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-700" />
            매체 분류
          </h1>
          <p className="text-[13px] text-ink-700 mt-1">
            참가 상황·매체 유형·시점·위치를 그룹별로 보고 드래그로 스폰서십 매체를 이동하세요.
          </p>
        </div>
        {events.filter((e) => e.id !== eventId).length > 0 && (
          <select
            value=""
            disabled={copying}
            onChange={(e) => {
              const v = e.target.value;
              if (v) void copyRecoFromEvent(v);
              e.target.value = "";
            }}
            className="px-3 py-2 rounded-btn border border-ink-200 bg-white text-[12.5px] font-semibold text-ink-900 hover:bg-ink-50 cursor-pointer disabled:opacity-50"
            title="다른 행사의 1분 진단 점수·페르소나 연결·시너지(함께 보면 좋은)·노출 시점을 카테고리 코드 기준으로 복사 (엑셀 임포트 후 추천 로직 복원용)"
          >
            <option value="" disabled>
              {copying ? "복사 중…" : "📋 다른 행사에서 추천 매핑 복사…"}
            </option>
            {events
              .filter((e) => e.id !== eventId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        )}
      </header>

      <div className="flex items-center gap-1 bg-white border border-ink-100 rounded-btn p-1 w-fit">
        {(
          [
            { id: "persona", label: "참가 상황" },
            { id: "media", label: "매체 유형" },
            { id: "timing", label: "노출 시점" },
            { id: "location", label: "위치" },
          ] as Array<{ id: Tab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setActiveBucket(null);
            }}
            className={
              "px-3.5 py-1.5 rounded text-[13px] font-semibold transition-colors " +
              (tab === t.id ? "bg-ink-900 text-white" : "text-ink-700 hover:text-ink-900")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "persona" && personas.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-amber-700" />
          <span className="text-[13px] text-amber-700 font-semibold">
            등록된 페르소나가 없습니다 — /admin/classification 의 페르소나 탭에서 직접 추가하세요.
          </span>
        </div>
      )}

      {tab === "media" && (
        <div className="bg-blue-50 border border-blue-100 rounded-card p-3 text-[12px] text-blue-800">
          ⓘ 매체 유형은 카테고리의 <code className="font-mono">type</code> 필드를 사용합니다. 다른 유형으로 옮기면 그 카테고리의 type이 변경됩니다.
        </div>
      )}
      {(tab === "timing" || tab === "location") && (
        <div className="bg-blue-50 border border-blue-100 rounded-card p-3 text-[12px] text-blue-800">
          ⓘ 명시 지정이 없으면 자동 추출(휴리스틱) 결과로 동작합니다. 여기서 명시 지정하면 그 값이 우선됩니다.
        </div>
      )}

      {/* 버킷 편집 모드 — 매체/시점/위치 탭에서만 */}
      {(tab === "media" || tab === "timing" || tab === "location") && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditingBuckets((v) => !v)}
            className={
              "px-3 py-1.5 rounded-btn border text-[12px] font-semibold flex items-center gap-1.5 " +
              (editingBuckets
                ? "bg-ink-900 border-ink-900 text-white"
                : "border-ink-100 text-ink-700 hover:border-ink-900")
            }
          >
            {editingBuckets ? "편집 완료" : `${tab === "media" ? "매체 유형" : tab === "timing" ? "노출 시점" : "위치"} 항목 편집`}
          </button>
        </div>
      )}
      {editingBuckets &&
        (tab === "media" || tab === "timing" || tab === "location") && (
          <BucketEditor
            kind={tab}
            buckets={buckets}
            onSave={(next) => void saveBuckets(tab, next)}
          />
        )}

      {buckets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-4 items-start">
          {/* 좌: 버킷 목록 */}
          <aside className="bg-white border border-ink-100 rounded-card overflow-hidden">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-ink-500 font-bold bg-ink-50">
              그룹
            </div>
            <ul>
              {buckets.map((b) => {
                const count = categories.filter((c) =>
                  isInBucket(c, tab, b.id)
                ).length;
                const active = activeBucket === b.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setActiveBucket(b.id)}
                      className={
                        "w-full text-left px-3 py-2.5 border-t border-ink-100 flex items-center justify-between gap-2 text-[13px] " +
                        (active
                          ? "bg-brand-50 text-brand-700 font-bold"
                          : "text-ink-700 hover:bg-ink-50")
                      }
                    >
                      <span className="truncate">{b.label}</span>
                      <span className="text-[11px] text-ink-500 font-mono">
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {tab === "persona" && (
              <div className="p-2 border-t border-ink-100 space-y-1">
                <button
                  type="button"
                  onClick={() => setAddingPersona(true)}
                  className="w-full px-2 py-1.5 rounded-btn border border-dashed border-ink-200 text-[11px] text-ink-500 hover:border-brand-500 hover:text-brand-700 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />새 페르소나
                </button>
                {personas.length > 0 && (
                  <div className="pt-2 space-y-0.5">
                    {personas
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1 px-1.5 py-1 hover:bg-ink-50 rounded"
                        >
                          <span className="text-[10px] text-ink-500 truncate flex-1">
                            {p.emoji} {p.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditPersona(p)}
                            className="p-0.5 text-ink-300 hover:text-brand-700"
                            title="편집"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                !confirm(
                                  "페르소나를 삭제할까요? 이미 카테고리에 적용된 매칭은 풀립니다."
                                )
                              )
                                return;
                              try {
                                await deleteDoc(doc(getDb(), "personas", p.id));
                              } catch (e) {
                                alert(
                                  `삭제 실패: ${e instanceof Error ? e.message : String(e)}`
                                );
                              }
                            }}
                            className="p-0.5 text-ink-300 hover:text-red-700"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* 중: 활성 버킷에 속한 카테고리 */}
          <div
            className="bg-white border-2 border-dashed border-brand-200 rounded-card min-h-[300px] p-4"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const catId = e.dataTransfer.getData("text/plain");
              if (catId && activeBucket) handleDrop(catId, activeBucket);
              setDraggingCatId(null);
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-wider text-brand-700 font-bold">
                속한 카테고리
              </div>
              <span className="text-[11px] text-ink-500 font-mono">
                {inBucket.length}개
              </span>
            </div>
            {inBucket.length === 0 ? (
              <div className="text-center py-10 text-[12px] text-ink-500">
                이 그룹에 속한 카테고리가 없습니다.
                <br />
                <span className="text-[11px]">
                  우측에서 드래그해 추가하세요.
                </span>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {inBucket.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      setDraggingCatId(c.id);
                    }}
                    onDragEnd={() => setDraggingCatId(null)}
                    className={
                      "flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-100 rounded-btn cursor-move transition-opacity " +
                      (draggingCatId === c.id ? "opacity-40" : "")
                    }
                  >
                    <span className="text-[10px] font-mono text-brand-700 shrink-0">
                      {c.code}
                    </span>
                    <span className="text-[13px] text-ink-900 font-semibold truncate flex-1">
                      {c.name.ko}
                    </span>
                    {activeBucket && (
                      <button
                        type="button"
                        onClick={() => handleRemove(c.id, activeBucket)}
                        className="p-0.5 text-ink-500 hover:text-red-700"
                        title="이 그룹에서 제거"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 우: 미배정·다른 그룹 카테고리 */}
          <aside className="bg-white border border-ink-100 rounded-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-2">
              아직 이 그룹에 없는 카테고리
            </div>
            {unassigned.length === 0 ? (
              <div className="text-[12px] text-ink-500 py-6 text-center">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-brand-500" />
                모든 카테고리가 이 그룹에 있습니다.
              </div>
            ) : (
              <ul className="space-y-1">
                {unassigned.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      setDraggingCatId(c.id);
                    }}
                    onDragEnd={() => setDraggingCatId(null)}
                    className={
                      "flex items-center gap-2 px-2 py-1.5 bg-white border border-ink-100 rounded-btn cursor-move hover:border-brand-300 hover:bg-brand-50/50 transition-all " +
                      (draggingCatId === c.id ? "opacity-40" : "")
                    }
                    title={c.name.ko}
                  >
                    <span className="text-[10px] font-mono text-ink-500 shrink-0">
                      {c.code}
                    </span>
                    <span className="text-[12px] text-ink-700 truncate flex-1">
                      {c.name.ko}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}

      {addingPersona && (
        <PersonaEditModal
          mode={{ kind: "new", eventId, order: personas.length }}
          onClose={() => setAddingPersona(false)}
        />
      )}
      {editPersona && (
        <PersonaEditModal
          mode={{ kind: "edit", persona: editPersona }}
          onClose={() => setEditPersona(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getBuckets(
  tab: Tab,
  personas: Persona[],
  taxonomy: Taxonomy | null
): Bucket[] {
  if (tab === "persona") {
    return personas
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p.id, label: `${p.emoji} ${p.title}` }));
  }
  if (tab === "media") return taxonomy?.mediaBuckets ?? MEDIA_BUCKETS;
  if (tab === "timing") return taxonomy?.timingBuckets ?? TIMING_BUCKETS;
  return taxonomy?.locationBuckets ?? LOCATION_BUCKETS;
}

function isInBucket(c: Category, tab: Tab, bucketId: string): boolean {
  if (tab === "persona") return (c.personas ?? []).includes(bucketId);
  if (tab === "media") return c.type === bucketId;
  if (tab === "timing")
    return (c.timingOverride ?? []).includes(bucketId as "pre" | "onsite" | "post");
  return (c.locationOverride ?? []).includes(
    bucketId as "hall_a" | "hall_b" | "hall_c" | "hall_d" | "outdoor" | "online"
  );
}

function computeBucketUpdate(
  c: Category,
  tab: Tab,
  bucketId: string,
  op: "add" | "remove"
): Record<string, unknown> {
  if (tab === "persona") {
    const next = new Set(c.personas ?? []);
    if (op === "add") next.add(bucketId);
    else next.delete(bucketId);
    return { personas: Array.from(next) };
  }
  if (tab === "media") {
    if (op === "add") return { type: bucketId as CategoryType };
    return {}; // 매체 유형 단일값이라 'remove'는 의미 없음
  }
  if (tab === "timing") {
    const next = new Set(c.timingOverride ?? []);
    if (op === "add") next.add(bucketId as "pre" | "onsite" | "post");
    else next.delete(bucketId as "pre" | "onsite" | "post");
    return { timingOverride: Array.from(next) };
  }
  const next = new Set(c.locationOverride ?? []);
  if (op === "add")
    next.add(bucketId as "hall_a" | "hall_b" | "hall_c" | "hall_d" | "outdoor" | "online");
  else
    next.delete(bucketId as "hall_a" | "hall_b" | "hall_c" | "hall_d" | "outdoor" | "online");
  return { locationOverride: Array.from(next) };
}

// ============================================================================
// 버킷 편집기 — 매체 유형 / 노출 시점 / 위치 항목을 추가·수정·삭제
// 저장 시 taxonomy/{eventId} 도큐먼트의 mediaBuckets / timingBuckets / locationBuckets 에 머지.
// ============================================================================

function BucketEditor({
  kind,
  buckets,
  onSave,
}: {
  kind: "media" | "timing" | "location";
  buckets: Bucket[];
  onSave: (next: Bucket[]) => void;
}) {
  const [draft, setDraft] = useState<Bucket[]>(buckets);
  const [newLabel, setNewLabel] = useState("");
  const [newId, setNewId] = useState("");

  useEffect(() => {
    setDraft(buckets);
  }, [buckets]);

  const kindLabel =
    kind === "media" ? "매체 유형" : kind === "timing" ? "노출 시점" : "위치";

  return (
    <div className="bg-white border-2 border-ink-900 rounded-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-ink-900 text-[14px]">
          {kindLabel} 항목 편집
        </div>
        <div className="text-[11px] text-ink-500">
          항목 ID 는 카테고리에 저장되는 값. 라벨은 표시용.
        </div>
      </div>
      {kind === "media" && (
        <div className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 leading-snug">
          ⚠ 매체 유형은 카테고리의 <code>type</code> 필드와 매핑됩니다 — ID 를
          바꾸면 기존 카테고리와 어긋날 수 있으니 신중히. 새 ID 는 코드 유효
          타입과 일치해야 합니다 (floor_plan / xpace / digital_banner / mailing /
          print_page / content / quantity / media).
        </div>
      )}
      <ul className="space-y-1.5">
        {draft.map((b, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={b.id}
              onChange={(e) => {
                const next = [...draft];
                next[i] = { ...next[i], id: e.target.value };
                setDraft(next);
              }}
              placeholder="ID"
              className="px-2 py-1.5 rounded border border-ink-100 text-[11.5px] font-mono w-[140px] focus:border-ink-900 focus:outline-none"
            />
            <input
              type="text"
              value={b.label}
              onChange={(e) => {
                const next = [...draft];
                next[i] = { ...next[i], label: e.target.value };
                setDraft(next);
              }}
              placeholder="라벨 (한글)"
              className="flex-1 px-2 py-1.5 rounded border border-ink-100 text-[12px] focus:border-ink-900 focus:outline-none"
            />
            <input
              type="text"
              value={b.labelEn ?? ""}
              onChange={(e) => {
                const next = [...draft];
                next[i] = { ...next[i], labelEn: e.target.value };
                setDraft(next);
              }}
              placeholder="EN label"
              className="flex-1 px-2 py-1.5 rounded border border-ink-100 text-[12px] focus:border-ink-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (i > 0) {
                  const next = [...draft];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  setDraft(next);
                }
              }}
              disabled={i === 0}
              className="w-7 h-7 grid place-items-center rounded hover:bg-ink-100 text-ink-500 disabled:opacity-30"
              title="위로"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (i < draft.length - 1) {
                  const next = [...draft];
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  setDraft(next);
                }
              }}
              disabled={i === draft.length - 1}
              className="w-7 h-7 grid place-items-center rounded hover:bg-ink-100 text-ink-500 disabled:opacity-30"
              title="아래로"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`「${b.label}」 항목을 삭제할까요? (카테고리에 이 ID 가 지정된 경우 다시 분류해야 합니다.)`)) return;
                setDraft(draft.filter((_, j) => j !== i));
              }}
              className="w-7 h-7 grid place-items-center rounded hover:bg-red-50 text-ink-500 hover:text-red-700"
              title="삭제"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5 pt-2 border-t border-ink-100">
        <input
          type="text"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="새 ID (예: hall_7)"
          className="px-2 py-1.5 rounded border border-ink-100 text-[11.5px] font-mono w-[160px] focus:border-ink-900 focus:outline-none"
        />
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="새 라벨 (예: Hall 7)"
          className="flex-1 px-2 py-1.5 rounded border border-ink-100 text-[12px] focus:border-ink-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            const id = newId.trim();
            const label = newLabel.trim();
            if (!id || !label) {
              alert("ID 와 라벨을 모두 입력해주세요.");
              return;
            }
            if (draft.some((b) => b.id === id)) {
              alert("같은 ID 가 이미 있습니다.");
              return;
            }
            setDraft([...draft, { id, label }]);
            setNewId("");
            setNewLabel("");
          }}
          className="px-3 py-1.5 rounded border border-ink-100 text-[12px] font-semibold hover:border-ink-900"
        >
          + 추가
        </button>
      </div>
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-ink-100">
        <button
          type="button"
          onClick={() => setDraft(buckets)}
          className="px-3 py-1.5 rounded text-[12px] font-semibold text-ink-500 hover:text-ink-900"
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="px-3.5 py-1.5 rounded-btn bg-ink-900 text-white text-[12px] font-bold hover:bg-brand-500 flex items-center gap-1.5"
        >
          <Save className="w-3 h-3" />
          저장
        </button>
      </div>
    </div>
  );
}
