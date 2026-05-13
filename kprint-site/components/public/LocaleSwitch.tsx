"use client";

import { useLocale, type Locale } from "@/lib/i18n/locale";

/**
 * 공개 사이트 우상단 언어 토글. "KO / EN" 두 글자 세그먼트.
 */
export function LocaleSwitch({
  size = "md",
}: {
  size?: "sm" | "md";
}) {
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const hydrated = useLocale((s) => s.hasHydrated);

  // hydrate 전엔 SSR과 어긋나지 않게 ko 기본
  const current: Locale = hydrated ? locale : "ko";

  const small = size === "sm";
  const padding = small ? "px-2 py-1" : "px-2.5 py-1.5";
  const text = small ? "text-[11px]" : "text-[12px]";

  return (
    <div
      role="group"
      aria-label="언어 / Language"
      className={
        "inline-flex items-center bg-ink-50 border border-ink-100 rounded-btn p-0.5 " +
        text
      }
    >
      <button
        type="button"
        onClick={() => setLocale("ko")}
        aria-pressed={current === "ko"}
        className={
          padding +
          " rounded font-bold transition-colors " +
          (current === "ko"
            ? "bg-ink-900 text-white"
            : "text-ink-500 hover:text-ink-900")
        }
      >
        KO
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={current === "en"}
        className={
          padding +
          " rounded font-bold transition-colors " +
          (current === "en"
            ? "bg-ink-900 text-white"
            : "text-ink-500 hover:text-ink-900")
        }
      >
        EN
      </button>
    </div>
  );
}
