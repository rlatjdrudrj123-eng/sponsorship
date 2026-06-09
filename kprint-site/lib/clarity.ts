/**
 * Microsoft Clarity API 얇은 래퍼.
 *
 * - 스크립트가 로드 안 됐거나 SSR 일 때는 no-op (안전).
 * - 화면·행동에 의미 있는 컨텍스트를 태그/이벤트로 보내 대시보드에서 필터링.
 * - 개인정보는 보내지 않음 (이름·이메일 등은 contactIdentify 에서 별도 처리).
 *
 * 사용법:
 *   import { tag, event } from "@/lib/clarity";
 *   tag("locale", "ko");
 *   event("diagnosis_started");
 */

type TagValue = string | number | boolean;

type ClarityFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

function call(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const fn = window.clarity;
  if (!fn) return;
  try {
    fn(...args);
  } catch {
    // 무시
  }
}

/** 세션 태그 — 대시보드에서 필터에 사용 가능. 예: locale, eventSlug, primary_goal. */
export function tag(key: string, value: TagValue | TagValue[]) {
  call("set", key, value);
}

/** 커스텀 이벤트 — 대시보드에서 발생 빈도·세션 분포 분석. */
export function event(name: string) {
  call("event", name);
}

/**
 * 식별 — 사용자가 폼 제출 등으로 자신을 명시한 시점에만 호출.
 * customId (예: 회사명#이메일) 로 같은 사람의 다른 세션 묶기 가능.
 */
export function identify(customId: string, friendlyName?: string) {
  call("identify", customId, undefined, undefined, friendlyName);
}

/** 현재 세션을 강제로 전체 녹화 우선순위로 (중요 이벤트 발생 시). */
export function upgrade(reason: string) {
  call("upgrade", reason);
}
