"use client";

import { useParams } from "next/navigation";
import { HomePage } from "@/components/public/HomePage";
import { LocaleSetter } from "@/components/public/LocaleSetter";

/**
 * 영문 메인 페이지 (/[eventSlug]/en).
 *
 * 한국어 페이지와 동일한 HomePage 컴포넌트 사용 + LocaleSetter 로 locale='en' 설정.
 * HomePage 내부에서 locale==='en' 이면 settings.landingEn 사용 (비어있으면 ko 폴백).
 *
 * 어드민에서 영문 랜딩을 따로 디자인하면 그 데이터로 렌더, 아니면 한국어 데이터에
 * useLocale 자동 번역 적용.
 */
export default function EventHomePageEn() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;

  if (!eventId) {
    return (
      <main className="min-h-screen grid place-items-center bg-canvas">
        <div className="text-sm text-ink-500">Loading…</div>
      </main>
    );
  }

  return (
    <>
      <LocaleSetter locale="en" />
      <HomePage eventId={eventId} />
    </>
  );
}
