import type { Metadata } from "next";
import { getEventNameForMetadata } from "@/lib/eventMeta";

// 행사별 페이지 제목/설명 — 링크 공유(카톡/메일 미리보기)와 브라우저 탭에
// 해당 행사 이름이 나오게 한다. (전에는 루트 레이아웃의 고정 문구가
// 모든 행사 URL 에 그대로 노출되는 문제가 있었음 — 예: /kimesbusan-2026 인데
// "K-PRINT 2026 — 스폰서십" 으로 보임)
//
// URL 의 [eventSlug] 세그먼트가 곧 events 문서 ID (예: kimesbusan-2026).
export async function generateMetadata({
  params,
}: {
  params: { eventSlug: string };
}): Promise<Metadata> {
  const name = await getEventNameForMetadata(params.eventSlug);
  if (!name) return {}; // 조회 실패 시 루트 레이아웃 기본 메타데이터로 폴백
  const title = `${name} — 스폰서십`;
  const description = `${name} 스폰서십 안내 및 견적 문의`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
