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
  | "segment"
  | "companySize"
  | "experience"
  | "goal"
  | "budget"
  | "channel"
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
// K-PRINT 는 KINTEX 한 곳 (Hall 7·8) 이라 "어디 홀" 질문은 의미 없음.
// 대신 노출 채널 선호를 묻는 것이 실제 추천에 더 유용.
type ChannelPref =
  | "entry"        // 등록데스크, 사전등록 페이지, 참관객 목걸이 (입구 동선)
  | "booth"        // 천장배너, 도면 검색 (부스 노출)
  | "online"       // 참가업체·전시품 검색, 뉴스레터
  | "seminar"      // 세미나·컨퍼런스 페이지
  | "guide_print"  // 가이드북, 초대장 삽지 (인쇄물)
  | "any";

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
  channel?: ChannelPref;
  channelLabel?: string;
};

type Msg = { role: "user" | "bot"; content: string };

export type Chip = { label: string; value: string; hint?: string };

export const STAGES: Stage[] = [
  "segment",
  "companySize",
  "experience",
  "goal",
  "budget",
  "channel",
];

/**
 * K-PRINT 스폰서십 진단 — 6단계 (분야 lead).
 * 사용자 지적: "참가 경험"보다 "어떤 분야 회사이신가" 가 훨씬 강한 lead question.
 * 분야가 정해지면 그에 맞는 채널·예산 가이드가 즉시 나옴.
 */
export const QUESTIONS: Record<
  Stage,
  { intro: string; chips?: Chip[]; why?: string }
> = {
  segment: {
    intro: "어떤 분야의 회사이신가요?",
    why: "분야 기준으로 가장 효율 좋은 노출 채널이 달라집니다. (예: 패키징은 샘플북·도면 / 디지털인쇄는 온라인 우선)",
    chips: [
      { label: "🖨 일반 인쇄 (오프셋·UV)", value: "offset", hint: "도면·옥외 + 검색 페이지" },
      { label: "💻 디지털 인쇄·POD", value: "digital", hint: "온라인 배너 + 뉴스레터 우선" },
      { label: "📦 패키징·박스", value: "packaging", hint: "샘플북·도면 우선" },
      { label: "🏷 라벨·스티커", value: "label", hint: "시그니처 + 도면" },
      { label: "✂ 후가공·바인딩", value: "post_press", hint: "쇼가이드 + 검색" },
      { label: "🪧 사인·디스플레이", value: "sign", hint: "옥외 + 전광판" },
      { label: "⚙ 잉크·소재·기자재", value: "supply", hint: "참관객 목걸이 + 쇼가이드" },
      { label: "기타 / 정하지 않음", value: "other" },
    ],
  },
  companySize: {
    intro: "회사 규모는 어느 정도이신가요?",
    why: "규모는 예산 가용성과 패키지 적합도에 영향. 1인·스타트업은 단품 위주, 중견·대기업은 시그니처 통합 패키지가 효율적.",
    chips: [
      { label: "👤 1인 / 스타트업 (1-5명)", value: "solo", hint: "단품·진입 채널" },
      { label: "👥 소기업 (5-30명)", value: "small", hint: "프라임 스팟 + 단품" },
      { label: "🏢 중견 (30-100명)", value: "mid", hint: "패키지 권장" },
      { label: "🏛 대기업 (100명+)", value: "large", hint: "시그니처 패키지 + 통합 노출" },
    ],
  },
  experience: {
    intro: "이번이 K-PRINT 참가는 어떻게 되시나요?",
    why: "신규 참가는 진입 채널 (검색 페이지·뉴스레터) 위주, 재참가·정기 참가는 확장·시그니처 후보 우선.",
    chips: [
      { label: "🌱 신규 참가", value: "first", hint: "진입 채널 위주 추천" },
      { label: "♻️ 재참가 (전년)", value: "repeat", hint: "확장 후보 추천" },
      { label: "📌 정기 참가 (3년+)", value: "regular", hint: "프리미엄·시그니처 후보" },
    ],
  },
  goal: {
    intro: "이번 참가의 최우선 목표는 무엇입니까?",
    why: "목표에 따라 채널 믹스가 달라짐 — 부스 트래픽은 도면·목걸이, 브랜드는 전광판·천장배너, 해외는 영문 뉴스레터·쇼가이드.",
    chips: [
      { label: "🧭 부스로 사람 끌어오기 (트래픽)", value: "traffic_driver" },
      { label: "🚀 브랜드 인지도 확보", value: "brand_awareness" },
      { label: "🎯 해외/특정 바이어 도달", value: "buyer_reach" },
      { label: "📰 행사 후 콘텐츠 자산", value: "post_asset" },
    ],
  },
  budget: {
    intro: "전체 스폰서십 예산 범위를 알려주세요.",
    why: "예산은 추천에서 가장 무거운 가중치 — 범위를 벗어나는 항목은 자동 제외, 평균에 가까운 콤보 우선.",
    chips: [
      { label: "💰 500만원 이하", value: "5000000" },
      { label: "💰 500~1,500만원", value: "15000000" },
      { label: "💰 1,500~3,000만원", value: "30000000" },
      { label: "💰 3,000만원 이상", value: "100000000" },
    ],
  },
  channel: {
    intro: "어떤 노출 채널이 가장 중요하신가요?",
    why: "K-PRINT 는 KINTEX Hall 7·8 단일 회장 — 위치 분기 대신 채널 선호로 콤보를 조정. 「무관」 이면 효율 우선 자동 추천.",
    chips: [
      { label: "🚪 입구·등록 동선", value: "entry", hint: "등록데스크 · 사전등록 · 목걸이" },
      { label: "🏭 부스·홀 내부 노출", value: "booth", hint: "천장배너 · 도면 검색" },
      { label: "💻 온라인 검색·뉴스레터", value: "online", hint: "참가업체 · 전시품 검색 · 국내·해외 NL" },
      { label: "🎤 세미나·컨퍼런스", value: "seminar", hint: "세미나 페이지 배너" },
      { label: "📰 가이드북·초대장 인쇄물", value: "guide_print", hint: "GDB·IVL" },
      { label: "무관 — 효율 우선", value: "any" },
    ],
  },
  result: { intro: "" },
};

/**
 * 스코어링 가중치 — 어드민에서 확인 가능.
 * findBestPersona 가 이 가중치를 활용해 페르소나 별 점수를 계산.
 */
export const SCORING_WEIGHTS = {
  segmentMatch: 35,        // 분야 일치 (가장 강함)
  budgetInRange: 30,       // 예산 범위 일치
  budgetDistancePenalty: 0.00000005, // 평균과의 거리 * 이 값 만큼 감점
  experienceFirst: 25,     // 신규 + 진입형 페르소나
  experienceRegular: 15,   // 정기 + 시그니처 페르소나
  companySizeLarge: 20,    // 대기업 + 시그니처 가중
  companySizeSolo: 15,     // 1인 + 단품 가중
  goalMatch: 20,           // 목표(purpose) 일치
  channelMatch: 18,        // 채널 일치 (K-PRINT 는 채널이 의미 있음)
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
  initialSegment,
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
  /** 페이지에서 첫 질문(분야) 칩을 미리 누르고 열었을 때 — 모달은 바로 2번째 질문부터 */
  initialSegment?: Segment;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>("experience");
  const [collected, setCollected] = useState<Collected>({});
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 모달 열릴 때 초기화 (initialSegment 가 있으면 1번 질문 자동 답변 후 2번부터)
  useEffect(() => {
    if (!open) return;
    setMessages([
      {
        role: "bot",
        content:
          "안녕하세요. K-PRINT 스폰서십 어드바이저입니다. 6가지 짧게 여쭙고 가장 효율 좋은 노출 조합을 추천드릴게요. 답은 보기에서 클릭만 해주시면 됩니다.",
      },
    ]);
    setStage("segment");
    setCollected({});
    setThinking(false);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => say(QUESTIONS.segment.intro), 450));

    if (initialSegment) {
      const chip = QUESTIONS.segment.chips!.find(
        (c) => c.value === initialSegment
      );
      if (chip) {
        // intro 가 보인 직후, 사용자가 칩을 누른 것처럼 진행
        timers.push(
          setTimeout(() => {
            userSay(chip.label);
            const next: Collected = {
              segment: chip.value as Segment,
              segmentLabel: chip.label,
            };
            setCollected(next);
            advance(next, "segment");
          }, 1100)
        );
      }
    }

    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSegment]);

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
    if (stage === "segment") {
      next.segment = chip.value as Segment;
      next.segmentLabel = chip.label;
    } else if (stage === "companySize") {
      next.companySize = chip.value as CompanySize;
      next.companySizeLabel = chip.label;
    } else if (stage === "experience") {
      next.experience = chip.value as Experience;
      next.experienceLabel = chip.label;
    } else if (stage === "goal") {
      next.purpose = chip.value as Purpose;
      next.purposeLabel = chip.label;
    } else if (stage === "budget") {
      next.budget = parseInt(chip.value, 10);
      next.budgetLabel = chip.label.replace("💰 ", "");
    } else if (stage === "channel") {
      next.channel = chip.value as ChannelPref;
      next.channelLabel = chip.label;
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
        const persona = findBestPersona(personas, next);
        say(buildSummary(next, persona));
      }, 1100);
      return;
    }

    const nextStage = STAGES[idx + 1];
    setTimeout(() => {
      setStage(nextStage);
      say(QUESTIONS[nextStage].intro);
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

  // 추천 산출
  const persona = useMemo(
    () => (stage === "result" ? findBestPersona(personas, collected) : null),
    [stage, collected, personas]
  );
  const picks = useMemo(() => {
    if (stage !== "result" || !persona) return [];
    return computeCombo(
      persona,
      categories,
      subcategories,
      slots,
      packages,
      collected
    );
  }, [stage, persona, categories, subcategories, slots, packages, collected]);

  if (!open) return null;

  const currentChips = stage !== "result" ? QUESTIONS[stage].chips : undefined;
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
              <div className="w-9 h-9 rounded-full bg-brand-500 grid place-items-center shadow-glow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-num text-[10px] uppercase tracking-[0.3em] text-brand-500 font-bold">
                  추천 도우미
                </div>
                <h3 className="text-[15px] font-bold text-ink-900 leading-tight">
                  대화로 스폰서십 찾기
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

          {/* 결과 카드 */}
          {stage === "result" && persona && picks.length > 0 && (
            <ResultCard
              persona={persona}
              picks={picks}
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

function ResultCard({
  persona,
  picks,
  eventId,
  onClose,
}: {
  persona: Persona;
  picks: Pick[];
  eventId: string;
  onClose: () => void;
}) {
  const addSlot = useCartStore((s) => s.addSlot);
  const addPackage = useCartStore((s) => s.addPackage);
  const hasSlot = useCartStore((s) => s.hasSlot);
  const hasPackage = useCartStore((s) => s.hasPackage);

  const total = picks.reduce((sum, p) => sum + p.price, 0);
  const allInCart = picks.every((p) =>
    p.kind === "slot" && p.slotId
      ? hasSlot(p.slotId)
      : p.kind === "package" && p.packageId
        ? hasPackage(p.packageId)
        : false
  );

  const addAll = () => {
    for (const p of picks) {
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

  return (
    <div className="mt-4 bg-surface border-2 border-brand-500 rounded-card overflow-hidden shadow-glow-sm">
      <div className="bg-brand-grad text-white px-4 py-3">
        <div className="font-num text-[10px] uppercase tracking-[0.3em] text-white/80 font-bold flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          맞춤 추천
        </div>
        <h4 className="text-[16px] font-bold mt-1 leading-tight">
          {persona.emoji} {persona.title}
        </h4>
        {persona.socialProofNote && (
          <p className="text-[11.5px] text-white/85 mt-1.5">
            {persona.socialProofNote}
          </p>
        )}
      </div>

      <div className="px-4 py-3">
        <ul className="space-y-2.5">
          {picks.map((p) => (
            <li
              key={p.key}
              className="border-b border-ink-100 pb-2.5 last:border-b-0"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-num text-[10px] text-ink-300 w-14 shrink-0 mt-1">
                  {p.code}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-bold text-[13px] text-ink-900">
                    {p.label}
                  </span>
                  {p.sublabel && (
                    <span className="text-ink-500 text-[12px] ml-1.5">
                      · {p.sublabel}
                    </span>
                  )}
                </span>
                <span className="font-num text-[12.5px] font-bold text-ink-900 shrink-0">
                  {p.price.toLocaleString()}원
                </span>
              </div>
              {p.reason && (
                <div className="text-[11px] text-ink-500 mt-0.5 ml-16 leading-snug">
                  {p.reason}
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="font-num text-[14px] font-bold text-ink-900">
            합계 {total.toLocaleString()}원
            <span className="text-[10.5px] text-ink-500 ml-1.5 font-normal">
              (부가세 별도)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${eventId}/compare?ids=${encodeURIComponent(
                picks.map((p) => p.key).join(",")
              )}`}
              onClick={onClose}
              className="text-[11.5px] text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline"
            >
              비교 →
            </Link>
            <button
              type="button"
              onClick={addAll}
              disabled={allInCart}
              className={
                "px-3.5 py-2 rounded-pill text-[12px] font-bold flex items-center gap-1.5 transition-all " +
                (allInCart
                  ? "bg-ink-100 text-ink-500"
                  : "bg-brand-500 text-white hover:bg-brand-700 hover:shadow-glow-sm")
              }
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {allInCart ? "담겨있어요" : "한 번에 담기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 추천 로직 (rule-based, 다요인 가중치)
// ============================================================================

function ackFor(stage: Stage, c: Collected): string {
  switch (stage) {
    case "segment":
      return `${c.segmentLabel} 분야시군요. 그 분야 효율 좋은 채널 위주로 보겠습니다.`;
    case "companySize":
      return c.companySize === "solo"
        ? "단품·진입 채널 우선으로 추리겠습니다."
        : c.companySize === "large"
          ? "통합 시그니처 패키지 후보도 함께 보여드릴게요."
          : `${c.companySizeLabel} 규모에 맞는 조합으로 짜드릴게요.`;
    case "experience":
      return c.experience === "first"
        ? "신규 참가시면 안정적인 진입 채널 위주로 잡아드릴게요."
        : c.experience === "regular"
          ? "정기 참가시면 시그니처·풀패키지 후보도 같이 봐드릴게요."
          : "확장 후보까지 같이 보겠습니다.";
    case "goal":
      return `좋아요. 「${c.purposeLabel}」 우선으로 잡고 가겠습니다.`;
    case "budget":
      return `예산 ${c.budgetLabel} 안에서 조합해드릴게요.`;
    case "channel":
      return c.channel === "any"
        ? "채널은 효율 좋은 쪽으로 자동 선정합니다."
        : `${c.channelLabel} 채널 가중치 두고 추리겠습니다.`;
    case "result":
      return "";
  }
}

function buildSummary(c: Collected, persona: Persona | null): string {
  const parts: string[] = ["정리하면:"];
  if (c.segmentLabel) parts.push(`· 분야: ${c.segmentLabel.replace(/^.+?\s/, "")}`);
  if (c.companySizeLabel) parts.push(`· 규모: ${c.companySizeLabel.replace(/^.+?\s/, "")}`);
  if (c.experienceLabel) parts.push(`· 경험: ${c.experienceLabel.replace(/^.+?\s/, "")}`);
  if (c.purposeLabel) parts.push(`· 목적: ${c.purposeLabel.replace(/^.+?\s/, "")}`);
  if (c.budgetLabel) parts.push(`· 예산: ${c.budgetLabel}`);
  if (c.channel && c.channel !== "any" && c.channelLabel)
    parts.push(`· 채널: ${c.channelLabel.replace(/^.+?\s/, "")}`);
  parts.push("");
  if (persona) {
    parts.push(
      `이 상황엔 「${persona.emoji} ${persona.title}」 코스가 가장 맞아요.`
    );
    if (persona.budgetNote)
      parts.push(`💰 ${persona.budgetNote}`);
  }
  parts.push("");
  parts.push("아래 콤보 확인하시고, 마음에 들면 한 번에 카트에 담으세요.");
  return parts.join("\n");
}

/**
 * K-PRINT 기준 다층 가중치 스코어링.
 * 분야(segment)·예산이 가장 무거운 가중치. 어드민 페이지에서 SCORING_WEIGHTS 그대로 확인 가능.
 */
export function findBestPersona(
  personas: Persona[],
  c: Collected
): Persona | null {
  const active = personas.filter((p) => p.isActive);
  if (active.length === 0) return null;

  const W = SCORING_WEIGHTS;

  const scored = active.map((p) => {
    let score = 0;

    // 1. 분야(segment) 매칭 — 페르소나 targetTags 또는 id 에 분야가 들어있으면 강한 가중
    if (c.segment) {
      const tags = (p.targetTags ?? []).map((t) => t.toLowerCase());
      const idLow = p.id.toLowerCase();
      const titleLow = p.title.toLowerCase();
      const segKey = c.segment;
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
      const kws = segKeywords[segKey];
      if (
        kws.some(
          (kw) =>
            tags.includes(kw) || idLow.includes(kw) || titleLow.includes(kw)
        )
      ) {
        score += W.segmentMatch;
      }
    }

    // 2. 예산 범위 매칭 — 범위 안이면 +30, 평균 가까울수록 감점 작게
    if (c.budget !== undefined) {
      const min = p.budgetMin ?? 0;
      const max = p.budgetMax ?? Number.POSITIVE_INFINITY;
      if (c.budget >= min && c.budget <= max) score += W.budgetInRange;
      const mid = (min + Math.min(max, 100_000_000)) / 2;
      score -= Math.abs(c.budget - mid) * W.budgetDistancePenalty;
    }

    // 3. 참가 경험
    if (c.experience === "first") {
      if (p.id.endsWith("first-time") || p.title.includes("처음") || p.title.includes("신규"))
        score += W.experienceFirst;
      if (p.packageTier === "signature") score -= 10;
    }
    if (c.experience === "regular") {
      if (p.packageTier === "signature" || p.title.includes("정기") || p.title.includes("프리미엄"))
        score += W.experienceRegular;
    }

    // 4. 회사 규모
    if (c.companySize === "large" && p.packageTier === "signature")
      score += W.companySizeLarge;
    if (
      c.companySize === "solo" &&
      (p.title.includes("진입") || p.title.includes("단품") || p.budgetMax && p.budgetMax < 10_000_000)
    )
      score += W.companySizeSolo;

    // 5. 목표 매칭 (purpose)
    if (c.purpose && p.purposes?.includes(c.purpose)) score += W.goalMatch;

    // 6. 채널 — K-PRINT 단일 회장 (Hall 7·8) 이라 위치 대신 채널 일치 가중
    if (c.channel && c.channel !== "any") {
      const channelKeywords: Record<ChannelPref, string[]> = {
        entry: ["입구", "등록", "목걸이", "사전등록"],
        booth: ["부스", "천장", "도면", "홀"],
        online: ["온라인", "검색", "뉴스레터", "메일"],
        seminar: ["세미나", "컨퍼런스"],
        guide_print: ["가이드", "초대", "인쇄물"],
        any: [],
      };
      const kws = channelKeywords[c.channel];
      const titleLow = p.title.toLowerCase();
      if (kws.some((kw) => titleLow.includes(kw))) score += W.channelMatch;
    }

    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.p ?? active[0];
}

function computeCombo(
  persona: Persona,
  categories: Category[],
  subcategories: Subcategory[],
  slots: Slot[],
  packages: Package[],
  c: Collected
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
    // 채널 매칭 — 카테고리 타입 기반
    if (c.channel && c.channel !== "any") {
      const channelTypes: Record<ChannelPref, string[]> = {
        entry: ["quantity"],                   // 등록데스크·목걸이 = quantity
        booth: ["floor_plan", "xpace"],        // 도면·천장배너
        online: ["digital_banner", "mailing"],
        seminar: ["content"],                  // 세미나 페이지
        guide_print: ["print_page"],           // 가이드북·삽지
        any: [],
      };
      const types = channelTypes[c.channel];
      if (types.includes(cat.type)) {
        score += 40;
        reasons.push(`${c.channelLabel} 채널 매칭`);
      }
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
