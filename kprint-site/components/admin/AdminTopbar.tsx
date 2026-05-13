"use client";

import { usePathname, useRouter } from "next/navigation";
import { HelpCircle, LogOut, RefreshCw } from "lucide-react";
import { signOut, type User } from "@/lib/firebase/auth";
import { EventSelector } from "./EventSelector";

const PATH_LABELS: Record<string, string> = {
  "/admin": "대시보드",
  "/admin/import": "엑셀 업로드",
  "/admin/categories": "카테고리",
  "/admin/packages": "패키지",
  "/admin/slots": "슬롯 관리",
  "/admin/inquiries": "문의",
  "/admin/sponsors": "스폰서",
  "/admin/events": "행사 관리",
  "/admin/seed": "데모 시드",
  "/admin/settings": "사이트 설정",
  "/admin/settings/taxonomy": "분류·태그",
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
  const initial = (user?.email?.[0] ?? "A").toUpperCase();

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

      <EventSelector />

      <button
        type="button"
        onClick={handleRefresh}
        className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
        title="새로고침"
        aria-label="새로고침"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
        title="도움말"
        aria-label="도움말"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 pl-3 ml-1 border-l border-ink-100">
        <div
          className="w-8 h-8 rounded-full bg-brand-500 text-ink-900 grid place-items-center font-bold text-[13px]"
          title={user?.email ?? ""}
        >
          {initial}
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
