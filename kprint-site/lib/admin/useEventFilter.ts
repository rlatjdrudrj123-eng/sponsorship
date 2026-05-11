"use client";

import { useAdminEvent } from "./adminEventStore";

/**
 * 어드민 페이지에서 선택된 행사로 쿼리 필터를 적용할 때 쓰는 헬퍼.
 *
 * - eventId: 현재 선택된 행사 ID (null 가능)
 * - ready: hydrate 완료 + eventId 있음
 *
 * 사용 예:
 *   const { eventId, ready } = useEventFilter();
 *   useEffect(() => {
 *     if (!ready) return;
 *     const q = query(collection(db, "categories"),
 *                     where("eventId", "==", eventId));
 *     ...
 *   }, [ready, eventId]);
 */
export function useEventFilter(): { eventId: string | null; ready: boolean } {
  const eventId = useAdminEvent((s) => s.selectedEventId);
  const hydrated = useAdminEvent((s) => s.hasHydrated);
  return { eventId, ready: hydrated && !!eventId };
}
