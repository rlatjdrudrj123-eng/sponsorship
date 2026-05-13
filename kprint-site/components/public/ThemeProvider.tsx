"use client";

import { useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "next/navigation";
import { getDb } from "@/lib/firebase/firestore";
import type { SiteSettings } from "@/lib/types";

/**
 * 공개 사이트 ThemeProvider — 행사별 brand color 적용.
 *
 * siteSettings/{eventId} 의 theme.primary (hex string) 를 읽어서
 * <html> element 에 --brand-500 CSS 변수로 주입한다.
 * 음영(50, 100, 700 등)은 globals.css 의 color-mix() 로 파생.
 *
 * settings 가 없거나 theme.primary 가 비어있으면 기본값(KIMES 빨강) 유지.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const [primary, setPrimary] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setPrimary(null);
      return;
    }
    const unsub = onSnapshot(
      doc(getDb(), "siteSettings", eventId),
      (snap) => {
        if (!snap.exists()) {
          setPrimary(null);
          return;
        }
        const data = snap.data() as SiteSettings;
        const color = data.theme?.primary?.trim();
        setPrimary(color && isValidHex(color) ? color : null);
      },
      () => setPrimary(null)
    );
    return unsub;
  }, [eventId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (primary) {
      root.style.setProperty("--brand-500", primary);
    } else {
      root.style.removeProperty("--brand-500");
    }
    return () => {
      root.style.removeProperty("--brand-500");
    };
  }, [primary]);

  return <>{children}</>;
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s);
}
