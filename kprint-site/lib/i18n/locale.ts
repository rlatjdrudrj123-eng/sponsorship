"use client";

import { create } from "zustand";

/**
 * 공개 사이트 언어. 어드민은 항상 한글.
 *
 * URL 이 단일 진실원 — /[eventSlug]/en/... = en, 그 외 = ko.
 * LocaleSetter 가 페이지 마운트 시 setLocale 로 store 를 URL 에 맞춤.
 * 옛 persist 는 EN→KO 페이지 이동 시에도 store 에 옛 'en' 이 남아
 * 첫 렌더에서 영어가 잠깐 보이는 깜빡임 이슈로 제거.
 */

export type Locale = "ko" | "en";

type LocaleStore = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  hasHydrated: boolean;
};

export const useLocale = create<LocaleStore>()((set) => ({
  locale: "ko",
  hasHydrated: true, // persist 없으므로 항상 hydrated
  setLocale: (l) => set({ locale: l }),
}));

/** name.ko/name.en 패턴에서 현재 locale 에 맞는 값 (en 비어있으면 ko 폴백) */
export function localized(
  pair: { ko?: string; en?: string } | undefined,
  locale: Locale
): string {
  if (!pair) return "";
  if (locale === "en") return pair.en?.trim() || pair.ko || "";
  return pair.ko || pair.en || "";
}

/**
 * 별도 ko / en 필드(예: shortDesc + shortDescEn) 에서 현재 locale 값 반환.
 * Category/Package 등 nested object 없이 동일 객체에 두 필드 있는 경우.
 * en 이 비어있으면 ko 폴백 (영문 페이지에서도 한국어 데이터라도 보이게).
 */
export function localizedField(
  ko: string | undefined,
  en: string | undefined,
  locale: Locale
): string {
  if (locale === "en") return en?.trim() || ko || "";
  return ko || en || "";
}

/**
 * 행사 라우트에 locale 세그먼트 자동 삽입.
 * localeHref('kprint-2026', '/cart', 'en') -> '/kprint-2026/en/cart'
 * localeHref('kprint-2026', '/cart', 'ko') -> '/kprint-2026/cart'
 * suffix 는 반드시 '/' 로 시작.
 */
export function localeHref(
  eventId: string,
  suffix: string,
  locale: Locale
): string {
  if (!eventId) return suffix || "/";
  return locale === "en" ? `/${eventId}/en${suffix}` : `/${eventId}${suffix}`;
}
