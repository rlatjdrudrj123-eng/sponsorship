/**
 * 진단 챗봇 v2 — 4문항 룩업 매트릭스 기반 추천.
 *
 * 가중치 합산 없이 (Q1, Q2) 쌍으로 미리 정의된 추천 ID 배열을 가져와서
 * Q3 예산으로 가격 필터링, Q4 검토 단계로 결과 화면 레이아웃 결정.
 *
 * 어드민 override: siteSettings.diagnosisV2Config 가 있으면 우선 적용.
 */
import type {
  Category,
  DiagQ1Value,
  DiagQ2Value,
  DiagQ3Value,
  DiagQ4Value,
  DiagV2QuestionId,
  DiagV2QuestionOverride,
  Package,
  ReasonCategoryKey,
  ReasonTemplates,
  RecommendationMatrix,
} from "./types";
import { DIAG_Q3_PRICE_CEILING } from "./types";

// ─── 기본 질문 정의 ──────────────────────────────────────────

export type DiagV2Chip = {
  /** 진단 로직용 값 — 코드 상수, 변경 금지 */
  value: string;
  /** 표시 라벨 — 어드민이 chipLabels override 가능 */
  label: string;
};

export type DiagV2Question = {
  id: DiagV2QuestionId;
  intro: string;
  hint?: string;
  chips: DiagV2Chip[];
};

export const DEFAULT_DIAG_V2_QUESTIONS: Record<
  DiagV2QuestionId,
  DiagV2Question
> = {
  q1: {
    id: "q1",
    intro: "이번 K-PRINT 참가, 가장 우선하는 목적 하나를 선택해주세요.",
    hint: "목적에 따라 채널 매칭이 달라집니다. 가장 우선하는 하나만 선택해주세요.",
    chips: [
      { value: "launch", label: "신제품·신기술 런칭" },
      { value: "acquisition", label: "신규 거래선·대리점 발굴" },
      { value: "retention", label: "기존 고객·파트너 관계 강화" },
      { value: "awareness", label: "브랜드 인지도·점유율 확대" },
    ],
  },
  q2: {
    id: "q2",
    intro: "부스 규모를 알려주세요.",
    hint: "광고 예산과 별개로, 부스 규모에 적합한 노출 채널을 매칭합니다.",
    chips: [
      { value: "small", label: "1~2부스 (소형)" },
      { value: "medium", label: "3~6부스 (중형)" },
      { value: "large", label: "7부스 이상 (대형)" },
    ],
  },
  q3: {
    id: "q3",
    intro: "집행 가능한 최대 예산은?",
    chips: [
      { value: "under_100", label: "100만원 수준" },
      { value: "under_500", label: "500만원 수준" },
      { value: "under_1500", label: "1,500만원 수준" },
      { value: "over_1500", label: "1,500만원 이상" },
    ],
  },
  q4: {
    id: "q4",
    intro: "검토 단계는 어디쯤이세요?",
    hint: "검토 단계에 따라 결과 화면을 다르게 보여드립니다.",
    chips: [
      { value: "early", label: "초기 정보 수집" },
      { value: "compare", label: "상품 비교·검토" },
      { value: "decision", label: "결정 직전 단계" },
    ],
  },
};

// ─── 기본 추천 매트릭스 — Q1 × Q2 ───────────────────────────
// 스펙 3.1 기준. selectorId 는 categories.selectorId / packages.selectorId 와 매칭.
// 어드민 override 가능.

export const DEFAULT_RECOMMENDATION_MATRIX: RecommendationMatrix = {
  // Q1 = launch (신제품·신기술 런칭)
  launch: {
    small: ["seminar_banner", "instagram_card", "company_search_banner"],
    medium: ["seminar_package", "interview_sns", "distribution_stand"],
    large: ["custom_seminar_package", "seminar_package", "guidebook_back"],
  },
  // Q1 = acquisition (신규 거래선·대리점 발굴)
  acquisition: {
    small: ["company_search_banner", "product_search_banner", "category_wall"],
    medium: ["prime_spot_package", "floor_map_banner", "floor_map_logo"],
    large: [
      "prime_spot_package",
      "floor_map_banner",
      "floor_map_logo",
      "pre_registration_banner",
    ],
  },
  // Q1 = retention (기존 고객·파트너 관계 강화)
  retention: {
    small: ["invitation_insert", "pre_registration_email", "instagram_card"],
    medium: [
      "pre_registration_banner",
      "invitation_insert",
      "newsletter_domestic",
    ],
    large: [
      "invitation_insert",
      "visitor_atoz_package",
      "newsletter_domestic",
    ],
  },
  // Q1 = awareness (브랜드 인지도·점유율 확대)
  awareness: {
    small: ["floor_sticker", "integrated_search_banner", "category_wall"],
    medium: ["onsite_package", "ceiling_banner", "lighting_wall"],
    large: ["visitor_atoz_package", "ceiling_banner", "visitor_lanyard"],
  },
};

// ─── 기본 추천 이유 매핑 — Q1 × ReasonCategoryKey ───────────

export const DEFAULT_REASON_TEMPLATES: ReasonTemplates = {
  launch: {
    seminar: "신제품 발표는 세미나 채널이 가장 효율적입니다",
    content: "발표 후 콘텐츠 자산화로 사후 마케팅까지 활용",
    signature: "대규모 런칭은 통합 노출로 임팩트 극대화",
    package: "런칭 동선 한 번에 — 패키지 통합 노출",
    other: "신제품·신기술 런칭에 적합한 노출 채널",
  },
  acquisition: {
    search: "검색 상위 노출은 부스 도달의 가장 짧은 경로",
    floor_map: "도면 위 노출로 부스 방문 의사를 직접 자극",
    package: "검색·도면 통합으로 거래선 발굴 동선 풀커버",
    other: "신규 거래선 발굴에 효율적인 매체",
  },
  retention: {
    invitation: "기존 거래선·VIP 바이어에게 직접 도달",
    newsletter: "재참가 알림 + 부스 이벤트 안내",
    signature: "관계자 전 동선에서 브랜드 존재감 확보",
    package: "관계 강화 동선 통합 — 패키지로 효율 극대화",
    other: "기존 관계 강화에 적합한 매체",
  },
  awareness: {
    ceiling: "입장 시 가장 먼저 보이는 대형 매체",
    lanyard: "전 참관객 노출 시간 최장",
    package: "전 동선 통합 노출로 점유율 시각화",
    signature: "통합 노출로 행사 내 점유율 확보",
    other: "브랜드 인지도 확대에 효과적인 매체",
  },
};

// ─── 카테고리/패키지 → ReasonCategoryKey ────────────────────
// 매트릭스 추천 ID 별로 어떤 reason key 를 쓸지 결정.

export const SELECTOR_TO_REASON_KEY: Record<string, ReasonCategoryKey> = {
  // 세미나 계열
  seminar_banner: "seminar",
  seminar_package: "seminar",
  custom_seminar_package: "seminar",
  // 콘텐츠 계열
  interview_sns: "content",
  instagram_card: "content",
  // 시그니처 패키지
  visitor_atoz_package: "signature",
  onsite_package: "signature",
  // 검색 계열
  company_search_banner: "search",
  product_search_banner: "search",
  integrated_search_banner: "search",
  // 도면 계열
  floor_map_banner: "floor_map",
  floor_map_logo: "floor_map",
  // 패키지 (시그니처 외)
  prime_spot_package: "package",
  // 초대장
  invitation_insert: "invitation",
  // 뉴스레터
  newsletter_domestic: "newsletter",
  newsletter_overseas: "newsletter",
  pre_registration_email: "newsletter",
  // 천장
  ceiling_banner: "ceiling",
  // 목걸이
  visitor_lanyard: "lanyard",
};

/** 카테고리/패키지의 selectorId → reason key 결정. 매핑 없으면 'other'. */
export function selectorToReasonKey(selectorId: string): ReasonCategoryKey {
  return SELECTOR_TO_REASON_KEY[selectorId] ?? "other";
}

// ─── 결과 화면 레이아웃 (Q4 → 'cards' | 'comparison') ───────

export type ResultLayout = "cards" | "comparison";

export function getResultLayout(q4: DiagQ4Value): ResultLayout {
  if (q4 === "compare") return "comparison";
  // early, decision 모두 카드형 (decision 은 CTA 강조)
  return "cards";
}

// ─── 추천 entry — 카테고리 or 패키지 단일 행 ─────────────────

export type RecommendedEntry = {
  selectorId: string;
  kind: "category" | "package";
  /** 표시 이름 */
  nameKo: string;
  nameEn: string;
  /** 최저 가격 (원) — 카테고리: 소분류 최저값, 패키지: discountPrice */
  minPriceKRW: number;
  /** 가격 표시 라벨 — 별도 문의면 "별도 문의" */
  priceLabel: string;
  /** 데이터 원본 — 카테고리/패키지 객체 (상세 페이지 링크용) */
  category?: Category;
  package?: Package;
  /** 추천 이유 (1줄) */
  reason: string;
};

export type DiagnosisData = {
  categories: Category[];
  packages: Package[];
  /** subcategories 의 카테고리별 최저가 (priceKRW===0 제외) — 카테고리 minPrice 산출용 */
  minPriceByCategoryId?: Record<string, number>;
};

/**
 * 4문항 답을 받아서 추천 entries 를 만들어 반환.
 *  - matrix 와 reasons 는 어드민 override (siteSettings.diagnosisV2Config) 우선
 *  - 가격이 Q3 상한 초과면 제외
 *  - matrix 에 없는 selectorId 는 무시
 *  - 결과가 비어있으면 빈 배열 반환 (호출부에서 폴백 처리)
 */
export function getRecommendations(args: {
  q1: DiagQ1Value;
  q2: DiagQ2Value;
  q3: DiagQ3Value;
  data: DiagnosisData;
  matrix?: RecommendationMatrix;
  reasons?: ReasonTemplates;
}): RecommendedEntry[] {
  const { q1, q2, q3, data } = args;
  const matrix = mergeMatrix(args.matrix);
  const reasons = mergeReasons(args.reasons);

  const baseIds = matrix[q1]?.[q2] ?? [];
  const ceiling = DIAG_Q3_PRICE_CEILING[q3];

  // selectorId → category / package 인덱스
  const catBySelector = new Map<string, Category>();
  data.categories.forEach((c) => {
    if (c.selectorId) catBySelector.set(c.selectorId, c);
  });
  const pkgBySelector = new Map<string, Package>();
  data.packages.forEach((p) => {
    if (p.selectorId) pkgBySelector.set(p.selectorId, p);
  });

  const results: RecommendedEntry[] = [];

  for (const id of baseIds) {
    const cat = catBySelector.get(id);
    const pkg = pkgBySelector.get(id);

    if (cat) {
      const minPrice = data.minPriceByCategoryId?.[cat.id] ?? 0;
      const priceLabel =
        minPrice === 0 ? "별도 문의" : `${minPrice.toLocaleString()}원`;
      // 별도문의 (priceKRW===0) 는 가격 필터 통과
      if (minPrice > 0 && minPrice > ceiling) continue;
      results.push({
        selectorId: id,
        kind: "category",
        nameKo: cat.name.ko,
        nameEn: cat.name.en,
        minPriceKRW: minPrice,
        priceLabel,
        category: cat,
        reason: pickReason(reasons, q1, id),
      });
    } else if (pkg) {
      if (pkg.discountPrice > ceiling) continue;
      results.push({
        selectorId: id,
        kind: "package",
        nameKo: pkg.name.ko,
        nameEn: pkg.name.en,
        minPriceKRW: pkg.discountPrice,
        priceLabel: `${pkg.discountPrice.toLocaleString()}원`,
        package: pkg,
        reason: pickReason(reasons, q1, id),
      });
    }
    // 매핑 안 된 selectorId 는 조용히 무시 (어드민이 매트릭스에 오타 박았을 경우 등)
  }

  return results;
}

function pickReason(
  reasons: ReasonTemplates,
  q1: DiagQ1Value,
  selectorId: string
): string {
  const key = selectorToReasonKey(selectorId);
  const tpl = reasons[q1];
  return (tpl?.[key] ?? tpl?.other ?? "") || "추천 매체";
}

// ─── 매트릭스 / 이유 머지 — override + 기본값 ───────────────

function mergeMatrix(
  override?: RecommendationMatrix
): RecommendationMatrix {
  if (!override) return DEFAULT_RECOMMENDATION_MATRIX;
  const out: RecommendationMatrix = {};
  const q1Values: DiagQ1Value[] = [
    "launch",
    "acquisition",
    "retention",
    "awareness",
  ];
  const q2Values: DiagQ2Value[] = ["small", "medium", "large"];
  for (const q1 of q1Values) {
    out[q1] = {};
    for (const q2 of q2Values) {
      const ov = override[q1]?.[q2];
      const base = DEFAULT_RECOMMENDATION_MATRIX[q1]?.[q2] ?? [];
      out[q1]![q2] = ov && ov.length > 0 ? ov : base;
    }
  }
  return out;
}

function mergeReasons(override?: ReasonTemplates): ReasonTemplates {
  if (!override) return DEFAULT_REASON_TEMPLATES;
  const out: ReasonTemplates = {};
  const q1Values: DiagQ1Value[] = [
    "launch",
    "acquisition",
    "retention",
    "awareness",
  ];
  for (const q1 of q1Values) {
    out[q1] = {
      ...(DEFAULT_REASON_TEMPLATES[q1] ?? {}),
      ...(override[q1] ?? {}),
    };
  }
  return out;
}

// ─── 패키지 업셀 ─────────────────────────────────────────
// 사용자가 Q5 에서 고른 단품 + 보완재의 selectorId 들이 어느 패키지에 일정 비율 이상
// 포함되면 "이거 묶으면 패키지로 더 싸다" 추천. 매칭률 60% 이상 + 절감액 양수일 때.

export type UpsellSuggestion = {
  package: Package;
  /** 사용자가 고려 중인 selectorId 중 이 패키지에 포함된 것들 */
  matched: string[];
  /** 패키지에 포함됐지만 사용자가 안 고른 것들 (추가로 따라오는 항목) */
  extra: string[];
  /** 단품으로 따로 살 때 합계 */
  individualTotal: number;
  /** 패키지 가격 */
  packagePrice: number;
  /** 절감액 (individualTotal - packagePrice). 음수면 후보 제외. */
  savings: number;
};

/**
 * 사용자가 고려 중인 단품 selectorId 들과 잘 맞는 패키지를 찾는다.
 *  - matched / composition >= 0.6 (60% 이상 포함)
 *  - 절감액 > 0
 *  - 가장 큰 절감액 1개만 반환 (다중 추천은 혼란만 가중)
 */
export function findUpsellPackage(args: {
  consideringIds: string[];
  packages: Package[];
  /** selectorId → 단품 최저가 (원). 매칭 안 된 selectorId 는 단순 무시. */
  priceBySelectorId: Map<string, number>;
}): UpsellSuggestion | null {
  const { consideringIds, packages, priceBySelectorId } = args;
  if (consideringIds.length === 0) return null;

  const considering = new Set(consideringIds);
  let best: UpsellSuggestion | null = null;

  for (const pkg of packages) {
    const comp = pkg.composition ?? [];
    if (comp.length === 0) continue;

    const matched = comp.filter((id) => considering.has(id));
    const matchRatio = matched.length / comp.length;
    if (matchRatio < 0.6) continue; // 60% 이상 매칭 못 하면 패스
    if (matched.length < 2) continue; // 1개 매칭은 의미 없음 (단품 사도 됨)

    // 단품 합계 (가격 0/별도 문의는 0 으로 계산해서 절감액에 영향 없게)
    const individualTotal = matched.reduce((sum, id) => {
      return sum + (priceBySelectorId.get(id) ?? 0);
    }, 0);

    const packagePrice = pkg.discountPrice;
    const savings = individualTotal - packagePrice;
    if (savings <= 0) continue;

    const extra = comp.filter((id) => !considering.has(id));
    const candidate: UpsellSuggestion = {
      package: pkg,
      matched,
      extra,
      individualTotal,
      packagePrice,
      savings,
    };

    if (!best || candidate.savings > best.savings) {
      best = candidate;
    }
  }

  return best;
}

// ─── 질문 텍스트 머지 (어드민 override) ─────────────────────

export function mergeQuestion(
  qid: DiagV2QuestionId,
  override?: DiagV2QuestionOverride
): DiagV2Question {
  const base = DEFAULT_DIAG_V2_QUESTIONS[qid];
  if (!override) return base;
  const chipLabels = override.chipLabels ?? {};
  return {
    ...base,
    intro: override.intro ?? base.intro,
    hint: override.hint ?? base.hint,
    chips: base.chips.map((c) => ({
      ...c,
      label: chipLabels[c.value] ?? c.label,
    })),
  };
}
