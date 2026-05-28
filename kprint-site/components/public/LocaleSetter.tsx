"use client";

import { useEffect } from "react";
import { useLocale, type Locale } from "@/lib/i18n/locale";

/**
 * URL 기반 locale 설정.
 *
 * /[eventSlug]/en/* 진입 시 layout 에서 <LocaleSetter locale="en" /> 렌더 →
 * 마운트 시 useLocale store 가 "en" 으로 set. 토글이 아닌 URL 이 locale 의
 * 단일 진실원.
 *
 * 페이지 진입 후 사용자가 URL 직접 변경하지 않는 한 그 locale 유지.
 */
export function LocaleSetter({ locale }: { locale: Locale }) {
  const setLocale = useLocale((s) => s.setLocale);
  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);
  return null;
}
