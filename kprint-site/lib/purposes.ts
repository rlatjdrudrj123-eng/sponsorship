import type { Category, Purpose } from "./types";

/**
 * 참가업체 시점의 광고 목적(Purpose)을 카테고리로부터 추론한다.
 * 페르소나 3종(신제품 홍보형 / 현장 방문객 유도형 / 브랜드 확산형) 과 1:1 매칭.
 *
 * 단일 진실원 — 페르소나 매칭, 사이드바 필터, 카드 뱃지 모두 이 함수의 결과를 공유.
 * 어드민이 `purposeOverride` 를 명시했으면 그것이 우선.
 */
export function derivePurposes(
  c: Pick<Category, "type" | "tags" | "code" | "name" | "channel" | "purposeOverride">
): Purpose[] {
  if (c.purposeOverride && c.purposeOverride.length > 0) {
    // 옛 enum 잔재 (buyer_reach, post_asset) 는 자동으로 신 enum 으로 매핑
    return Array.from(
      new Set(
        c.purposeOverride
          .map(mapLegacyPurpose)
          .filter((p): p is Purpose => p !== null)
      )
    );
  }
  const out = new Set<Purpose>();
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  const n = c.name?.ko ?? "";

  switch (c.type) {
    case "floor_plan":
    case "xpace":
      // 도면형·X-pace: 부스 동선·시각 임팩트
      out.add("traffic_driver");
      out.add("brand_awareness");
      break;
    case "digital_banner":
      // 검색·페이지 배너: 사전 정보 도달 (신제품 홍보)
      out.add("new_product");
      out.add("brand_awareness");
      break;
    case "mailing":
      // 뉴스레터·메일: 사전 발송 (신제품 알림 + 트래픽 유도)
      out.add("new_product");
      out.add("traffic_driver");
      break;
    case "print_page":
      // 쇼가이드: 브랜드 인지
      out.add("brand_awareness");
      break;
    case "content":
      // 인터뷰·카드뉴스: 신제품 홍보 + 브랜드 확산
      out.add("new_product");
      out.add("brand_awareness");
      break;
    case "quantity":
      // 목걸이·삽지: 노출 시간 김 → 브랜드 + 트래픽
      out.add("brand_awareness");
      out.add("traffic_driver");
      break;
    case "media":
      // 영상 LED: 현장 트래픽 + 브랜드
      out.add("traffic_driver");
      out.add("brand_awareness");
      break;
    case "package":
      // 패키지: 모든 목적 가능
      out.add("new_product");
      out.add("traffic_driver");
      out.add("brand_awareness");
      break;
  }

  // tags / name 기준 보정
  const hay = `${n} ${tags.join(" ")}`;
  if (/세미나|인터뷰|카드뉴스|sns|신제품|발표/i.test(hay)) out.add("new_product");
  if (/동선|온사이트|부스|현장|천장|라이팅|등록데스크/i.test(hay))
    out.add("traffic_driver");
  if (/목걸이|가이드북|브랜드/i.test(hay)) out.add("brand_awareness");

  return Array.from(out);
}

/**
 * 옛 Purpose enum (buyer_reach, post_asset) → 신 enum 매핑.
 * Firestore 의 옛 데이터를 화면에서 안전하게 처리하기 위함.
 *  - buyer_reach (해외/특정 바이어 도달) → new_product (사전 노출·메일 채널)
 *  - post_asset (행사 후 자산) → new_product (콘텐츠는 신제품 홍보로 흡수)
 */
function mapLegacyPurpose(p: string): Purpose | null {
  switch (p) {
    case "new_product":
    case "traffic_driver":
    case "brand_awareness":
      return p;
    case "buyer_reach":
    case "post_asset":
      return "new_product";
    default:
      return null;
  }
}
