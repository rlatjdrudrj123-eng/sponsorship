"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  MessageCircle,
  RotateCcw,
  Save,
  Scale,
} from "lucide-react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import {
  QUESTIONS,
  STAGES,
  SCORING_WEIGHTS,
} from "@/components/public/PersonaAiChat";
import type {
  DiagnosisChipOverride,
  DiagnosisConfig,
  DiagnosisStage,
  SiteSettings,
} from "@/lib/types";
import { ArrowDown as ArrowDownIcon, ArrowUp as ArrowUpIcon, Plus, X as XIcon } from "lucide-react";

/**
 * 스폰서십 진단 로직 — 어드민 편집.
 *
 * - 각 단계의 질문 텍스트 (intro / why) 를 행사별로 override 가능
 * - 스코어링 가중치 조절 가능 (각 항목 점수)
 * - 칩(선택지) 은 코드 기반 — 여기서 편집 불가 (질문 흐름과 강하게 묶여 있음)
 *
 * 저장 위치: siteSettings/{eventId}.diagnosisConfig
 * 비어있으면 코드 기본값(PersonaAiChat.tsx의 QUESTIONS / SCORING_WEIGHTS) 사용.
 */

const EDITABLE_STAGES: DiagnosisStage[] = [
  "goal",
  "budget",
  "segment",
  "companySize",
  "experience",
];

type QuestionEdits = {
  [K in DiagnosisStage]?: {
    intro?: string;
    why?: string;
    chips?: DiagnosisChipOverride[];
  };
};

type WeightEdits = Record<string, number>;

export default function DiagnosisLogicPage() {
  const selectedEventId = useAdminEvent((s) => s.selectedEventId);
  const [questionEdits, setQuestionEdits] = useState<QuestionEdits>({});
  const [weightEdits, setWeightEdits] = useState<WeightEdits>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!selectedEventId) return;
    const u = onSnapshot(
      doc(getDb(), "siteSettings", selectedEventId),
      (s) => {
        if (!s.exists()) return;
        const data = s.data() as SiteSettings;
        const cfg = data.diagnosisConfig;
        if (!dirty) {
          setQuestionEdits((cfg?.questions ?? {}) as QuestionEdits);
          setWeightEdits(cfg?.scoringWeights ?? {});
        }
      }
    );
    return () => u();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  if (!selectedEventId) {
    return (
      <div className="p-8 text-sm text-ink-500">
        먼저 상단의 행사를 선택하세요.
      </div>
    );
  }

  const updateQuestion = (
    stage: DiagnosisStage,
    field: "intro" | "why",
    value: string
  ) => {
    setQuestionEdits((prev) => ({
      ...prev,
      [stage]: { ...prev[stage], [field]: value },
    }));
    setDirty(true);
  };

  const resetQuestion = (stage: DiagnosisStage) => {
    setQuestionEdits((prev) => {
      const { [stage]: _omitted, ...rest } = prev;
      void _omitted;
      return rest;
    });
    setDirty(true);
  };

  const updateWeight = (key: string, value: number) => {
    setWeightEdits((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const resetWeight = (key: string) => {
    setWeightEdits((prev) => {
      const { [key]: _omitted, ...rest } = prev;
      void _omitted;
      return rest;
    });
    setDirty(true);
  };

  const resetAll = () => {
    if (!confirm("모든 override 를 지우고 코드 기본값으로 되돌릴까요?")) return;
    setQuestionEdits({});
    setWeightEdits({});
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const cfg: DiagnosisConfig = {};
      // 비어있는 override 는 저장 안 함
      const cleanQuestions: NonNullable<DiagnosisConfig["questions"]> = {};
      for (const stage of EDITABLE_STAGES) {
        const q = questionEdits[stage];
        if (!q) continue;
        const obj: {
          intro?: string;
          why?: string;
          chips?: DiagnosisChipOverride[];
        } = {};
        if (q.intro?.trim()) obj.intro = q.intro.trim();
        if (q.why?.trim()) obj.why = q.why.trim();
        if (q.chips && q.chips.length > 0) {
          // 빈 label 칩 거름
          const cleanChips = q.chips
            .filter((c) => c.label.trim() && c.value.trim())
            .map((c) => ({
              label: c.label.trim(),
              value: c.value.trim(),
              ...(c.hint?.trim() ? { hint: c.hint.trim() } : {}),
            }));
          if (cleanChips.length > 0) obj.chips = cleanChips;
        }
        if (Object.keys(obj).length > 0) cleanQuestions[stage] = obj;
      }
      if (Object.keys(cleanQuestions).length > 0) cfg.questions = cleanQuestions;

      const cleanWeights: Record<string, number> = {};
      for (const [k, v] of Object.entries(weightEdits)) {
        if (Number.isFinite(v)) cleanWeights[k] = Number(v);
      }
      if (Object.keys(cleanWeights).length > 0)
        cfg.scoringWeights = cleanWeights;

      await setDoc(
        doc(getDb(), "siteSettings", selectedEventId),
        {
          diagnosisConfig: cfg,
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      );
      setSavedAt(new Date());
      setDirty(false);
    } catch (e) {
      alert("저장 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <header>
        <Link
          href="/admin/settings"
          className="text-[12px] text-ink-500 hover:text-ink-900 flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="w-3 h-3" />
          사이트 설정
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-500" />
              스폰서십 진단 로직
            </h1>
            <p className="text-[13px] text-ink-700 mt-1 max-w-2xl">
              「대화로 추천 받기」 챗봇의 <strong>질문 텍스트와 스코어링 가중치</strong>를
              행사별로 override 합니다. 비워두면 코드 기본값 사용.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-2 rounded-btn border border-ink-100 hover:border-ink-900 text-[12px] font-semibold text-ink-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              전체 기본값
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="px-3.5 py-2 rounded-btn bg-brand-500 text-white text-[12px] font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saving
                ? "저장 중…"
                : dirty
                  ? "저장"
                  : savedAt
                    ? `${savedAt.toLocaleTimeString()} 저장됨`
                    : "변경 없음"}
            </button>
          </div>
        </div>
      </header>

      {/* 질문 단계 편집 */}
      <section className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <header className="px-5 py-3 border-b border-ink-100 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-ink-700" />
          <h2 className="text-[14px] font-bold text-ink-900">
            질문 흐름 — 단계별 텍스트 ({STAGES.length - 1}단계, 칩은 코드 고정)
          </h2>
        </header>
        <ol className="divide-y divide-ink-100">
          {EDITABLE_STAGES.map((stage, i) => {
            const defaults = QUESTIONS[stage];
            const edits = questionEdits[stage] ?? {};
            const isOverride = !!(edits.intro || edits.why);
            return (
              <li key={stage} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-ink-900 text-white grid place-items-center text-[12px] font-bold shrink-0 font-num">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-num text-[10.5px] uppercase tracking-wider font-bold text-ink-500">
                        {stage}
                      </span>
                      {i === 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-brand-500 text-white tracking-wider">
                          LEAD
                        </span>
                      )}
                      {isOverride && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-brand-50 text-brand-700">
                          커스텀
                        </span>
                      )}
                      {isOverride && (
                        <button
                          type="button"
                          onClick={() => resetQuestion(stage)}
                          className="text-[11px] text-ink-500 hover:text-red-700 font-semibold ml-auto"
                        >
                          이 단계 기본값으로
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-ink-700 mb-1 block">
                        질문 (intro)
                      </label>
                      <textarea
                        rows={2}
                        value={edits.intro ?? defaults.intro}
                        onChange={(e) =>
                          updateQuestion(stage, "intro", e.target.value)
                        }
                        className="w-full px-3 py-2 text-[13.5px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-ink-700 mb-1 block">
                        설명 (why) — 사용자에게 &ldquo;왜 묻는지&rdquo; 보조 설명
                      </label>
                      <textarea
                        rows={2}
                        value={edits.why ?? defaults.why ?? ""}
                        onChange={(e) =>
                          updateQuestion(stage, "why", e.target.value)
                        }
                        className="w-full px-3 py-2 text-[12.5px] text-ink-700 border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 resize-none"
                      />
                    </div>
                    {/* 선택지(칩) 편집 — override 가 있으면 우선, 없으면 코드 기본값 노출·편집 시 override 생성 */}
                    <ChipsEditor
                      defaults={defaults.chips ?? []}
                      value={edits.chips}
                      onChange={(next) =>
                        setQuestionEdits((prev) => ({
                          ...prev,
                          [stage]: {
                            ...prev[stage],
                            chips: next,
                          },
                        }))
                      }
                    />
                    {edits.chips && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionEdits((prev) => {
                            const { [stage]: _omitted, ...rest } = prev;
                            void _omitted;
                            const cur = prev[stage] ?? {};
                            const { chips: _c, ...resetChips } = cur;
                            void _c;
                            const next: typeof prev = { ...rest };
                            if (Object.keys(resetChips).length > 0) {
                              next[stage] = resetChips;
                            }
                            setDirty(true);
                            return next;
                          })
                        }
                        className="text-[10.5px] text-ink-500 hover:text-red-700 font-semibold"
                      >
                        선택지 코드 기본값으로 되돌리기
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 가중치 편집 */}
      <section className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <header className="px-5 py-3 border-b border-ink-100 flex items-center gap-2">
          <Scale className="w-4 h-4 text-ink-700" />
          <h2 className="text-[14px] font-bold text-ink-900">
            스코어링 가중치 ({Object.keys(SCORING_WEIGHTS).length}개)
          </h2>
        </header>
        <div className="divide-y divide-ink-100">
          {Object.entries(SCORING_WEIGHTS).map(([key, defaultVal]) => {
            const isOverride = key in weightEdits;
            const effectiveVal = isOverride ? weightEdits[key] : defaultVal;
            return (
              <div
                key={key}
                className="px-5 py-3 grid grid-cols-[1fr_120px_auto] gap-3 items-center"
              >
                <div>
                  <div className="text-[13px] font-mono font-semibold text-ink-900 flex items-center gap-2">
                    {key}
                    {isOverride && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-brand-50 text-brand-700">
                        커스텀
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-0.5">
                    기본값: {defaultVal} · 현재 적용: {effectiveVal}
                  </div>
                </div>
                <input
                  type="number"
                  value={effectiveVal}
                  onChange={(e) =>
                    updateWeight(key, Number(e.target.value))
                  }
                  className="px-2 py-1.5 text-[13px] font-mono border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 text-right"
                />
                {isOverride ? (
                  <button
                    type="button"
                    onClick={() => resetWeight(key)}
                    className="text-[11px] text-ink-500 hover:text-red-700 font-semibold"
                  >
                    기본값
                  </button>
                ) : (
                  <span className="w-10" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="text-[11px] text-ink-500 leading-relaxed">
        💡 칩 선택지(답안)·점수 로직 자체는 코드 (
        <code className="font-mono">components/public/PersonaAiChat.tsx</code>
        ) 에 박혀있습니다. 텍스트·가중치·선택지 (칩) 모두 어드민에서 편집 가능.
      </div>
    </div>
  );
}

// 칩 편집기 — 라벨/값/힌트 인라인 편집, 순서 변경, 추가/제거
function ChipsEditor({
  defaults,
  value,
  onChange,
}: {
  defaults: { label: string; value: string; hint?: string }[];
  value?: DiagnosisChipOverride[];
  onChange: (next: DiagnosisChipOverride[]) => void;
}) {
  // override 가 있으면 그걸 편집, 없으면 defaults 를 기본 시드로
  const isOverride = !!value;
  const chips = value ?? defaults;

  const update = (idx: number, patch: Partial<DiagnosisChipOverride>) => {
    const next = chips.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };
  const remove = (idx: number) => {
    onChange(chips.filter((_, i) => i !== idx));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= chips.length) return;
    const next = [...chips];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const add = () => {
    onChange([
      ...chips,
      { label: "새 선택지", value: `value-${chips.length + 1}`, hint: "" },
    ]);
  };

  return (
    <div className="bg-ink-50/60 border border-ink-100 rounded-btn p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">
          선택지 ({chips.length})
        </span>
        {isOverride ? (
          <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
            커스텀
          </span>
        ) : (
          <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-ink-100 text-ink-500">
            기본값
          </span>
        )}
        <span className="text-[10.5px] text-ink-500 ml-auto">
          value 는 점수 계산에 쓰이는 키 — 신중히 변경
        </span>
      </div>
      <ul className="space-y-1">
        {chips.map((c, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr_120px_1fr_auto] gap-1.5 items-center bg-white border border-ink-100 rounded-btn px-2 py-1"
          >
            <span className="text-[10.5px] font-mono text-ink-500 w-5 text-center">
              {i + 1}
            </span>
            <input
              value={c.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="라벨"
              className="px-2 py-1 text-[12.5px] border border-transparent hover:border-ink-100 focus:border-brand-500 rounded outline-none"
            />
            <input
              value={c.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="value"
              className="px-2 py-1 text-[11.5px] font-mono border border-transparent hover:border-ink-100 focus:border-brand-500 rounded outline-none"
            />
            <input
              value={c.hint ?? ""}
              onChange={(e) => update(i, { hint: e.target.value })}
              placeholder="설명 (선택)"
              className="px-2 py-1 text-[11px] text-ink-500 border border-transparent hover:border-ink-100 focus:border-brand-500 rounded outline-none"
            />
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="w-6 h-6 grid place-items-center rounded hover:bg-ink-50 text-ink-500 disabled:opacity-30"
                title="위로"
              >
                <ArrowUpIcon className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === chips.length - 1}
                className="w-6 h-6 grid place-items-center rounded hover:bg-ink-50 text-ink-500 disabled:opacity-30"
                title="아래로"
              >
                <ArrowDownIcon className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="w-6 h-6 grid place-items-center rounded hover:bg-red-50 text-ink-500 hover:text-red-700"
                title="제거"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-1.5 w-full py-1.5 rounded-btn border-dashed border border-ink-300 hover:border-brand-500 hover:bg-brand-50 text-[11px] text-ink-500 hover:text-brand-700 flex items-center justify-center gap-1"
      >
        <Plus className="w-3 h-3" />
        선택지 추가
      </button>
    </div>
  );
}
