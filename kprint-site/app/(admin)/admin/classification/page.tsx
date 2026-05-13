"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import { populateClassifications, seedDefaultPersonas } from "@/lib/admin/seedDemo";
import { PersonaEditModal } from "@/components/admin/PersonaEditModal";
import type { Category, CategoryType, Persona } from "@/lib/types";

type Tab = "persona" | "media" | "timing" | "location";

type Bucket = {
  id: string;
  label: string;
  description?: string;
};

const MEDIA_BUCKETS: Bucket[] = [
  { id: "floor_plan", label: "전시장 내부 설치" },
  { id: "xpace", label: "LED 영상 광고" },
  { id: "digital_banner", label: "사이트·앱 배너" },
  { id: "mailing", label: "뉴스레터·푸시" },
  { id: "print_page", label: "쇼가이드 인쇄" },
  { id: "content", label: "SNS 콘텐츠" },
  { id: "quantity", label: "참관객 배포물" },
];

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
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [editPersona, setEditPersona] = useState<Persona | null>(null);
  const [addingPersona, setAddingPersona] = useState(false);
  const [populating, setPopulating] = useState(false);

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
    return () => {
      u1();
      u2();
    };
  }, [ready, eventId]);

  // 첫 로드 시 활성 버킷 자동 선택
  useEffect(() => {
    const buckets = getBuckets(tab, personas);
    if (buckets.length > 0 && !buckets.some((b) => b.id === activeBucket)) {
      setActiveBucket(buckets[0].id);
    }
  }, [tab, personas, activeBucket]);

  const buckets = getBuckets(tab, personas);

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

  const seedPersonas = async () => {
    if (!eventId) return;
    if (!confirm("기본 페르소나 5개를 시드합니다. 같은 ID가 있으면 덮어씌워집니다.")) return;
    try {
      await seedDefaultPersonas(eventId);
    } catch (e) {
      alert(`시드 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const populateCurrent = async () => {
    if (!eventId) return;
    if (
      !confirm(
        "기본 페르소나 5개를 시드하고, 현재 카테고리들의 태그·이름에 따라 페르소나·시점·위치를 일괄 자동 배정합니다. 기존 명시 지정이 덮어쓰여집니다. 진행할까요?"
      )
    )
      return;
    setPopulating(true);
    try {
      const r = await populateClassifications(eventId);
      alert(
        `완료\n· 페르소나 ${r.personasSeeded}개 시드\n· 카테고리 ${r.categoriesUpdated}개 갱신`
      );
    } catch (e) {
      alert(`실행 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPopulating(false);
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
            분류 관리
          </h1>
          <p className="text-[13px] text-ink-700 mt-1">
            페르소나·매체 유형·시점·위치를 그룹별로 보고 드래그로 카테고리를 이동하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={populateCurrent}
          disabled={populating}
          className="px-3.5 py-2 rounded-btn bg-brand-500 text-ink-900 text-[12.5px] font-bold hover:bg-brand-700 hover:text-white disabled:opacity-50 flex items-center gap-1.5"
          title="현재 카테고리 태그·이름·type에 따라 페르소나·시점·위치를 한 번에 채워넣습니다"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {populating ? "채우는 중…" : "현재 설정대로 일괄 채우기"}
        </button>
      </header>

      <div className="flex items-center gap-1 bg-white border border-ink-100 rounded-btn p-1 w-fit">
        {(
          [
            { id: "persona", label: "페르소나" },
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
        <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-[13px] font-semibold">등록된 페르소나가 없습니다.</span>
          </div>
          <button
            type="button"
            onClick={seedPersonas}
            className="px-3.5 py-2 rounded-btn bg-amber-700 text-white text-[12px] font-bold hover:bg-amber-800"
          >
            기본 5개 시드
          </button>
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

function getBuckets(tab: Tab, personas: Persona[]): Bucket[] {
  if (tab === "persona") {
    return personas
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p.id, label: `${p.emoji} ${p.title}` }));
  }
  if (tab === "media") return MEDIA_BUCKETS;
  if (tab === "timing") return TIMING_BUCKETS;
  return LOCATION_BUCKETS;
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
