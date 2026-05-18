import type { BundledPerk } from "./types";

/**
 * KPRINT 2026 기본 동봉 혜택 — 스폰서십 신청 시 모두에게 제공.
 * 어드민의 [사이트 설정 → 동봉 혜택] 에서 자유롭게 편집 가능.
 * siteSettings.bundledPerks 가 비어있으면 이 기본값이 fallback.
 */
export const DEFAULT_BUNDLED_PERKS: BundledPerk[] = [
  {
    label: "등록대 스폰서 로고",
    description: "전시장 입구 등록대에 회사 로고 노출 — 전 참관객 첫 접점",
    valueKRW: 1_000_000,
  },
  {
    label: "사전등록 페이지 배너",
    description: "공식 사전등록 페이지에 배너 노출 — 등록 동선의 핵심 매체",
    valueKRW: 3_000_000,
  },
  {
    label: "참관등록 완료 이메일",
    description: "사전등록 완료자 전원에게 발송되는 이메일에 배너 포함",
    valueKRW: 2_000_000,
  },
  {
    label: "참가업체 검색 배너",
    description: "참가업체 검색 페이지 상단 배너 노출",
    valueKRW: 1_000_000,
  },
  {
    label: "전시품 검색 배너",
    description: "전시품 검색 페이지 상단 배너 노출",
    valueKRW: 1_000_000,
  },
  {
    label: "통합검색 배너",
    description: "통합검색 결과 페이지 상단 배너 노출",
    valueKRW: 1_000_000,
  },
  {
    label: "도면 내 참가기업 로고",
    description: "공식 전시장 도면 위 참가기업 로고 표기",
    valueKRW: 2_000_000,
    condition: "큰 회사 우선",
  },
  {
    label: "결과보고서 노출",
    description: "행사 종료 후 발행되는 공식 결과보고서에 스폰서 명단 노출",
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
