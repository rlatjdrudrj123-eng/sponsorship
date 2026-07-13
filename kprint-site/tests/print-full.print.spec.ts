import { test, expect, fullPrintPath, SEED } from "./fixtures/firestore";
import {
  expectedFullPrintTotalPages,
  expectedUnmappedCategoryNames,
} from "./fixtures/seed";

/**
 * R1 / R2 — 전체 패키지 PDF (print/full) 정합성.
 *
 * 검증 대상 페이지:
 *   /[eventSlug]/print/full          (KO)
 *   /[eventSlug]/en/print/full       (EN, KO 컴포넌트 래핑)
 *
 * 페이지 구조 (app/(public)/[eventSlug]/print/full/page.tsx 기준):
 *   - 각 슬라이드는 <section class="a4-page ...">
 *   - 우하단 페이지 번호: <span>NN</span> / <span>TT</span>  (둘 다 2자리 zero-pad)
 *   - totalPages = cover + atGlance(persona별 + 미매핑 "기타") + packageOverview
 *                  + 단품 카테고리 + closing
 *
 * ⚠️ 데이터 의존: 이 spec 들은 Firestore 시드 주입이 동작해야 의미가 있다.
 *    현재 주입 어댑터(에뮬레이터/window 훅)가 확정되지 않아 test.fixme 로 둔다.
 *    fixtures/firestore.ts 의 전략 노트 (A)/(B) 중 하나를 연동한 뒤
 *    아래 test.fixme(...) 를 test(...) 로 바꿔 활성화하라.
 */

const EVENT = SEED.eventId;

// .a4-page 의 페이지 번호 텍스트(NN/TT)를 파싱한다.
// 마크업: <span class="...font-bold">NN</span><span>/</span>TT
// → 보이는 텍스트는 "NN/TT" 또는 "NN / TT" 형태. 공백 제거 후 매칭.
async function readPageNumbers(page: import("@playwright/test").Page) {
  const pages = page.locator(".a4-page");
  const count = await pages.count();
  const entries: Array<{ index: number; num: number; total: number }> = [];
  for (let i = 0; i < count; i++) {
    const raw = (await pages.nth(i).innerText()).replace(/\s+/g, "");
    const m = raw.match(/(\d{2})\/(\d{2})(?!\d)/);
    expect(m, `.a4-page[${i}] 에 NN/TT 페이지번호가 보여야 함 (got: ${raw.slice(-40)})`).not.toBeNull();
    entries.push({ index: i, num: Number(m![1]), total: Number(m![2]) });
  }
  return { count, entries };
}

test.describe("R1 — 인쇄 PDF 페이지번호 정합성", () => {
  for (const locale of ["ko", "en"] as const) {
    test.fixme(
      `${locale}: .a4-page 개수 == 표시 total, 번호 연속·유일`,
      async ({ seededPage }) => {
        const page = seededPage;
        await page.emulateMedia({ media: "print" });
        await page.goto(fullPrintPath(EVENT, locale));

        // "불러오는 중…/Loading…" 이 사라지고 a4-page 가 렌더될 때까지 대기.
        await expect(page.locator(".a4-page").first()).toBeVisible();

        const { count, entries } = await readPageNumbers(page);
        const expectedTotal = expectedFullPrintTotalPages();

        // (1) DOM 개수 == 시드 기준 기대 페이지 수
        expect(count, "렌더된 .a4-page 개수").toBe(expectedTotal);

        // (2) 모든 슬라이드가 같은 total 을 표시
        const totals = new Set(entries.map((e) => e.total));
        expect(totals, "모든 페이지 번호의 분모(total)는 동일해야 함").toEqual(
          new Set([expectedTotal])
        );

        // (3) 표시 total == 실제 DOM 개수
        expect([...totals][0]).toBe(count);

        // (4) 페이지 번호가 1..N 연속이고 유일
        const nums = entries.map((e) => e.num).sort((a, b) => a - b);
        expect(nums).toEqual(
          Array.from({ length: expectedTotal }, (_, i) => i + 1)
        );

        // (5) DOM 순서 == 번호 순서 (i번째 슬라이드의 번호가 i+1)
        entries.forEach((e) => {
          expect(e.num, `DOM ${e.index}번째 슬라이드 번호`).toBe(e.index + 1);
        });

        // (6) 자동 인쇄가 트리거됐는지 (window.print stub 호출 카운트)
        const printCalls = await page.evaluate(
          () => (window as unknown as { __printCalls?: number }).__printCalls ?? 0
        );
        expect(printCalls, "데이터 로드 후 window.print() 자동 호출").toBeGreaterThanOrEqual(1);
      }
    );
  }
});

test.describe("R2 — 한눈에 보기: 미매핑 카테고리 누락 방지", () => {
  for (const locale of ["ko", "en"] as const) {
    test.fixme(
      `${locale}: 어떤 페르소나에도 없는 카테고리가 "기타/Others" 페이지에 표시됨`,
      async ({ seededPage }) => {
        const page = seededPage;
        await page.goto(fullPrintPath(EVENT, locale));
        await expect(page.locator(".a4-page").first()).toBeVisible();

        const unmapped = expectedUnmappedCategoryNames(); // 시드: ["현장 미디어"]
        expect(unmapped.length, "시드에 미매핑 카테고리가 있어야 테스트가 의미 있음").toBeGreaterThan(0);

        // "기타/Others" 한눈에보기 페이지가 존재
        const othersHeading = locale === "en" ? "Others" : "기타";
        const atGlanceLabel = locale === "en" ? "at a glance" : "한눈에 보기";
        await expect(
          page.getByText(atGlanceLabel, { exact: false }).first()
        ).toBeVisible();

        const othersSlide = page
          .locator(".a4-page")
          .filter({ hasText: othersHeading });
        await expect(
          othersSlide,
          `"${othersHeading}" 요약 페이지가 있어야 함`
        ).toHaveCount(1);

        // 미매핑 카테고리 이름이 전체 문서 어딘가(=기타 페이지)에 노출되는지.
        // (EN 이라도 카테고리 name 은 ko 폴백될 수 있어 ko 이름으로 확인 — locale.ts localized 정책)
        for (const name of unmapped) {
          await expect(
            page.locator(".a4-page", { hasText: name }),
            `미매핑 카테고리 "${name}" 가 어딘가에 노출되어야 함`
          ).not.toHaveCount(0);
        }
      }
    );
  }
});

test.describe("R1/R2 — 스모크 (데이터 무관, 라우트/렌더 자체 검증)", () => {
  // 시드 없이도 돌아가는 최소 스모크 — print/full 라우트가 죽지 않는지,
  // window.print stub 이 다이얼로그를 막는지만 본다.
  // 데이터가 비면 totalPages 는 cover(1)+atGlance(1)+closing(1)=3 이 된다.
  test("ko: print/full 라우트가 로드되고 인쇄 다이얼로그로 멈추지 않는다", async ({
    seededPage,
  }) => {
    const page = seededPage;
    await page.goto(fullPrintPath(EVENT, "ko"));
    // Loading 문구 또는 a4-page 중 하나는 보여야 함 (라우트 자체가 살아있음).
    await expect(
      page.locator(".a4-page").first().or(page.getByText(/불러오는 중|Loading/))
    ).toBeVisible();
    // window.print 가 stub 으로 덮였는지 (다이얼로그로 테스트가 멈추지 않음).
    const isStubbed = await page.evaluate(
      () => typeof (window as unknown as { __printCalls?: number }).__printCalls === "number"
    );
    expect(isStubbed).toBe(true);
  });
});
