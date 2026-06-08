"use client";

/**
 * 1분 진단 v3 — 점수 기반 + 시각적 좁히기.
 *
 *   3문항: 목표(1·2순위) → 예산(슬라이더) → 꼭 잡고 싶은 것(다중)
 *   결과: 답변 영수증 + 단품 추천 3개(답 인용 reason) + 패키지 업그레이드 경로
 *   라이브 후보 카운터로 답이 결과를 어떻게 좁히는지 가시화.
 *
 * lib/diagnosis3.ts 의 recommend() / findUpgradeOffers() 가 점수·시너지·폴백 처리.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  FileText,
  Package2,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import {
  findUpgradeOffers,
  MUST_HAVE_LABEL_EN,
  MUST_HAVE_LABEL_KO,
  PURPOSE_LABEL_EN,
  PURPOSE_LABEL_KO,
  PURPOSES,
  recommend,
  type DiagAnswers,
  type MustHaveTag,
  type RecEntry,
  type UpgradeOffer,
} from "@/lib/diagnosis3";
import type {
  Category,
  Package,
  Purpose,
  Subcategory,
} from "@/lib/types";
import { useLocale, localeHref } from "@/lib/i18n/locale";

type Step = "intro" | "q1" | "q2" | "q3" | "result";

const STEP_ORDER: Step[] = ["intro", "q1", "q2", "q3", "result"];

const MUST_HAVE_OPTIONS: MustHaveTag[] = [
  "online_channel",
  "post_event_asset",
  "overseas",
  "signature_combo",
];

const BUDGET_MIN = 1_000_000;
const BUDGET_MAX = 20_000_000;
const BUDGET_STEPS = [
  1_000_000, 2_000_000, 3_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000,
];

export function SponsorshipDiagnosisChat({
  open,
  onClose,
  eventId,
  categories,
  subcategories,
  packages,
  initialPrimaryGoal,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName?: string;
  categories: Category[];
  subcategories: Subcategory[];
  packages: Package[];
  /** 외부에서 Q1 1순위 답을 미리 채워 진단을 바로 Q2 부터 시작. */
  initialPrimaryGoal?: Purpose | null;
}) {
  const locale = useLocale((s) => s.locale);
  const isEn = locale === "en";

  const [step, setStep] = useState<Step>("intro");
  const [primaryGoal, setPrimaryGoal] = useState<Purpose | null>(null);
  const [secondaryGoal, setSecondaryGoal] = useState<Purpose | null>(null);
  const [budgetKRW, setBudgetKRW] = useState<number>(5_000_000);
  const [mustHave, setMustHave] = useState<MustHaveTag[]>([]);

  const sessionIdRef = useRef<string>("");
  const loggedFinalRef = useRef(false);

  // 세션 초기화 — initialPrimaryGoal 있으면 Q2 부터.
  useEffect(() => {
    if (open) {
      if (!sessionIdRef.current) sessionIdRef.current = randomId();
      if (initialPrimaryGoal) {
        setPrimaryGoal(initialPrimaryGoal);
        setSecondaryGoal(null);
        setBudgetKRW(5_000_000);
        setMustHave([]);
        setStep("q2");
      } else {
        setStep("intro");
        setPrimaryGoal(null);
        setSecondaryGoal(null);
        setBudgetKRW(5_000_000);
        setMustHave([]);
      }
      loggedFinalRef.current = false;
    }
  }, [open, initialPrimaryGoal]);

  // Esc 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 라이브 카운터 — 매 답마다 좁아지는 후보 풀 표시.
  // primaryGoal 만 있어도 GoalFit 통과 후보 카운트는 가능.
  const liveFunnel = useMemo(() => {
    if (!primaryGoal) {
      return {
        initial: countDiagnosable(categories),
        afterGoal: countDiagnosable(categories),
        afterBudget: countDiagnosable(categories),
        afterMustHave: countDiagnosable(categories),
      };
    }
    const dummy: DiagAnswers = {
      goals: {
        primary: primaryGoal,
        secondary: secondaryGoal ?? undefined,
      },
      budgetKRW: step === "q1" ? 0 : budgetKRW,
      mustHave: step === "q3" || step === "result" ? mustHave : [],
    };
    const r = recommend({ candidates: categories, subcategories, answers: dummy });
    return r.funnelCounts;
  }, [
    categories,
    subcategories,
    primaryGoal,
    secondaryGoal,
    budgetKRW,
    mustHave,
    step,
  ]);

  // 진짜 추천 결과 (result 화면에서만 계산)
  const result = useMemo(() => {
    if (step !== "result" || !primaryGoal) return null;
    const answers: DiagAnswers = {
      goals: { primary: primaryGoal, secondary: secondaryGoal ?? undefined },
      budgetKRW,
      mustHave,
    };
    return recommend({ candidates: categories, subcategories, answers });
  }, [
    step,
    categories,
    subcategories,
    primaryGoal,
    secondaryGoal,
    budgetKRW,
    mustHave,
  ]);

  // 업그레이드 경로
  const upgradeOffer: UpgradeOffer | null = useMemo(() => {
    if (!result || result.picks.length < 2) return null;
    const offers = findUpgradeOffers({
      picks: result.picks,
      packages,
      categories,
      subcategories,
      budgetKRW,
    });
    return offers[0] ?? null;
  }, [result, packages, categories, subcategories, budgetKRW]);

  // 결과 로그 기록 (1회만)
  useEffect(() => {
    if (
      step === "result" &&
      !loggedFinalRef.current &&
      primaryGoal &&
      result
    ) {
      loggedFinalRef.current = true;
      writeLog({
        eventId,
        sessionId: sessionIdRef.current,
        completed: true,
        primaryGoal,
        secondaryGoal,
        budgetKRW,
        mustHave,
        recommendedCategoryIds: result.picks.map((p) => p.category.id),
      }).catch(() => {});
    }
  }, [step, primaryGoal, secondaryGoal, budgetKRW, mustHave, result, eventId]);

  // 닫기 (미완료면 이탈 로그)
  const onCloseWithLog = () => {
    if (step !== "result" && step !== "intro" && !loggedFinalRef.current) {
      writeLog({
        eventId,
        sessionId: sessionIdRef.current,
        completed: false,
        exitedAt: step,
        primaryGoal,
        secondaryGoal,
        budgetKRW,
        mustHave,
        recommendedCategoryIds: [],
      }).catch(() => {});
    }
    onClose();
  };

  const goNext = () => {
    const i = STEP_ORDER.indexOf(step);
    setStep(STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)]);
  };
  const goBack = () => {
    const i = STEP_ORDER.indexOf(step);
    setStep(STEP_ORDER[Math.max(i - 1, 0)]);
  };

  if (!open) return null;

  const progressIdx = STEP_ORDER.indexOf(step); // 0 (intro) ~ 4 (result)
  const showProgress = step !== "intro" && step !== "result";

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCloseWithLog}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] sm:rounded-card shadow-2xl flex flex-col overflow-hidden"
      >
        {/* 헤더 */}
        <header className="px-5 py-3 border-b border-ink-100 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {step !== "intro" && (
              <button
                type="button"
                onClick={goBack}
                className="w-8 h-8 grid place-items-center rounded-btn hover:bg-ink-50 text-ink-500 shrink-0"
                aria-label="back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-brand-700 font-bold font-num">
                {isEn ? "1-min match" : "1분 진단"}
              </div>
              <div className="text-[13px] font-bold text-ink-900 truncate">
                {step === "intro"
                  ? isEn
                    ? "Find what fits you"
                    : "당신에게 맞는 매체 찾기"
                  : step === "result"
                  ? isEn
                    ? "Your match"
                    : "당신의 매칭"
                  : isEn
                  ? `Question ${progressIdx} of 3`
                  : `질문 ${progressIdx} / 3`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseWithLog}
            className="w-8 h-8 grid place-items-center rounded-btn hover:bg-ink-50 text-ink-500 shrink-0"
            aria-label="close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* 진행률 + 라이브 카운터 */}
        {showProgress && (
          <div className="px-5 py-2 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={
                    "h-1 rounded-full transition-all " +
                    (n < progressIdx
                      ? "bg-brand-500 w-6"
                      : n === progressIdx
                      ? "bg-brand-500 w-10"
                      : "bg-ink-200 w-6")
                  }
                />
              ))}
            </div>
            <LiveCounter
              funnel={liveFunnel}
              step={step}
              isEn={isEn}
            />
          </div>
        )}

        {/* 본문 */}
        <div className="px-5 py-5 overflow-y-auto flex-1">
          {step === "intro" && (
            <IntroPanel
              isEn={isEn}
              onStart={() => setStep("q1")}
              categoryCount={countDiagnosable(categories)}
            />
          )}

          {step === "q1" && (
            <GoalsPanel
              isEn={isEn}
              primary={primaryGoal}
              secondary={secondaryGoal}
              onPickPrimary={setPrimaryGoal}
              onPickSecondary={setSecondaryGoal}
            />
          )}

          {step === "q2" && (
            <BudgetPanel
              isEn={isEn}
              value={budgetKRW}
              onChange={setBudgetKRW}
            />
          )}

          {step === "q3" && (
            <MustHavePanel
              isEn={isEn}
              selected={mustHave}
              onToggle={(t) =>
                setMustHave((prev) =>
                  prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                )
              }
            />
          )}

          {step === "result" && result && primaryGoal && (
            <ResultPanel
              isEn={isEn}
              eventId={eventId}
              result={result}
              upgrade={upgradeOffer}
              answers={{
                primaryGoal,
                secondaryGoal,
                budgetKRW,
                mustHave,
              }}
              onEditGoals={() => setStep("q1")}
              onEditBudget={() => setStep("q2")}
              onEditMustHave={() => setStep("q3")}
              onClose={onCloseWithLog}
            />
          )}
        </div>

        {/* 푸터 (질문 단계에서만 — 결과는 자체 CTA) */}
        {step !== "intro" && step !== "result" && (
          <footer className="px-5 py-3 border-t border-ink-100 shrink-0 flex items-center justify-end">
            <button
              type="button"
              onClick={goNext}
              disabled={step === "q1" && !primaryGoal}
              className={
                "px-5 py-2.5 rounded-pill text-[13px] font-bold flex items-center gap-1.5 transition-all " +
                (step === "q1" && !primaryGoal
                  ? "bg-ink-100 text-ink-400 cursor-not-allowed"
                  : "bg-brand-500 text-white hover:bg-brand-700 hover:shadow-glow-sm")
              }
            >
              {step === "q3" ? (isEn ? "See match" : "결과 보기") : isEn ? "Next" : "다음"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 패널들
// ============================================================================

function IntroPanel({
  isEn,
  onStart,
  categoryCount,
}: {
  isEn: boolean;
  onStart: () => void;
  categoryCount: number;
}) {
  const bullets = isEn
    ? [
        `매체 ${categoryCount}종 → 매칭 점수 상위 3종 자동 산출`,
        "답변별 후보 풀 즉시 표시",
        "패키지 전환 시 절감액 동시 안내",
      ]
    : [
        `매체 ${categoryCount}종 → 매칭 점수 상위 3종 자동 산출`,
        "답변별 후보 풀 즉시 표시",
        "패키지 전환 시 절감액 동시 안내",
      ];
  const enBullets = [
    `${categoryCount} media → top 3 by match score`,
    "Live candidate count per answer",
    "Package savings calculated alongside",
  ];
  const items = isEn ? enBullets : bullets;

  return (
    <div className="py-4 max-w-md mx-auto">
      <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold mb-2">
        {isEn ? "Sponsorship Match · 3 Q · ~1 min" : "스폰서십 매칭 진단 · 3문항 · 약 1분"}
      </div>
      <h3 className="text-[22px] font-bold text-ink-900 leading-tight tracking-tight mb-5">
        {isEn
          ? "Find the right sponsorship mix."
          : "참가 목표에 맞는 스폰서십 구성을 산출합니다."}
      </h3>
      <ul className="space-y-2.5 mb-7">
        {items.map((t, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[13px] text-ink-700 leading-snug"
          >
            <span className="w-1 h-1 rounded-full bg-brand-500 mt-2 shrink-0" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onStart}
        className="w-full px-5 py-3 rounded-pill bg-brand-500 text-white text-[13.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm inline-flex items-center justify-center gap-2 transition-all"
      >
        {isEn ? "Start" : "진단 시작"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function GoalsPanel({
  isEn,
  primary,
  secondary,
  onPickPrimary,
  onPickSecondary,
}: {
  isEn: boolean;
  primary: Purpose | null;
  secondary: Purpose | null;
  onPickPrimary: (p: Purpose) => void;
  onPickSecondary: (p: Purpose | null) => void;
}) {
  const labels = isEn ? PURPOSE_LABEL_EN : PURPOSE_LABEL_KO;
  return (
    <div>
      <div className="mb-5">
        <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold mb-1.5">
          {isEn ? "Step 1 · Goal" : "STEP 1 · 목표"}
        </div>
        <h3 className="text-[18px] font-bold text-ink-900 leading-tight">
          {isEn ? "1st priority goal" : "1순위 목표"}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
        {PURPOSES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onPickPrimary(p);
              if (secondary === p) onPickSecondary(null);
            }}
            className={
              "text-left px-4 py-3 rounded-card border-2 transition-all " +
              (primary === p
                ? "border-brand-500 bg-brand-50"
                : "border-ink-100 bg-white hover:border-ink-300")
            }
          >
            <span className="text-[14px] font-bold text-ink-900">
              {labels[p]}
            </span>
          </button>
        ))}
      </div>

      {primary && (
        <>
          <div className="mb-3">
            <div className="font-num text-[10px] uppercase tracking-[0.2em] text-ink-500 font-bold mb-1">
              {isEn ? "2nd Priority (Optional)" : "2순위 (선택)"}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onPickSecondary(null)}
              className={
                "px-3 py-2 rounded-pill text-[12px] font-semibold border transition-colors " +
                (secondary === null
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-500 border-ink-100 hover:border-ink-300")
              }
            >
              {isEn ? "Skip" : "지정 안 함"}
            </button>
            {PURPOSES.filter((p) => p !== primary).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPickSecondary(p)}
                className={
                  "px-3 py-2 rounded-pill text-[12px] font-semibold border transition-colors " +
                  (secondary === p
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-ink-700 border-ink-100 hover:border-ink-300")
                }
              >
                {labels[p]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BudgetPanel({
  isEn,
  value,
  onChange,
}: {
  isEn: boolean;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-5">
        <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold mb-1.5">
          {isEn ? "Step 2 · Budget" : "STEP 2 · 예산"}
        </div>
        <h3 className="text-[18px] font-bold text-ink-900 leading-tight">
          {isEn ? "Set executable budget" : "집행 가능 예산을 설정하세요"}
        </h3>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-card p-5 text-center mb-5">
        <div className="text-[28px] font-bold text-brand-700 font-num">
          {isEn ? `$${Math.round(value / 1000).toLocaleString()}` : `${(value / 10000).toLocaleString()}만원`}
        </div>
      </div>

      <input
        type="range"
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        step={500_000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500 mb-3"
      />

      <div className="flex flex-wrap gap-1.5 justify-center">
        {BUDGET_STEPS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={
              "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors " +
              (Math.abs(value - v) < 100_000
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-white text-ink-500 border-ink-100 hover:border-ink-300")
            }
          >
            {isEn ? `$${Math.round(v / 1000).toLocaleString()}` : `${(v / 10000).toLocaleString()}만`}
          </button>
        ))}
      </div>
    </div>
  );
}

function MustHavePanel({
  isEn,
  selected,
  onToggle,
}: {
  isEn: boolean;
  selected: MustHaveTag[];
  onToggle: (t: MustHaveTag) => void;
}) {
  const labels = isEn ? MUST_HAVE_LABEL_EN : MUST_HAVE_LABEL_KO;
  return (
    <div>
      <div className="mb-5">
        <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold mb-1.5">
          {isEn ? "Step 3 · Requirements" : "STEP 3 · 추가 요건"}
        </div>
        <h3 className="text-[18px] font-bold text-ink-900 leading-tight">
          {isEn
            ? "Required conditions (optional, multi-select)"
            : "포함이 필요한 요건을 선택하세요 (선택, 복수 가능)"}
        </h3>
      </div>
      <div className="space-y-2">
        {MUST_HAVE_OPTIONS.map((t) => {
          const on = selected.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToggle(t)}
              className={
                "w-full text-left px-4 py-3 rounded-card border-2 transition-all flex items-center gap-3 " +
                (on
                  ? "border-brand-500 bg-brand-50"
                  : "border-ink-100 bg-white hover:border-ink-300")
              }
            >
              <span
                className={
                  "w-5 h-5 rounded grid place-items-center shrink-0 " +
                  (on
                    ? "bg-brand-500 text-white"
                    : "border-2 border-ink-200")
                }
              >
                {on && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
              <span className="text-[13.5px] font-semibold text-ink-900">
                {labels[t]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LiveCounter({
  funnel,
  step,
  isEn,
}: {
  funnel: {
    initial: number;
    afterGoal: number;
    afterBudget: number;
    afterMustHave: number;
  };
  step: Step;
  isEn: boolean;
}) {
  // 현재 단계 까지 적용된 카운트
  let current = funnel.initial;
  if (step === "q2" || step === "q3" || step === "result") current = funnel.afterGoal;
  if (step === "q3" || step === "result") current = funnel.afterBudget;
  if (step === "result") current = funnel.afterMustHave;

  return (
    <div className="text-[10.5px] font-num text-ink-500 flex items-center gap-1">
      <span className="hidden sm:inline">
        {isEn ? "candidates" : "후보"}
      </span>
      <span className="font-bold text-ink-900 tabular-nums">
        {current}
      </span>
      <span className="text-ink-400">/ {funnel.initial}</span>
    </div>
  );
}

// ============================================================================
// 결과 화면
// ============================================================================

function ResultPanel({
  isEn,
  eventId,
  result,
  upgrade,
  answers,
  onEditGoals,
  onEditBudget,
  onEditMustHave,
  onClose,
}: {
  isEn: boolean;
  eventId: string;
  result: ReturnType<typeof recommend>;
  upgrade: UpgradeOffer | null;
  answers: {
    primaryGoal: Purpose;
    secondaryGoal: Purpose | null;
    budgetKRW: number;
    mustHave: MustHaveTag[];
  };
  onEditGoals: () => void;
  onEditBudget: () => void;
  onEditMustHave: () => void;
  onClose: () => void;
}) {
  const purposeLabels = isEn ? PURPOSE_LABEL_EN : PURPOSE_LABEL_KO;
  const mustHaveLabels = isEn ? MUST_HAVE_LABEL_EN : MUST_HAVE_LABEL_KO;

  // 전체 후보 풀 펼치기 토글
  const [showAll, setShowAll] = useState(false);
  // 외 후보 (추천 3개 제외 나머지)
  const moreCandidates = result.candidatePool.filter(
    (e) => !result.picks.some((p) => p.category.id === e.category.id)
  );

  const fmtKRW = (n: number) =>
    isEn ? `$${Math.round(n / 1000).toLocaleString()}` : `${n.toLocaleString()}원`;

  return (
    <div className="space-y-5">
      {/* 답변 영수증 */}
      <div className="bg-ink-50 rounded-card p-4 space-y-2">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-ink-500 font-bold font-num">
          {isEn ? "Your Inputs" : "입력 답변"}
        </div>
        <Receipt
          label={
            answers.secondaryGoal
              ? `${purposeLabels[answers.primaryGoal]} · ${purposeLabels[answers.secondaryGoal]}`
              : purposeLabels[answers.primaryGoal]
          }
          onEdit={onEditGoals}
          editLabel={isEn ? "Edit" : "수정"}
        />
        <Receipt
          label={
            isEn
              ? `Budget ≤ $${Math.round(answers.budgetKRW / 1000).toLocaleString()}`
              : `예산 ${(answers.budgetKRW / 10000).toLocaleString()}만원 이내`
          }
          onEdit={onEditBudget}
          editLabel={isEn ? "Edit" : "수정"}
        />
        <Receipt
          label={
            answers.mustHave.length === 0
              ? isEn
                ? "Requirements: none"
                : "추가 요건: 없음"
              : (isEn ? "Requirements: " : "추가 요건: ") +
                answers.mustHave.map((t) => mustHaveLabels[t]).join(" · ")
          }
          onEdit={onEditMustHave}
          editLabel={isEn ? "Edit" : "수정"}
        />
      </div>

      {/* 폴백 안내 (필요 시) */}
      {result.relaxNotes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-btn px-3 py-2 text-[11.5px] text-amber-800 leading-snug">
          ⓘ {isEn ? "Constraint relaxation applied. " : "조건 일부 완화 적용. "}
          {result.relaxNotes.join(" · ")}
        </div>
      )}

      {/* 단품 추천 카드 */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[15px] font-bold text-ink-900">
            {isEn ? "Recommended Items" : "추천 단품"}
          </h3>
          <div className="text-[11px] text-ink-500 font-num">
            {isEn
              ? `${result.candidatePool.length} match · top ${result.picks.length}`
              : `매칭 ${result.candidatePool.length}개 · 상위 ${result.picks.length}개`}
          </div>
        </div>

        {result.picks.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-ink-500 bg-ink-50 rounded-card">
            {isEn
              ? "No matches within constraints. Adjust the budget or requirements."
              : "조건 내 매칭 없음. 예산·요건을 조정하세요."}
          </div>
        ) : (
          <ul className="space-y-2">
            {result.picks.map((p) => (
              <RecCard key={p.category.id} entry={p} isEn={isEn} />
            ))}
            <li className="flex items-baseline justify-between border-t border-ink-100 pt-2.5 text-[12px]">
              <span className="text-ink-500">
                {isEn ? "Subtotal" : "단품 합계"}
              </span>
              <span className="font-num font-bold text-ink-900">
                {fmtKRW(result.picksTotal)}
                <span className="text-ink-400 font-normal">
                  {" / "}
                  {fmtKRW(answers.budgetKRW)}
                </span>
              </span>
            </li>
          </ul>
        )}

        {/* 전체 후보 펼치기 */}
        {moreCandidates.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[11.5px] text-ink-500 hover:text-ink-900 font-semibold underline-offset-2 hover:underline"
            >
              {showAll
                ? isEn
                  ? "Collapse"
                  : "접기"
                : isEn
                ? `View ${moreCandidates.length} more candidates`
                : `매칭 후보 ${moreCandidates.length}개 더 보기`}
            </button>
            {showAll && (
              <ul className="mt-2 space-y-1.5">
                {moreCandidates.slice(0, 10).map((p) => (
                  <RecCard key={p.category.id} entry={p} isEn={isEn} compact />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 업그레이드 경로 블록 */}
      {upgrade && (
        <UpgradeBlock
          offer={upgrade}
          userPicksTotal={result.picksTotal}
          fmt={fmtKRW}
          isEn={isEn}
        />
      )}

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-2 pt-2 border-t border-ink-100">
        <Link
          href={localeHref(eventId, "/contact", isEn ? "en" : "ko")}
          className="px-4 py-2.5 rounded-pill bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm flex items-center gap-1.5 transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          {isEn ? "Request quote" : "이대로 견적 요청"}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-3 py-2.5 rounded-pill text-[12.5px] font-semibold text-ink-500 hover:text-ink-900"
        >
          {isEn ? "Close" : "닫기"}
        </button>
      </div>
    </div>
  );
}

function Receipt({
  label,
  onEdit,
  editLabel,
}: {
  label: string;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12.5px] text-ink-900 font-semibold flex items-baseline gap-1.5">
        <span className="text-brand-500">•</span> {label}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="text-[11px] text-ink-500 hover:text-brand-500 font-semibold underline-offset-2 hover:underline"
      >
        {editLabel}
      </button>
    </div>
  );
}

function RecCard({
  entry,
  isEn,
  compact = false,
}: {
  entry: RecEntry;
  isEn: boolean;
  compact?: boolean;
}) {
  const c = entry.category;
  const name = isEn && c.name.en ? c.name.en : c.name.ko;
  const fmt = (n: number) =>
    isEn ? `$${Math.round(n / 1000).toLocaleString()}` : `${n.toLocaleString()}원`;
  // 답 인용 reason — 매칭 신호가 약하면(폴백) 숨김
  const reason = entry.reason && !entry.reason.includes("부합하는 후보")
    ? entry.reason
    : null;

  if (compact) {
    return (
      <li className="bg-white border border-ink-100 rounded-btn px-3 py-2 flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-ink-700 truncate">{name}</span>
        <span className="text-[11px] font-num text-ink-500 shrink-0">
          {entry.minPriceKRW > 0
            ? fmt(entry.minPriceKRW)
            : isEn
            ? "Contact"
            : "별도 문의"}
        </span>
      </li>
    );
  }

  return (
    <li className="bg-white border border-ink-100 rounded-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-0.5">
        <span className="text-[13.5px] font-bold text-ink-900 truncate">
          {name}
        </span>
        <span className="text-[12.5px] font-num font-bold text-ink-900 shrink-0">
          {entry.minPriceKRW > 0
            ? fmt(entry.minPriceKRW)
            : isEn
            ? "Contact"
            : "별도 문의"}
        </span>
      </div>
      {reason && (
        <div className="text-[11.5px] text-brand-700 leading-snug">
          └ {reason}
        </div>
      )}
    </li>
  );
}

function UpgradeBlock({
  offer,
  userPicksTotal,
  fmt,
  isEn,
}: {
  offer: UpgradeOffer;
  userPicksTotal: number;
  fmt: (n: number) => string;
  isEn: boolean;
}) {
  const delta = offer.packagePriceKRW - userPicksTotal;
  const name = isEn && offer.package.name.en ? offer.package.name.en : offer.package.name.ko;
  const discountPct = Math.round(
    ((offer.totalIfSinglesKRW - offer.packagePriceKRW) / offer.totalIfSinglesKRW) * 100
  );

  return (
    <div className="bg-gradient-to-br from-brand-50 to-white border-2 border-brand-500 rounded-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Package2 className="w-4 h-4 text-brand-700" />
        <span className="text-[10.5px] uppercase tracking-[0.2em] text-brand-700 font-bold font-num">
          {isEn ? "Upgrade path" : "업그레이드 경로"}
        </span>
      </div>
      <h4 className="text-[15px] font-bold text-ink-900 leading-tight mb-2">
        {isEn
          ? `+${fmt(delta)} unlocks「${name}」`
          : `+${fmt(delta)}로「${name}」가 됩니다`}
      </h4>

      <div className="text-[12px] text-ink-700 leading-relaxed mb-3">
        <div className="mb-1.5">
          <span className="font-semibold">
            {isEn
              ? "Includes your 3 + extra:"
              : "당신이 고른 3개 모두 포함 + 추가:"}
          </span>
        </div>
        <ul className="space-y-0.5 pl-2">
          {offer.extraCategoryIds.slice(0, 3).map((id) => (
            <li key={id} className="text-[11.5px] text-ink-700">
              ★ <CategoryNameById id={id} isEn={isEn} />
            </li>
          ))}
          {offer.extraCategoryIds.length > 3 && (
            <li className="text-[10.5px] text-ink-500">
              {isEn
                ? `+ ${offer.extraCategoryIds.length - 3} more`
                : `+ ${offer.extraCategoryIds.length - 3}개 더`}
            </li>
          )}
        </ul>
      </div>

      <div className="bg-white rounded-btn p-2.5 mb-3 text-[11.5px] space-y-1 font-num">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-500">
            {isEn ? "Buy singles total" : "단품 합산"}
          </span>
          <span className="text-ink-700">
            {fmt(offer.totalIfSinglesKRW)}
          </span>
        </div>
        <div className="flex items-baseline justify-between font-bold">
          <span className="text-brand-700">
            {isEn ? "Package price" : "패키지가"}
          </span>
          <span className="text-brand-700">
            {fmt(offer.packagePriceKRW)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-[10.5px] text-ink-500 border-t border-ink-100 pt-1">
          <span>{isEn ? "Savings" : "절감"}</span>
          <span>{fmt(offer.savingsKRW)} ({discountPct}%)</span>
        </div>
      </div>

      <Link
        href="/sponsorships"
        className="block w-full text-center px-4 py-2.5 rounded-pill bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm transition-all"
      >
        {isEn ? `View 「${name}」` : `「${name}」 보기`}
      </Link>
    </div>
  );
}

// 패키지에 들어있는 카테고리 ID 로 이름 찾기 — 부모에 categories 가 있어야 하는데
// UpgradeBlock 가 categories prop 을 받지 않으므로 별도 컴포넌트로 분리.
// 단순화: 카테고리 id 만으로는 이름 찾기 불가 → 그냥 id 표기.
function CategoryNameById({ id, isEn }: { id: string; isEn: boolean }) {
  void isEn;
  return <span className="font-mono text-[10.5px] text-ink-500">{id}</span>;
}

// ============================================================================
// 유틸
// ============================================================================

function countDiagnosable(categories: Category[]): number {
  return categories.filter((c) => c.channel !== "package" && c.type !== "package")
    .length;
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function writeLog(args: {
  eventId: string;
  sessionId: string;
  completed: boolean;
  exitedAt?: string;
  primaryGoal?: Purpose | null;
  secondaryGoal?: Purpose | null;
  budgetKRW?: number;
  mustHave?: MustHaveTag[];
  recommendedCategoryIds: string[];
}) {
  try {
    await addDoc(collection(getDb(), "diagnostic_logs"), {
      ...args,
      createdAt: serverTimestamp(),
    });
  } catch {
    // 로그 실패는 사용자 경험에 영향 주지 않게 무시
  }
}
