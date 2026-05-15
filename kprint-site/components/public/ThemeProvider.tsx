"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "next/navigation";
import { getDb } from "@/lib/firebase/firestore";
import type { SiteSettings } from "@/lib/types";

/**
 * 공개 사이트 ThemeProvider — 행사별 brand color 적용.
 *
 * 흐름:
 *  1. 마운트 즉시 (useLayoutEffect) — localStorage 의 캐시 적용 → 첫 페인트 전 색상 확정
 *  2. 그 후 Firestore onSnapshot 으로 최신 색상 fetch → 캐시 갱신
 *
 * 이전 문제: 첫 페인트는 globals.css 기본값(빨강), 그 후 mint 로 점프하던 FOUC.
 * 이제 같은 행사로 두 번째 접속부터는 캐시된 색이 즉시 적용되어 깜박임 없음.
 */
const CACHE_KEY_PREFIX = "kprint-theme:";

function getCachedPrimary(eventId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CACHE_KEY_PREFIX + eventId);
  } catch {
    return null;
  }
}

function setCachedPrimary(eventId: string, color: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (color) {
      window.localStorage.setItem(CACHE_KEY_PREFIX + eventId, color);
    } else {
      window.localStorage.removeItem(CACHE_KEY_PREFIX + eventId);
    }
  } catch {
    /* localStorage 차단된 환경 — 무시 */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const [primary, setPrimary] = useState<string | null>(() =>
    eventId ? getCachedPrimary(eventId) : null
  );

  // ① 첫 페인트 전 — 캐시된 색상을 CSS 변수에 즉시 주입 (FOUC 방지)
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const cached = eventId ? getCachedPrimary(eventId) : null;
    const root = document.documentElement;
    if (cached && isValidHex(cached)) {
      root.style.setProperty("--brand-500", cached);
    }
  }, [eventId]);

  // ② Firestore 에서 최신 색상 구독 (캐시와 다르면 갱신)
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
          setCachedPrimary(eventId, null);
          return;
        }
        const data = snap.data() as SiteSettings;
        const color = data.theme?.primary?.trim();
        const validColor = color && isValidHex(color) ? color : null;
        setPrimary(validColor);
        setCachedPrimary(eventId, validColor);
      },
      () => setPrimary(null)
    );
    return unsub;
  }, [eventId]);

  // 색상이 바뀔 때마다 CSS 변수 갱신
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (primary) {
      root.style.setProperty("--brand-500", primary);
    }
    // 의도적으로 removeProperty 하지 않음 — 캐시 또는 기본값 유지
  }, [primary]);

  return <>{children}</>;
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s);
}
