"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  isAdminEmail,
  onAuthChange,
  signOut,
  type User,
} from "@/lib/firebase/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

type GuardState = "loading" | "authed" | "unauthed";

/**
 * 클라이언트 사이드 어드민 가드 + 사이드바/topbar 크롬.
 *
 * - /admin/login 은 가드 바깥 (pathname 체크) + 사이드바·topbar 없이 풀스크린 렌더
 * - 그 외 /admin/* 은 onAuthStateChanged + 화이트리스트 검사 후 chrome으로 감쌈
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  const [state, setState] = useState<GuardState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (isLoginPage) return;

    const unsub = onAuthChange(async (u) => {
      if (u && isAdminEmail(u.email)) {
        setUser(u);
        setState("authed");
        return;
      }
      if (u) await signOut();
      setUser(null);
      setState("unauthed");
      router.replace("/admin/login");
    });

    return unsub;
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (state !== "authed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <svg
            className="animate-spin w-4 h-4 text-brand-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <path
              d="M22 12a10 10 0 0 1-10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {state === "loading" ? "인증 확인 중…" : "로그인 페이지로 이동 중…"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopbar user={user} />
        <main className="flex-1 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
