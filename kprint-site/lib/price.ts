// 가격 표시 유틸 — 한 곳에서 KRW <-> USD 환산·포맷 규칙 통일.
//
// 환산 비율: KPRINT 사무국 운영 기준 1,000,000원 ≈ 1,000달러.
// (= 1 USD = 1,000 KRW 로 간주.)
//
// 어드민이 priceUSD 를 직접 입력했으면 그 값을 우선,
// 비어 있으면 KRW 기반 자동 변환값을 사용.

import type { Locale } from "@/lib/i18n/locale";

const KRW_PER_USD = 1000;

/** KRW → USD 자동 변환 (반올림). */
export function krwToUsd(krw: number): number {
  if (!krw || krw <= 0) return 0;
  return Math.round(krw / KRW_PER_USD);
}

/**
 * locale 에 맞춘 표시 가격을 반환.
 * - ko: priceKRW 그대로
 * - en: priceUSD 있으면 그것, 없으면 krwToUsd(priceKRW)
 *
 * value 가 0 이면 "별도 문의(Negotiable)" 케이스 — 호출처에서 별도 처리.
 */
export function getDisplayPrice(
  item: { priceKRW: number; priceUSD?: number },
  locale: Locale
): { value: number; currency: "KRW" | "USD" } {
  if (locale === "en") {
    const usd =
      typeof item.priceUSD === "number" && item.priceUSD > 0
        ? item.priceUSD
        : krwToUsd(item.priceKRW);
    return { value: usd, currency: "USD" };
  }
  return { value: item.priceKRW, currency: "KRW" };
}

/** 패키지(원가/할인가) 양쪽을 일괄 처리. */
export function getDisplayPackagePrice(
  pkg: {
    originalPrice: number;
    discountPrice: number;
    originalPriceUSD?: number;
    discountPriceUSD?: number;
  },
  locale: Locale
): {
  original: { value: number; currency: "KRW" | "USD" };
  discount: { value: number; currency: "KRW" | "USD" };
} {
  if (locale === "en") {
    return {
      original: {
        value:
          typeof pkg.originalPriceUSD === "number" && pkg.originalPriceUSD > 0
            ? pkg.originalPriceUSD
            : krwToUsd(pkg.originalPrice),
        currency: "USD",
      },
      discount: {
        value:
          typeof pkg.discountPriceUSD === "number" && pkg.discountPriceUSD > 0
            ? pkg.discountPriceUSD
            : krwToUsd(pkg.discountPrice),
        currency: "USD",
      },
    };
  }
  return {
    original: { value: pkg.originalPrice, currency: "KRW" },
    discount: { value: pkg.discountPrice, currency: "KRW" },
  };
}

/** 화폐 단위 라벨 — ko 는 "원" 접미사, en 은 "$" 접두사. */
export function formatPrice(
  value: number,
  currency: "KRW" | "USD"
): string {
  if (currency === "USD") {
    return `$${value.toLocaleString()}`;
  }
  return `${value.toLocaleString()}원`;
}
