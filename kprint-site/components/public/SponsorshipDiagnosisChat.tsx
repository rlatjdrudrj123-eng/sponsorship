"use client";

/**
 * SponsorshipDiagnosisChat — KPRINT 2026 진단 챗봇 v2 (4문항 룩업).
 *
 * 기존 PersonaAiChat (5문항 가중치) 을 대체. lib/diagnosis2.ts 의 매트릭스 기반.
 * spec: kprint_chatbot_revision_spec.md
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import {
  getRecommendations,
  getResultLayout,
  mergeQuestion,
  type DiagnosisData,
  type RecommendedEntry,
  type ResultLayout,
} from "@/lib/diagnosis2";
import type {
  Category,
  DiagnosisV2Config,
  DiagQ1Value,
  DiagQ2Value,
  DiagQ3Value,
  DiagQ4Value,
  DiagV2QuestionId,
  Package,
  Subcategory,
} from "@/lib/types";
import { X, ChevronLeft, ArrowRight, FileText } from "lucide-react";

type Answers = {
  q1?: DiagQ1Value;
  q2?: DiagQ2Value;
  q3?: DiagQ3Value;
  q4?: DiagQ4Value;
};

type Step = "intro" | "q1" | "q2" | "q3" | "q4" | "result";

const STEP_ORDER: Step[] = ["intro", "q1", "q2", "q3", "q4", "result"];

function nextStep(s: Step): Step {
  const i = STEP_ORDER.indexOf(s);
  return STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)] ?? s;
}
function prevStep(s: Step): Step {
  const i = STEP_ORDER.indexOf(s);
  return STEP_ORDER[Math.max(i - 1, 0)] ?? s;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function SponsorshipDiagnosisChat({
  open,
  onClose,
  eventId,
  eventName,
  categories,
  subcategories,
  packages,
  diagnosisV2Config,
  initialQ1,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  categories: Category[];
  subcategories: Subcategory[];
  packages: Package[];
  diagnosisV2Config?: DiagnosisV2Config;
  /** 메인 페이지의 칩 클릭에서 Q1 답을 가지고 들어올 때 — intro 건너뛰고 Q2 로 직행 */
  initialQ1?: DiagQ1Value;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const sessionIdRef = useRef<string>("");
  const loggedFinalRef = useRef(false);

  // 모달 열릴 때 세션 ID 부여 + initialQ1 적용 / 닫힐 때 초기화
  useEffect(() => {
    if (open) {
      if (!sessionIdRef.current) sessionIdRef.current = randomId();
      if (initialQ1) {
        setAnswers({ q1: initialQ1 });
        setStep("q2");
      } else {
        setStep("intro");
        setAnswers({});
      }
    } else {
      setStep("intro");
      setAnswers({});
      sessionIdRef.current = "";
      loggedFinalRef.current = false;
    }
  }, [open, initialQ1]);

  // Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 카테고리별 최저가 (priceKRW > 0 만 — 별도 문의 0 은 제외)
  const minPriceByCategoryId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const sub of subcategories) {
      const cur = m[sub.categoryId];
      if (sub.priceKRW <= 0) continue;
      if (cur === undefined || sub.priceKRW < cur) {
        m[sub.categoryId] = sub.priceKRW;
      }
    }
    // 가격 0 (별도 문의) 카테고리도 키 채워두기 — minPrice 0 으로
    for (const cat of categories) {
      if (m[cat.id] === undefined) m[cat.id] = 0;
    }
    return m;
  }, [categories, subcategories]);

  const data: DiagnosisData = useMemo(
    () => ({ categories, packages, minPriceByCategoryId }),
    [categories, packages, minPriceByCategoryId]
  );

  // 추천 결과 (결과 단계에서만 계산)
  const recommendations: RecommendedEntry[] = useMemo(() => {
    if (step !== "result") return [];
    if (!answers.q1 || !answers.q2 || !answers.q3) return [];
    return getRecommendations({
      q1: answers.q1,
      q2: answers.q2,
      q3: answers.q3,
      data,
      matrix: diagnosisV2Config?.matrix,
      reasons: diagnosisV2Config?.reasons,
    });
  }, [step, answers, data, diagnosisV2Config]);

  const layout: ResultLayout = answers.q4
    ? getResultLayout(answers.q4)
    : "cards";

  // 결과 단계 도달 시 로그 1회 기록
  useEffect(() => {
    if (
      step === "result" &&
      !loggedFinalRef.current &&
      answers.q1 &&
      answers.q2 &&
      answers.q3 &&
      answers.q4
    ) {
      loggedFinalRef.current = true;
      writeLog({
        eventId,
        sessionId: sessionIdRef.current,
        q1: answers.q1,
        q2: answers.q2,
        q3: answers.q3,
        q4: answers.q4,
        recommendedSelectorIds: recommendations.map((r) => r.selectorId),
        completed: true,
      }).catch(() => {});
    }
  }, [step, answers, recommendations, eventId]);

  // 닫기 시 미완료면 이탈 로그
  const onCloseWithLog = () => {
    if (step !== "result" && step !== "intro" && !loggedFinalRef.current) {
      const exitedAt: "q1" | "q2" | "q3" | "q4" = step;
      writeLog({
        eventId,
        sessionId: sessionIdRef.current,
        q1: answers.q1,
        q2: answers.q2,
        q3: answers.q3,
        q4: answers.q4,
        recommendedSelectorIds: [],
        completed: false,
        exitedAt,
      }).catch(() => {});
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-card shadow-card overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <header className="px-5 md:px-7 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <div>
            <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold">
              Sponsorship Advisor
            </div>
            <h2 className="text-[15px] font-bold text-ink-900 mt-0.5">
              {eventName} — 맞춤 진단
            </h2>
          </div>
          <button
            type="button"
            onClick={onCloseWithLog}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-ink-50 text-ink-500"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-7 py-6">
          {step === "intro" && (
            <IntroScreen onStart={() => setStep("q1")} />
          )}

          {step !== "intro" && step !== "result" && (
            <QuestionScreen
              step={step}
              answers={answers}
              config={diagnosisV2Config}
              onAnswer={(value) => {
                setAnswers((prev) => ({ ...prev, [step]: value }));
                setStep(nextStep(step));
              }}
              onBack={() => setStep(prevStep(step))}
            />
          )}

          {step === "result" && (
            <ResultScreen
              eventId={eventId}
              layout={layout}
              recommendations={recommendations}
              answers={answers}
              onRestart={() => {
                setAnswers({});
                setStep("intro");
                sessionIdRef.current = randomId();
                loggedFinalRef.current = false;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Intro ────────────────────────────────────────────────

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-6 md:py-10">
      <h3 className="text-[22px] md:text-[28px] font-bold text-ink-900 leading-tight">
        K-PRINT 2026
      </h3>
      <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">
        KINTEX 제2전시장 7·8홀 · 8월 19일(수) — 22일(토)
      </p>
      <div className="mt-8 max-w-md mx-auto">
        <p className="text-[15px] md:text-[16px] text-ink-900 leading-[1.65]">
          귀사 참가 목표에 맞는 스폰서십을
          <br />
          <strong className="text-brand-500">4가지 질문</strong>으로
          정리해 드립니다.
        </p>
        <p className="text-[12px] text-ink-500 mt-3">
          소요 시간 약 1분
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-pill bg-brand-500 hover:bg-brand-700 text-white text-[14px] font-bold transition-colors"
      >
        추천 받기 시작
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Question (Q1-Q4) ─────────────────────────────────────

function QuestionScreen({
  step,
  answers,
  config,
  onAnswer,
  onBack,
}: {
  step: Exclude<Step, "intro" | "result">;
  answers: Answers;
  config?: DiagnosisV2Config;
  onAnswer: (value: string) => void;
  onBack: () => void;
}) {
  const qid = step as DiagV2QuestionId;
  const q = useMemo(
    () => mergeQuestion(qid, config?.questions?.[qid]),
    [qid, config]
  );

  const currentValue = answers[qid];
  const qIndex = STEP_ORDER.indexOf(step) - 1; // q1=1, q2=2, q3=3, q4=4 - intro offset
  const stepLabel = `${qIndex} / 4`;

  return (
    <div>
      {/* 진행 표시 */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onBack}
          className="text-[12.5px] text-ink-500 hover:text-ink-900 flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          이전
        </button>
        <div className="font-num text-[11px] text-ink-500 font-bold tracking-wider">
          {stepLabel}
        </div>
      </div>

      <h3 className="text-[18px] md:text-[20px] font-bold text-ink-900 leading-snug">
        {q.intro}
      </h3>
      {q.hint && (
        <p className="text-[12.5px] text-ink-500 mt-2 leading-relaxed">
          {q.hint}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {q.chips.map((chip) => {
          const selected = currentValue === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onAnswer(chip.value)}
              className={
                "w-full px-5 py-3.5 rounded-btn border text-left text-[14px] font-semibold transition-all " +
                (selected
                  ? "bg-brand-50 border-brand-500 text-brand-700"
                  : "bg-white border-ink-100 text-ink-900 hover:border-ink-700 hover:bg-ink-50")
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result ───────────────────────────────────────────────

function ResultScreen({
  eventId,
  layout,
  recommendations,
  answers,
  onRestart,
}: {
  eventId: string;
  layout: ResultLayout;
  recommendations: RecommendedEntry[];
  answers: Answers;
  onRestart: () => void;
}) {
  const isDecision = answers.q4 === "decision";

  const intro =
    answers.q4 === "early"
      ? "처음 알아보시는 단계네요. 부담 없이 시작해볼 수 있는 상품 위주로 정리했습니다."
      : answers.q4 === "compare"
        ? "후보를 좁히고 계시네요. 비교해서 결정하세요."
        : "결정 단계시군요. 바로 진행하실 수 있도록 안내드립니다.";

  return (
    <div>
      <h3 className="text-[18px] md:text-[20px] font-bold text-ink-900">
        추천 결과
      </h3>
      <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">{intro}</p>

      {recommendations.length === 0 ? (
        <div className="mt-6 px-4 py-6 bg-ink-50 rounded-btn text-center text-[13px] text-ink-500">
          입력하신 예산 범위에 맞는 추천이 없습니다. 예산을 한 단계 올려보거나
          사무국에 직접 문의해 주세요.
        </div>
      ) : layout === "comparison" ? (
        <ComparisonTable
          eventId={eventId}
          recommendations={recommendations}
        />
      ) : (
        <Cards
          eventId={eventId}
          recommendations={recommendations}
          ctaStrong={isDecision}
        />
      )}

      {/* 하단 액션 */}
      <div className="mt-8 pt-5 border-t border-ink-100 flex flex-wrap items-center gap-3 justify-between">
        <button
          type="button"
          onClick={onRestart}
          className="text-[12.5px] text-ink-500 hover:text-ink-900 font-semibold"
        >
          다시 진단하기
        </button>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${eventId}/contact`}
            className={
              "px-4 py-2 rounded-btn text-[13px] font-bold flex items-center gap-1.5 " +
              (isDecision
                ? "bg-brand-500 hover:bg-brand-700 text-white"
                : "border border-ink-100 hover:bg-ink-50 text-ink-900")
            }
          >
            <FileText className="w-3.5 h-3.5" />
            {isDecision ? "지금 문의하기" : "사무국 연결"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Cards({
  eventId,
  recommendations,
  ctaStrong,
}: {
  eventId: string;
  recommendations: RecommendedEntry[];
  ctaStrong: boolean;
}) {
  return (
    <div className="mt-5 space-y-3">
      {recommendations.map((r) => (
        <RecommendationCard
          key={r.selectorId}
          eventId={eventId}
          entry={r}
          ctaStrong={ctaStrong}
        />
      ))}
    </div>
  );
}

function RecommendationCard({
  eventId,
  entry,
  ctaStrong,
}: {
  eventId: string;
  entry: RecommendedEntry;
  ctaStrong: boolean;
}) {
  const detailHref =
    entry.kind === "category" && entry.category
      ? `/${eventId}/sponsorships/${entry.category.slug}`
      : entry.kind === "package" && entry.package
        ? `/${eventId}/packages/${entry.package.id}`
        : `/${eventId}/sponsorships`;

  return (
    <article className="border border-ink-100 rounded-card p-5 hover:border-ink-700 transition-colors">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="text-[15px] font-bold text-ink-900 leading-tight">
            {entry.nameKo}
          </h4>
          <div className="font-num text-[10.5px] uppercase tracking-wider text-ink-500 mt-1">
            {entry.kind === "package" ? "Package" : "Single"}
          </div>
        </div>
        <div className="font-num text-[15px] font-bold text-ink-900 shrink-0">
          {entry.priceLabel}
        </div>
      </header>

      <p className="text-[12.5px] text-ink-700 leading-relaxed mt-3 pl-3 border-l-2 border-brand-500">
        {entry.reason}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={detailHref}
          className="px-3.5 py-1.5 rounded-btn border border-ink-100 hover:bg-ink-50 text-[12px] font-bold text-ink-900"
        >
          상세 보기
        </Link>
        <Link
          href={`/${eventId}/contact`}
          className={
            "px-3.5 py-1.5 rounded-btn text-[12px] font-bold " +
            (ctaStrong
              ? "bg-brand-500 hover:bg-brand-700 text-white"
              : "border border-ink-100 hover:bg-ink-50 text-ink-900")
          }
        >
          문의하기
        </Link>
      </div>
    </article>
  );
}

function ComparisonTable({
  eventId,
  recommendations,
}: {
  eventId: string;
  recommendations: RecommendedEntry[];
}) {
  return (
    <div className="mt-5">
      <div className="overflow-x-auto border border-ink-100 rounded-card">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ink-50">
            <tr>
              <th className="text-left px-3 py-2 font-bold text-ink-700">
                상품
              </th>
              <th className="text-right px-3 py-2 font-bold text-ink-700 w-28">
                가격
              </th>
              <th className="text-left px-3 py-2 font-bold text-ink-700 w-20">
                구분
              </th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {recommendations.map((r) => {
              const detailHref =
                r.kind === "category" && r.category
                  ? `/${eventId}/sponsorships/${r.category.slug}`
                  : r.kind === "package" && r.package
                    ? `/${eventId}/packages/${r.package.id}`
                    : `/${eventId}/sponsorships`;
              return (
                <tr
                  key={r.selectorId}
                  className="border-t border-ink-100 hover:bg-ink-50/50"
                >
                  <td className="px-3 py-3">
                    <div className="font-bold text-ink-900 leading-tight">
                      {r.nameKo}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-1 leading-snug">
                      {r.reason}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-num font-bold text-ink-900">
                    {r.priceLabel}
                  </td>
                  <td className="px-3 py-3 text-ink-500 text-[11.5px]">
                    {r.kind === "package" ? "패키지" : "단품"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={detailHref}
                      className="text-[11.5px] font-bold text-brand-500 hover:text-brand-700"
                    >
                      상세 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 로그 기록 ───────────────────────────────────────────

async function writeLog(args: {
  eventId: string;
  sessionId: string;
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
  recommendedSelectorIds: string[];
  completed: boolean;
  exitedAt?: "q1" | "q2" | "q3" | "q4" | "result";
}) {
  try {
    await addDoc(collection(getDb(), "diagnostic_logs"), {
      eventId: args.eventId,
      sessionId: args.sessionId,
      ...(args.q1 ? { q1: args.q1 } : {}),
      ...(args.q2 ? { q2: args.q2 } : {}),
      ...(args.q3 ? { q3: args.q3 } : {}),
      ...(args.q4 ? { q4: args.q4 } : {}),
      recommendedSelectorIds: args.recommendedSelectorIds,
      completed: args.completed,
      ...(args.exitedAt ? { exitedAt: args.exitedAt } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // 로그 실패는 사용자 영향 없음 — 콘솔만
    console.warn("diagnostic_logs write failed", e);
  }
}
