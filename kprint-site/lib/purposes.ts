import type { Category, Purpose } from "./types";

/**
 * 참가업체 시점의 광고 목적(Purpose)을 카테고리로부터 추론한다.
 *
 * 단일 진실원 — 페르소나 매칭, 사이드바 필터, 카드 뱃지 모두 이 함수의 결과를 공유.
 * 어드민이 `purposeOverride` 를 명시했으면 그것이 우선.
 *
 * 휴리스틱은 type + tags + name 기반. 정확하지 않아도 운영자가 어드민에서
 * 카테고리별로 override 할 수 있도록 설계.
 */
export function derivePurposes(c: Pick<Category, "type" | "tags" | "code" | "name" | "channel" | "purposeOverride">): Purpose[] {
  if (c.purposeOverride && c.purposeOverride.length > 0) {
    return c.purposeOverride;
  }
  const out = new Set<Purpose>();
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  const n = c.name?.ko ?? "";

  // type 기준 1차 매핑
  switch (c.type) {
    case "floor_plan":
      // 도면형: 동선 위 설치물 → 부스 방문 유도 + 브랜드 인지도
      out.add("traffic_driver");
      out.add("brand_awareness");
      break;
    case "xpace":
      // 옥외 LED → 대형 노출 → 브랜드 인지도 우선
      out.add("brand_awareness");
      out.add("traffic_driver");
      break;
    case "digital_banner":
      // 등록·검색·세미나 페이지 → 바이어 도달
      out.add("buyer_reach");
      out.add("brand_awareness");
      break;
    case "mailing":
      // 뉴스레터·푸시 → 직접 도달
      out.add("buyer_reach");
      break;
    case "print_page":
      // 쇼가이드 인쇄 → 브랜드 인지도 + 사후 자산
      out.add("brand_awareness");
      out.add("post_asset");
      break;
    case "content":
      // 인터뷰·카드뉴스 → 사후 자산 + 브랜드
      out.add("post_asset");
      out.add("brand_awareness");
      break;
    case "quantity":
      // 목걸이·삽지 → 전방위 노출
      out.add("brand_awareness");
      out.add("traffic_driver");
      break;
    case "media":
      // 경품 LED → 현장 트래픽 + 브랜드
      out.add("traffic_driver");
      out.add("brand_awareness");
      break;
    case "package":
      // 패키지는 별도 처리 (모든 목적 가능)
      out.add("brand_awareness");
      out.add("traffic_driver");
      break;
  }

  // tags 기준 2차 보정
  for (const t of tags) {
    if (t.includes("등록경로") || t.includes("등록") || t.includes("바이어"))
      out.add("buyer_reach");
    if (t.includes("글로벌") || t.includes("해외")) out.add("buyer_reach");
    if (t.includes("산업종사자") || t.includes("직접도달")) out.add("buyer_reach");
    if (t.includes("브랜드_확산") || t.includes("브랜드 확산"))
      out.add("brand_awareness");
    if (t.includes("동선") || t.includes("온사이트")) out.add("traffic_driver");
    if (t.includes("콘텐츠") || t.includes("sns")) out.add("post_asset");
    if (t.includes("정보탐색")) out.add("buyer_reach");
  }

  // name 기준 3차 보정
  if (n.includes("참관등록") || n.includes("등록")) out.add("buyer_reach");
  if (n.includes("뉴스레터") || n.includes("푸시")) out.add("buyer_reach");
  if (n.includes("세미나")) out.add("buyer_reach");
  if (n.includes("인터뷰") || n.includes("카드뉴스") || n.includes("SNS"))
    out.add("post_asset");

  return Array.from(out);
}
