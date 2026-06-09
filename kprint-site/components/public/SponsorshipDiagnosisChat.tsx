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
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  FileText,
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
  Slot,
  Subcategory,
} from "@/lib/types";
import { useCartStore } from "@/lib/cart/cartStore";
import { useLocale, localeHref } from "@/lib/i18n/locale";

type Step = "intro" | "q1" | "q2" | "q3" | "result";

const STEP_ORDER: Step[] = ["intro", "q1", "q2", "q3", "result"];

const MUST_HAVE_OPTIONS: MustHaveTag[] = [
  "online_channel",
  "overseas",
  "pre_exposure",
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
  slots,
  packages,
  initialPrimaryGoal,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName?: string;
  categories: Category[];
  subcategories: Subcategory[];
  slots: Slot[];
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

  // 진짜 추천 결과 (result 화면에서만 계산)
  const result = useMemo(() => {
    if (step !== "result" || !primaryGoal) return null;
    const answers: DiagAnswers = {
      goals: { primary: primaryGoal, secondary: secondaryGoal ?? undefined },
      budgetKRW,
      mustHave,
    };
    return recommend({
      candidates: categories,
      subcategories,
      answers,
      locale: isEn ? "en" : "ko",
    });
  }, [
    step,
    categories,
    subcategories,
    primaryGoal,
    secondaryGoal,
    budgetKRW,
    mustHave,
    isEn,
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
              <div className="text-[11px] text-brand-700 font-bold">
                {isEn ? "1-min match" : "1분 진단"}
              </div>
              <div className="text-[13px] font-bold text-ink-900 truncate">
                {step === "intro"
                  ? isEn
                    ? "Tailored Sponsorship Proposal"
                    : "맞춤형 스폰서십 제안"
                  : step === "result"
                  ? isEn
                    ? "Your Sponsorship Proposal"
                    : "맞춤형 스폰서십 제안 결과"
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

        {/* 진행률 — 3단계 도트 */}
        {showProgress && (
          <div className="px-5 py-2 border-b border-ink-100 bg-ink-50/50 flex items-center gap-1.5 shrink-0">
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
        )}

        {/* 본문 */}
        <div className="px-5 py-5 overflow-y-auto flex-1">
          {step === "intro" && (
            <IntroPanel isEn={isEn} onStart={() => setStep("q1")} />
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
              subcategories={subcategories}
              slots={slots}
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
              {step === "q3"
                ? isEn
                  ? "See results"
                  : "결과 보기"
                : isEn
                  ? "Next"
                  : "다음"}
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
}: {
  isEn: boolean;
  onStart: () => void;
}) {
  const koBullets = [
    "목표 달성을 위한 최적의 스폰서십 TOP 3 추천",
    "패키지 구성 시 절감되는 할인 혜택 자동 계산",
  ];
  const enBullets = [
    "Top 3 sponsorships matched to your goal",
    "Package upgrade savings auto-calculated",
  ];
  const items = isEn ? enBullets : koBullets;

  return (
    <div className="py-4">
      <h3 className="text-[19px] font-bold text-ink-900 leading-snug mb-1">
        {isEn
          ? "Find your sponsorship in 1 minute."
          : "우리 기업에 딱 맞는 스폰서십, 1분 만에 찾아보세요."}
      </h3>
      <p className="text-[12px] text-ink-500 mb-5">
        {isEn ? "3 questions · about 1 minute" : "3문항 · 약 1분 소요"}
      </p>
      <ul className="space-y-2 mb-7">
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
        className="w-full px-5 py-3 rounded-pill bg-brand-500 text-white text-[14px] font-bold hover:bg-brand-700 hover:shadow-glow-sm inline-flex items-center justify-center gap-2 transition-all"
      >
        {isEn ? "Find my sponsorship" : "맞춤 스폰서십 찾기"}
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
        <h3 className="text-[18px] font-bold text-ink-900 leading-snug">
          {isEn
            ? "What's the main goal of your sponsorship?"
            : "스폰서십을 통해 달성하고자 하는 핵심 목표는 무엇인가요?"}
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
            <h4 className="text-[14px] font-semibold text-ink-900">
              {isEn
                ? "Any secondary effect you'd like? (optional)"
                : "추가로 기대하는 효과가 있다면 선택해 주세요."}
            </h4>
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
              {isEn ? "Focus on main goal" : "핵심 목표에만 집중"}
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
        <h3 className="text-[18px] font-bold text-ink-900 leading-snug">
          {isEn
            ? "Set your expected sponsorship budget."
            : "스폰서십 예상 예산을 설정해 주세요."}
        </h3>
        <p className="text-[12px] text-ink-500 mt-1.5 leading-snug">
          {isEn
            ? "We'll suggest the best package within this range."
            : "선택하신 예산 범위 내에서 최적의 스폰서십 패키지를 제안해 드립니다."}
        </p>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-card p-5 text-center mb-5">
        <div className="text-[28px] font-bold text-brand-700 font-num">
          {isEn
            ? `$${Math.round(value / 1000).toLocaleString()}`
            : `${(value / 10000).toLocaleString()}만 원`}
        </div>
        <div className="text-[10.5px] text-brand-700/60 mt-1">
          {isEn ? "* VAT excluded" : "* 부가세 별도"}
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
            {isEn ? `$${Math.round(v / 1000).toLocaleString()}` : `${(v / 10000).toLocaleString()}만 원`}
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
        <h3 className="text-[18px] font-bold text-ink-900 leading-snug">
          {isEn
            ? "Any must-include conditions? (optional)"
            : "스폰서십 구성 시 꼭 포함하고 싶은 조건이 있나요? (선택)"}
        </h3>
        <p className="text-[12px] text-ink-500 mt-1.5">
          {isEn ? "Select all that apply." : "원하시는 항목을 모두 선택해 주세요."}
        </p>
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

// ============================================================================
// 결과 화면
// ============================================================================

function ResultPanel({
  isEn,
  eventId,
  result,
  upgrade,
  subcategories,
  slots,
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
  subcategories: Subcategory[];
  slots: Slot[];
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
  const router = useRouter();
  const purposeLabels = isEn ? PURPOSE_LABEL_EN : PURPOSE_LABEL_KO;
  const mustHaveLabels = isEn ? MUST_HAVE_LABEL_EN : MUST_HAVE_LABEL_KO;
  const addSlot = useCartStore((s) => s.addSlot);
  const hasSlot = useCartStore((s) => s.hasSlot);

  // 전체 후보 풀 펼치기 토글
  const [showAll, setShowAll] = useState(false);
  // 외 후보 (추천 3개 제외 나머지)
  const moreCandidates = result.candidatePool.filter(
    (e) => !result.picks.some((p) => p.category.id === e.category.id)
  );

  const fmtKRW = (n: number) =>
    isEn ? `$${Math.round(n / 1000).toLocaleString()}` : `${n.toLocaleString()}원`;

  // 진단 컨텍스트 — sessionStorage 에 저장해서 /contact 또는 패키지 상세 모달에서
  // 다시 끌어다 쓰게. inquiry 제출 시 admin 에 같이 기록됨.
  const buildAndSaveContext = () => {
    if (typeof window === "undefined") return;
    const ctx = {
      primaryGoal: answers.primaryGoal,
      secondaryGoal: answers.secondaryGoal ?? undefined,
      budgetKRW: answers.budgetKRW,
      mustHave: answers.mustHave,
      recommendedCategories: result.picks.map((p) => ({
        id: p.category.id,
        nameKo: p.category.name.ko,
      })),
    };
    try {
      sessionStorage.setItem("diagnosisContext", JSON.stringify(ctx));
    } catch {
      // sessionStorage 비활성 환경은 무시
    }
  };

  // 카테고리 → 가장 싼 가용 슬롯 찾기 (자동 카트 추가용)
  const findCheapestAvailableSlot = (
    catId: string
  ): { slot: Slot; sub: Subcategory } | null => {
    const subs = subcategories
      .filter((s) => s.categoryId === catId && s.priceKRW > 0)
      .sort((a, b) => a.priceKRW - b.priceKRW);
    for (const sub of subs) {
      const slot = slots.find(
        (s) => s.subcategoryId === sub.id && s.status === "available"
      );
      if (slot) return { slot, sub };
    }
    return null;
  };

  const onClickQuote = () => {
    buildAndSaveContext();
    // 추천 단품을 카트에 자동 추가 — 각 카테고리에서 가장 싼 가용 슬롯 1개씩.
    // 어드민이 견적서 추출·스폰서 전환을 정상적으로 진행할 수 있게 실제 cartItem 으로 들어감.
    for (const p of result.picks) {
      const found = findCheapestAvailableSlot(p.category.id);
      if (!found) continue;
      if (hasSlot(found.slot.id)) continue;
      addSlot({
        type: "slot",
        eventId,
        slotId: found.slot.id,
        categoryId: p.category.id,
        subcategoryId: found.sub.id,
        code: found.slot.code,
        price: found.sub.priceKRW,
      });
    }
    onClose();
    router.push(localeHref(eventId, "/contact", isEn ? "en" : "ko"));
  };

  const onClickPackageDetail = (pkgId: string) => {
    buildAndSaveContext();
    onClose();
    router.push(
      localeHref(eventId, `/sponsorships?package=${pkgId}`, isEn ? "en" : "ko")
    );
  };

  return (
    <div className="space-y-5">
      {/* 답변 영수증 */}
      <div className="bg-ink-50 rounded-card p-4 space-y-2">
        <div className="text-[12px] text-ink-500 font-semibold">
          {isEn ? "My diagnosis" : "나의 진단 조건"}
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
          ⓘ {isEn ? "Note · " : "안내 · "}
          {result.relaxNotes.join(" · ")}
        </div>
      )}

      {/* 단품 추천 카드 */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[15px] font-bold text-ink-900">
            {isEn
              ? `Best match for you (TOP ${result.picks.length})`
              : `조건에 딱 맞는 추천 스폰서십 (TOP ${result.picks.length})`}
          </h3>
          <div className="text-[11px] text-ink-500 font-num">
            {isEn
              ? `${result.candidatePool.length} candidates`
              : `매칭 후보 ${result.candidatePool.length}개`}
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
          onViewPackage={() => onClickPackageDetail(upgrade.package.id)}
        />
      )}

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-2 pt-2 border-t border-ink-100">
        <button
          type="button"
          onClick={onClickQuote}
          className="px-4 py-2.5 rounded-pill bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm flex items-center gap-1.5 transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          {isEn ? "Get a quote for this" : "현재 구성으로 견적서 받기"}
        </button>
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
        <div className="text-[11.5px] text-brand-700 leading-snug mt-0.5">
          {reason}
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
  onViewPackage,
}: {
  offer: UpgradeOffer;
  userPicksTotal: number;
  fmt: (n: number) => string;
  isEn: boolean;
  onViewPackage: () => void;
}) {
  const delta = offer.packagePriceKRW - userPicksTotal;
  const name = isEn && offer.package.name.en ? offer.package.name.en : offer.package.name.ko;
  const discountPct = Math.round(
    ((offer.totalIfSinglesKRW - offer.packagePriceKRW) / offer.totalIfSinglesKRW) * 100
  );

  return (
    <div className="bg-gradient-to-br from-brand-50 to-white border-2 border-brand-500 rounded-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[15px]">💡</span>
        <span className="text-[12px] text-brand-700 font-bold">
          {isEn ? "Package upgrade" : "패키지 업그레이드 제안"}
        </span>
      </div>
      <h4 className="text-[15px] font-bold text-ink-900 leading-snug mb-1">
        {delta > 0
          ? isEn
            ? `Add ${fmt(delta)} to unlock 「${name}」 with ${fmt(offer.savingsKRW)} in savings.`
            : `${fmt(delta)} 추가하면 ${fmt(offer.savingsKRW)} 할인 혜택의「${name}」가 됩니다.`
          : isEn
            ? `Switch to 「${name}」 and save ${fmt(-delta)} vs your current picks.`
            : `「${name}」로 묶으면 현재 구성보다 ${fmt(-delta)} 더 적게 쓰고 더 많이 받습니다.`}
      </h4>
      <p className="text-[12px] text-ink-700 leading-snug mb-3">
        {offer.extras.length > 0
          ? isEn
            ? `Includes your ${offer.covered.length} pick${offer.covered.length > 1 ? "s" : ""} plus ${offer.extras.length} extra item${offer.extras.length > 1 ? "s" : ""}.`
            : `선택하신 ${offer.covered.length}개 + 추가 매체 ${offer.extras.length}종 동봉.`
          : isEn
            ? `Includes your ${offer.covered.length} pick${offer.covered.length > 1 ? "s" : ""} at package price.`
            : `선택하신 ${offer.covered.length}개를 패키지가로 묶어 드립니다.`}
      </p>

      {offer.extras.length > 0 && (
        <div className="text-[12px] text-ink-700 leading-relaxed mb-3">
          <ul className="space-y-0.5 pl-1">
            {offer.extras.slice(0, 4).map((c) => (
              <li key={c.id} className="text-[11.5px] text-ink-700">
                + {isEn && c.name.en ? c.name.en : c.name.ko}
              </li>
            ))}
            {offer.extras.length > 4 && (
              <li className="text-[10.5px] text-ink-500">
                {isEn
                  ? `+ ${offer.extras.length - 4} more`
                  : `외 ${offer.extras.length - 4}개`}
              </li>
            )}
          </ul>
        </div>
      )}

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
          <span className="text-brand-700">{fmt(offer.packagePriceKRW)}</span>
        </div>
        <div className="flex items-baseline justify-between text-[10.5px] text-ink-500 border-t border-ink-100 pt-1">
          <span>{isEn ? "Savings" : "할인 혜택"}</span>
          <span>
            {fmt(offer.savingsKRW)} ({discountPct}%)
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onViewPackage}
        className="block w-full text-center px-4 py-2.5 rounded-pill bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 hover:shadow-glow-sm transition-all"
      >
        {isEn ? "View discounted package" : "할인 적용 패키지 상세 보기"}
      </button>
    </div>
  );
}

// ============================================================================
// 유틸
// ============================================================================

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
