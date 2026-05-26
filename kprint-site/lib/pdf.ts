import type { SiteSettings } from "./types";

/**
 * 공개 "전체 패키지 PDF 다운로드" 링크.
 *
 * 어드민이 settings 에 미리 만든 PDF 를 업로드해뒀으면 그 Storage URL 을 직접 반환 →
 * 사용자는 클릭 즉시 PDF 받음 (0초). 인쇄 페이지를 안 거치므로 이미지 누락 / 진행률
 * 대기 같은 문제 없음.
 *
 * 업로드된 PDF 가 없으면 /print/full 인쇄 페이지로 폴백 (브라우저 인쇄 다이얼로그
 * 자동 오픈 → 사용자가 [PDF로 저장]). 느리지만 최신 데이터 반영.
 */
export function getFullPdfHref(
  eventId: string,
  settings: Pick<SiteSettings, "pdfFullUrl"> | null | undefined
): string {
  return settings?.pdfFullUrl || `/${eventId}/print/full`;
}

/** 업로드된 PDF 직접 URL 인지 (= 즉시 다운로드 가능) */
export function isDirectPdfHref(
  settings: Pick<SiteSettings, "pdfFullUrl"> | null | undefined
): boolean {
  return Boolean(settings?.pdfFullUrl);
}
