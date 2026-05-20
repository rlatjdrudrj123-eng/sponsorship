// 모듈 스코프 메모리 캐시 — 같은 브라우저 세션 안에서 페이지 이동 시
// 같은 Firestore 쿼리/도큐먼트 재요청을 막아 reads 비용 감소.
//
// 사용 시점:
// - 공개 사이트의 categories / subcategories / slots / packages / personas / settings
//   처럼 1분 안에 자주 바뀌지 않는 데이터.
// - 어드민의 실시간 onSnapshot 은 그대로 둠 (실시간 추적 필요).
//
// 주의:
// - 페이지 새로고침 / 새 탭 열기 시 캐시 reset (module reload). 그건 의도적임.
// - Firestore Timestamp 객체를 그대로 메모리에 들고 있으므로 toDate() 호출 안전.
// - sessionStorage 안 씀 — Timestamp 직렬화 / 역직렬화 비용·버그 회피.

type Entry = { ts: number; data: unknown };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 모듈 스코프 메모리 캐시로 fetcher 결과를 보관.
 * 같은 key 로 TTL 안에 다시 호출되면 캐시된 값 반환.
 * 진행 중인 fetch 가 있으면 그 promise 를 공유 (dedupe).
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) {
    return hit.data as T;
  }
  const ongoing = inflight.get(key);
  if (ongoing) {
    return ongoing as Promise<T>;
  }
  const p = fetcher()
    .then((data) => {
      cache.set(key, { ts: Date.now(), data });
      inflight.delete(key);
      return data;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });
  inflight.set(key, p);
  return p;
}

/** 특정 key 캐시 무효화. 데이터 변경 후 호출. */
export function invalidate(key: string): void {
  cache.delete(key);
}

/** prefix 로 시작하는 모든 key 무효화. 예: `cat:` */
export function invalidatePrefix(prefix: string): void {
  const toDelete: string[] = [];
  cache.forEach((_v, k) => {
    if (k.startsWith(prefix)) toDelete.push(k);
  });
  toDelete.forEach((k) => cache.delete(k));
}

/** 전체 캐시 초기화 (디버그·로그아웃 등). */
export function clearCache(): void {
  cache.clear();
}
