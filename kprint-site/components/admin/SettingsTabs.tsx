"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 사이트 설정 탭 — 사이드바에는 '사이트 설정' 하나만 두고 세부 화면은 탭으로.
 * (메인 페이지 디자인·견적서 설정은 자주 써서 사이드바에 따로 있음)
 */
const TABS = [
  { href: "/admin/settings", label: "기본 정보" },
  { href: "/admin/settings/perks", label: "추가 혜택" },
  { href: "/admin/settings/type-layouts", label: "유형별 표시" },
  { href: "/admin/settings/diagnosis", label: "1분 진단" },
  { href: "/admin/settings/taxonomy", label: "참가 상황·태그" },
] as const;

/** 사이드바 '사이트 설정' 이 선택 표시될 경로 */
export const SETTINGS_TAB_PATHS: string[] = TABS.map((t) => t.href).filter(
  (h) => h !== "/admin/settings"
);

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="사이트 설정 메뉴"
      className="flex items-center gap-1 bg-white border border-ink-100 rounded-btn p-1 w-fit max-w-full overflow-x-auto"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={
              "px-3 py-1.5 rounded text-[12.5px] font-semibold whitespace-nowrap " +
              (active ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900 hover:bg-ink-50")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
