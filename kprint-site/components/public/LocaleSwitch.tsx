"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as clarity from "@/lib/clarity";

/**
 * 공개 사이트 우상단 언어 토글. "KO / EN" 두 글자 세그먼트.
 *
 * 강조 표시·href 둘 다 URL 에서 직접 도출 — store 동기화 타이밍과 무관하게
 * 즉시 반응. store 의 locale 은 콘텐츠 렌더용으로만 사용 (LocaleSetter 가
 * URL → store 동기화).
 */
export function LocaleSwitch({
  size = "md",
}: {
  size?: "sm" | "md";
}) {
  const pathname = usePathname() || "";

  // 현재 URL 에서 ko/en path 각각 계산.
  // /[eventSlug] 첫 segment 가 eventSlug, 두 번째가 "en" 이면 영문 URL.
  const segments = pathname.split("/").filter(Boolean);
  const eventSlug = segments[0] ?? "";
  const isEn = segments[1] === "en";
  const current: "ko" | "en" = isEn ? "en" : "ko";
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
      <Link
        href={koHref}
        prefetch={false}
        aria-pressed={current === "ko"}
        onClick={() => current !== "ko" && clarity.event("locale_switch_to_ko")}
        className={cls(current === "ko")}
      >
        KO
      </Link>
      <Link
        href={enHref}
        prefetch={false}
        aria-pressed={current === "en"}
        onClick={() => current !== "en" && clarity.event("locale_switch_to_en")}
        className={cls(current === "en")}
      >
        EN
      </Link>
    </div>
  );
}
