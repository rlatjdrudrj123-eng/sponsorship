/**
 * 문의 접수번호 — inquiries 문서 ID 의 앞 8자리(영문·숫자, 대문자 표기).
 * 고객 접수 완료 화면(contact/done)과 어드민 문의 목록·상세가 같은 규칙을 쓴다.
 * Firestore 자동 ID 는 대소문자를 구분하므로 검색은 소문자로 맞춰 앞부분 비교.
 */
export function receiptNo(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
}
