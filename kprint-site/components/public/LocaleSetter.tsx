"use client";

import { useLayoutEffect, useEffect } from "react";
import { useLocale, type Locale } from "@/lib/i18n/locale";

// SSR 에서 useLayoutEffect 경고 회피 — 서버는 useEffect, 클라는 useLayoutEffect.
// 클라이언트 첫 페인트 전에 setLocale 호출되어 깜빡임(KO 페이지인데 잠깐 EN
// 텍스트 보이는 현상) 방지.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * URL 기반 locale 설정.
 *
 * /[eventSlug]/en/* 진입 시 layout 에서 <LocaleSetter locale="en" /> 렌더 →
 * 첫 페인트 전에 useLocale store 를 그 locale 로 set. URL 이 단일 진실원.
 */
export function LocaleSetter({ locale }: { locale: Locale }) {
  const setLocale = useLocale((s) => s.setLocale);
  useIsoLayoutEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);
  return null;
}
