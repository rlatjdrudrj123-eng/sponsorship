"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { CalendarDays } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Event } from "@/lib/types";

/**
 * 루트 진입점.
 * - 활성 행사 중 가장 낮은 order = 기본 행사로 자동 리다이렉트
 * - 참가업체는 보통 메일/마케팅 채널로 받은 직접 링크(/{eventSlug})로 들어옴
 * - 행사가 없거나 모두 비활성이면 "준비 중" 안내
 */
export default function RootRedirect() {
  const [state, setState] = useState<"loading" | "empty">("loading");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(getDb(), "events"), orderBy("order", "asc"))
        );
        const active = snap.docs
          .map((d) => ({ ...(d.data() as Event), id: d.id }))
          .find((e) => e.isActive);
        if (active) {
          window.location.replace(`/${active.id}`);
          return;
        }
        setState("empty");
      } catch {
        setState("empty");
      }
    })();
  }, []);

  if (state === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-white">
        <div className="text-sm text-ink-500">불러오는 중…</div>
      </main>
    );
  }

  // 활성 행사 0개 — 운영자가 행사를 등록할 때까지의 placeholder
  return (
    <main className="min-h-screen bg-white grid place-items-center px-6">
      <div className="text-center max-w-md">
        <CalendarDays className="w-10 h-10 text-ink-300 mx-auto mb-4" />
        <h1 className="text-[22px] font-bold text-ink-900">행사 준비 중</h1>
        <p className="text-[13px] text-ink-700 mt-2 leading-relaxed">
          현재 안내 가능한 행사가 없습니다. 잠시 후 다시 방문해주세요.
        </p>
        <Link
          href="/admin"
          className="text-[11px] text-ink-300 hover:text-ink-700 mt-6 inline-block font-mono"
        >
          admin
        </Link>
      </div>
    </main>
  );
}
