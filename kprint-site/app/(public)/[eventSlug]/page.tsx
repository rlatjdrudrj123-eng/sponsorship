"use client";

import { useParams } from "next/navigation";
import { HomePage } from "@/components/public/HomePage";

/**
 * 이벤트 홈 — 캔버스로 디자인된 데크가 메인 화면.
 * 어드민이 [랜딩 빌더]에서 만든 슬라이드들을 풀스크린 snap 으로 렌더.
 *
 * "필터로 보기 (카탈로그)" 는 /sponsorships 별도 라우트에서.
 */
export default function EventHomePage() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;

  if (!eventId) {
    return (
      <main className="min-h-screen grid place-items-center bg-canvas">
        <div className="text-sm text-ink-500">불러오는 중…</div>
      </main>
    );
  }

  return <HomePage eventId={eventId} />;
}
