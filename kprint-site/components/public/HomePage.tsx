"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { cachedFetch } from "@/lib/firebase/cache";
import type { SiteSettings } from "@/lib/types";
import { LandingRenderer } from "./landing/LandingRenderer";
import { useLocale, localeHref } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

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
        const data = await cachedFetch(`pub:settings:${eventId}`, async () => {
          const snap = await getDoc(doc(getDb(), "siteSettings", eventId));
          return snap.exists() ? (snap.data() as SiteSettings) : null;
        });
        if (data) setSettings(data);
      } catch (e) {
        console.error("home settings fetch failed", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [eventId]);

  // 영문 페이지 (/en) 진입 시 settings.landingEn 우선, 비어있으면 ko landing 폴백.
  // 한국어 진입 시 항상 settings.landing.
  const locale = useLocale((s) => s.locale);
  const blocks = useMemo(() => {
    if (locale === "en") {
      const en = settings?.landingEn;
      if (en && en.length > 0) return en;
    }
    return settings?.landing ?? [];
  }, [settings?.landing, settings?.landingEn, locale]);

  // settings 로딩 중 — LandingRenderer 가 빈 blocks 로 그려져 ModeChoice 만 보이는
  // 버그 방지. 로딩 끝난 후 데이터로 한 번에 그려야 main snap-scroll 이 첫 슬라이드부터.
  if (!loaded) {
    return <HomeLoading />;
  }

  // 빈 상태 — 어드민이 아직 랜딩을 만들지 않음. 카탈로그로 바로 가는 링크만 노출.
  if (blocks.length === 0) {
    return <EmptyLanding eventId={eventId} />;
  }

  return (
    <LandingRenderer blocks={blocks} eventId={eventId} settings={settings} />
  );
}

function HomeLoading() {
  const locale = useLocale((s) => s.locale);
  return (
    <main className="min-h-screen grid place-items-center bg-canvas">
      <div className="text-[12px] text-ink-300">{t("common.loading", locale)}</div>
    </main>
  );
}

function EmptyLanding({ eventId }: { eventId: string }) {
  const locale = useLocale((s) => s.locale);
  const isEn = locale === "en";
  return (
    <main className="min-h-screen grid place-items-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <div className="font-num text-[11px] uppercase tracking-[0.35em] text-brand-500 font-bold flex items-center justify-center gap-2 mb-5">
          <span className="w-6 h-px bg-brand-500" />
          Sponsorship
          <span className="w-6 h-px bg-brand-500" />
        </div>
        <h1 className="text-[36px] md:text-[44px] font-bold tracking-tight leading-tight text-ink-900">
          {isEn ? "Event page coming soon" : "행사 페이지가 곧 공개됩니다"}
        </h1>
        <p className="text-[14px] text-ink-500 mt-4 leading-relaxed">
          {isEn
            ? "We're still preparing this event page. Meanwhile, take a look at the sponsorship catalog."
            : "준비 중인 페이지가 있습니다. 먼저 스폰서십 카탈로그를 둘러보실 수 있습니다."}
        </p>
        <Link
          href={localeHref(eventId, "/sponsorships", locale)}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-brand-500 text-white font-bold text-[14px] hover:bg-brand-700 transition-colors"
        >
          <LayoutGrid className="w-4 h-4" />
          {isEn ? "Browse sponsorship catalog" : "스폰서십 카탈로그 보기"}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
