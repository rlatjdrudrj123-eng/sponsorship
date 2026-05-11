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
