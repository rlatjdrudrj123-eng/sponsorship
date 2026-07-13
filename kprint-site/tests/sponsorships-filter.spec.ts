import { test, expect, sponsorshipsPath, SEED } from "./fixtures/firestore";

/**
 * 목록 필터 — budget / persona / search 기본 동작 + 0건 빈 상태.
 *
 * 대상: /[eventSlug]/sponsorships  (KO),  /[eventSlug]/en/sponsorships (EN)
 *
 * 중요 — UI 진입 경로:
 *   기본 진입은 "슬라이드(slide) 뷰" 라서 필터 사이드바가 보이지 않는다.
 *   필터 UI(검색/예산칩/페르소나)는 ?view=card 로 들어가야 노출된다.
 *   (sponsorshipsPath(..., "card") 가 ?view=card 를 붙인다.)
 *
 * 필터 동작 (app/(public)/[eventSlug]/sponsorships/page.tsx):
 *   - 예산 칩: "100만 이하"(1,000,000) / "300만 이하"(3,000,000) /
 *             "500만 이하"(5,000,000) / "전체"(0).  minPrice <= budget 만 통과.
 *   - 페르소나: 선택 시 matchesPersona 매칭만.
 *   - 검색: name.ko/name.en/code 부분일치 (소문자).
 *   - 0건: "0 / {total}" + "조건에 맞는 항목이 없어요." / "No items match these filters."
 *
 * 시드 가격(카테고리 minPrice, KRW):
 *   cat-1 표지광고 = 3,000,000  / cat-2 디지털배너 = 800,000 / cat-3 현장미디어 = 5,000,000
 *
 * ⚠️ 데이터 의존 → 시드 주입 어댑터 확정 전까지 test.fixme.
 */

const EVENT = SEED.eventId;

test.describe("목록 필터 — 카드/필터 뷰", () => {
  test.fixme("ko: ?view=card 진입 시 필터 사이드바(검색/예산)가 보인다", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(sponsorshipsPath(EVENT, "ko", "card"));
    await expect(page.getByPlaceholder(/검색|이름|코드/)).toBeVisible();
    await expect(page.getByRole("button", { name: "100만 이하" })).toBeVisible();
  });

  test.fixme("ko: 예산 '100만 이하' 칩 → 800,000 짜리 cat-2 만 통과 (3건→1건)", async ({
    seededPage,
  }) => {
    const page = seededPage;
    await page.goto(sponsorshipsPath(EVENT, "ko", "card"));

    // 초기 3건 (cat-1/2/3, package 타입 제외).
    const cards = page.locator("a[href*='/sponsorships/'], [data-testid='category-card']");
    // TODO: 카드에 안정적인 셀렉터(data-testid)가 없다. page.tsx 의 CardGrid 마크업을
    //       확인해 카드 루트에 맞는 셀렉터로 교체하거나 data-testid 추가를 요청할 것.
    await expect(page.getByText(/전체.*3.*개/)).toBeVisible();

    await page.getByRole("button", { name: "100만 이하" }).click();

    // 결과 카운트 "전체 3개 중 1개" / 사이드바 카운트로 확인.
    await expect(page.getByText(/3.*개 중.*1.*개/)).toBeVisible();
    await expect(page.getByText("디지털 배너")).toBeVisible();
    await expect(page.getByText("현장 미디어")).toHaveCount(0);
    void cards;
  });

  test.fixme("ko: 검색 'C2' → cat-2 만, 나머지 사라짐", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(sponsorshipsPath(EVENT, "ko", "card"));
    await page.getByPlaceholder(/검색|이름|코드/).fill("C2");
    await expect(page.getByText("디지털 배너")).toBeVisible();
    await expect(page.getByText("표지 광고")).toHaveCount(0);
  });

  test.fixme("ko: 매칭 0건 → 빈 상태 문구 + '필터 초기화' 노출", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(sponsorshipsPath(EVENT, "ko", "card"));
    // 존재하지 않는 검색어 → 0건
    await page.getByPlaceholder(/검색|이름|코드/).fill("존재하지않는상품zzz");
    await expect(page.getByText("조건에 맞는 항목이 없어요.")).toBeVisible();
    await expect(page.getByText(/^0 \/ \d+$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "필터 초기화" })).toBeVisible();
  });

  test.fixme("en: 매칭 0건 → 영문 빈 상태 문구", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(sponsorshipsPath(EVENT, "en", "card"));
    await page.getByPlaceholder(/search|name|code/i).fill("nonexistent-zzz");
    await expect(page.getByText("No items match these filters.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible();
  });

  test.fixme("ko: 페르소나 'persona-a' 선택 → 매핑된 카테고리만", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(sponsorshipsPath(EVENT, "ko", "card"));
    await page.getByRole("button", { name: /브랜드 인지도/ }).click();
    // persona-a 매핑: cat-1, cat-2 (matchesPersona 규칙에 따라 달라질 수 있음 — TODO 확인)
    // TODO: matchesPersona(components/public/PersonaCourses) 의 실제 매칭 규칙을 읽고
    //       기대 결과를 확정하라. 시드의 personas 배열만으로 결정되지 않을 수 있다.
    await expect(page.getByText("현장 미디어")).toHaveCount(0);
  });
});

test.describe("목록 — 스모크 (데이터 무관)", () => {
  test("ko: ?view=card 라우트가 죽지 않고 모드 토글이 렌더된다", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(sponsorshipsPath(EVENT, "ko", "card"));
    // 카드 모드 상단 바의 '필터로 보기' 토글 or 로딩 문구 중 하나는 보임.
    await expect(
      page
        .getByText(/필터로 보기|불러오는 중|조건에 맞는 항목/)
        .first()
    ).toBeVisible();
  });
});
