"use client";

/**
 * 어드민 접근 권한 상태 — 로그인 계정 + members/{uid} 문서로 결정.
 *
 *   signedOut   로그인 안 됨 → /admin/login
 *   unverified  메일 인증 전 (가입 직후)
 *   noMember    로그인은 했지만 가입 신청서(members 문서)가 없음 → 신청 버튼
 *   pending     가입 신청 후 관리자 승인 대기
 *   disabled    비활성(퇴사 등)
 *   active      사용 가능 — isAdmin(전체 행사·멤버 관리) 또는 담당자(events 만)
 *
 * 최초 관리자(lib/firebase/config 의 BOOTSTRAP_ADMIN_* — 보안 규칙과 같은 값)는
 * members 문서 없이도 관리자로 본다. 다른 관리자는 멤버 관리에서 역할로 지정.
 *
 * ⚠️ 이 상태는 화면 표시용. 실제 차단은 firestore.rules / storage.rules 가 한다.
 */
import { create } from "zustand";
import type { User } from "firebase/auth";
import type { Member } from "@/lib/types";

export type AccessState =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "unverified"; user: User }
  | { state: "noMember"; user: User }
  | { state: "pending"; user: User; member: Member }
  | { state: "disabled"; user: User; member: Member }
  | {
      state: "active";
      user: User;
      /** 최초 관리자(members 문서 없음)면 undefined */
      member?: Member;
      isAdmin: boolean;
      /** 담당자의 접근 가능 행사. 관리자는 "all" */
      events: string[] | "all";
    };

type AccessStore = {
  access: AccessState;
  setAccess: (a: AccessState) => void;
};

export const useAccessStore = create<AccessStore>((set) => ({
  access: { state: "loading" },
  setAccess: (access) => set({ access }),
}));

export function useAccess(): AccessState {
  return useAccessStore((s) => s.access);
}

/** active 상태일 때만 의미 있음. 그 외에는 false. */
export function canAccessEvent(access: AccessState, eventId: string | null | undefined): boolean {
  if (access.state !== "active" || !eventId) return false;
  if (access.isAdmin || access.events === "all") return true;
  return access.events.includes(eventId);
}

export function isAdminAccess(access: AccessState): boolean {
  return access.state === "active" && access.isAdmin;
}

/** 행사 목록을 현재 사용자가 볼 수 있는 것만 남긴다. */
export function filterAccessibleEvents<T extends { id: string }>(
  access: AccessState,
  events: T[]
): T[] {
  if (access.state !== "active") return [];
  if (access.isAdmin || access.events === "all") return events;
  const allowed = new Set(access.events);
  return events.filter((e) => allowed.has(e.id));
}

/** 표시용 이름 — 멤버 이름 > 계정 이름 > 이메일 앞부분 */
export function displayName(access: AccessState): string {
  if (access.state === "loading" || access.state === "signedOut") return "";
  const member = "member" in access ? access.member : undefined;
  return (
    member?.name ||
    access.user.displayName ||
    (access.user.email ? access.user.email.split("@")[0] : "")
  );
}
