"use client";

/**
 * 어드민에서 선택된 행사 (eventId).
 * - localStorage에 영속
 * - 어드민 모든 페이지가 이 ID로 콘텐츠를 필터
 * - 행사 1개만 있을 땐 그 행사로 자동 선택 (EventSelector 측에서 처리)
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AdminEventState = {
  selectedEventId: string | null;
  hasHydrated: boolean;
  setSelectedEventId: (id: string | null) => void;
  setHasHydrated: (h: boolean) => void;
};

export const useAdminEvent = create<AdminEventState>()(
  persist(
    (set) => ({
      selectedEventId: null,
      hasHydrated: false,
      setSelectedEventId: (id) => set({ selectedEventId: id }),
      setHasHydrated: (h) => set({ hasHydrated: h }),
    }),
    {
      name: "kprint:admin-event:v1",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * 랜딩 캔버스 업로드 경로 — 행사별 폴더(landing/{eventId}/{kind}).
 * 보안 규칙이 담당 행사 폴더에만 쓰기를 허용한다. (예전 업로드는 landing/{kind})
 */
export function landingUploadPrefix(kind: string): string {
  const ev = useAdminEvent.getState().selectedEventId;
  return ev ? `landing/${ev}/${kind}` : `landing/${kind}`;
}
