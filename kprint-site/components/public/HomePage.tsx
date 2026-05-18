"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { SiteSettings } from "@/lib/types";
import { LandingRenderer } from "./landing/LandingRenderer";

/**
 * 행사 메인 랜딩.
 *
 * settings.landing 에 블록 시퀀스가 있으면 그대로 렌더.
 * 비어있으면 자동 기본 블록을 그리지 않고 — 빈 상태 (어드민이 직접 빌더에서 채우도록) 안내.
 */
export function HomePage({ eventId }: { eventId: string }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "siteSettings", eventId));
        if (snap.exists()) setSettings(snap.data() as SiteSettings);
      } catch (e) {
        console.error("home settings fetch failed", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [eventId]);

  const blocks = useMemo(() => settings?.landing ?? [], [settings?.landing]);

  // 빈 상태 — 어드민이 아직 랜딩을 만들지 않음. 카탈로그로 바로 가는 링크만 노출.
  if (loaded && blocks.length === 0) {
    return <EmptyLanding eventId={eventId} />;
  }

  return (
    <LandingRenderer blocks={blocks} eventId={eventId} settings={settings} />
  );
}

function EmptyLanding({ eventId }: { eventId: string }) {
  return (
    <main className="min-h-screen grid place-items-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <div className="font-num text-[11px] uppercase tracking-[0.35em] text-brand-500 font-bold flex items-center justify-center gap-2 mb-5">
          <span className="w-6 h-px bg-brand-500" />
          Sponsorship
          <span className="w-6 h-px bg-brand-500" />
        </div>
        <h1 className="text-[36px] md:text-[44px] font-bold tracking-tight leading-tight text-ink-900">
          행사 페이지가 곧 공개됩니다
        </h1>
        <p className="text-[14px] text-ink-500 mt-4 leading-relaxed">
          준비 중인 페이지가 있습니다. 먼저 스폰서십 카탈로그를 둘러보실 수 있습니다.
        </p>
        <Link
          href={`/${eventId}/sponsorships`}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-brand-500 text-white font-bold text-[14px] hover:bg-brand-700 transition-colors"
        >
          <LayoutGrid className="w-4 h-4" />
          스폰서십 카탈로그 보기
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
