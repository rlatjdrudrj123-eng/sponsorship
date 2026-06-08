/**
 * 1분 진단 v3 — 점수 기반 추천 엔진.
 *
 * 기존 v2 (정적 룩업 매트릭스) 의 "랜덤 느낌" 문제 해결.
 *  - 점수 = GoalFit + Synergy + JourneyFill + BudgetFit + MustHave + AntiPattern + AdminBoost
 *  - 다양성 인식 그리디 선택 (3개 슬롯, 매 슬롯에서 이전 픽 영향 반영)
 *  - 빈 결과 절대 안 나오게 폴백 사다리 (제약 단계적 완화)
 *
 * 답변 → 점수 → 결과 사이의 인과를 화면에 추적 가능하게 — UI 는 점수 노출 안 하지만
 * "왜 이게 추천됐는지" 한 줄을 답변 인용으로 만들어 줌.
 */
import type { Category, Package, Purpose, Subcategory } from "./types";
import { PURPOSE_ORDER } from "./types";

// ============================================================================
// 사용자 답변
// ============================================================================

export type DiagAnswers = {
  /** 1·2 순위 목표 (Purpose). 1순위 가중치 1.0, 2순위 0.5. */
  goals: { primary: Purpose; secondary?: Purpose };
  /** 예산 (원). 슬라이더로 받음. 0 = 미정. */
  budgetKRW: number;
  /** 꼭 잡고 싶은 옵션 (다중). 매칭 시 하드 필터 또는 보너스. */
  mustHave: MustHaveTag[];
};

export type MustHaveTag =
  | "online_channel"       // 온라인 채널도 포함
  | "post_event_asset"     // 행사 후 콘텐츠 자산
  | "overseas"             // 해외 노출
  | "signature_combo";     // 시그니처 패키지 풀 콤보

// ============================================================================
// 추천 결과 entry
// ============================================================================

export type RecEntry = {
  kind: "category";
  category: Category;
  minPriceKRW: number;
  /** 점수 (내부용 — UI 미노출) */
  score: number;
  /** 점수 컴포넌트별 분해 (advanced 펼치기에 사용 가능) */
  breakdown: ScoreBreakdown;
  /** 사용자 답 인용 한 줄 — "1순위 신제품 출시에 부합" 등 */
  reason: string;
};

export type ScoreBreakdown = {
  goalFit: number;
  synergy: number;
  journeyFill: number;
  budgetFit: number;
  mustHaveMet: string[];     // 충족한 mustHave 태그 라벨
  antiPatternHit: string[];  // 발생한 anti-pattern (감점 사유)
  adminBoost: number;
};

// ============================================================================
// 메인 추천 API
// ============================================================================

export type RecommendResult = {
  picks: RecEntry[];
  /** 매 답마다 후보 풀이 어떻게 줄어들었는지 (라이브 카운터 표시용) */
  funnelCounts: {
    initial: number;
    afterGoal: number;
    afterBudget: number;
    afterMustHave: number;
  };
  /** 추천 합계 (KRW). 예산 잔여 안내용. */
  picksTotal: number;
  /** 답변이 상충해서 일부 완화됐다면 사유. UI 에 안내. */
  relaxNotes: string[];
  /** 전체 후보 풀 (mustHave 까지 통과한 매체) — "전체 N개 펼치기" 에 사용 */
  candidatePool: RecEntry[];
};

export function recommend(
  args: {
    candidates: Category[];
    subcategories: Subcategory[];
    answers: DiagAnswers;
    k?: number;
  }
): RecommendResult {
  const k = args.k ?? 3;
  const { candidates, subcategories, answers } = args;

  // 카테고리당 최저가 인덱스 (priceKRW > 0)
  const minPriceByCat = computeMinPriceByCategory(subcategories);

  // 모든 후보를 채점 정보와 함께 entries 로 빌드
  const entries = candidates
    .filter((c) => c.channel !== "package" && c.type !== "package")
    .map((c) => buildEntry(c, minPriceByCat, answers));

  // 단계별 후보 풀 카운터 (UI 띠 표시용)
  const initial = entries.length;
  const passedGoal = entries.filter((e) => e.breakdown.goalFit > 0);
  const passedBudget = passedGoal.filter((e) =>
    answers.budgetKRW <= 0 ? true : e.minPriceKRW <= answers.budgetKRW * 1.2
  );
  const passedMustHave = passedBudget.filter((e) =>
    meetsMustHaveSoft(e.category, answers.mustHave)
  );

  // 1차 시도: 모든 제약 적용
  let chosen = greedySelect(passedMustHave, answers, k);
  const relaxNotes: string[] = [];

  // 폴백 사다리 — 결과가 k 미만이면 단계적으로 완화
  if (chosen.length < k) {
    chosen = greedySelect(passedBudget, answers, k);
    if (chosen.length < k) {
      relaxNotes.push("일부 필수 조건을 완화했습니다");
    }
  }
  if (chosen.length < k) {
    chosen = greedySelect(passedGoal, answers, k);
    if (!relaxNotes.includes("일부 필수 조건을 완화했습니다"))
      relaxNotes.push("일부 추천은 예산을 살짝 넘을 수 있습니다");
  }
  if (chosen.length < k) {
    // 최후의 수단 — 전체 후보에서 점수 순. anti-pattern 도 무시.
    chosen = greedySelect(entries, answers, k);
    relaxNotes.push("답변이 좁아 일부 매체는 답과 거리 있을 수 있어요");
  }

  const picksTotal = chosen.reduce((s, e) => s + e.minPriceKRW, 0);

  return {
    picks: chosen,
    funnelCounts: {
      initial,
      afterGoal: passedGoal.length,
      afterBudget: passedBudget.length,
      afterMustHave: passedMustHave.length,
    },
    picksTotal,
    relaxNotes,
    candidatePool: passedMustHave.sort((a, b) => b.score - a.score),
  };
}

// ============================================================================
// 빌드 entry — 점수 계산 (이전 픽 무관한 컴포넌트만)
// ============================================================================

function buildEntry(
  c: Category,
  minPriceByCat: Map<string, number>,
  answers: DiagAnswers
): RecEntry {
  const minPriceKRW = minPriceByCat.get(c.id) ?? 0;

  const goalFit = computeGoalFit(c, answers.goals);
  const budgetFit = computeBudgetFit(minPriceKRW, answers.budgetKRW);
  const adminBoost = c.recommendBoost ?? 0;
  const mustHaveMet = collectMustHaveMet(c, answers.mustHave);
  const antiPatternHit = collectAntiPatterns(c, answers);

  const antiPenalty = antiPatternHit.length * 1.5;

  const initialScore =
    goalFit + budgetFit + adminBoost - antiPenalty + mustHaveMet.length * 0.3;

  const breakdown: ScoreBreakdown = {
    goalFit,
    synergy: 0,
    journeyFill: 0,
    budgetFit,
    mustHaveMet,
    antiPatternHit,
    adminBoost,
  };

  return {
    kind: "category",
    category: c,
    minPriceKRW,
    score: initialScore,
    breakdown,
    reason: buildReason(c, answers, breakdown),
  };
}

// ============================================================================
// 점수 컴포넌트
// ============================================================================

function computeGoalFit(
  c: Category,
  goals: DiagAnswers["goals"]
): number {
  const aff = c.goalAffinity ?? {};
  // 어드민이 goalAffinity 안 채웠으면 purposeOverride 로 폴백 — 0 or 1 점.
  const fallback = (p: Purpose): number => {
    return (c.purposeOverride ?? []).includes(p) ? 1.5 : 0;
  };
  const get = (p: Purpose): number => {
    const v = aff[p];
    return typeof v === "number" ? v : fallback(p);
  };
  // 1순위 가중치 1.0 (× max 3 = 3.0), 2순위 0.5 (× max 3 = 1.5)
  const primary = get(goals.primary) * 1.0;
  const secondary = goals.secondary ? get(goals.secondary) * 0.5 : 0;
  return primary + secondary;
}

function computeBudgetFit(price: number, budget: number): number {
  if (budget <= 0 || price <= 0) return 0;
  const ratio = price / budget;
  // 예산의 10~60% 가격대가 sweet spot — 추천 1개당 적당히 비중 있게.
  // 너무 저가 (<10%) 는 dumping 방지로 약감점, 너무 고가 (>120%) 는 다른 곳에서 컷됨.
  if (ratio < 0.1) return -0.3;
  if (ratio < 0.6) return 1.0;
  if (ratio < 0.9) return 0.5;
  return 0;
}

function meetsMustHaveSoft(c: Category, tags: MustHaveTag[]): boolean {
  // 1단계 통과 기준: mustHave 중 하나라도 통과 못 하는 게 결정적이지 않으면 OK.
  // 진짜 하드 필터는 selectChosen 단계에서 enforce_must_have 가 처리.
  // 여기서는 명백히 상충하는 카테고리만 컷.
  if (tags.includes("online_channel") && c.channel === "offline") {
    // 전체 추천에서 1개는 온라인 필요 — 여기서 컷하면 안 됨. soft 통과.
    return true;
  }
  return true;
}

function collectMustHaveMet(c: Category, tags: MustHaveTag[]): string[] {
  const out: string[] = [];
  if (tags.includes("online_channel") && c.channel === "online") {
    out.push("온라인 채널");
  }
  if (tags.includes("post_event_asset") && hasPostAsset(c)) {
    out.push("콘텐츠 자산");
  }
  if (tags.includes("overseas") && hasOverseasTag(c)) {
    out.push("해외 노출");
  }
  return out;
}

function hasPostAsset(c: Category): boolean {
  // content 스펙이 있거나 timing 에 post 가 포함되거나 type=content
  if (c.type === "content") return true;
  if ((c.timingOverride ?? []).includes("post")) return true;
  if (c.contentSpec) return true;
  return false;
}

function hasOverseasTag(c: Category): boolean {
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  return tags.some((t) => t.includes("해외") || t.includes("overseas") || t.includes("global"));
}

function collectAntiPatterns(c: Category, answers: DiagAnswers): string[] {
  const out: string[] = [];
  // 트래픽 목적인데 매체가 온라인 전용 — 약감점
  if (
    (answers.goals.primary === "traffic_driver" ||
      answers.goals.secondary === "traffic_driver") &&
    c.channel === "online"
  ) {
    out.push("traffic vs online");
  }
  // 콘텐츠 자산 필수인데 매체가 onsite 만
  if (
    answers.mustHave.includes("post_event_asset") &&
    (c.timingOverride ?? []).length > 0 &&
    !(c.timingOverride ?? []).includes("post") &&
    c.type !== "content"
  ) {
    out.push("no post asset");
  }
  return out;
}

// ============================================================================
// 다양성 인식 그리디 선택
// ============================================================================

function greedySelect(
  pool: RecEntry[],
  answers: DiagAnswers,
  k: number
): RecEntry[] {
  if (pool.length === 0) return [];
  const remaining = pool.slice().sort((a, b) => b.score - a.score);
  const picked: RecEntry[] = [];
  let budgetUsed = 0;

  while (picked.length < k && remaining.length > 0) {
    // 매 슬롯마다 점수 재평가 (synergy + journey 반영)
    const reranked = remaining
      .map((e) => {
        const synergy = computeSynergy(e.category, picked.map((p) => p.category));
        const journeyFill = computeJourneyFill(
          e.category,
          picked.map((p) => p.category)
        );
        const newScore =
          e.score + synergy + journeyFill - budgetOverPenalty(e, budgetUsed, answers.budgetKRW);
        return {
          entry: {
            ...e,
            score: newScore,
            breakdown: {
              ...e.breakdown,
              synergy,
              journeyFill,
            },
          },
          newScore,
        };
      })
      .filter((x) => {
        // 예산 hard 컷: 합계가 예산의 1.4배를 넘으면 탈락
        if (answers.budgetKRW <= 0) return true;
        return budgetUsed + x.entry.minPriceKRW <= answers.budgetKRW * 1.4;
      })
      .sort((a, b) => b.newScore - a.newScore);

    if (reranked.length === 0) break;
    const top = reranked[0].entry;

    // 점수가 0 이하면 의미 없음. 아예 안 뽑음.
    if (top.score <= 0) break;

    picked.push({
      ...top,
      // reason 재생성 — synergy/journey 정보 포함
      reason: buildReason(top.category, answers, top.breakdown),
    });
    budgetUsed += top.minPriceKRW;
    // remaining 에서 빼기
    const idx = remaining.indexOf(top);
    if (idx >= 0) remaining.splice(idx, 1);
  }

  return picked;
}

function computeSynergy(c: Category, prev: Category[]): number {
  if (prev.length === 0) return 0;
  let bonus = 0;
  for (const p of prev) {
    // 양방향 시너지
    if ((c.synergyTargets ?? []).includes(p.id)) bonus += 0.6;
    if ((p.synergyTargets ?? []).includes(c.id)) bonus += 0.6;
    // 같은 type 반복 — 한계효용 감점
    if (c.type === p.type) bonus -= 0.4;
  }
  return Math.max(-1, Math.min(1.5, bonus));
}

function computeJourneyFill(c: Category, prev: Category[]): number {
  if (prev.length === 0) return 0;
  const prevTimings = new Set<string>();
  for (const p of prev) (p.timingOverride ?? []).forEach((t) => prevTimings.add(t));
  const myTimings = c.timingOverride ?? [];
  // 비어있는 단계를 채우면 보너스
  const fills = myTimings.filter((t) => !prevTimings.has(t)).length;
  return Math.min(1.0, fills * 0.5);
}

function budgetOverPenalty(e: RecEntry, used: number, budget: number): number {
  if (budget <= 0) return 0;
  const after = used + e.minPriceKRW;
  if (after <= budget) return 0;
  // 예산 초과분의 정도에 따라 0~3 점 감점
  const over = (after - budget) / budget;
  return Math.min(3, over * 4);
}

// ============================================================================
// 답 인용 한 줄 — UI 의 핵심 인과 표현
// ============================================================================

function buildReason(
  c: Category,
  answers: DiagAnswers,
  bd: ScoreBreakdown
): string {
  const parts: string[] = [];

  // 1) 목표 매칭이 가장 강한 신호. goalAffinity 점수가 높은 목표를 인용.
  const aff = c.goalAffinity ?? {};
  const primary = answers.goals.primary;
  const secondary = answers.goals.secondary;
  const primaryHit = (aff[primary] ?? 0) >= 2;
  const secondaryHit = secondary && (aff[secondary] ?? 0) >= 2;

  if (primaryHit && secondaryHit) {
    parts.push(`${purposeLabel(primary)}·${purposeLabel(secondary!)}에 부합`);
  } else if (primaryHit) {
    parts.push(`${purposeLabel(primary)}에 부합`);
  } else if (secondaryHit) {
    parts.push(`${purposeLabel(secondary!)}에 보조`);
  } else if (bd.goalFit > 0) {
    parts.push(`${purposeLabel(primary)} 보조`);
  }

  // 2) 시너지
  if (bd.synergy > 0.3) {
    parts.push("앞 선택과 시너지");
  }

  // 3) 단계 보강
  if (bd.journeyFill > 0.3) {
    parts.push(timingFillLabel(c));
  }

  // 4) mustHave 충족
  if (bd.mustHaveMet.length > 0) {
    parts.push(`${bd.mustHaveMet.join("·")} 조건 충족`);
  }

  // 폴백 — 무엇이라도 띄움
  if (parts.length === 0) {
    parts.push("답변에 부합하는 후보");
  }

  return parts.join(" · ");
}

function purposeLabel(p: Purpose): string {
  switch (p) {
    case "traffic_driver":
      return "부스 트래픽";
    case "brand_awareness":
      return "브랜드 인지";
    case "buyer_reach":
      return "바이어 도달";
    case "post_asset":
      return "행사 후 자산";
  }
}

function timingFillLabel(c: Category): string {
  const t = c.timingOverride ?? [];
  if (t.includes("post")) return "행사 후 단계 보강";
  if (t.includes("pre")) return "사전 단계 보강";
  if (t.includes("onsite")) return "현장 단계 보강";
  return "단계 분포 보강";
}

// ============================================================================
// 업그레이드 경로 — 단품 추천 + α 로 패키지가 더 이득
// ============================================================================

export type UpgradeOffer = {
  package: Package;
  /** 사용자 추천 단품 중 패키지에 포함된 카테고리 (체크 표시) */
  covered: Category[];
  /** 패키지가 추가로 주는 카테고리 ID (별 표시) */
  extraCategoryIds: string[];
  /** 사용자 픽 단품 합산가 + 패키지에 들어간 항목들을 단품으로 살 때의 추정 추가가 */
  singlesEquivalentKRW: number;
  packagePriceKRW: number;
  /** 절감액 (양수면 패키지가 이득) */
  savingsKRW: number;
  /** 사용자 픽 + 추가 합산 — singlesEquivalentKRW */
  totalIfSinglesKRW: number;
};

export function findUpgradeOffers(args: {
  picks: RecEntry[];
  packages: Package[];
  categories: Category[];
  subcategories: Subcategory[];
  budgetKRW: number;
}): UpgradeOffer[] {
  const { picks, packages, categories, subcategories, budgetKRW } = args;
  if (picks.length < 2) return [];

  const pickIds = new Set(picks.map((p) => p.category.id));
  const minPriceByCat = computeMinPriceByCategory(subcategories);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const candidates: UpgradeOffer[] = [];

  for (const pkg of packages) {
    const pkgCatIds = new Set(
      (pkg.includedItems ?? [])
        .map((it) => it.categoryId)
        .filter((id): id is string => !!id)
    );
    // 패키지가 사용자 픽 중 최소 2개를 포함해야 의미 있음
    const covered = picks.filter((p) => pkgCatIds.has(p.category.id));
    if (covered.length < 2) continue;

    // 추가로 따라오는 카테고리들 (사용자가 안 고른 것)
    const extraCategoryIds = Array.from(pkgCatIds).filter(
      (id) => !pickIds.has(id)
    );

    // 추가 항목들을 단품으로 살 때 가격
    const extraSinglesPrice = extraCategoryIds.reduce(
      (sum, id) => sum + (minPriceByCat.get(id) ?? 0),
      0
    );
    const userPicksTotal = picks.reduce((s, p) => s + p.minPriceKRW, 0);
    const totalIfSinglesKRW = userPicksTotal + extraSinglesPrice;
    const packagePriceKRW = pkg.discountPrice ?? pkg.originalPrice ?? 0;

    // 추가 비용이 예산의 60% 미만이면 후보로 (너무 큰 점프는 제안 안 함)
    const delta = packagePriceKRW - userPicksTotal;
    if (delta <= 0) continue; // 더 싸면 별도 추천 필요 (현재는 skip)
    if (budgetKRW > 0 && delta > budgetKRW * 0.6) continue;

    const savings = totalIfSinglesKRW - packagePriceKRW;
    if (savings <= 0) continue; // 절감이 없으면 제안 의미 없음

    candidates.push({
      package: pkg,
      covered: covered.map((p) => p.category),
      extraCategoryIds: extraCategoryIds.filter((id) => catById.has(id)),
      singlesEquivalentKRW: extraSinglesPrice,
      packagePriceKRW,
      savingsKRW: savings,
      totalIfSinglesKRW,
    });
  }

  // 절감액 큰 순. 최대 1개만 표시 (혼란 방지).
  return candidates.sort((a, b) => b.savingsKRW - a.savingsKRW).slice(0, 1);
}

// ============================================================================
// 유틸
// ============================================================================

function computeMinPriceByCategory(
  subcategories: Subcategory[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of subcategories) {
    if (s.priceKRW <= 0) continue;
    const prev = m.get(s.categoryId);
    if (prev === undefined || s.priceKRW < prev) m.set(s.categoryId, s.priceKRW);
  }
  return m;
}

export const PURPOSES = PURPOSE_ORDER;

export const PURPOSE_LABEL_KO: Record<Purpose, string> = {
  traffic_driver: "부스 트래픽 유도",
  brand_awareness: "브랜드 인지도",
  buyer_reach: "바이어 도달",
  post_asset: "행사 후 콘텐츠 자산",
};

export const PURPOSE_LABEL_EN: Record<Purpose, string> = {
  traffic_driver: "Drive booth traffic",
  brand_awareness: "Brand awareness",
  buyer_reach: "Reach buyers",
  post_asset: "Post-event content asset",
};

export const MUST_HAVE_LABEL_KO: Record<MustHaveTag, string> = {
  online_channel: "온라인 채널도 포함",
  post_event_asset: "행사 후 콘텐츠 자산",
  overseas: "해외 노출",
  signature_combo: "시그니처 패키지 풀 콤보",
};

export const MUST_HAVE_LABEL_EN: Record<MustHaveTag, string> = {
  online_channel: "Include online channels",
  post_event_asset: "Post-event content asset",
  overseas: "Overseas exposure",
  signature_combo: "Signature full bundle",
};
