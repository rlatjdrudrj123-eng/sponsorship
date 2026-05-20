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
  DEFAULT_DIAG_V2_QUESTIONS_EN,
  findUpsellPackage,
  getRecommendations,
  getResultLayout,
  mergeQuestion,
  type DiagnosisData,
  type RecommendedEntry,
  type ResultLayout,
  type UpsellSuggestion,
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
import { useLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

type Answers = {
  q1?: DiagQ1Value;
  q2?: DiagQ2Value;
  q3?: DiagQ3Value;
  q4?: DiagQ4Value;
  /** Q5 — Q4='decision' 일 때만 묻는 추가 질문. 선택된 추천 상품의 selectorId 또는 'none' */
  q5?: string;
};

type Step = "intro" | "q1" | "q2" | "q3" | "q4" | "q5" | "result";

/**
 * 흐름:
 *   intro → q1 → q2 → q3 → q4
 *   - q4='decision' 이면 → q5 → result
 *   - 그 외 (early / compare) → 바로 result
 *
 * 시퀀스를 동적으로 만들어서 nextStep / prevStep 계산.
 */
function visitSequence(answers: Answers): Step[] {
  const seq: Step[] = ["intro", "q1", "q2", "q3", "q4"];
  if (answers.q4 === "decision") seq.push("q5");
  seq.push("result");
  return seq;
}

function nextStep(s: Step, answers: Answers): Step {
  const seq = visitSequence(answers);
  const i = seq.indexOf(s);
  if (i < 0) return s;
  return seq[Math.min(i + 1, seq.length - 1)] ?? s;
}
function prevStep(s: Step, answers: Answers): Step {
  const seq = visitSequence(answers);
  const i = seq.indexOf(s);
  if (i < 0) return s;
  return seq[Math.max(i - 1, 0)] ?? s;
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

  // 추천 결과 — Q5 (decision 추가 질문) 부터 필요. Q5 옵션에 추천 목록을 노출해야 하므로.
  const recommendations: RecommendedEntry[] = useMemo(() => {
    if (step !== "q5" && step !== "result") return [];
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
      // q5 도 미완료 이탈 지점으로 q4 로 묶어서 기록 (스키마 단순화)
      const exitedAt: "q1" | "q2" | "q3" | "q4" =
        step === "q5" ? "q4" : step;
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

  const locale = useLocale((s) => s.locale);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-ink-900/40 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-2xl bg-canvas rounded-card shadow-card overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <header className="px-5 md:px-7 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <div>
            <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold">
              {t("diag.advisor", locale)}
            </div>
            <h2 className="text-[15px] font-bold text-ink-900 mt-0.5">
              {eventName} — {t("diag.subtitle", locale)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCloseWithLog}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-ink-50 text-ink-500"
            aria-label={t("diag.close", locale)}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-7 py-6">
          {step === "intro" && (
            <IntroScreen onStart={() => setStep("q1")} locale={locale} />
          )}

          {(step === "q1" ||
            step === "q2" ||
            step === "q3" ||
            step === "q4") && (
            <QuestionScreen
              step={step}
              answers={answers}
              config={diagnosisV2Config}
              locale={locale}
              onAnswer={(value) => {
                const nextAnswers = { ...answers, [step]: value };
                setAnswers(nextAnswers);
                setStep(nextStep(step, nextAnswers));
              }}
              onBack={() => setStep(prevStep(step, answers))}
            />
          )}

          {step === "q5" && (
            <Q5Screen
              recommendations={recommendations}
              currentValue={answers.q5}
              locale={locale}
              onAnswer={(value) => {
                const nextAnswers = { ...answers, q5: value };
                setAnswers(nextAnswers);
                setStep(nextStep(step, nextAnswers));
              }}
              onBack={() => setStep(prevStep(step, answers))}
            />
          )}

          {step === "result" && (
            <ResultScreen
              eventId={eventId}
              layout={layout}
              recommendations={recommendations}
              packages={packages}
              answers={answers}
              locale={locale}
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

function IntroScreen({
  onStart,
  locale,
}: {
  onStart: () => void;
  locale: "ko" | "en";
}) {
  return (
    <div className="text-center py-6 md:py-10">
      <h3 className="text-[22px] md:text-[28px] font-bold text-ink-900 leading-tight">
        K-PRINT 2026
      </h3>
      <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">
        {locale === "en"
          ? "KINTEX Hall 7·8 · Aug 19 (Wed) — 22 (Sat)"
          : "KINTEX 제2전시장 7·8홀 · 8월 19일(수) — 22일(토)"}
      </p>
      <div className="mt-8 max-w-md mx-auto">
        <p className="text-[15px] md:text-[16px] text-ink-900 leading-[1.65]">
          {t("diag.intro.tagline", locale)}
        </p>
        <p className="text-[12px] text-ink-500 mt-3">
          {t("diag.intro.duration", locale)}
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-pill bg-brand-500 hover:bg-brand-700 text-white text-[14px] font-bold transition-colors"
      >
        {t("diag.intro.cta", locale)}
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
  locale,
  onAnswer,
  onBack,
}: {
  step: DiagV2QuestionId;
  answers: Answers;
  config?: DiagnosisV2Config;
  locale: "ko" | "en";
  onAnswer: (value: string) => void;
  onBack: () => void;
}) {
  const qid = step;
  // 한글: 어드민 override 적용. 영문: 코드 영문 default (override 미적용).
  const q = useMemo(() => {
    if (locale === "en") return DEFAULT_DIAG_V2_QUESTIONS_EN[qid];
    return mergeQuestion(qid, config?.questions?.[qid]);
  }, [qid, config, locale]);

  const currentValue = answers[qid];
  // q1=1 ... q4=4. q5 는 별도 컴포넌트라 여기 안 옴.
  const qIndex = Number(qid.slice(1));
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
          {t("diag.back", locale)}
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

// ─── Q5 (Decision 전용 — 고려 중인 상품 확인) ──────────────

function Q5Screen({
  recommendations,
  currentValue,
  locale,
  onAnswer,
  onBack,
}: {
  recommendations: RecommendedEntry[];
  currentValue?: string;
  locale: "ko" | "en";
  onAnswer: (value: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onBack}
          className="text-[12.5px] text-ink-500 hover:text-ink-900 flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {t("diag.back", locale)}
        </button>
        <div className="font-num text-[11px] text-ink-500 font-bold tracking-wider">
          {t("diag.q5.lastStep", locale)}
        </div>
      </div>

      <h3 className="text-[18px] md:text-[20px] font-bold text-ink-900 leading-snug">
        {t("diag.q5.title", locale)}
      </h3>
      <p className="text-[12.5px] text-ink-500 mt-2 leading-relaxed">
        {t("diag.q5.hint", locale)}
      </p>

      <div className="mt-6 space-y-2">
        {recommendations.length === 0 ? (
          <div className="px-4 py-6 bg-ink-50 rounded-btn text-center text-[12.5px] text-ink-500">
            {t("diag.q5.empty", locale)}
          </div>
        ) : (
          recommendations.map((r) => {
            const selected = currentValue === r.selectorId;
            return (
              <button
                key={r.selectorId}
                type="button"
                onClick={() => onAnswer(r.selectorId)}
                className={
                  "w-full px-4 py-3 rounded-btn border text-left transition-all " +
                  (selected
                    ? "bg-brand-50 border-brand-500"
                    : "bg-white border-ink-100 hover:border-ink-700 hover:bg-ink-50")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-ink-900 leading-tight">
                      {locale === "en" ? r.nameEn : r.nameKo}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      {r.kind === "package"
                        ? t("diag.kind.package", locale)
                        : t("diag.kind.single", locale)}
                    </div>
                  </div>
                  <div className="font-num text-[13px] font-bold text-ink-900 shrink-0">
                    {r.priceLabel}
                  </div>
                </div>
              </button>
            );
          })
        )}

        {/* "특정 없음" 옵션 */}
        <button
          type="button"
          onClick={() => onAnswer("none")}
          className={
            "w-full px-4 py-3 rounded-btn border text-left transition-all " +
            (currentValue === "none"
              ? "bg-brand-50 border-brand-500"
              : "bg-white border-ink-100 hover:border-ink-700 hover:bg-ink-50")
          }
        >
          <div className="text-[13.5px] font-bold text-ink-900">
            {t("diag.q5.none", locale)}
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Result ───────────────────────────────────────────────

function ResultScreen({
  eventId,
  layout,
  recommendations,
  packages,
  answers,
  locale,
  onRestart,
}: {
  eventId: string;
  layout: ResultLayout;
  recommendations: RecommendedEntry[];
  packages: Package[];
  answers: Answers;
  locale: "ko" | "en";
  onRestart: () => void;
}) {
  const isDecision = answers.q4 === "decision";
  const focusedId = answers.q5 && answers.q5 !== "none" ? answers.q5 : null;

  const intro =
    answers.q4 === "early"
      ? t("diag.result.intro.early", locale)
      : answers.q4 === "compare"
        ? t("diag.result.intro.compare", locale)
        : focusedId
          ? t("diag.result.intro.decisionFocused", locale)
          : t("diag.result.intro.decision", locale);

  // Decision + focused 모드 — 메인 1개 + 보완재 2개로 분리
  const decisionFocused: {
    main: RecommendedEntry | null;
    supplements: RecommendedEntry[];
  } | null = useMemo(() => {
    if (!isDecision || !focusedId) return null;
    const main =
      recommendations.find((r) => r.selectorId === focusedId) ?? null;
    if (!main) return null;
    const supplements = recommendations
      .filter((r) => r.selectorId !== focusedId)
      .slice(0, 2);
    return { main, supplements };
  }, [isDecision, focusedId, recommendations]);

  // 패키지 업셀 — Decision-focused 일 때만 의미. 사용자가 고려 중인 단품(메인+보완재)이
  // 어느 패키지에 60% 이상 포함되고 절감액이 양수면 추천.
  const upsell: UpsellSuggestion | null = useMemo(() => {
    if (!decisionFocused) return null;
    const considering = [
      decisionFocused.main!,
      ...decisionFocused.supplements,
    ];
    // 이미 패키지가 고려 중이면 업셀 의미 없음
    if (considering.some((r) => r.kind === "package")) return null;
    const consideringIds = considering.map((r) => r.selectorId);
    const priceBySelectorId = new Map<string, number>();
    recommendations.forEach((r) => {
      if (r.kind === "category" && r.minPriceKRW > 0) {
        priceBySelectorId.set(r.selectorId, r.minPriceKRW);
      }
    });
    return findUpsellPackage({
      consideringIds,
      packages,
      priceBySelectorId,
    });
  }, [decisionFocused, recommendations, packages]);

  return (
    <div>
      <h3 className="text-[18px] md:text-[20px] font-bold text-ink-900">
        {t("diag.result.title", locale)}
      </h3>
      <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">{intro}</p>

      {recommendations.length === 0 ? (
        <div className="mt-6 px-4 py-6 bg-ink-50 rounded-btn text-center text-[13px] text-ink-500">
          {t("diag.result.empty", locale)}
        </div>
      ) : decisionFocused ? (
        <DecisionFocused
          eventId={eventId}
          main={decisionFocused.main!}
          supplements={decisionFocused.supplements}
          upsell={upsell}
          locale={locale}
        />
      ) : layout === "comparison" ? (
        <ComparisonTable
          eventId={eventId}
          recommendations={recommendations}
          locale={locale}
        />
      ) : (
        <Cards
          eventId={eventId}
          recommendations={recommendations}
          ctaStrong={isDecision}
          locale={locale}
        />
      )}

      {/* 하단 액션 */}
      <div className="mt-8 pt-5 border-t border-ink-100 flex flex-wrap items-center gap-3 justify-between">
        <button
          type="button"
          onClick={onRestart}
          className="text-[12.5px] text-ink-500 hover:text-ink-900 font-semibold"
        >
          {t("diag.result.restart", locale)}
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
            {isDecision
              ? t("diag.result.inquireNow", locale)
              : t("diag.result.connect", locale)}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── DecisionFocused — 메인 상품 큰 카드 + 보완재 2개 ──────

function DecisionFocused({
  eventId,
  main,
  supplements,
  upsell,
  locale,
}: {
  eventId: string;
  main: RecommendedEntry;
  supplements: RecommendedEntry[];
  upsell: UpsellSuggestion | null;
  locale: "ko" | "en";
}) {
  const detailHref =
    main.kind === "category" && main.category
      ? `/${eventId}/sponsorships/${main.category.slug}`
      : main.kind === "package" && main.package
        ? `/${eventId}/packages/${main.package.id}`
        : `/${eventId}/sponsorships`;
  const pkgName = locale === "en" ? upsell?.package.name.en : upsell?.package.name.ko;

  return (
    <div className="mt-5 space-y-5">
      {/* 메인 — 큰 강조 카드 */}
      <article className="border-2 border-brand-500 rounded-card p-5 md:p-6 bg-brand-50/40">
        <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold mb-2">
          {t("diag.focused.label", locale)}
        </div>
        <h4 className="text-[20px] md:text-[24px] font-bold text-ink-900 leading-tight">
          {locale === "en" ? main.nameEn : main.nameKo}
        </h4>
        <p className="text-[12.5px] text-ink-700 leading-relaxed mt-3 pl-3 border-l-2 border-brand-500">
          {main.reason}
        </p>
        <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="font-num text-[24px] md:text-[28px] font-bold text-ink-900 leading-none">
              {main.priceLabel}
            </div>
            <div className="text-[11px] text-ink-500 mt-1">
              {main.kind === "package"
                ? t("diag.kind.package", locale)
                : t("diag.kind.single", locale)}{" "}
              · {t("diag.vatExcluded", locale)}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={detailHref}
              className="px-4 py-2.5 rounded-btn border border-ink-900 text-ink-900 text-[12.5px] font-bold hover:bg-ink-50"
            >
              {t("diag.focused.detailBtn", locale)}
            </Link>
            <Link
              href={`/${eventId}/contact`}
              className="px-4 py-2.5 rounded-btn bg-brand-500 hover:bg-brand-700 text-white text-[12.5px] font-bold"
            >
              {t("diag.focused.inquireBtn", locale)}
            </Link>
          </div>
        </div>
      </article>

      {/* 보완재 */}
      {supplements.length > 0 && (
        <div>
          <div className="text-[12px] font-bold text-ink-700 mb-2.5">
            {t("diag.supplements.title", locale)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {supplements.map((s) => {
              const href =
                s.kind === "category" && s.category
                  ? `/${eventId}/sponsorships/${s.category.slug}`
                  : s.kind === "package" && s.package
                    ? `/${eventId}/packages/${s.package.id}`
                    : `/${eventId}/sponsorships`;
              return (
                <Link
                  key={s.selectorId}
                  href={href}
                  className="block border border-ink-100 rounded-btn p-3 hover:border-ink-700 transition-colors"
                >
                  <div className="text-[13px] font-bold text-ink-900 leading-tight">
                    {locale === "en" ? s.nameEn : s.nameKo}
                  </div>
                  <div className="font-num text-[13px] font-bold text-ink-900 mt-2">
                    {s.priceLabel}
                  </div>
                  <div className="text-[10.5px] text-ink-500 mt-1.5 leading-snug">
                    {s.reason}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 패키지 업셀 */}
      {upsell && (
        <Link
          href={`/${eventId}/packages/${upsell.package.id}`}
          className="block border border-brand-500 rounded-card p-4 md:p-5 bg-brand-50/60 hover:bg-brand-50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="text-[20px] shrink-0" aria-hidden>
              💡
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-num text-[10.5px] uppercase tracking-[0.25em] text-brand-500 font-bold">
                {t("diag.upsell.label", locale)}
              </div>
              <div className="text-[14px] md:text-[15px] font-bold text-ink-900 leading-snug mt-1">
                {locale === "en" ? (
                  <>
                    <strong className="text-brand-700">
                      {upsell.matched.length}
                    </strong>{" "}
                    of your considered items are included in{" "}
                    <strong>“{pkgName}”</strong>. Bundling saves{" "}
                    <strong className="text-brand-700">
                      ₩{upsell.savings.toLocaleString()}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    지금 고려 중인 매체 중{" "}
                    <strong className="text-brand-700">
                      {upsell.matched.length}개
                    </strong>
                    가 <strong>“{pkgName}”</strong>에 포함돼 있어요.
                    <br />
                    묶으면{" "}
                    <strong className="text-brand-700">
                      {upsell.savings.toLocaleString()}원
                    </strong>{" "}
                    저렴합니다.
                  </>
                )}
              </div>
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11.5px]">
                <div>
                  <span className="text-ink-500">
                    {t("diag.upsell.individualTotal", locale)}{" "}
                  </span>
                  <span className="font-num font-bold text-ink-900">
                    {locale === "en" ? "₩" : ""}
                    {upsell.individualTotal.toLocaleString()}
                    {locale === "en" ? "" : "원"}
                  </span>
                </div>
                <div>
                  <span className="text-ink-500">
                    {t("diag.upsell.packagePrice", locale)}{" "}
                  </span>
                  <span className="font-num font-bold text-brand-700">
                    {locale === "en" ? "₩" : ""}
                    {upsell.packagePrice.toLocaleString()}
                    {locale === "en" ? "" : "원"}
                  </span>
                </div>
                <div>
                  <span className="text-ink-500">
                    {t("diag.upsell.savings", locale)}{" "}
                  </span>
                  <span className="font-num font-bold text-brand-700">
                    -{locale === "en" ? "₩" : ""}
                    {upsell.savings.toLocaleString()}
                    {locale === "en" ? "" : "원"}
                  </span>
                </div>
              </div>
              {upsell.extra.length > 0 && (
                <div className="mt-2 text-[11px] text-ink-500 leading-snug">
                  {locale === "en"
                    ? `Bonus: the package also includes ${upsell.extra.length} more items.`
                    : `보너스: 패키지에는 추가로 ${upsell.extra.length}개 매체가 더 포함돼요.`}
                </div>
              )}
              <div className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-700">
                {t("diag.upsell.cta", locale)}{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

function Cards({
  eventId,
  recommendations,
  ctaStrong,
  locale,
}: {
  eventId: string;
  recommendations: RecommendedEntry[];
  ctaStrong: boolean;
  locale: "ko" | "en";
}) {
  return (
    <div className="mt-5 space-y-3">
      {recommendations.map((r) => (
        <RecommendationCard
          key={r.selectorId}
          eventId={eventId}
          entry={r}
          ctaStrong={ctaStrong}
          locale={locale}
        />
      ))}
    </div>
  );
}

function RecommendationCard({
  eventId,
  entry,
  ctaStrong,
  locale,
}: {
  eventId: string;
  entry: RecommendedEntry;
  ctaStrong: boolean;
  locale: "ko" | "en";
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
            {locale === "en" ? entry.nameEn : entry.nameKo}
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
          {t("diag.cards.detailBtn", locale)}
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
          {t("diag.cards.inquireBtn", locale)}
        </Link>
      </div>
    </article>
  );
}

function ComparisonTable({
  eventId,
  recommendations,
  locale,
}: {
  eventId: string;
  recommendations: RecommendedEntry[];
  locale: "ko" | "en";
}) {
  return (
    <div className="mt-5">
      <div className="overflow-x-auto border border-ink-100 rounded-card">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ink-50">
            <tr>
              <th className="text-left px-3 py-2 font-bold text-ink-700">
                {t("diag.compare.col.product", locale)}
              </th>
              <th className="text-right px-3 py-2 font-bold text-ink-700 w-28">
                {t("diag.compare.col.price", locale)}
              </th>
              <th className="text-left px-3 py-2 font-bold text-ink-700 w-20">
                {t("diag.compare.col.kind", locale)}
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
                      {locale === "en" ? r.nameEn : r.nameKo}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-1 leading-snug">
                      {r.reason}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-num font-bold text-ink-900">
                    {r.priceLabel}
                  </td>
                  <td className="px-3 py-3 text-ink-500 text-[11.5px]">
                    {r.kind === "package"
                      ? t("diag.kind.package", locale)
                      : t("diag.kind.single", locale)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={detailHref}
                      className="text-[11.5px] font-bold text-brand-500 hover:text-brand-700"
                    >
                      {t("diag.compare.detail", locale)}
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
