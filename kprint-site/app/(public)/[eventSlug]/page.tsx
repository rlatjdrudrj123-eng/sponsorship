"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

/**
 * 이벤트 홈 = 스폰서십 리스트로 즉시 리다이렉트.
 * 참가업체는 사무국이 보낸 링크(/{eventSlug})로 진입 → 바로 리스트로.
 */
export default function EventHomeRedirect() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;

  useEffect(() => {
    if (!eventId) return;
    window.location.replace(`/${eventId}/sponsorships`);
  }, [eventId]);

  return (
    <main className="min-h-screen grid place-items-center bg-white">
      <div className="text-sm text-ink-500">불러오는 중…</div>
    </main>
  );
}
