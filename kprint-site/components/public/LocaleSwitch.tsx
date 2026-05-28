"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale";

/**
 * 공개 사이트 우상단 언어 토글. "KO / EN" 두 글자 세그먼트.
 *
 * URL 기반 — 토글 클릭 시 같은 페이지의 ko/en URL 로 이동. 단순 store
 * setLocale 만 호출하던 옛 동작은 URL 라우팅을 우회해서 /[eventSlug]/en/...
 * 라우트로 이동하지 않는 문제가 있었음. 이제 Link 로 페이지 이동.
 */
export function LocaleSwitch({
  size = "md",
}: {
  size?: "sm" | "md";
}) {
  const locale = useLocale((s) => s.locale);
  const hydrated = useLocale((s) => s.hasHydrated);
  const pathname = usePathname() || "";

  // hydrate 전엔 SSR과 어긋나지 않게 ko 기본
  const current = hydrated ? locale : "ko";

  // 현재 URL 에서 ko/en path 각각 계산.
  // /[eventSlug] 첫 segment 가 eventSlug, 두 번째가 "en" 이면 영문 URL.
  const segments = pathname.split("/").filter(Boolean);
  const eventSlug = segments[0] ?? "";
  const isEn = segments[1] === "en";
  const restSegments = isEn ? segments.slice(2) : segments.slice(1);
  const rest = restSegments.length > 0 ? "/" + restSegments.join("/") : "";
  const koHref = eventSlug ? `/${eventSlug}${rest}` : "/";
  const enHref = eventSlug ? `/${eventSlug}/en${rest}` : "/";

  const small = size === "sm";
  const padding = small ? "px-2 py-1" : "px-2.5 py-1.5";
  const text = small ? "text-[11px]" : "text-[12px]";

  const cls = (active: boolean) =>
    padding +
    " rounded font-bold transition-colors " +
    (active ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900");

  return (
    <div
      role="group"
      aria-label="언어 / Language"
      className={
        "inline-flex items-center bg-ink-50 border border-ink-100 rounded-btn p-0.5 " +
        text
      }
    >
      <Link href={koHref} prefetch={false} aria-pressed={current === "ko"} className={cls(current === "ko")}>
        KO
      </Link>
      <Link href={enHref} prefetch={false} aria-pressed={current === "en"} className={cls(current === "en")}>
        EN
      </Link>
    </div>
  );
}
