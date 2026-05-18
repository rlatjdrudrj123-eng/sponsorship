"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import type {
  Category,
  DiagnosisConfig,
  Package,
  Persona,
  Purpose,
  Slot,
  Subcategory,
} from "@/lib/types";
import { useCartStore } from "@/lib/cart/cartStore";
import { derivePurposes } from "@/lib/purposes";

/**
 * 룰 기반 대화형 페르소나 추천 — 외부 API 호출 없음, 비용 0.
 *
 * 5단계 선택형 (자유 입력 없음):
 *   1. experience — 첫 참가 / 재참가 / 매년 참가
 *   2. goal — 4가지 광고 목적 중 하나 (Purpose)
 *   3. audience — 국내 B2B / 글로벌 / 일반·언론 / 무관
 *   4. budget — 4단계 예산 범위
 *   5. location — Hall A/B/C/D / 옥외 / 온라인 / 무관
 *
 * 답마다 봇이 "정리하면…" 으로 진행을 짧게 confirm, 마지막에 추천 콤보.
 * 모든 답이 추천 점수에 가중치로 들어감.
 */

type Stage =
  | "goal"        // LEAD — 가장 강한 결정 요인
  | "budget"
  | "segment"
  | "companySize"
  | "experience"
  | "result";

type Experience = "first" | "repeat" | "regular";
type Segment =
  | "offset"
  | "digital"
  | "packaging"
  | "label"
  | "post_press"
  | "sign"
  | "supply"
  | "other";
type CompanySize = "solo" | "small" | "mid" | "large";

export type Collected = {
  segment?: Segment;
  segmentLabel?: string;
  companySize?: CompanySize;
  companySizeLabel?: string;
  experience?: Experience;
  experienceLabel?: string;
  purpose?: Purpose;
  purposeLabel?: string;
  budget?: number;
  budgetLabel?: string;
};

type Msg = { role: "user" | "bot"; content: string };

export type Chip = { label: string; value: string; hint?: string };

export const STAGES: Stage[] = [
  "goal",
  "budget",
  "segment",
  "companySize",
  "experience",
];

/**
 * K-PRINT 스폰서십 진단 — 5단계 (목표 lead).
 * 톤: 사무국 안내문 — "~합니다 / ~입니다", "귀사", 이모지·느낌표 제거.
 */
export const QUESTIONS: Record<
  Stage,
  { intro: string; chips?: Chip[]; why?: string; stepLabel?: string }
> = {
  goal: {
    intro: "이번 K-PRINT 참가의 우선 목표를 선택해 주세요.",
    stepLabel: "GOAL",
    why: "목표에 따라 채널 믹스가 달라집니다 — 부스 트래픽은 도면·목걸이, 브랜드 인지는 천장배너, 해외 바이어는 영문 뉴스레터 중심.",
    chips: [
      { label: "부스 방문 유도", value: "traffic_driver", hint: "도면 검색 · 목걸이 · 등록데스크" },
      { label: "브랜드 인지 확보", value: "brand_awareness", hint: "천장배너 · 가이드북 · 옥외" },
      { label: "해외·전문 바이어 도달", value: "buyer_reach", hint: "해외 뉴스레터 · 영문 가이드" },
      { label: "행사 후 자산 확보", value: "post_asset", hint: "콘텐츠 · 인터뷰 · SNS" },
    ],
  },
  budget: {
    intro: "집행 가능 예산 범위를 알려주세요.",
    stepLabel: "BUDGET",
    why: "예산 범위를 벗어나는 항목은 자동 제외됩니다. 범위 초과는 큰 감점, 범위 미달은 작은 감점이 적용됩니다.",
    chips: [
      { label: "500만원 이하", value: "5000000" },
      { label: "500만 ~ 1,500만원", value: "15000000" },
      { label: "1,500만 ~ 3,000만원", value: "30000000" },
      { label: "3,000만원 이상", value: "100000000" },
    ],
  },
  segment: {
    intro: "귀사의 주력 분야를 선택해 주세요.",
    stepLabel: "SEGMENT",
    why: "분야 기준으로 효율 높은 노출 채널이 달라집니다. (예: 패키징은 샘플북·도면 / 디지털 인쇄는 온라인 배너 우선)",
    chips: [
      { label: "일반 인쇄 (오프셋·UV)", value: "offset", hint: "도면 · 옥외 · 검색 페이지" },
      { label: "디지털 인쇄·POD", value: "digital", hint: "온라인 배너 · 뉴스레터 우선" },
      { label: "패키징·박스", value: "packaging", hint: "샘플북 · 도면 우선" },
      { label: "라벨·스티커", value: "label", hint: "시그니처 · 도면" },
      { label: "후가공·바인딩", value: "post_press", hint: "쇼가이드 · 검색" },
      { label: "사인·디스플레이", value: "sign", hint: "옥외 · 전광판" },
      { label: "잉크·소재·기자재", value: "supply", hint: "참관객 목걸이 · 쇼가이드" },
      { label: "기타 / 정하지 않음", value: "other" },
    ],
  },
  companySize: {
    intro: "회사 규모를 알려주세요.",
    stepLabel: "COMPANY SIZE",
    why: "규모는 예산 가용성과 패키지 적합도에 반영됩니다. 1인·스타트업은 단품 중심, 중견·대기업은 시그니처 통합 패키지가 효율적입니다.",
    chips: [
      { label: "1인 / 스타트업 (1~5명)", value: "solo", hint: "단품 · 진입 채널" },
      { label: "소기업 (5~30명)", value: "small", hint: "프라임 스팟 + 단품" },
      { label: "중견 (30~100명)", value: "mid", hint: "패키지 권장" },
      { label: "대기업 (100명 이상)", value: "large", hint: "시그니처 패키지 · 통합 노출" },
    ],
  },
  experience: {
    intro: "K-PRINT 참가 이력은 어떻게 되십니까?",
    stepLabel: "EXPERIENCE",
    why: "신규 참가는 진입 채널 (검색 페이지·뉴스레터) 중심, 정기 참가는 확장·시그니처 후보 우선.",
    chips: [
      { label: "신규 참가", value: "first", hint: "진입 채널 중심" },
      { label: "재참가 (전년)", value: "repeat", hint: "확장 후보" },
      { label: "정기 참가 (3년 이상)", value: "regular", hint: "프리미엄·시그니처" },
    ],
  },
  result: { intro: "" },
};

/**
 * 스코어링 가중치 — 사용자 정의 (2026-05 변경).
 * 목표가 가장 강한 결정 요인, 예산 범위는 강한 hard-rule (over/under 감점),
 * 분야·규모·경험은 보조 조정.
 */
export const SCORING_WEIGHTS = {
  goalMatch: 35,           // 목표(purpose) 일치 — LEAD 가중치
  budgetInRange: 30,       // 예산 범위 적합
  budgetOverPenalty: 50,   // 예산 초과 (강한 감점)
  budgetUnderPenalty: 25,  // 예산 미달 (작은 감점)
  segmentMatch: 20,        // 분야 일치
  companySizeLarge: 20,    // 대기업 + 시그니처 정합
  experienceFirst: 15,     // 신규 + 진입형
  experienceRegular: 15,   // 정기 + 시그니처
  companySizeSolo: 15,     // 1인 + 단품
  channelMatch: 18,        // 채널 일치 (목표·분야에서 자동 추출)
  soloChannelBonus: 8,     // 단독 채널 (해당 분야 단일 강조 채널)
  lastSlotBonus: 5,        // 잔여 1자리 보너스 (희소성)
  onOffBalanceBonus: 8,    // 온·오프 균형 콤보
} as const;

export function PersonaAiChat({
  open,
  onClose,
  eventId,
  personas,
  categories,
  subcategories,
  slots,
  packages,
  initialGoal,
  diagnosisConfig,
}: {
  open: boolean;
  onClose: () => void;
  eventName: string;
  eventId: string;
  personas: Persona[];
  categories: Category[];
  subcategories: Subcategory[];
  slots: Slot[];
  packages: Package[];
  /** 페이지에서 첫 질문(GOAL) 칩을 미리 누르고 열었을 때 — 모달은 바로 2번째 질문부터 */
  initialGoal?: Purpose;
  /** 어드민에서 override 한 진단 설정 (siteSettings.diagnosisConfig). 없으면 코드 기본값. */
  diagnosisConfig?: DiagnosisConfig;
}) {
  // override 적용된 effective 값들 — 어드민에서 수정한 텍스트/가중치가 있으면 반영
  const effectiveQuestions = useMemo(() => {
    const overrides = diagnosisConfig?.questions ?? {};
    const merged = { ...QUESTIONS };
    for (const stage of STAGES) {
      if (stage === "result") continue;
      const ov = overrides[stage];
      if (!ov) continue;
      merged[stage] = {
        ...QUESTIONS[stage],
        ...(ov.intro ? { intro: ov.intro } : {}),
        ...(ov.why !== undefined ? { why: ov.why } : {}),
        ...(ov.chips && ov.chips.length > 0
          ? {
              chips: ov.chips.map((c) => ({
                label: c.label,
                value: c.value,
                hint: c.hint,
              })),
            }
          : {}),
      };
    }
    return merged;
  }, [diagnosisConfig]);

  const effectiveWeights = useMemo(
    () => ({
      ...SCORING_WEIGHTS,
      ...(diagnosisConfig?.scoringWeights ?? {}),
    }),
    [diagnosisConfig]
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>("experience");
  const [collected, setCollected] = useState<Collected>({});
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 모달 열릴 때 초기화 (initialGoal 이 있으면 1번 질문 자동 답변 후 2번부터)
  useEffect(() => {
    if (!open) return;
    setMessages([
      {
        role: "bot",
        content:
          "K-PRINT 2026 사무국입니다. 귀사의 참가 목표·예산·분야를 바탕으로 가장 효율이 높은 스폰서십 구성을 검토해 드립니다. 5개 항목, 약 1분이 소요됩니다.",
      },
    ]);
    setStage("goal");
    setCollected({});
    setThinking(false);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => say(QUESTIONS.goal.intro), 450));

    if (initialGoal) {
      const chip = QUESTIONS.goal.chips!.find(
        (c) => c.value === initialGoal
      );
      if (chip) {
        // intro 가 보인 직후, 사용자가 칩을 누른 것처럼 진행
        timers.push(
          setTimeout(() => {
            userSay(chip.label);
            const next: Collected = {
              purpose: chip.value as Purpose,
              purposeLabel: chip.label,
            };
            setCollected(next);
            advance(next, "goal");
          }, 1100)
        );
      }
    }

    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialGoal]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking, stage]);

  // ESC + body lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const say = (text: string) => {
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setMessages((m) => [...m, { role: "bot", content: text }]);
    }, 450);
  };

  const userSay = (text: string) => {
    setMessages((m) => [...m, { role: "user", content: text }]);
  };

  // 칩 클릭
  const onChip = (chip: Chip) => {
    userSay(chip.label);
    const next: Collected = { ...collected };
    if (stage === "goal") {
      next.purpose = chip.value as Purpose;
      next.purposeLabel = chip.label;
    } else if (stage === "budget") {
      next.budget = parseInt(chip.value, 10);
      next.budgetLabel = chip.label;
    } else if (stage === "segment") {
      next.segment = chip.value as Segment;
      next.segmentLabel = chip.label;
    } else if (stage === "companySize") {
      next.companySize = chip.value as CompanySize;
      next.companySizeLabel = chip.label;
    } else if (stage === "experience") {
      next.experience = chip.value as Experience;
      next.experienceLabel = chip.label;
    }
    setCollected(next);
    advance(next, stage);
  };

  const advance = (next: Collected, from: Stage) => {
    const idx = STAGES.indexOf(from);
    const ackText = ackFor(from, next);
    setTimeout(() => say(ackText), 350);

    if (idx === STAGES.length - 1) {
      // 마지막 → 결과
      setTimeout(() => {
        setStage("result");
        say(buildSummary(next));
      }, 1100);
      return;
    }

    const nextStage = STAGES[idx + 1];
    setTimeout(() => {
      setStage(nextStage);
      say(effectiveQuestions[nextStage].intro);
    }, 1100);
  };

  const reset = () => {
    setMessages([
      {
        role: "bot",
        content: "처음부터 다시 시작할게요. 짧게 5가지 다시 여쭙겠습니다.",
      },
    ]);
    setCollected({});
    setStage("experience");
    setTimeout(() => say(QUESTIONS.experience.intro), 450);
  };

  // 추천 산출 — 권장안 / 대안 / 절감안 3개 옵션
  const scoredPersonas = useMemo(
    () => (stage === "result" ? scoreAllPersonas(personas, collected) : []),
    [stage, personas, collected]
  );
  const persona = scoredPersonas[0]?.persona ?? null;

  // 호환을 위한 picks (권장안의 콤보)
  const picks = useMemo(() => {
    if (stage !== "result" || !persona) return [];
    return computeCombo(
      persona,
      categories,
      subcategories,
      slots,
      packages,
      collected,
      effectiveWeights
    );
  }, [
    stage,
    persona,
    categories,
    subcategories,
    slots,
    packages,
    collected,
    effectiveWeights,
  ]);

  // 3-옵션 결과
  const options = useMemo(() => {
    if (stage !== "result" || scoredPersonas.length === 0) return null;
    return buildThreeOptions(
      scoredPersonas,
      categories,
      subcategories,
      slots,
      packages,
      collected,
      effectiveWeights
    );
  }, [
    stage,
    scoredPersonas,
    categories,
    subcategories,
    slots,
    packages,
    collected,
    effectiveWeights,
  ]);

  if (!open) return null;

  const currentChips =
    stage !== "result" ? effectiveQuestions[stage].chips : undefined;
  const stageIdx = STAGES.indexOf(stage);
  const progress = stage === "result" ? 100 : ((stageIdx + 1) / STAGES.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[70] bg-ink-900/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full md:max-w-2xl h-[92vh] md:h-[88vh] md:rounded-card shadow-2xl overflow-hidden flex flex-col"
      >
        <header className="px-5 py-4 border-b border-ink-100 shrink-0 bg-canvas">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-ink-900 grid place-items-center text-white text-[11px] font-bold tracking-wider">
                SA
              </div>
              <div>
                <div className="font-num text-[10px] uppercase tracking-[0.3em] text-ink-500 font-bold">
                  {stage === "result"
                    ? "RESULT"
                    : `STEP ${stageIdx + 1} / ${STAGES.length}${effectiveQuestions[stage].stepLabel ? " · " + effectiveQuestions[stage].stepLabel : ""}`}
                </div>
                <h3 className="text-[15px] font-bold text-ink-900 leading-tight">
                  Sponsorship Advisor
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="px-2.5 py-1.5 rounded-btn text-[11px] font-semibold text-ink-500 hover:text-ink-900 hover:bg-ink-100 flex items-center gap-1"
                title="다시 시작"
              >
                <RotateCcw className="w-3 h-3" />
                다시
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 grid place-items-center rounded-btn hover:bg-ink-100 text-ink-500"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* 진행 바 */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-ink-100 overflow-hidden">
              <div
                className="h-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-num text-[10px] text-ink-500 font-bold">
              {stage === "result"
                ? "추천 완료"
                : `${stageIdx + 1} / ${STAGES.length}`}
            </span>
          </div>
        </header>

        {/* 메시지 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-3"
        >
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role}>
              {m.content}
            </Bubble>
          ))}
          {thinking && <ThinkingBubble />}

          {/* 칩 (선택 옵션) */}
          {stage !== "result" && !thinking && currentChips && (
            <div className="pt-2">
              <div className="flex flex-wrap gap-1.5">
                {currentChips.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onChip(c)}
                    className="group px-3.5 py-2 rounded-btn border-2 border-brand-500 bg-white hover:bg-brand-500 hover:text-white transition-colors text-left max-w-full"
                  >
                    <div className="text-[12.5px] font-bold text-ink-900 group-hover:text-white">
                      {c.label}
                    </div>
                    {c.hint && (
                      <div className="text-[10px] text-ink-500 group-hover:text-white/80 mt-0.5">
                        {c.hint}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 결과 카드 — 권장안 / 대안 / 절감안 3-옵션 비교 */}
          {stage === "result" && options && (
            <ThreeOptionResult
              options={options}
              eventId={eventId}
              onClose={onClose}
            />
          )}
          {stage === "result" && (!persona || picks.length === 0) && (
            <div className="mt-4 bg-canvas border border-ink-100 rounded-card p-5 text-[13px] text-ink-700 leading-relaxed">
              조건에 정확히 맞는 콤보를 찾지 못했어요. 사이드바 필터를 직접
              조정하거나, 사무국에 문의 부탁드립니다.
            </div>
          )}
        </div>

        {/* 푸터 — 결과 화면에서는 닫기/카탈로그 안내 */}
        {stage === "result" && (
          <footer className="border-t border-ink-100 px-4 py-3 shrink-0 bg-surface flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-ink-500">
              추천은 참고용. 정식 견적은 사무국이 확정합니다.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="px-3 py-1.5 rounded-btn border border-ink-100 hover:border-ink-900 text-[12px] font-semibold"
              >
                다시 추천
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-btn bg-ink-900 text-white text-[12px] font-bold hover:bg-brand-500"
              >
                닫기
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// UI 조각
// ============================================================================

function Bubble({
  role,
  children,
}: {
  role: "user" | "bot";
  children: React.ReactNode;
}) {
  return (
    <div
      className={"flex " + (role === "user" ? "justify-end" : "justify-start")}
    >
      <div
        className={
          "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap " +
          (role === "user"
            ? "bg-ink-900 text-white"
            : "bg-canvas border border-ink-100 text-ink-900")
        }
      >
        {children}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="px-3.5 py-3 rounded-2xl bg-canvas border border-ink-100 text-ink-500 flex items-center gap-1.5">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-ink-500 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

// ============================================================================
// 결과 카드
// ============================================================================

type Pick = {
  key: string;
  kind: "slot" | "package";
  label: string;
  sublabel?: string;
  code: string;
  price: number;
  reason: string;
  slotId?: string;
  categoryId?: string;
  subcategoryId?: string;
  packageId?: string;
  eventId: string;
};

// ============================================================================
// 3-옵션 결과 (권장안 / 대안 / 절감안)
// ============================================================================

type RecommendationOption = {
  kind: "recommended" | "alternative" | "thrifty";
  label: string;
  description: string;
  persona: Persona;
  personaScore: number;
  personaReasons: string[];
  picks: Pick[];
  total: number;
  budgetRemaining: number;
  supplementaryPicks: Pick[]; // 잔여 예산 보완 채널
  reasons: string[]; // 3~4줄 자연어 설명
};

function buildThreeOptions(
  scored: Array<{ persona: Persona; score: number; reasons: string[] }>,
  categories: Category[],
  subcategories: Subcategory[],
  slots: Slot[],
  packages: Package[],
  c: Collected,
  effectiveWeights: typeof SCORING_WEIGHTS
): { recommended: RecommendationOption; alternative?: RecommendationOption; thrifty?: RecommendationOption } | null {
  if (scored.length === 0) return null;

  const budget = c.budget ?? Number.POSITIVE_INFINITY;

  // 권장안 — 1순위 페르소나의 전체 콤보
  const top = scored[0];
  const topPicks = computeCombo(
    top.persona,
    categories,
    subcategories,
    slots,
    packages,
    c,
    effectiveWeights
  );
  const topTotal = topPicks.reduce((s, p) => s + p.price, 0);
  const recommended: RecommendationOption = {
    kind: "recommended",
    label: "권장안",
    description: "응답 가중치 합계 최상위",
    persona: top.persona,
    personaScore: top.score,
    personaReasons: top.reasons,
    picks: topPicks,
    total: topTotal,
    budgetRemaining: Math.max(0, budget - topTotal),
    supplementaryPicks: buildSupplementaryPicks(
      topPicks,
      categories,
      subcategories,
      slots,
      Math.max(0, budget - topTotal)
    ),
    reasons: buildReasonsParagraph(top.reasons, topPicks, c, "recommended"),
  };

  // 대안 — 2순위 페르소나가 있으면 그 페르소나의 콤보, 없으면 권장안에서 항목 1개 교체
  let alternative: RecommendationOption | undefined;
  if (scored.length > 1) {
    const alt = scored[1];
    const altPicks = computeCombo(
      alt.persona,
      categories,
      subcategories,
      slots,
      packages,
      c,
      effectiveWeights
    );
    if (altPicks.length > 0) {
      const altTotal = altPicks.reduce((s, p) => s + p.price, 0);
      alternative = {
        kind: "alternative",
        label: "대안",
        description: "다른 페르소나 기반 대안 구성",
        persona: alt.persona,
        personaScore: alt.score,
        personaReasons: alt.reasons,
        picks: altPicks,
        total: altTotal,
        budgetRemaining: Math.max(0, budget - altTotal),
        supplementaryPicks: [],
        reasons: buildReasonsParagraph(alt.reasons, altPicks, c, "alternative"),
      };
    }
  }

  // 절감안 — 권장안에서 가장 비싼 항목을 빼서 예산을 더 줄임
  let thrifty: RecommendationOption | undefined;
  if (topPicks.length > 1) {
    const sortedByPrice = [...topPicks].sort((a, b) => b.price - a.price);
    const cheapestSet = sortedByPrice.slice(1); // 가장 비싼 1개 제외
    const cheapestTotal = cheapestSet.reduce((s, p) => s + p.price, 0);
    thrifty = {
      kind: "thrifty",
      label: "절감안",
      description: "예산 부담을 최소화한 구성",
      persona: top.persona,
      personaScore: top.score,
      personaReasons: top.reasons,
      picks: cheapestSet,
      total: cheapestTotal,
      budgetRemaining: Math.max(0, budget - cheapestTotal),
      supplementaryPicks: [],
      reasons: buildReasonsParagraph(top.reasons, cheapestSet, c, "thrifty"),
    };
  }

  return { recommended, alternative, thrifty };
}

function buildSupplementaryPicks(
  current: Pick[],
  categories: Category[],
  subcategories: Subcategory[],
  slots: Slot[],
  remaining: number
): Pick[] {
  if (remaining <= 0) return [];
  const usedCatIds = new Set(current.map((p) => p.categoryId).filter(Boolean));
  const out: Pick[] = [];
  for (const sub of [...subcategories].sort((a, b) => a.priceKRW - b.priceKRW)) {
    if (out.length >= 2) break;
    if (sub.priceKRW > remaining) continue;
    if (usedCatIds.has(sub.categoryId)) continue;
    const cat = categories.find((c) => c.id === sub.categoryId);
    if (!cat) continue;
    const slot = slots.find(
      (s) => s.subcategoryId === sub.id && s.status === "available"
    );
    if (!slot) continue;
    out.push({
      key: slot.id,
      kind: "slot",
      eventId: cat.eventId,
      label: cat.name.ko || cat.code,
      sublabel: sub.name.ko,
      categoryId: cat.id,
      subcategoryId: sub.id,
      slotId: slot.id,
      code: slot.code,
      price: sub.priceKRW,
      reason: "잔여 예산 보완",
    });
  }
  return out;
}

function buildReasonsParagraph(
  scoreReasons: string[],
  picks: Pick[],
  c: Collected,
  kind: "recommended" | "alternative" | "thrifty"
): string[] {
  const lines: string[] = [];
  if (c.purposeLabel) {
    lines.push(`목표 「${c.purposeLabel}」에 부합하는 채널 위주로 구성하였습니다.`);
  }
  if (c.budgetLabel) {
    const total = picks.reduce((s, p) => s + p.price, 0);
    lines.push(
      `예산 ${c.budgetLabel} 범위 내 합계 ${total.toLocaleString()}원 (부가세 별도) 으로 산정되었습니다.`
    );
  }
  if (c.segmentLabel) {
    lines.push(`귀사 분야 「${c.segmentLabel}」의 효율 가중치를 적용하였습니다.`);
  }
  if (scoreReasons.length > 0) {
    lines.push(
      `매칭 근거: ${scoreReasons.slice(0, 3).join(" · ")}`
    );
  }
  if (kind === "alternative") {
    lines.push("권장안과 페르소나가 다른 대안 구성입니다. 비교 검토용으로 활용해 주십시오.");
  }
  if (kind === "thrifty") {
    lines.push("권장안에서 최고가 항목을 제외해 예산 부담을 최소화한 구성입니다.");
  }
  return lines;
}
function ThreeOptionResult({
  options,
  eventId,
  onClose,
}: {
  options: {
    recommended: RecommendationOption;
    alternative?: RecommendationOption;
    thrifty?: RecommendationOption;
  };
  eventId: string;
  onClose: () => void;
}) {
  const list: RecommendationOption[] = [
    options.recommended,
    ...(options.alternative ? [options.alternative] : []),
    ...(options.thrifty ? [options.thrifty] : []),
  ];

  return (
    <div className="mt-4 space-y-3">
      <div className="bg-ink-900 text-white rounded-card px-4 py-3.5">
        <div className="font-num text-[10px] uppercase tracking-[0.3em] text-white/60 font-bold mb-1">
          K-PRINT SPONSORSHIP ADVISOR · RESULT
        </div>
        <h4 className="text-[15px] font-semibold leading-snug">
          다음 구성이 부합합니다.
        </h4>
        <p className="text-[11.5px] text-white/70 mt-1 leading-relaxed">
          권장안 / 대안 / 절감안 — 세 가지 구성을 함께 검토해 주십시오.
        </p>
      </div>

      {list.map((opt) => (
        <OptionCard
          key={opt.kind}
          option={opt}
          eventId={eventId}
          onClose={onClose}
        />
      ))}

      <div className="bg-canvas border border-ink-100 rounded-card p-4 text-[12px] text-ink-700 leading-relaxed">
        본 결과는 K-PRINT 사무국 내부 데이터를 기준으로 산출된 참고안입니다.
        세부 협의는{" "}
        <a
          href="mailto:sales@k-print.kr"
          className="text-brand-500 font-semibold hover:underline"
        >
          sales@k-print.kr
        </a>{" "}
        로 문의해 주십시오.
      </div>
    </div>
  );
}

function OptionCard({
  option,
  eventId,
  onClose,
}: {
  option: RecommendationOption;
  eventId: string;
  onClose: () => void;
}) {
  const addSlot = useCartStore((s) => s.addSlot);
  const addPackage = useCartStore((s) => s.addPackage);
  const hasSlot = useCartStore((s) => s.hasSlot);
  const hasPackage = useCartStore((s) => s.hasPackage);
  const allInCart = option.picks.every((p) => {
    if (p.kind === "slot" && p.slotId) return hasSlot(p.slotId);
    if (p.kind === "package" && p.packageId) return hasPackage(p.packageId);
    return true;
  });

  const addAll = () => {
    for (const p of option.picks) {
      if (p.kind === "slot" && p.slotId && p.categoryId && p.subcategoryId) {
        if (!hasSlot(p.slotId)) {
          addSlot({
            type: "slot",
            eventId: p.eventId,
            slotId: p.slotId,
            categoryId: p.categoryId,
            subcategoryId: p.subcategoryId,
            code: p.code,
            price: p.price,
          });
        }
      } else if (p.kind === "package" && p.packageId) {
        if (!hasPackage(p.packageId)) {
          addPackage({
            type: "package",
            eventId: p.eventId,
            packageId: p.packageId,
            code: p.code,
            price: p.price,
          });
        }
      }
    }
  };

  const isMain = option.kind === "recommended";

  return (
    <div
      className={
        "border rounded-card overflow-hidden bg-surface " +
        (isMain ? "border-brand-500 shadow-glow-sm" : "border-ink-100")
      }
    >
      <div
        className={
          "px-4 py-3 flex items-baseline justify-between gap-2 " +
          (isMain ? "bg-brand-500 text-white" : "bg-ink-50 text-ink-900")
        }
      >
        <div>
          <div
            className={
              "font-num text-[10px] uppercase tracking-[0.25em] font-bold " +
              (isMain ? "text-white/80" : "text-ink-500")
            }
          >
            {option.kind === "recommended"
              ? "OPTION A · 권장안"
              : option.kind === "alternative"
                ? "OPTION B · 대안"
                : "OPTION C · 절감안"}
          </div>
          <div className="text-[14px] font-bold mt-0.5 leading-tight">
            {option.persona.emoji} {option.persona.title}
          </div>
        </div>
        <div className="text-right">
          <div
            className={
              "text-[10.5px] font-num " +
              (isMain ? "text-white/70" : "text-ink-500")
            }
          >
            합계 (부가세 별도)
          </div>
          <div className="font-num font-bold text-[16px]">
            {option.total.toLocaleString()}원
          </div>
        </div>
      </div>

      <ul className="divide-y divide-ink-100">
        {option.picks.map((p) => (
          <li key={p.key} className="px-4 py-2.5 flex items-baseline gap-2">
            <span className="font-num text-[10px] text-ink-400 w-14 shrink-0">
              {p.code}
            </span>
            <span className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-ink-900">
                {p.label}
              </span>
              {p.sublabel && (
                <span className="text-[11.5px] text-ink-500 ml-1.5">
                  · {p.sublabel}
                </span>
              )}
            </span>
            <span className="font-num text-[12px] text-ink-900 shrink-0">
              {p.price.toLocaleString()}원
            </span>
          </li>
        ))}
      </ul>

      {option.supplementaryPicks.length > 0 && (
        <div className="bg-ink-50 px-4 py-2.5 border-t border-ink-100">
          <div className="text-[10.5px] uppercase tracking-wider font-bold text-ink-500 mb-1.5">
            잔여 예산 보완 제안
          </div>
          <ul className="space-y-1">
            {option.supplementaryPicks.map((p) => (
              <li
                key={p.key}
                className="flex items-baseline gap-2 text-[12px]"
              >
                <span className="font-num text-[10px] text-ink-400 w-14">
                  {p.code}
                </span>
                <span className="flex-1 text-ink-700">{p.label}</span>
                <span className="font-num text-ink-700">
                  {p.price.toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {option.reasons.length > 0 && (
        <div className="px-4 py-3 bg-canvas border-t border-ink-100">
          <div className="text-[10.5px] uppercase tracking-wider font-bold text-ink-500 mb-1.5">
            권장 사유
          </div>
          <ul className="space-y-1 text-[12.5px] text-ink-700 leading-relaxed">
            {option.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-ink-400 mt-2 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 py-3 border-t border-ink-100 flex items-center justify-between gap-2 flex-wrap">
        <Link
          href={`/${eventId}/compare?ids=${encodeURIComponent(
            option.picks.map((p) => p.key).join(",")
          )}`}
          onClick={onClose}
          className="text-[11.5px] text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline"
        >
          비교 페이지에서 보기 →
        </Link>
        <button
          type="button"
          onClick={addAll}
          disabled={allInCart}
          className={
            "px-3.5 py-2 rounded-pill text-[12px] font-bold flex items-center gap-1.5 " +
            (allInCart
              ? "bg-ink-100 text-ink-500"
              : isMain
                ? "bg-brand-500 text-white hover:bg-brand-700"
                : "bg-ink-900 text-white hover:bg-ink-700")
          }
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          {allInCart ? "담겨있음" : "이 구성으로 담기"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 추천 로직 (rule-based, 다요인 가중치)
// ============================================================================

function ackFor(stage: Stage, c: Collected): string {
  switch (stage) {
    case "goal":
      return `${c.purposeLabel} 목표로 검토합니다.`;
    case "budget":
      return `${c.budgetLabel} 범위 내 구성으로 한정합니다.`;
    case "segment":
      return `${c.segmentLabel} 분야 효율 채널을 우선 반영합니다.`;
    case "companySize":
      return `${c.companySizeLabel} 규모에 적합한 구성으로 조정합니다.`;
    case "experience":
      return c.experience === "first"
        ? "신규 참가 — 진입 채널 중심으로 권장합니다."
        : c.experience === "regular"
          ? "정기 참가 — 시그니처·풀패키지 후보를 포함합니다."
          : "확장 후보까지 함께 검토합니다.";
    case "result":
      return "";
  }
}

function buildSummary(c: Collected): string {
  const parts: string[] = ["응답 요약입니다."];
  if (c.purposeLabel) parts.push(`· 목표: ${c.purposeLabel}`);
  if (c.budgetLabel) parts.push(`· 예산: ${c.budgetLabel}`);
  if (c.segmentLabel) parts.push(`· 분야: ${c.segmentLabel}`);
  if (c.companySizeLabel) parts.push(`· 규모: ${c.companySizeLabel}`);
  if (c.experienceLabel) parts.push(`· 참가 이력: ${c.experienceLabel}`);
  parts.push("");
  parts.push(
    "위 응답을 기반으로 권장안 / 대안 / 절감안 세 가지 구성을 제안드립니다."
  );
  return parts.join("\n");
}

/**
 * K-PRINT 기준 다층 가중치 스코어링.
 * 분야(segment)·예산이 가장 무거운 가중치. 어드민 페이지에서 SCORING_WEIGHTS 그대로 확인 가능.
 */
/**
 * 페르소나 별 점수 (높을수록 적합).
 * 2026-05 사용자 정의 가중치: 목표 +35, 예산 범위 +30, 분야 +20, 규모 +20, 경험 ±15,
 * 예산 초과 -50, 예산 미달 -25. 평균 거리 패널티 제거.
 */
export function findBestPersona(
  personas: Persona[],
  c: Collected
): Persona | null {
  return scoreAllPersonas(personas, c)[0]?.persona ?? null;
}

/** 모든 페르소나의 점수를 내림차순으로 반환 — 3-옵션 결과(권장/대안/절감) 구성 시 사용. */
export function scoreAllPersonas(
  personas: Persona[],
  c: Collected
): Array<{ persona: Persona; score: number; reasons: string[] }> {
  const active = personas.filter((p) => p.isActive);
  if (active.length === 0) return [];

  const W = SCORING_WEIGHTS;

  const scored = active.map((p) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. 목표(GOAL) — 가장 강한 결정 요인
    if (c.purpose && p.purposes?.includes(c.purpose)) {
      score += W.goalMatch;
      reasons.push(`목표 「${c.purposeLabel}」 일치 (+${W.goalMatch})`);
    }

    // 2. 예산 — 범위 적합 +30, 초과 -50, 미달 -25 (평균 거리 패널티 제거)
    if (c.budget !== undefined) {
      const min = p.budgetMin ?? 0;
      const max = p.budgetMax ?? Number.POSITIVE_INFINITY;
      if (c.budget >= min && c.budget <= max) {
        score += W.budgetInRange;
        reasons.push(`예산 범위 적합 (+${W.budgetInRange})`);
      } else if (c.budget < min) {
        score -= W.budgetUnderPenalty;
        reasons.push(`예산 미달 (-${W.budgetUnderPenalty})`);
      } else {
        score -= W.budgetOverPenalty;
        reasons.push(`예산 초과 (-${W.budgetOverPenalty})`);
      }
    }

    // 3. 분야(SEGMENT)
    if (c.segment) {
      const tags = (p.targetTags ?? []).map((t) => t.toLowerCase());
      const idLow = p.id.toLowerCase();
      const titleLow = p.title.toLowerCase();
      const segKeywords: Record<Segment, string[]> = {
        offset: ["offset", "인쇄", "오프셋"],
        digital: ["digital", "디지털", "pod"],
        packaging: ["packaging", "패키지", "박스"],
        label: ["label", "라벨", "스티커"],
        post_press: ["post", "후가공", "바인딩"],
        sign: ["sign", "사인", "디스플레이"],
        supply: ["supply", "잉크", "소재", "기자재"],
        other: [],
      };
      const kws = segKeywords[c.segment];
      if (
        kws.some(
          (kw) =>
            tags.includes(kw) || idLow.includes(kw) || titleLow.includes(kw)
        )
      ) {
        score += W.segmentMatch;
        reasons.push(`분야 「${c.segmentLabel}」 일치 (+${W.segmentMatch})`);
      }
    }

    // 4. 회사 규모
    if (c.companySize === "large" && p.packageTier === "signature") {
      score += W.companySizeLarge;
      reasons.push(`대기업 + 시그니처 정합 (+${W.companySizeLarge})`);
    }
    if (
      c.companySize === "solo" &&
      (p.title.includes("진입") ||
        p.title.includes("단품") ||
        (p.budgetMax && p.budgetMax < 10_000_000))
    ) {
      score += W.companySizeSolo;
      reasons.push(`1인 + 단품 정합 (+${W.companySizeSolo})`);
    }

    // 5. 참가 경험
    if (c.experience === "first") {
      if (
        p.id.endsWith("first-time") ||
        p.title.includes("처음") ||
        p.title.includes("신규")
      ) {
        score += W.experienceFirst;
        reasons.push(`신규 + 진입형 (+${W.experienceFirst})`);
      }
      if (p.packageTier === "signature") {
        score -= 10;
        reasons.push("신규 + 시그니처 부적합 (-10)");
      }
    }
    if (c.experience === "regular") {
      if (
        p.packageTier === "signature" ||
        p.title.includes("정기") ||
        p.title.includes("프리미엄")
      ) {
        score += W.experienceRegular;
        reasons.push(`정기 + 시그니처 정합 (+${W.experienceRegular})`);
      }
    }

    return { persona: p, score, reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function computeCombo(
  persona: Persona,
  categories: Category[],
  subcategories: Subcategory[],
  slots: Slot[],
  packages: Package[],
  c: Collected,
  effectiveWeights: typeof SCORING_WEIGHTS
): Pick[] {
  const picks: Pick[] = [];
  const budget = c.budget ?? Number.POSITIVE_INFINITY;
  const targetPurpose = c.purpose ?? persona.purposes?.[0];

  type Scored = {
    cat: Category;
    sub: Subcategory;
    slot: Slot;
    score: number;
    reason: string;
  };

  const scored: Scored[] = [];

  for (const cat of categories) {
    // 페르소나 매칭 (명시 personas 우선, fallback tags)
    if (cat.personas?.length) {
      if (!cat.personas.includes(persona.id)) continue;
    } else if (persona.targetTags?.length) {
      const has = persona.targetTags.some((t) => (cat.tags ?? []).includes(t));
      if (!has) continue;
    }

    const subs = subcategories
      .filter((s) => s.categoryId === cat.id)
      .sort((a, b) => a.priceKRW - b.priceKRW);
    const sub = subs[0];
    if (!sub) continue;
    const slot = slots.find(
      (s) => s.subcategoryId === sub.id && s.status === "available"
    );
    if (!slot) continue;
    if (sub.priceKRW > budget) continue;

    const purposes = derivePurposes(cat);
    const reasons: string[] = [];

    let score = 0;

    if (targetPurpose && purposes.includes(targetPurpose)) {
      score += 50;
      reasons.push(
        targetPurpose === "traffic_driver"
          ? "동선 위 노출"
          : targetPurpose === "brand_awareness"
            ? "브랜드 인지도"
            : targetPurpose === "buyer_reach"
              ? "바이어 도달"
              : "콘텐츠 자산"
      );
    }
    // 목표(GOAL)에서 자동 추출된 채널 매칭 — 카테고리 타입 기반
    if (targetPurpose) {
      const purposeChannelTypes: Record<Purpose, string[]> = {
        traffic_driver: ["floor_plan", "quantity"], // 도면·등록데스크·목걸이
        brand_awareness: ["xpace", "floor_plan", "print_page"], // 옥외·천장·가이드북
        buyer_reach: ["mailing", "print_page"], // 해외 NL · 가이드북
        post_asset: ["content", "mailing"], // SNS·뉴스레터
      };
      const types = purposeChannelTypes[targetPurpose] ?? [];
      if (types.includes(cat.type)) {
        score += effectiveWeights.channelMatch;
        reasons.push("목표 채널 적합");
      }
    }
    // 잔여 1자리 보너스 (희소성)
    const sameSubAvailableSlots = slots.filter(
      (s) => s.subcategoryId === sub.id && s.status === "available"
    ).length;
    if (sameSubAvailableSlots === 1) {
      score += effectiveWeights.lastSlotBonus;
      reasons.push(`잔여 1자리 (+${effectiveWeights.lastSlotBonus})`);
    }
    // 단독 채널 보너스 — 카테고리에 슬롯이 1개뿐 (희소·시그니처)
    const totalSlotsForCat = slots.filter(
      (s) => s.categoryId === cat.id
    ).length;
    if (totalSlotsForCat === 1) {
      score += effectiveWeights.soloChannelBonus;
      reasons.push(`단독 채널 (+${effectiveWeights.soloChannelBonus})`);
    }
    // 분야(segment) 별 채널 보너스
    if (c.segment === "digital" && (cat.type === "digital_banner" || cat.type === "mailing")) {
      score += 30;
      reasons.push("디지털인쇄 분야 — 온라인 채널 적합");
    }
    if (c.segment === "packaging" && (cat.type === "print_page" || cat.type === "floor_plan")) {
      score += 25;
      reasons.push("패키징 분야 — 도면·샘플북 적합");
    }
    if (c.segment === "sign" && cat.type === "xpace") {
      score += 30;
      reasons.push("사인 분야 — 옥외·전광판 적합");
    }
    if (c.segment === "supply" && (cat.type === "quantity" || cat.type === "media")) {
      score += 20;
      reasons.push("소재·기자재 — 참관객 도달 적합");
    }
    // 회사 규모 별 가격 적합도
    if (c.companySize === "solo" && sub.priceKRW < 5_000_000) {
      score += 20;
      reasons.push("1인·스타트업 친화 가격");
    }
    if (c.companySize === "large" && sub.priceKRW >= 10_000_000) {
      score += 15;
      reasons.push("대기업 규모 효율");
    }
    if (c.experience === "first" && sub.priceKRW < 5_000_000) {
      score += 15;
      reasons.push("진입 친화 가격");
    }
    if (c.experience === "regular" && cat.isFeatured) {
      score += 10;
      reasons.push("주력 채널");
    }
    if (cat.isFeatured) score += 5;
    // 가격 보너스 — 저렴할수록 살짝 가산 (작은 단위)
    score += Math.max(0, 10 - sub.priceKRW / 2_000_000);

    scored.push({
      cat,
      sub,
      slot,
      score,
      reason: reasons.slice(0, 2).join(" · ") || "페르소나 매칭",
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // 예산 안에서 최대 3개 — 다양성 위해 타입 중복 회피
  const usedTypes = new Set<string>();
  let spent = 0;
  for (const { cat, sub, slot, reason } of scored) {
    if (picks.length >= 3) break;
    if (usedTypes.has(cat.type) && picks.length >= 1) {
      // 한 번은 같은 타입도 허용하되 2개 이상 같은 타입은 회피
      const sameCount = picks.filter((p) => {
        const cId = p.categoryId;
        return cId && categories.find((cc) => cc.id === cId)?.type === cat.type;
      }).length;
      if (sameCount >= 1) continue;
    }
    if (spent + sub.priceKRW > budget && picks.length > 0) continue;
    picks.push({
      key: `slot:${slot.id}`,
      kind: "slot",
      label: cat.name.ko,
      sublabel: sub.name.ko,
      code: slot.code,
      price: sub.priceKRW,
      reason,
      slotId: slot.id,
      categoryId: cat.id,
      subcategoryId: sub.id,
      eventId: cat.eventId,
    });
    spent += sub.priceKRW;
    usedTypes.add(cat.type);
  }

  // 패키지 — 예산 여유 + experience 가 "처음"이 아니면 추천
  if (
    persona.packageTier &&
    c.experience !== "first" &&
    picks.length < 4 // 너무 많이 안 채움
  ) {
    const pkg = packages
      .filter((p) => p.tier === persona.packageTier)
      .find((p) => {
        const cost = p.discountPrice || p.originalPrice;
        return spent + cost <= budget;
      });
    if (pkg) {
      picks.push({
        key: `pkg:${pkg.id}`,
        kind: "package",
        label: pkg.name.ko,
        sublabel: pkg.tier === "signature" ? "Signature" : "Standard",
        code: pkg.code,
        price: pkg.discountPrice || pkg.originalPrice,
        reason: "단품 합산 대비 할인 + 통합 노출",
        packageId: pkg.id,
        eventId: pkg.eventId,
      });
    }
  }

  return picks;
}

// ============================================================================
// 페르소나 코스 트리거 버튼
// ============================================================================

export function PersonaAiChatTrigger({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full md:w-auto bg-ink-900 text-white px-5 py-3 rounded-pill text-[13px] font-bold hover:bg-brand-500 transition-colors flex items-center gap-2 shadow-glow-sm hover:shadow-glow"
    >
      <Sparkles className="w-4 h-4" />
      대화로 추천 받기
      <span className="text-[11px] font-num text-white/70 group-hover:text-white">
        5문항 · 클릭만
      </span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}
