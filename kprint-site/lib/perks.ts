import type { BundledPerk } from "./types";

/**
 * KPRINT 2026 기본 동봉 혜택 — 스폰서십 신청 시 모두에게 제공.
 * 어드민의 [사이트 설정 → 동봉 혜택] 에서 자유롭게 편집 가능.
 * siteSettings.bundledPerks 가 비어있으면 이 기본값이 fallback.
 */
// 200만원 이상 스폰서십 구매 시 모두에게 동봉되는 무료 혜택.
// 단품으로는 사실상 안 팔리는 매체들을 가치로 묶어서 제공.
// (총 가치 약 950만원 — 메인 매체 구매에 부가가치 강조용)
export const DEFAULT_BUNDLED_PERKS: BundledPerk[] = [
  {
    label: "등록대 스폰서 로고 표기",
    description:
      "전시장 입구 등록대에 회사 로고 노출 — 전 참관객 첫 접점",
    valueKRW: 1_000_000,
  },
  {
    label: "도면 내 참가기업 로고",
    description:
      "공식 전시장 도면 위에 참가기업 로고 표기 — 4부스 이상 우선 배치",
    valueKRW: 2_000_000,
  },
  {
    label: "참가업체 검색 배너 1구좌",
    description: "참가업체 검색 페이지 상단 배너 노출",
    valueKRW: 2_000_000,
  },
  {
    label: "전시품 검색 배너 1구좌",
    description: "전시품 검색 페이지 상단 배너 노출",
    valueKRW: 2_000_000,
  },
  {
    label: "통합검색 배너 1구좌",
    description: "통합검색 결과 페이지 상단 배너 노출",
    valueKRW: 2_000_000,
  },
  {
    label: "세미나 페이지 배너 1구좌",
    description: "세미나/컨퍼런스 페이지 상단 배너 노출",
    valueKRW: 1_500_000,
  },
  {
    label: "결과보고서 노출",
    description:
      "행사 종료 후 발행되는 공식 결과보고서에 스폰서 명단 노출",
  },
];

/** 혜택 총 가치 계산 (KRW) — 조건부 (condition 있는 것은 제외 가능) */
export function calcPerksTotalValue(
  perks: BundledPerk[],
  includeConditional = false
): number {
  return perks.reduce((sum, p) => {
    if (!p.valueKRW) return sum;
    if (!includeConditional && p.condition) return sum;
    return sum + p.valueKRW;
  }, 0);
}

/**
 * 컨텍스트(현재 표시 중인 매체/패키지의 code) 에 적용 가능한 혜택만 필터.
 * - appliesToCodes 가 비어있는 혜택 = 모든 곳에 노출
 * - appliesToCodes 가 채워진 혜택 = code 가 포함된 컨텍스트에만 노출
 *
 * @param perks - 전체 혜택 목록
 * @param contextCode - 현재 표시 중인 카테고리/패키지의 code (예: "CB", "PKG-AZ")
 *                     undefined 면 "모든 곳" 혜택만 반환 (예: 전체 혜택 페이지)
 */
export function filterPerksForContext(
  perks: BundledPerk[],
  contextCode: string | undefined
): BundledPerk[] {
  return perks.filter((p) => {
    if (!p.appliesToCodes || p.appliesToCodes.length === 0) return true;
    if (!contextCode) return false;
    return p.appliesToCodes.includes(contextCode);
  });
}
