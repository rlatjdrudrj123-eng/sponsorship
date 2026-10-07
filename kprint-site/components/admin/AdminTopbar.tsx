"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, GraduationCap, HelpCircle, ListChecks, LogOut, MousePointerClick, PlayCircle, RefreshCw } from "lucide-react";
import { MAIN_TOUR, pageTourFor, useOnboarding } from "@/lib/admin/onboarding";
import { signOut, type User } from "@/lib/firebase/auth";
import { displayName, isAdminAccess, useAccess } from "@/lib/admin/access";
import { EventSelector } from "./EventSelector";

const PATH_LABELS: Record<string, string> = {
  "/admin": "스폰서십 매체",
  "/admin/members": "멤버 관리",
  "/admin/history": "변경 이력",
  "/admin/help": "사용 안내",
  "/admin/import": "엑셀 일괄 등록",
  "/admin/categories": "스폰서십 매체",
  "/admin/classification": "매체 분류",
  "/admin/packages": "패키지",
  "/admin/slots": "판매 현황",
  "/admin/inquiries": "문의",
  "/admin/sponsors": "스폰서 관리",
  "/admin/events": "행사 관리",
  "/admin/seed": "데모 시드",
  "/admin/settings": "사이트 설정",
  "/admin/settings/perks": "사이트 설정 · 추가 혜택",
  "/admin/settings/type-layouts": "사이트 설정 · 유형별 표시",
  "/admin/settings/diagnosis": "사이트 설정 · 1분 진단",
  "/admin/settings/taxonomy": "사이트 설정 · 참가 상황·태그",
  "/admin/settings/landing": "메인 페이지 디자인",
  "/admin/settings/quote": "견적서 설정",
};

function pageLabel(pathname: string): string {
  if (PATH_LABELS[pathname]) return PATH_LABELS[pathname];
  // 가장 긴 prefix 매칭 — /admin/categories/[id] 같은 동적 경로 대응
  const match = Object.keys(PATH_LABELS)
    .filter((k) => pathname === k || pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PATH_LABELS[match] : "Admin";
}

export function AdminTopbar({ user }: { user: User | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const access = useAccess();
  const name = displayName(access);
  const roleLabel = isAdminAccess(access) ? "관리자" : "담당자";
  const initial = (name?.[0] ?? user?.email?.[0] ?? "A").toUpperCase();

  const handleLogout = async () => {
    await signOut();
    router.replace("/admin/login");
  };

  const handleRefresh = () => {
    router.refresh();
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-ink-100 px-7 h-[56px] flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-[13px] text-ink-700 min-w-0">
        <span className="font-semibold text-ink-900 truncate">{pageLabel(pathname)}</span>
      </div>

      <div className="flex-1" />

      <div data-tour="event-selector">
        <EventSelector />
      </div>

      <button
        type="button"
        onClick={handleRefresh}
        className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
        title="새로고침"
        aria-label="새로고침"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      <HelpMenu pathname={pathname} />

      <div className="flex items-center gap-2 pl-3 ml-1 border-l border-ink-100">
        <div
          className="w-8 h-8 rounded-full bg-brand-500 text-white grid place-items-center font-bold text-[13px]"
          title={user?.email ?? ""}
        >
          {initial}
        </div>
        <div className="hidden md:block leading-tight min-w-0">
          <div className="text-[12.5px] font-semibold text-ink-900 truncate max-w-[140px]">
            {name}
          </div>
          <div className="text-[11px] text-ink-500">{roleLabel}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs text-ink-500 hover:text-ink-900 flex items-center gap-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          로그아웃
        </button>
      </div>
    </header>
  );
}

/** 도움말(?) — 투어 다시 보기·이 화면 둘러보기·시작하기 목록·사용 안내 */
function HelpMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const startTour = useOnboarding((s) => s.startTour);
  const setHidden = useOnboarding((s) => s.setHidden);
  const setCollapsed = useOnboarding((s) => s.setCollapsed);
  const setPickerOpen = useOnboarding((s) => s.setPickerOpen);
  const pageTour = pageTourFor(pathname);
  const item =
    "w-full text-left px-3 py-2 text-[13px] text-ink-900 hover:bg-ink-50 flex items-center gap-2";
  return (
    <div className="relative" data-tour="help">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
        title="도움말"
        aria-label="도움말"
        aria-expanded={open}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-ink-100 rounded-card shadow-xl min-w-[260px] py-1">
            {pageTour && (
              <button
                type="button"
                className={item}
                onClick={() => {
                  setOpen(false);
                  startTour(pageTour);
                }}
              >
                <MousePointerClick className="w-4 h-4 text-brand-700" />
                {pageTour.label}
              </button>
            )}
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                setPickerOpen(true);
              }}
            >
              <GraduationCap className="w-4 h-4 text-brand-700" />
              업무 따라하기 (매체·패키지·스폰서 등)
            </button>
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                startTour(MAIN_TOUR);
              }}
            >
              <PlayCircle className="w-4 h-4 text-ink-500" />
              처음 화면 투어 다시 보기
            </button>
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                setHidden(false);
                setCollapsed(false);
              }}
            >
              <ListChecks className="w-4 h-4 text-ink-500" />
              시작하기 목록 보기
            </button>
            <Link href="/admin/help" className={item} onClick={() => setOpen(false)}>
              <BookOpen className="w-4 h-4 text-ink-500" />
              사용 안내 (전체 설명)
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
