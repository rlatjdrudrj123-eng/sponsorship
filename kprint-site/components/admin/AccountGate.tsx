"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import {
  reloadCurrentUser,
  resendVerification,
  signOut,
  type User,
} from "@/lib/firebase/auth";
import type { AccessState } from "@/lib/admin/access";

// 사용 신청서 — 보안 규칙상 메일 인증을 마친 본인만, 'pending·담당자·배정 없음' 으로만 만들 수 있다
async function submitApplication(u: User, name: string): Promise<void> {
  await setDoc(doc(getDb(), "members", u.uid), {
    uid: u.uid,
    email: u.email ?? "",
    name: name.trim(),
    role: "manager",
    events: [],
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 로그인은 했지만 아직 어드민을 쓸 수 없는 상태의 안내 화면.
 * (메일 인증 전 / 가입 신청 전 / 승인 대기 / 비활성)
 */
export function AccountGate({ access }: { access: AccessState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState(
    access.state === "noMember" ? access.user.displayName ?? "" : ""
  );

  // 가입 때 입력한 이름이 있으면 인증 후 첫 접속에서 자동 접수 (한 번만 시도 —
  // 실패하면 아래 수동 신청 버튼으로)
  const autoTried = useRef(false);
  useEffect(() => {
    if (access.state !== "noMember" || autoTried.current) return;
    const dn = access.user.displayName?.trim();
    if (!dn) return;
    autoTried.current = true;
    setBusy(true);
    submitApplication(access.user, dn)
      .catch((e) => setMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, [access]);

  if (
    access.state !== "unverified" &&
    access.state !== "noMember" &&
    access.state !== "pending" &&
    access.state !== "disabled"
  ) {
    return null;
  }
  const email = access.user.email ?? "";

  const logout = async () => {
    await signOut();
    router.replace("/admin/login");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  let title = "";
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (access.state === "unverified") {
    title = "메일 인증이 필요합니다";
    body = (
      <>
        <b className="text-ink-900">{email}</b> 로 보낸 인증 메일의 링크를 누른 뒤,
        아래 [인증 완료] 를 눌러 주세요. 메일이 안 보이면 스팸함을 확인하세요.
      </>
    );
    actions = (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const u = await reloadCurrentUser();
              if (u?.emailVerified) window.location.reload();
              else setMsg("아직 인증되지 않았습니다. 메일의 링크를 먼저 눌러 주세요.");
            })
          }
          className="w-full py-2 rounded-btn bg-brand-500 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          인증 완료
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await resendVerification();
              setMsg("인증 메일을 다시 보냈습니다.");
            })
          }
          className="w-full py-2 rounded-btn border border-ink-100 text-ink-900 text-sm font-semibold hover:bg-ink-50 disabled:opacity-50"
        >
          인증 메일 다시 보내기
        </button>
      </>
    );
  } else if (access.state === "noMember") {
    title = "사용 신청이 필요합니다";
    body = (
      <>
        이 계정(<b className="text-ink-900">{email}</b>)은 아직 사용 신청이 없습니다.
        이름을 확인하고 신청하면 관리자 승인 후 사용할 수 있습니다.
      </>
    );
    actions = (
      <>
        <label className="block text-left">
          <span className="block text-xs text-ink-700 mb-1">이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
          />
        </label>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => run(() => submitApplication(access.user, name))}
          className="w-full py-2 rounded-btn bg-brand-500 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          사용 신청
        </button>
      </>
    );
  } else if (access.state === "pending") {
    title = "승인 대기 중입니다";
    body = (
      <>
        <b className="text-ink-900">{access.member.name}</b> ({email}) 님의 사용 신청이
        접수됐습니다. 관리자가 승인하면서 담당 전시회를 배정하면 바로 사용할 수 있습니다.
      </>
    );
    actions = (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="w-full py-2 rounded-btn border border-ink-100 text-ink-900 text-sm font-semibold hover:bg-ink-50"
      >
        승인 여부 다시 확인
      </button>
    );
  } else {
    title = "사용이 중지된 계정입니다";
    body = <>다시 사용하려면 관리자에게 요청하세요. ({email})</>;
  }

  return (
    <main className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-ink-100 rounded-card p-8 shadow-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          <span className="font-bold text-ink-900 tracking-tight">스폰서십 관리</span>
        </div>
        <h1 className="text-lg font-bold text-ink-900 mb-2 break-keep">{title}</h1>
        <p className="text-sm text-ink-700 leading-relaxed mb-6 break-keep">{body}</p>
        <div className="space-y-2">{actions}</div>
        {msg && (
          <p role="status" className="text-xs text-ink-700 bg-ink-50 rounded-btn px-3 py-2 mt-3">
            {msg}
          </p>
        )}
        <button
          type="button"
          onClick={logout}
          className="mt-5 text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2"
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}
