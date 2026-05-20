"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 어드민 진입점 — 대시보드는 사용 빈도가 낮고 정보 가치가 적어
 * '스폰서십 매체' 페이지로 자동 리다이렉트.
 * (이전 대시보드의 카운트 카드들은 사이드바 inquiry 뱃지로 갈음)
 */
export default function AdminEntry() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/categories");
  }, [router]);
  return (
    <div className="p-12 text-center text-sm text-ink-500">불러오는 중…</div>
  );
}
