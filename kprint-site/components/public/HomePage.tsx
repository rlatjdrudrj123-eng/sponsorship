"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { SiteSettings } from "@/lib/types";
import { LandingRenderer } from "./landing/LandingRenderer";
import { buildDefaultBlocks } from "./landing/defaults";

/**
 * 행사 메인 랜딩.
 *
 * settings.landing 에 블록 시퀀스가 있으면 그대로 렌더, 없으면 자동 기본값.
 * 디자인·콘텐츠는 모두 어드민 [사이트 설정] → 랜딩 빌더에서 관리.
 */
export function HomePage({ eventId }: { eventId: string }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "siteSettings", eventId));
        if (snap.exists()) setSettings(snap.data() as SiteSettings);
      } catch (e) {
        console.error("home settings fetch failed", e);
      }
    })();
  }, [eventId]);

  const blocks = useMemo(() => {
    if (settings?.landing && settings.landing.length > 0) {
      return settings.landing;
    }
    return buildDefaultBlocks(settings);
  }, [settings]);

  return (
    <LandingRenderer blocks={blocks} eventId={eventId} settings={settings} />
  );
}
