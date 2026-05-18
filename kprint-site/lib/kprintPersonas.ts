import type { Persona, Purpose } from "./types";

/**
 * KPRINT 2026 기본 페르소나.
 * 인쇄·디지털 프린팅·사인광고·패키징 업계의 회사 유형을 5가지로 정의.
 * 시드 함수에서 사용. 어드민 [분류 관리 → 페르소나] 에서 자유롭게 편집 가능.
 */
export const DEFAULT_KPRINT_PERSONAS: Array<
  Omit<Persona, "id" | "eventId"> & { idHint: string }
> = [
  {
    idHint: "new-product",
    emoji: "🚀",
    title: "신제품 출시 회사",
    description:
      "처음 KPRINT 에 참가하거나 새 제품·서비스를 알려야 하는 회사. 인지도 0 부터 쌓아야 함.",
    purposes: ["brand_awareness", "traffic_driver"] as Purpose[],
    budgetMin: 8_000_000,
    budgetMax: 15_000_000,
    packageTier: "signature",
    targetTags: ["참관객_AtoZ_패키지", "목걸이", "라이팅", "사전등록"],
    socialProofNote: "신규 참가사가 가장 많이 선택하는 코스",
    budgetNote: "평균 1,200만원 — 참관객 A to Z + 인터뷰",
    order: 1,
    isActive: true,
  },
  {
    idHint: "repeat-traffic",
    emoji: "🎯",
    title: "재참가 — 부스 트래픽 늘리기",
    description:
      "작년에 참가했고, 올해는 부스 방문자를 늘리는 게 목표인 회사. 현장 동선 노출이 핵심.",
    purposes: ["traffic_driver", "brand_awareness"] as Purpose[],
    budgetMin: 5_000_000,
    budgetMax: 10_000_000,
    packageTier: "signature",
    targetTags: ["천장", "도면", "라이팅", "참가업체_AtoZ_패키지"],
    socialProofNote: "재참가사의 60% 가 선택하는 노출 조합",
    budgetNote: "평균 800만원 — 프라임 스팟 + 천장배너 추가",
    order: 2,
    isActive: true,
  },
  {
    idHint: "global-reach",
    emoji: "🌏",
    title: "해외 바이어 도달",
    description:
      "해외 영업·바이어 매칭이 목표. 검색·뉴스레터·도면 노출이 핵심.",
    purposes: ["buyer_reach"] as Purpose[],
    budgetMin: 3_000_000,
    budgetMax: 8_000_000,
    packageTier: "standard",
    targetTags: ["검색", "뉴스레터", "해외", "도면"],
    socialProofNote: "해외 영업 강화 회사가 선호하는 조합",
    budgetNote: "평균 500만원 — 프라임 스팟 + 해외 뉴스레터",
    order: 3,
    isActive: true,
  },
  {
    idHint: "content-marketing",
    emoji: "📸",
    title: "콘텐츠·SNS 자산 확보",
    description:
      "행사 후에도 마케팅에 쓸 자산(영상·사진·인터뷰)이 필요한 회사. 콘텐츠형 매체 중심.",
    purposes: ["post_asset", "brand_awareness"] as Purpose[],
    budgetMin: 2_000_000,
    budgetMax: 5_000_000,
    packageTier: "standard",
    targetTags: ["인터뷰", "카드뉴스", "세미나", "콘텐츠"],
    socialProofNote: "마케팅 부서가 가장 많이 픽업하는 코스",
    budgetNote: "평균 400만원 — 세미나 + 인터뷰 SNS",
    order: 4,
    isActive: true,
  },
  {
    idHint: "entry-test",
    emoji: "🌱",
    title: "첫 KPRINT — 일단 발 담그기",
    description:
      "처음이라 큰 예산을 쓰기 어려운 회사. 최소 비용으로 노출 검증부터.",
    purposes: ["brand_awareness"] as Purpose[],
    budgetMin: 500_000,
    budgetMax: 2_500_000,
    packageTier: "standard",
    targetTags: ["카드뉴스", "라이팅", "바닥", "세미나"],
    socialProofNote: "첫 참가사가 부담 없이 시작하는 매체",
    budgetNote: "평균 200만원 — 단품 1-2종 + 카드뉴스",
    order: 5,
    isActive: true,
  },
];
