"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale";

/**
 * 사이트 언어 토글 — URL 기반 (토글 클릭 시 페이지 이동).
 *
 * /[eventSlug]/...   ↔  /[eventSlug]/en/...
 *
 * 디자인: 현재 locale 강조 + 다른 locale 링크. 작은 inline pill.
 */
export function LocaleToggle({
  className,
}: {
  className?: string;
}) {
  const pathname = usePathname() || "";
  const locale = useLocale((s) => s.locale);

  // 현재 path 에서 ko/en URL 둘 다 계산.
  // /[eventSlug] 의 첫 segment 가 eventSlug, 두 번째가 "en" 이면 영문 URL.
  const segments = pathname.split("/").filter(Boolean);
  const eventSlug = segments[0] ?? "";
  if (!eventSlug) return null;

  const isEn = segments[1] === "en";
  const restSegments = isEn ? segments.slice(2) : segments.slice(1);
  const rest = restSegments.length > 0 ? "/" + restSegments.join("/") : "";

  const koHref = `/${eventSlug}${rest}`;
  const enHref = `/${eventSlug}/en${rest}`;

  const base =
    "px-2.5 py-1 text-[11px] font-bold rounded-pill transition-colors font-num tracking-wider";
  const active =
    "bg-ink-900 text-white";
  const inactive =
    "bg-white/80 backdrop-blur border border-ink-100 text-ink-500 hover:text-ink-900";

  return (
    <div className={"inline-flex items-center gap-1 " + (className ?? "")}>
      <Link
        href={koHref}
        className={base + " " + (locale === "ko" ? active : inactive)}
        prefetch={false}
        aria-label="한국어"
      >
        KO
      </Link>
      <Link
        href={enHref}
        className={base + " " + (locale === "en" ? active : inactive)}
        prefetch={false}
        aria-label="English"
      >
        EN
      </Link>
    </div>
  );
}
