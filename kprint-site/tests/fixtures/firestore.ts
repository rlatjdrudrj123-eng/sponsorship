import { test as base, type Page } from "@playwright/test";
import {
  SEED_EVENT_ID,
  seedCategories,
  seedSubcategories,
  seedSlots,
  seedPackages,
  seedPersonas,
  seedSiteSettings,
  seedTaxonomy,
  type SeedDoc,
} from "./seed";

/**
 * Firestore 시드 주입 전략 노트 (반드시 읽을 것)
 * ------------------------------------------------------------------
 * 이 사이트는 Firestore "클라이언트 SDK"(firebase v12) 의 getDocs/getDoc 을 쓴다.
 * 브라우저 네트워크는 REST 가 아니라 다음 형태의 gRPC-Web 채널이다:
 *   POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?...
 *   POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?...
 * (getDocs 도 내부적으로 Listen 채널 1회성 스트림으로 처리된다.)
 *
 * 즉 page.route 로 "응답 JSON 한 덩어리"를 fulfill 하는 단순 목킹이 통하지 않는다.
 * protobuf/gRPC-Web 프레이밍을 흉내 내야 하는데 이는 깨지기 쉽고 SDK 버전에 종속적이다.
 *
 * 따라서 결정론적 시드는 아래 셋 중 하나로 확정해야 한다 (사용자 결정 필요 — TODO):
 *
 *   (A) [권장] Firestore 에뮬레이터 + 시드 스크립트
 *       - lib/firebase/firestore.ts 에 connectFirestoreEmulator 분기 추가가 필요
 *         (예: process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST 있으면 연결).
 *         ※ 이 파일은 "다른 에이전트 담당 소스"라 본 작업에서 건드리지 않았다.
 *       - 테스트 globalSetup 에서 에뮬레이터에 seed*.ts 데이터를 admin SDK 로 적재.
 *       - 가장 현실에 가깝고 안정적. R1/R2/필터 테스트를 그대로 활성화 가능.
 *
 *   (B) 앱 코드에 테스트 주입 훅 추가
 *       - getDb() 호출부보다 앞에서 window.__E2E_SEED__ 가 있으면 그 데이터를
 *         그대로 state 로 쓰도록 하는 소형 어댑터. (소스 수정 필요 → 본 작업 범위 밖)
 *
 *   (C) page.route 로 firestore.googleapis.com 채널 abort + 위 (B)/(A) 병행
 *       - 실 네트워크로 새지 않게 차단만 하는 용도. 단독으로는 데이터 못 채움.
 *
 * 본 픽스처는 (C) 의 "차단" 과 (B) 의 "window 주입" 스켈레톤을 제공한다.
 * 실제 데이터 주입이 동작하려면 (A) 또는 (B) 의 앱측 연동이 선행돼야 하며,
 * 그전까지 데이터 의존 spec 은 test.fixme 로 둔다.
 */

export const SEED = {
  eventId: SEED_EVENT_ID,
  categories: seedCategories,
  subcategories: seedSubcategories,
  slots: seedSlots,
  packages: seedPackages,
  personas: seedPersonas,
  siteSettings: seedSiteSettings,
  taxonomy: seedTaxonomy,
};

type SeedBundle = {
  categories: SeedDoc[];
  subcategories: SeedDoc[];
  slots: SeedDoc[];
  packages: SeedDoc[];
  personas: SeedDoc[];
  siteSettings: SeedDoc;
  taxonomy: SeedDoc;
};

/**
 * window.print() 자동 호출 차단.
 * print/full 페이지는 데이터/이미지 로드 후 window.print() 를 자동 호출한다.
 * 헤드리스에서 print 다이얼로그가 테스트를 멈추지 않도록 no-op 으로 덮는다.
 * 호출 횟수는 window.__printCalls 로 어서션할 수 있다.
 */
export async function stubWindowPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __printCalls?: number };
    w.__printCalls = 0;
    window.print = () => {
      w.__printCalls = (w.__printCalls ?? 0) + 1;
    };
  });
}

/**
 * (C) 실제 Firestore 네트워크 차단 — 테스트가 실 DB 로 새지 않게.
 * gRPC-Web 채널을 abort 한다. 데이터는 (A)/(B) 로 채워야 한다.
 */
export async function blockFirestoreNetwork(page: Page): Promise<void> {
  await page.route(/firestore\.googleapis\.com/, (route) => route.abort());
}

/**
 * (B) 앱이 window.__E2E_SEED__ 를 읽도록 연동돼 있을 때 사용할 주입기 (스켈레톤).
 * 앱측 어댑터가 없으면 이 데이터는 무시된다 (no-op).
 */
export async function injectSeed(
  page: Page,
  bundle: SeedBundle = {
    categories: seedCategories,
    subcategories: seedSubcategories,
    slots: seedSlots,
    packages: seedPackages,
    personas: seedPersonas,
    siteSettings: seedSiteSettings,
    taxonomy: seedTaxonomy,
  }
): Promise<void> {
  await page.addInitScript((data) => {
    (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = data;
  }, bundle);
}

/**
 * 시드/print-stub 이 미리 깔린 page 를 주는 Playwright 픽스처.
 * 사용: import { test, expect } from "../fixtures/firestore";
 */
export const test = base.extend<{ seededPage: Page }>({
  seededPage: async ({ page }, use) => {
    await stubWindowPrint(page);
    await injectSeed(page);
    // 데이터 주입 어댑터가 확정되기 전까지 실 네트워크 차단은 끄지 않는다 —
    // 차단하면 (A)/(B) 미연동 상태에서 페이지가 "빈 데이터"로 떠 디버깅이 더 명확.
    // 실 DB 의존 테스트를 임시로 돌려보려면 아래 줄을 주석 처리하면 된다.
    await blockFirestoreNetwork(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";

/** print/full 경로 헬퍼 — locale 별. */
export function fullPrintPath(eventId: string, locale: "ko" | "en"): string {
  return locale === "en"
    ? `/${eventId}/en/print/full`
    : `/${eventId}/print/full`;
}

/** 스폰서십 목록(카드/필터 모드) 경로 — 필터 UI 는 ?view=card 진입 시 노출됨. */
export function sponsorshipsPath(
  eventId: string,
  locale: "ko" | "en",
  view: "card" | "slide" = "card"
): string {
  const q = view === "card" ? "?view=card" : "";
  return locale === "en"
    ? `/${eventId}/en/sponsorships${q}`
    : `/${eventId}/sponsorships${q}`;
}
