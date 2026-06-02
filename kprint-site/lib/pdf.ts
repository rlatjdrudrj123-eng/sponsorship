import type { SiteSettings } from "./types";
import type { Locale } from "./i18n/locale";

/**
 * 공개 "전체 패키지 PDF 다운로드" 링크.
 *
 * 어드민이 settings 에 미리 만든 PDF 를 업로드해뒀으면 그 Storage URL 을 직접 반환.
 * 한국어/영문 사이트는 각 언어의 PDF 만 사용 — 영문 사이트에서 영문 PDF 가 없으면
 * 한국어 PDF 로 폴백하지 않고 영문 인쇄 페이지(/en/print/full) 로 보냄.
 * 한국어가 잘못 다운로드되어 사용자가 혼동하던 버그 대응.
 */
export function getFullPdfHref(
  eventId: string,
  settings:
    | Pick<SiteSettings, "pdfFullUrl" | "pdfFullUrlEn">
    | null
    | undefined,
  locale: Locale = "ko"
): string {
  if (locale === "en") {
    return settings?.pdfFullUrlEn || `/${eventId}/en/print/full`;
  }
  return settings?.pdfFullUrl || `/${eventId}/print/full`;
}

/** 업로드된 PDF 직접 URL 인지 (= 즉시 다운로드 가능) */
export function isDirectPdfHref(
  settings:
    | Pick<SiteSettings, "pdfFullUrl" | "pdfFullUrlEn">
    | null
    | undefined,
  locale: Locale = "ko"
): boolean {
  return locale === "en"
    ? Boolean(settings?.pdfFullUrlEn)
    : Boolean(settings?.pdfFullUrl);
}
