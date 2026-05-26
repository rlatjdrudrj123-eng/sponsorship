import type { CategoryType } from "./types";

/**
 * 카테고리 type 의 사용자 친화 한국어/영문 라벨.
 *
 * 단일 진실원 — 사이트(CategoryHero, sponsorships 필터), 어드민(매체분류 그룹,
 * 카테고리 편집 셀렉트), PDF(슬라이드 헤더) 모두 여기를 import.
 *
 * 이름 선정: 영업담당/사용자 입장에서 직관적인 이름.
 *  - "전시장 내부 설치" 가 "도면형" 보다 의미 명확
 *  - "사이트·앱 배너" 가 "디지털 배너" 보다 채널 명확
 */
export const CATEGORY_TYPE_LABELS: Record<
  CategoryType,
  { ko: string; en: string }
> = {
  floor_plan: { ko: "전시장 내부 설치", en: "On-floor Installation" },
  xpace: { ko: "LED 영상 광고", en: "LED Video Ads" },
  digital_banner: { ko: "사이트·앱 배너", en: "Site & App Banners" },
  mailing: { ko: "뉴스레터·푸시", en: "Newsletter & Push" },
  print_page: { ko: "쇼가이드 인쇄", en: "Show Guide Print" },
  content: { ko: "SNS 콘텐츠", en: "SNS Content" },
  quantity: { ko: "참관객 배포물", en: "Visitor Giveaways" },
  media: { ko: "미디어", en: "Media" },
  package: { ko: "패키지", en: "Package" },
};

/** locale 지정해서 한 줄에 가져오기 */
export function categoryTypeLabel(
  type: CategoryType,
  locale: "ko" | "en" = "ko"
): string {
  return CATEGORY_TYPE_LABELS[type][locale];
}
