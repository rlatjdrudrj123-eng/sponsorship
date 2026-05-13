"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 공개 사이트 언어. 어드민은 항상 한글.
 *
 * 데이터의 `name.ko`/`name.en` 같은 양국어 필드를 동적으로 선택해주는 helper와
 * 하드코딩된 UI 문구를 위한 t() 매핑이 같이 들어있다.
 */

export type Locale = "ko" | "en";

type LocaleStore = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  hasHydrated: boolean;
};

export const useLocale = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "ko",
      hasHydrated: false,
      setLocale: (l) => set({ locale: l }),
    }),
    {
      name: "public-locale",
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    }
  )
);

/** name.ko/name.en 패턴에서 현재 locale 에 맞는 값 (en 비어있으면 ko 폴백) */
export function localized(
  pair: { ko?: string; en?: string } | undefined,
  locale: Locale
): string {
  if (!pair) return "";
  if (locale === "en") return pair.en?.trim() || pair.ko || "";
  return pair.ko || pair.en || "";
}
