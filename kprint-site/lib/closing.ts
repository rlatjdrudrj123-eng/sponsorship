import type { SiteSettings } from "@/lib/types";

/**
 * 클로징 슬라이드(랜딩/슬라이드 끝 + 인쇄 PDF) 콘텐츠 — 행사별 분기.
 *
 * 배경: 로고("K·print")·헤드라인("인쇄·디지털프린팅 전문가가…")·신청 URL(kprint.kr)이
 * 하드코딩되어 KIMES 부산 등 다른 행사에서도 K-PRINT 문구가 그대로 노출되는 사고.
 *
 * 우선순위:
 *   1) siteSettings 의 행사별 값 (closingHeadline / applyUrl, 어드민 사이트 설정에서 입력)
 *   2) K-PRINT(kprint-*) 행사는 기존 문구/링크 유지 (하위호환)
 *   3) 그 외 행사는 행사명 기반 기본 문구 + 이 사이트의 문의 페이지 링크
 */
export type ClosingContent = {
  /** 상단 브랜드 표기 (K-PRINT 는 기존 로고타입 유지, 그 외는 행사명) */
  brand: string;
  /** 헤드라인 줄 배열 (줄바꿈 분리) */
  headlineLines: string[];
  /** 온라인 신청 버튼 href */
  applyHref: string;
  /** 외부 링크 여부 (target=_blank 처리용) */
  applyExternal: boolean;
};

const KPRINT_APPLY_KO = "https://kprint.kr/ko/mypage/exhibitor/advertise";
const KPRINT_APPLY_EN = "https://kprint.kr/en/auth/login/exhibitor";

export function getClosingContent(
  eventId: string,
  settings: SiteSettings | null,
  locale: "ko" | "en"
): ClosingContent {
  const isKprint = eventId.startsWith("kprint");
  const nameKo = settings?.event?.nameKo?.trim() || "";
  const nameEn = settings?.event?.nameEn?.trim() || "";
  const evName = locale === "en" ? nameEn || nameKo : nameKo || nameEn;

  // 브랜드 — K-PRINT 는 기존 로고타입, 그 외는 행사명 (없으면 빈 문자열 → 미표시)
  const brand = isKprint ? "K·print" : evName;

  // 헤드라인
  const custom =
    locale === "en"
      ? settings?.closingHeadlineEn?.trim() || settings?.closingHeadline?.trim()
      : settings?.closingHeadline?.trim();
  let headline: string;
  if (custom) {
    headline = custom;
  } else if (isKprint) {
    headline =
      locale === "en"
        ? "Reach decision-makers in the\nprint & digital industry — start now."
        : "인쇄·디지털프린팅 전문가가 모이는 자리,\n지금 바로 브랜드를 알리세요!";
  } else {
    headline =
      locale === "en"
        ? `Meet your buyers at ${evName || "the show"} —\npromote your brand now.`
        : `${evName || "행사"} 참관객이 모이는 자리,\n지금 바로 브랜드를 알리세요!`;
  }
  const headlineLines = headline.split("\n").filter((l) => l.trim());

  // 신청 URL
  const customUrl =
    locale === "en"
      ? settings?.applyUrlEn?.trim() || settings?.applyUrl?.trim()
      : settings?.applyUrl?.trim();
  let applyHref: string;
  if (customUrl) {
    applyHref = customUrl;
  } else if (isKprint) {
    applyHref = locale === "en" ? KPRINT_APPLY_EN : KPRINT_APPLY_KO;
  } else {
    applyHref = locale === "en" ? `/${eventId}/en/contact` : `/${eventId}/contact`;
  }
  const applyExternal = /^https?:\/\//i.test(applyHref);

  return { brand, headlineLines, applyHref, applyExternal };
}
