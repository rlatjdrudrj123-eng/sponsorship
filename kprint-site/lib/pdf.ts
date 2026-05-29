import type { SiteSettings } from "./types";
import type { Locale } from "./i18n/locale";

/**
 * 공개 "전체 패키지 PDF 다운로드" 링크.
 *
 * 어드민이 settings 에 미리 만든 PDF 를 업로드해뒀으면 그 Storage URL 을 직접 반환 →
 * 사용자는 클릭 즉시 PDF 받음 (0초). 영문 사이트는 pdfFullUrlEn 우선, 없으면
 * 한국어 PDF 폴백. 업로드된 PDF 가 없으면 /print/full 인쇄 페이지로 폴백.
 */
export function getFullPdfHref(
  eventId: string,
  settings:
    | Pick<SiteSettings, "pdfFullUrl" | "pdfFullUrlEn">
    | null
    | undefined,
  locale: Locale = "ko"
): string {
  const enUrl = settings?.pdfFullUrlEn;
  const koUrl = settings?.pdfFullUrl;
  const preferred = locale === "en" ? enUrl || koUrl : koUrl;
  return preferred || `/${eventId}/print/full`;
}

/** 업로드된 PDF 직접 URL 인지 (= 즉시 다운로드 가능) */
export function isDirectPdfHref(
  settings:
    | Pick<SiteSettings, "pdfFullUrl" | "pdfFullUrlEn">
    | null
    | undefined,
  locale: Locale = "ko"
): boolean {
  if (locale === "en") {
    return Boolean(settings?.pdfFullUrlEn || settings?.pdfFullUrl);
  }
  return Boolean(settings?.pdfFullUrl);
}
