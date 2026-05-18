"use client";

/**
 * 진단 챗봇 v2 어드민 — 4문항 룩업 매트릭스 기반.
 *
 * 저장 위치: siteSettings/{eventId}.diagnosisV2Config
 *
 * 편집 가능 항목:
 *  - 질문 텍스트 (Q1-Q4 intro / hint / 칩 라벨)
 *  - 추천 매트릭스 (Q1 × Q2 = 12 셀, selectorId 배열)
 *  - 추천 이유 (Q1 × ReasonCategoryKey = 16개 매핑 텍스트)
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  Grid3X3,
  MessageCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import {
  DEFAULT_DIAG_V2_QUESTIONS,
  DEFAULT_RECOMMENDATION_MATRIX,
  DEFAULT_REASON_TEMPLATES,
} from "@/lib/diagnosis2";
import type {
  Category,
  DiagnosisV2Config,
  DiagQ1Value,
  DiagQ2Value,
  DiagV2QuestionId,
  Package,
  ReasonCategoryKey,
  ReasonTemplates,
  RecommendationMatrix,
  SiteSettings,
} from "@/lib/types";

const Q1_VALUES: DiagQ1Value[] = [
  "launch",
  "acquisition",
  "retention",
  "awareness",
];
const Q1_LABELS: Record<DiagQ1Value, string> = {
  launch: "신제품·신기술 런칭",
  acquisition: "신규 거래선·대리점 발굴",
  retention: "기존 고객·파트너 강화",
  awareness: "브랜드 인지도·점유율",
};

const Q2_VALUES: DiagQ2Value[] = ["small", "medium", "large"];
const Q2_LABELS: Record<DiagQ2Value, string> = {
  small: "소형 (1~2부스)",
  medium: "중형 (3~6부스)",
  large: "대형 (7+)",
};

const REASON_KEYS: ReasonCategoryKey[] = [
  "seminar",
  "content",
  "signature",
  "search",
  "floor_map",
  "package",
  "invitation",
  "newsletter",
  "ceiling",
  "lanyard",
  "other",
];
const REASON_LABELS: Record<ReasonCategoryKey, string> = {
  seminar: "세미나",
  content: "콘텐츠 (인터뷰/SNS)",
  signature: "시그니처 패키지",
  search: "검색 배너",
  floor_map: "도면",
  package: "일반 패키지",
  invitation: "초대장",
  newsletter: "뉴스레터",
  ceiling: "천장배너",
  lanyard: "목걸이",
  other: "기타 (폴백)",
};

const QUESTION_IDS: DiagV2QuestionId[] = ["q1", "q2", "q3", "q4"];

type QEdits = NonNullable<DiagnosisV2Config["questions"]>;

export default function DiagnosisAdminPage() {
  const selectedEventId = useAdminEvent((s) => s.selectedEventId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [matrix, setMatrix] = useState<RecommendationMatrix>({});
  const [reasons, setReasons] = useState<ReasonTemplates>({});
  const [questions, setQuestions] = useState<QEdits>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!selectedEventId) return;
    const db = getDb();
    const u1 = onSnapshot(
      doc(db, "siteSettings", selectedEventId),
      (s) => {
        if (!s.exists()) return;
        const data = s.data() as SiteSettings;
        const cfg = data.diagnosisV2Config;
        if (!dirty) {
          setMatrix(cfg?.matrix ?? {});
          setReasons(cfg?.reasons ?? {});
          setQuestions(cfg?.questions ?? {});
        }
      }
    );
    const u2 = onSnapshot(
      query(collection(db, "categories"), where("eventId", "==", selectedEventId)),
      (s) =>
        setCategories(
          s.docs.map((d) => ({ ...(d.data() as Category), id: d.id }))
        )
    );
    const u3 = onSnapshot(
      query(collection(db, "packages"), where("eventId", "==", selectedEventId)),
      (s) =>
        setPackages(
          s.docs.map((d) => ({ ...(d.data() as Package), id: d.id }))
        )
    );
    return () => {
      u1();
      u2();
      u3();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  // 사용 가능한 selectorId 사전 (카테고리 + 패키지)
  const availableSelectors = useMemo(() => {
    const map = new Map<string, { name: string; kind: "category" | "package" }>();
    categories.forEach((c) => {
      if (c.selectorId) map.set(c.selectorId, { name: c.name.ko, kind: "category" });
    });
    packages.forEach((p) => {
      if (p.selectorId) map.set(p.selectorId, { name: p.name.ko, kind: "package" });
    });
    return map;
  }, [categories, packages]);

  if (!selectedEventId) {
    return (
      <div className="p-8 text-sm text-ink-500">
        먼저 상단의 행사를 선택하세요.
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(getDb(), "siteSettings", selectedEventId),
        {
          diagnosisV2Config: {
            matrix,
            reasons,
            questions,
            enabled: true,
          },
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      );
      setDirty(false);
      setSavedAt(new Date());
    } catch (e) {
      console.error("diagnosisV2 save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    if (!confirm("모든 진단 설정을 시스템 기본값으로 되돌릴까요?")) return;
    setMatrix({});
    setReasons({});
    setQuestions({});
    setDirty(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin/settings"
          className="text-[12px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          설정으로 돌아가기
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-ink-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-500" />
              진단 챗봇 관리 (v2)
            </h1>
            <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">
              4문항 룩업 매트릭스 기반. 비어있는 셀은 시스템 기본값이 사용됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-ink-500">
              {saving
                ? "저장 중…"
                : savedAt
                  ? `${savedAt.toLocaleTimeString()} 저장됨`
                  : dirty
                    ? "변경 사항 있음"
                    : ""}
            </span>
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-2 rounded-btn border border-ink-100 text-[12px] text-ink-700 hover:bg-ink-50 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              전체 기본값
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-btn bg-brand-500 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12.5px] font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              저장
            </button>
          </div>
        </div>
      </header>

      {/* ─── 섹션 1. 질문 텍스트 ─────────────────────────────── */}
      <section className="bg-white border border-ink-100 rounded-card p-5 md:p-6 mb-6">
        <h2 className="text-[16px] font-bold text-ink-900 flex items-center gap-2 mb-1">
          <MessageCircle className="w-4 h-4 text-brand-500" />
          질문 텍스트
        </h2>
        <p className="text-[12px] text-ink-500 mb-5">
          비워두면 기본 텍스트가 사용됩니다. value 값(launch / small 등)은 변경할 수 없습니다.
        </p>

        <div className="space-y-5">
          {QUESTION_IDS.map((qid) => {
            const base = DEFAULT_DIAG_V2_QUESTIONS[qid];
            const ov = questions[qid] ?? {};
            return (
              <div key={qid} className="border border-ink-100 rounded-btn p-4">
                <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-2">
                  {qid.toUpperCase()}
                </div>
                <input
                  type="text"
                  value={ov.intro ?? base.intro}
                  placeholder={base.intro}
                  onChange={(e) => {
                    setQuestions({
                      ...questions,
                      [qid]: { ...ov, intro: e.target.value },
                    });
                    setDirty(true);
                  }}
                  className="w-full px-3 py-2 text-[13.5px] font-bold border border-ink-100 rounded outline-none focus:border-brand-500 mb-2"
                />
                <input
                  type="text"
                  value={ov.hint ?? base.hint ?? ""}
                  placeholder={base.hint ?? "보조 설명"}
                  onChange={(e) => {
                    setQuestions({
                      ...questions,
                      [qid]: { ...ov, hint: e.target.value },
                    });
                    setDirty(true);
                  }}
                  className="w-full px-3 py-2 text-[12px] text-ink-700 border border-ink-100 rounded outline-none focus:border-brand-500"
                />

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {base.chips.map((chip) => {
                    const curLabel = ov.chipLabels?.[chip.value] ?? chip.label;
                    return (
                      <div
                        key={chip.value}
                        className="flex items-center gap-2 bg-ink-50 rounded px-2 py-1.5"
                      >
                        <span className="font-mono text-[10.5px] text-ink-500 shrink-0 w-20">
                          {chip.value}
                        </span>
                        <input
                          type="text"
                          value={curLabel}
                          onChange={(e) => {
                            setQuestions({
                              ...questions,
                              [qid]: {
                                ...ov,
                                chipLabels: {
                                  ...(ov.chipLabels ?? {}),
                                  [chip.value]: e.target.value,
                                },
                              },
                            });
                            setDirty(true);
                          }}
                          className="flex-1 min-w-0 px-2 py-1 text-[12px] bg-white border border-ink-100 rounded outline-none focus:border-brand-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 섹션 2. 추천 매트릭스 ───────────────────────────── */}
      <section className="bg-white border border-ink-100 rounded-card p-5 md:p-6 mb-6">
        <h2 className="text-[16px] font-bold text-ink-900 flex items-center gap-2 mb-1">
          <Grid3X3 className="w-4 h-4 text-brand-500" />
          추천 매트릭스 (Q1 × Q2)
        </h2>
        <p className="text-[12px] text-ink-500 mb-4">
          각 셀에 selectorId 를 쉼표 구분으로 입력. 비우면 기본값 사용. 사용 가능한 ID 는 아래 참조표.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 font-bold text-ink-700 border border-ink-100 bg-ink-50 w-32">
                  목적 \ 규모
                </th>
                {Q2_VALUES.map((q2) => (
                  <th
                    key={q2}
                    className="text-left p-2 font-bold text-ink-700 border border-ink-100 bg-ink-50"
                  >
                    {Q2_LABELS[q2]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Q1_VALUES.map((q1) => (
                <tr key={q1}>
                  <td className="p-2 font-bold text-ink-900 border border-ink-100 bg-ink-50 align-top">
                    <div>{Q1_LABELS[q1]}</div>
                    <div className="font-mono text-[10px] text-ink-500 mt-0.5">
                      {q1}
                    </div>
                  </td>
                  {Q2_VALUES.map((q2) => {
                    const cur = matrix[q1]?.[q2];
                    const base =
                      DEFAULT_RECOMMENDATION_MATRIX[q1]?.[q2] ?? [];
                    const value = cur && cur.length > 0 ? cur.join(", ") : "";
                    const placeholder = base.join(", ");
                    const ids =
                      cur && cur.length > 0 ? cur : base;
                    return (
                      <td
                        key={q2}
                        className="p-2 border border-ink-100 align-top min-w-[200px]"
                      >
                        <textarea
                          value={value}
                          placeholder={placeholder}
                          rows={3}
                          onChange={(e) => {
                            const ids = e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            setMatrix({
                              ...matrix,
                              [q1]: {
                                ...(matrix[q1] ?? {}),
                                [q2]: ids,
                              },
                            });
                            setDirty(true);
                          }}
                          className="w-full px-2 py-1.5 text-[11.5px] font-mono border border-ink-100 rounded outline-none focus:border-brand-500 resize-none"
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {ids.map((id) => {
                            const info = availableSelectors.get(id);
                            return (
                              <span
                                key={id}
                                className={
                                  "inline-block px-1.5 py-0.5 rounded font-mono text-[9.5px] " +
                                  (info
                                    ? "bg-brand-50 text-brand-700"
                                    : "bg-red-50 text-red-700")
                                }
                                title={info?.name ?? "❌ 매핑 안 됨"}
                              >
                                {id}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 참조표 — 사용 가능한 selectorId */}
        <details className="mt-5">
          <summary className="text-[12px] font-bold text-ink-700 cursor-pointer hover:text-brand-700">
            사용 가능한 selectorId 참조표 ({availableSelectors.size}개)
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {Array.from(availableSelectors.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([id, info]) => (
                <div
                  key={id}
                  className="flex items-center justify-between px-2 py-1.5 bg-ink-50 rounded text-[11px]"
                >
                  <span className="font-mono text-brand-700 font-bold">
                    {id}
                  </span>
                  <span className="text-ink-700 truncate ml-2 text-right">
                    {info.name}
                    <span className="text-ink-400 ml-1">
                      ({info.kind === "package" ? "패키지" : "단품"})
                    </span>
                  </span>
                </div>
              ))}
          </div>
        </details>
      </section>

      {/* ─── 섹션 3. 추천 이유 ──────────────────────────────── */}
      <section className="bg-white border border-ink-100 rounded-card p-5 md:p-6">
        <h2 className="text-[16px] font-bold text-ink-900 flex items-center gap-2 mb-1">
          <MessageCircle className="w-4 h-4 text-brand-500" />
          추천 이유 문구
        </h2>
        <p className="text-[12px] text-ink-500 mb-4">
          추천 카드의 “왜 추천했는지” 1줄. Q1 × 카테고리 키. 비우면 기본값.
          상품이 어느 키에 속하는지는{" "}
          <code className="font-mono bg-ink-50 px-1 rounded">lib/diagnosis2.ts</code>{" "}
          의 SELECTOR_TO_REASON_KEY 참고.
        </p>

        <div className="space-y-4">
          {Q1_VALUES.map((q1) => (
            <div key={q1} className="border border-ink-100 rounded-btn p-4">
              <div className="text-[12.5px] font-bold text-ink-900 mb-2">
                {Q1_LABELS[q1]}{" "}
                <span className="font-mono text-[10px] text-ink-500">
                  ({q1})
                </span>
              </div>
              <div className="space-y-1.5">
                {REASON_KEYS.map((key) => {
                  const ov = reasons[q1]?.[key];
                  const base = DEFAULT_REASON_TEMPLATES[q1]?.[key] ?? "";
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[140px_1fr] gap-2 items-start"
                    >
                      <div className="text-[11.5px] text-ink-700 font-semibold pt-1.5">
                        {REASON_LABELS[key]}
                      </div>
                      <input
                        type="text"
                        value={ov ?? base}
                        placeholder={base || "추천 매체"}
                        onChange={(e) => {
                          setReasons({
                            ...reasons,
                            [q1]: {
                              ...(reasons[q1] ?? {}),
                              [key]: e.target.value,
                            },
                          });
                          setDirty(true);
                        }}
                        className="w-full px-2.5 py-1.5 text-[12px] border border-ink-100 rounded outline-none focus:border-brand-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
