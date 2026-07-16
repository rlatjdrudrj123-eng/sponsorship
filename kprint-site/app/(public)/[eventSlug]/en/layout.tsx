import type { Metadata } from "next";
import { getEventNameForMetadata } from "@/lib/eventMeta";

// 영문 페이지(/[eventSlug]/en/*) 전용 메타데이터 — 행사명 + 영문 문구.
export async function generateMetadata({
  params,
}: {
  params: { eventSlug: string };
}): Promise<Metadata> {
  const name = await getEventNameForMetadata(params.eventSlug);
  if (!name) return {}; // 조회 실패 시 상위 레이아웃 메타데이터로 폴백
  const title = `${name} — Sponsorship`;
  const description = `${name} sponsorship packages and inquiries`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default function EventEnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
