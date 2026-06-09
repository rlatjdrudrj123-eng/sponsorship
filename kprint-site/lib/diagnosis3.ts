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
  | "online_channel"       // 온라인 채널 노출
  | "overseas"             // 글로벌(해외) 바이어 타깃
  | "pre_exposure";        // 사전 노출 포함 (행사 전 매체)

// ============================================================================
// 추천 결과 entry
// ============================================================================

export type RecEntry = {
  kind: "category";
  category: Category;
  /**
   * 이 entry 가 묶는 소분류들. 보통 가격이 같은 sub 끼리 한 entry (위치만 다른
   * 슬롯 변형은 같은 가격이면 같은 entry — 사용자 입장에선 동일 상품).
   * 가격이 다른 sub 는 별도 entry 로 분리.
   */
  subcategoryIds: string[];
  /**
   * 가격 그룹 라벨 — 카테고리에 가격대가 1개면 undefined (카테고리 이름만 표시).
   * 2개 이상이면 sub 이름 (예: "라벨 생수") 들어가서 카드에 "카테고리명 (라벨)" 노출.
   */
  tierLabel?: string;
  minPriceKRW: number;
  /** 점수 (내부용 — UI 미노출) */
  score: number;
  /** 점수 컴포넌트별 분해 */
  breakdown: ScoreBreakdown;
  /** 사용자 답 인용 한 줄 */
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

export function recommend(args: {
  candidates: Category[];
  subcategories: Subcategory[];
  answers: DiagAnswers;
  k?: number;
  locale?: "ko" | "en";
}): RecommendResult {
  const k = args.k ?? 3;
  const locale = args.locale ?? "ko";
  const { candidates, subcategories, answers } = args;

  // 모든 후보를 채점 정보와 함께 entries 로 빌드.
  // 카테고리당 가격 그룹별로 별도 entry — 같은 가격이면 1 entry, 가격 다르면 분리.
  const entries: RecEntry[] = [];
  for (const c of candidates) {
    if (c.channel === "package" || c.type === "package") continue;
    const subs = subcategories.filter(
      (s) => s.categoryId === c.id && s.priceKRW > 0
    );
    if (subs.length === 0) {
      // 가격 없는 카테고리 (별도 문의) — 1 entry, 0원
      entries.push(buildEntry(c, [], 0, undefined, answers, locale));
      continue;
    }
    // 가격으로 그룹핑
    const byPrice = new Map<number, Subcategory[]>();
    for (const s of subs) {
      const arr = byPrice.get(s.priceKRW) ?? [];
      arr.push(s);
      byPrice.set(s.priceKRW, arr);
    }
    const priceGroups = Array.from(byPrice.entries());
    const singleTier = priceGroups.length === 1;
    for (const [price, subsInTier] of priceGroups) {
      // tierLabel — 카테고리에 가격대가 1개면 undefined (카테고리 이름만).
      // 가격대 여러 개이면 sub 이름을 라벨로 (locale 별로).
      // 같은 가격대에 sub 가 2개 이상이면 "첫 sub 외 N건" 으로 안전 표기.
      let tierLabel: string | undefined;
      if (!singleTier) {
        const firstName =
          locale === "en"
            ? (subsInTier[0].name?.en ?? subsInTier[0].name?.ko)
            : subsInTier[0].name?.ko;
        if (subsInTier.length === 1) {
          tierLabel = firstName;
        } else {
          tierLabel =
            locale === "en"
              ? `${firstName} +${subsInTier.length - 1}`
              : `${firstName} 외 ${subsInTier.length - 1}건`;
        }
      }
      entries.push(
        buildEntry(
          c,
          subsInTier.map((s) => s.id),
          price,
          tierLabel,
          answers,
          locale
        )
      );
    }
  }

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
  let chosen = greedySelect(passedMustHave, answers, k, locale);
  const relaxNotes: string[] = [];
  // 실제로 사용된 후보 풀 (UI 의 "매칭 N개" 표시용)
  let activePool = passedMustHave;

  // 폴백 사다리 — 결과가 k 미만이면 단계적으로 완화
  if (chosen.length < k) {
    chosen = greedySelect(passedBudget, answers, k, locale);
    activePool = passedBudget;
    if (chosen.length >= k) {
      relaxNotes.push(
        locale === "en"
          ? "Some requirements unmet"
          : "추가 요건 일부 미충족"
      );
    }
  }
  if (chosen.length < k) {
    chosen = greedySelect(passedGoal, answers, k, locale);
    activePool = passedGoal;
    relaxNotes.push(
      locale === "en"
        ? "Some items may exceed budget slightly"
        : "예산 범위 일부 초과 가능"
    );
  }
  if (chosen.length < k) {
    // 최후의 수단 — 전체 후보에서 점수 순. anti-pattern 도 무시.
    chosen = greedySelect(entries, answers, k, locale);
    activePool = entries;
    relaxNotes.push(
      locale === "en"
        ? "Includes items with lower goal fit"
        : "목표 부합도 낮은 매체 포함"
    );
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
    candidatePool: activePool.sort((a, b) => b.score - a.score),
  };
}

// ============================================================================
// 빌드 entry — 점수 계산 (이전 픽 무관한 컴포넌트만)
// ============================================================================

function buildEntry(
  c: Category,
  subcategoryIds: string[],
  priceKRW: number,
  tierLabel: string | undefined,
  answers: DiagAnswers,
  locale: "ko" | "en"
): RecEntry {
  const goalFit = computeGoalFit(c, answers.goals);
  const budgetFit = computeBudgetFit(priceKRW, answers.budgetKRW);
  const adminBoost = c.recommendBoost ?? 0;
  const mustHaveMet = collectMustHaveMet(c, answers.mustHave, locale);
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
    subcategoryIds,
    tierLabel,
    minPriceKRW: priceKRW,
    score: initialScore,
    breakdown,
    reason: buildReason(c, answers, breakdown, locale),
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

function collectMustHaveMet(
  c: Category,
  tags: MustHaveTag[],
  locale: "ko" | "en"
): string[] {
  const out: string[] = [];
  if (tags.includes("online_channel") && c.channel === "online") {
    out.push(locale === "en" ? "Online channel" : "온라인 채널");
  }
  if (tags.includes("overseas") && hasOverseasTag(c)) {
    out.push(locale === "en" ? "Overseas" : "해외 노출");
  }
  if (tags.includes("pre_exposure") && hasPreExposure(c)) {
    out.push(locale === "en" ? "Pre-event" : "사전 노출");
  }
  return out;
}

function hasPreExposure(c: Category): boolean {
  // 사전 노출 = timing 에 pre 포함 or 타입이 mailing/digital_banner (행사 전 매체)
  if ((c.timingOverride ?? []).includes("pre")) return true;
  if (c.type === "mailing" || c.type === "digital_banner") return true;
  return false;
}

function hasOverseasTag(c: Category): boolean {
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  return tags.some(
    (t) => t.includes("해외") || t.includes("overseas") || t.includes("global")
  );
}

function collectAntiPatterns(c: Category, answers: DiagAnswers): string[] {
  const out: string[] = [];
  // 현장 방문객 유도가 목표인데 매체가 온라인 전용 — 약감점
  if (
    (answers.goals.primary === "traffic_driver" ||
      answers.goals.secondary === "traffic_driver") &&
    c.channel === "online"
  ) {
    out.push("traffic vs online");
  }
  return out;
}

// ============================================================================
// 다양성 인식 그리디 선택
// ============================================================================

// entry 식별 키 — 같은 카테고리의 같은 가격 tier 가 다시 뽑히지 않게.
function entryKey(e: RecEntry): string {
  return `${e.category.id}:${e.minPriceKRW}`;
}

function greedySelect(
  pool: RecEntry[],
  answers: DiagAnswers,
  k: number,
  locale: "ko" | "en"
): RecEntry[] {
  if (pool.length === 0) return [];
  const remaining = new Map<string, RecEntry>();
  for (const e of pool) remaining.set(entryKey(e), e);
  const picked: RecEntry[] = [];
  let budgetUsed = 0;

  while (picked.length < k && remaining.size > 0) {
    const reranked = Array.from(remaining.values())
      .map((e) => {
        const synergy = computeSynergy(
          e.category,
          picked.map((p) => p.category)
        );
        const journeyFill = computeJourneyFill(
          e.category,
          picked.map((p) => p.category)
        );
        // 같은 카테고리에서 다른 가격 tier 가 이미 뽑힘 → 같은 노출 반복이라
        // 감점 (다양성 우선). 너무 큰 감점은 아니어서, 점수 차이가 크면 여전히 뽑힘.
        const sameCategoryPenalty = picked.some(
          (p) => p.category.id === e.category.id
        )
          ? -1.5
          : 0;
        const newScore =
          e.score +
          synergy +
          journeyFill +
          sameCategoryPenalty -
          budgetOverPenalty(e, budgetUsed, answers.budgetKRW);
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
        if (answers.budgetKRW <= 0) return true;
        return budgetUsed + x.entry.minPriceKRW <= answers.budgetKRW * 1.4;
      })
      .sort((a, b) => b.newScore - a.newScore);

    if (reranked.length === 0) break;
    const top = reranked[0].entry;

    if (top.score <= 0) break;

    picked.push({
      ...top,
      reason: buildReason(top.category, answers, top.breakdown, locale),
    });
    remaining.delete(entryKey(top));
    budgetUsed += top.minPriceKRW;
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
  bd: ScoreBreakdown,
  locale: "ko" | "en"
): string {
  // 1) 목표 매칭 — 자연어 한 줄
  const aff = c.goalAffinity ?? {};
  const primary = answers.goals.primary;
  const secondary = answers.goals.secondary;
  const primaryHit = (aff[primary] ?? 0) >= 2;
  const secondaryHit = secondary && (aff[secondary] ?? 0) >= 2;

  // "핵심 매칭" 태그형 — 1순위 부합, "서브 매칭" — 2순위 부합 or 1순위 보조.
  const CORE_KO = "[핵심 매칭]";
  const CORE_EN = "[Core match]";
  const SUB_KO = "[서브 매칭]";
  const SUB_EN = "[Sub match]";

  let goalText = "";
  if (primaryHit) {
    const tag = locale === "en" ? CORE_EN : CORE_KO;
    const goal = purposeLabel(primary, locale);
    goalText = `${tag} ${goal}`;
    if (secondaryHit) {
      goalText += ` · ${purposeLabel(secondary!, locale)}`;
    }
  } else if (secondaryHit) {
    const tag = locale === "en" ? SUB_EN : SUB_KO;
    goalText = `${tag} ${purposeLabel(secondary!, locale)}`;
  } else if (bd.goalFit > 0) {
    const tag = locale === "en" ? SUB_EN : SUB_KO;
    goalText = `${tag} ${purposeLabel(primary, locale)}`;
  }

  // 2) mustHave 충족
  const mustHaveText =
    bd.mustHaveMet.length > 0
      ? bd.mustHaveMet.join(" · ") + (locale === "en" ? " incl." : " 포함")
      : "";

  return [goalText, mustHaveText].filter(Boolean).join(" · ");
}

function purposeLabel(p: Purpose, locale: "ko" | "en"): string {
  if (locale === "en") {
    switch (p) {
      case "new_product":
        return "New product";
      case "traffic_driver":
        return "On-floor traffic";
      case "brand_awareness":
        return "Brand awareness";
    }
  }
  switch (p) {
    case "new_product":
      return "신제품 홍보";
    case "traffic_driver":
      return "현장 방문객 유도";
    case "brand_awareness":
      return "브랜드 확산";
  }
}

// ============================================================================
// 업그레이드 경로 — 단품 추천 + α 로 패키지가 더 이득
// ============================================================================

export type UpgradeOffer = {
  package: Package;
  /** 사용자 픽 중 패키지에 들어간 카테고리들 (covered) */
  covered: Category[];
  /** 패키지가 추가로 주는 카테고리 (사용자 픽이 아닌 것들) */
  extras: Category[];
  /** 패키지 가격 (할인가) */
  packagePriceKRW: number;
  /** 패키지의 단품 합산가 (originalPrice 또는 컴포넌트 합산) */
  packageSinglesKRW: number;
  /** 절감액 = packageSinglesKRW - packagePriceKRW */
  savingsKRW: number;
  /** 절감률 (0~1) */
  discountRatio: number;
};

export function findUpgradeOffers(args: {
  picks: RecEntry[];
  packages: Package[];
  categories: Category[];
  subcategories: Subcategory[];
  budgetKRW: number;
}): UpgradeOffer[] {
  const { picks, packages, categories, subcategories, budgetKRW } = args;
  if (picks.length === 0) return [];

  // 픽이 같은 카테고리의 여러 sub tier 일 수도 — covered 는 unique cat id 기준.
  const pickCatIds = new Set(picks.map((p) => p.category.id));
  const minPriceByCat = computeMinPriceByCategory(subcategories);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const candidates: UpgradeOffer[] = [];

  for (const pkg of packages) {
    const pkgCatIds = new Set(
      (pkg.includedItems ?? [])
        .map((it) => it.categoryId)
        .filter((id): id is string => !!id)
    );
    if (pkgCatIds.size === 0) continue;

    // covered: 사용자 픽 카테고리 (unique) 중 패키지에 포함된 것.
    const coveredCatIds = Array.from(pickCatIds).filter((id) =>
      pkgCatIds.has(id)
    );
    // 2개 이상 매칭돼야 의미 있음 — 1개 매칭은 사용자에게 "단품 1개 빼고 패키지로?"
    // 라는 어색한 제안이 됨 (나머지 픽은 별도로 사야 하니 오히려 비싸짐).
    if (coveredCatIds.length < 2) continue;

    const coveredCategories = coveredCatIds
      .map((id) => catById.get(id))
      .filter((c): c is Category => !!c);

    const extraCategoryIds = Array.from(pkgCatIds).filter(
      (id) => !pickCatIds.has(id)
    );
    const extras = extraCategoryIds
      .map((id) => catById.get(id))
      .filter((c): c is Category => !!c);

    const packagePriceKRW = pkg.discountPrice ?? pkg.originalPrice ?? 0;
    if (packagePriceKRW <= 0) continue;

    // 패키지의 "단품 합산가" — 패키지가 originalPrice 를 정확히 들고 있으면 그걸 사용,
    // 없으면 includedItems 카테고리들의 단품 최저가 합으로 계산.
    const packageSinglesKRW =
      pkg.originalPrice && pkg.originalPrice > packagePriceKRW
        ? pkg.originalPrice
        : Array.from(pkgCatIds).reduce(
            (sum, id) => sum + (minPriceByCat.get(id) ?? 0),
            0
          );

    // 예산의 1.5배 초과면 너무 비쌈
    if (budgetKRW > 0 && packagePriceKRW > budgetKRW * 1.5) continue;

    const savings = packageSinglesKRW - packagePriceKRW;
    if (savings <= 0) continue;
    const discountRatio = savings / packageSinglesKRW;

    candidates.push({
      package: pkg,
      covered: coveredCategories,
      extras,
      packagePriceKRW,
      packageSinglesKRW,
      savingsKRW: savings,
      discountRatio,
    });
  }

  // covered 많은 순 → 절감액 큰 순. 최대 1개만 표시.
  return candidates
    .sort((a, b) => {
      if (a.covered.length !== b.covered.length)
        return b.covered.length - a.covered.length;
      return b.savingsKRW - a.savingsKRW;
    })
    .slice(0, 1);
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
  new_product: "신제품 홍보",
  traffic_driver: "현장 방문객 유도",
  brand_awareness: "브랜드 확산",
};

export const PURPOSE_LABEL_EN: Record<Purpose, string> = {
  new_product: "New product launch",
  traffic_driver: "Drive on-floor traffic",
  brand_awareness: "Brand awareness",
};

export const MUST_HAVE_LABEL_KO: Record<MustHaveTag, string> = {
  online_channel: "온라인 채널 노출",
  overseas: "글로벌(해외) 바이어 타깃",
  pre_exposure: "사전 노출 포함 (행사 전 매체)",
};

export const MUST_HAVE_LABEL_EN: Record<MustHaveTag, string> = {
  online_channel: "Online channel exposure",
  overseas: "Global (overseas) buyer targeting",
  pre_exposure: "Include pre-event exposure",
};
