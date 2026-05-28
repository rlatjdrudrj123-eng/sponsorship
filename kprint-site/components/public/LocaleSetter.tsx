"use client";

import { useLayoutEffect, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale, type Locale } from "@/lib/i18n/locale";

// SSR 에서 useLayoutEffect 경고 회피 — 서버는 useEffect, 클라는 useLayoutEffect.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * URL 기반 locale 자동 동기화.
 *
 * pathname 직접 읽어서 매 변경마다 setLocale. 클라이언트 네비게이션 (Link
 * 클릭) 으로 URL 만 바뀌고 컴포넌트 트리는 유지되는 경우에도 자동 감지.
 *
 * prop 으로 locale 받던 옛 패턴 (각 페이지에서 명시 전달) 은 KO/EN URL 토글
 * 시 prop 안 바뀌면 동기화 안 되는 버그가 있어 폐기. 이제 prop 없이 호출.
 */
export function LocaleSetter({ locale: _legacyProp }: { locale?: Locale } = {}) {
  void _legacyProp;
  const pathname = usePathname() || "";
  const segments = pathname.split("/").filter(Boolean);
  const isEn = segments[1] === "en";
  const locale: Locale = isEn ? "en" : "ko";

  const setLocale = useLocale((s) => s.setLocale);
  useIsoLayoutEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);
  return null;
}
