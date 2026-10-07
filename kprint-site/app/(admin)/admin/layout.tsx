"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { isBootstrapAdmin, onAuthChange } from "@/lib/firebase/auth";
import { getDb } from "@/lib/firebase/firestore";
import { useAccess, useAccessStore } from "@/lib/admin/access";
import type { Member } from "@/lib/types";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AccountGate } from "@/components/admin/AccountGate";

/**
 * 어드민 가드 + 사이드바/topbar 크롬.
 *
 * - /admin/login 은 가드 바깥 (사이드바·topbar 없이 풀스크린)
 * - 그 외 /admin/* 은 로그인 계정 + members/{uid} 로 접근 상태를 정한다 (lib/admin/access).
 *   최초 관리자(lib/firebase/config BOOTSTRAP_ADMIN_*)는 members 문서 없이 관리자.
 * - 화면 가드는 안내용이고, 실제 데이터 차단은 보안 규칙이 한다.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  const access = useAccess();
  const setAccess = useAccessStore((s) => s.setAccess);

  useEffect(() => {
    if (isLoginPage) return;

    let unsubMember: (() => void) | null = null;
    const unsubAuth = onAuthChange((u) => {
      unsubMember?.();
      unsubMember = null;

      if (!u) {
        setAccess({ state: "signedOut" });
        router.replace("/admin/login");
        return;
      }
      // 최초 관리자 — 보안 규칙의 isBootstrapAdmin() 과 같은 기준
      if (isBootstrapAdmin(u)) {
        setAccess({ state: "active", user: u, isAdmin: true, events: "all" });
        return;
      }
      if (!u.emailVerified) {
        setAccess({ state: "unverified", user: u });
        return;
      }
      unsubMember = onSnapshot(
        doc(getDb(), "members", u.uid),
        (snap) => {
          if (!snap.exists()) {
            setAccess({ state: "noMember", user: u });
            return;
          }
          const m = { ...(snap.data() as Member), uid: snap.id };
          if (m.status === "pending") setAccess({ state: "pending", user: u, member: m });
          else if (m.status === "disabled") setAccess({ state: "disabled", user: u, member: m });
          else
            setAccess({
              state: "active",
              user: u,
              member: m,
              isAdmin: m.role === "admin",
              events: m.role === "admin" ? "all" : m.events ?? [],
            });
        },
        () => setAccess({ state: "noMember", user: u })
      );
    });

    return () => {
      unsubAuth();
      unsubMember?.();
    };
  }, [isLoginPage, router, setAccess]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (
    access.state === "unverified" ||
    access.state === "noMember" ||
    access.state === "pending" ||
    access.state === "disabled"
  ) {
    return <AccountGate access={access} />;
  }

  if (access.state !== "active") {
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
          {access.state === "loading" ? "인증 확인 중…" : "로그인 페이지로 이동 중…"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopbar user={access.user} />
        <main className="flex-1 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
