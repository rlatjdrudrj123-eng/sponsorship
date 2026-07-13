import { test, expect, SEED } from "./fixtures/firestore";

/**
 * KO/EN 텍스트 어서션 — 영문 페이지에 한글이 남아있지 않은지.
 *
 * 정책:
 *   - 정적 UI 라벨(버튼/헤딩/안내문)은 EN 페이지에서 100% 영문이어야 한다.
 *   - 단, 사용자 데이터(카테고리/패키지 이름 등)는 lib/i18n/locale.ts 의 정책상
 *     en 값이 비면 ko 로 폴백한다. 즉 "데이터 영역의 한글"은 버그가 아닐 수 있다.
 *   → 따라서 한글 검출은 "정적 chrome(헤더/푸터/필터/빈상태 등)" 위주로 범위를 좁힌다.
 *     전체 페이지 통짜 검사는 데이터 폴백 때문에 오탐이 많다(아래 fixme 참고).
 *
 * 검출 정규식: 한글 음절 + 자모 — /[가-힣ㄱ-ㅎㅏ-ㅣ]/
 */

const EVENT = SEED.eventId;
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

// EN 정적 chrome 후보 영역 셀렉터.
// 사용자 데이터(카드 제목/가격 등) 폴백을 피하기 위해 라벨성 영역만 모은다.
const STATIC_CHROME_SELECTORS = [
  "header",
  "footer",
  "nav",
  "[role='dialog'] header",
];

/**
 * 영문 빈 상태 문구는 데이터가 없어도 렌더되는 "순수 정적 UI" 라 폴백 오탐이 없다.
 * 따라서 데이터 주입 없이도 결정론적으로 검사 가능 → 실제 test 로 활성화.
 * (sponsorships ?view=card 에서 검색어로 0건을 만들면 영문 빈상태 노출)
 */
test.describe("EN 정적 UI — 한글 잔존 검출 (데이터 무관)", () => {
  test("en sponsorships 빈 상태 문구에 한글이 없다", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(`/${EVENT}/en/sponsorships?view=card`);

    // 데이터가 비어 있어도(시드 미주입) loaded 후 0건 빈 상태가 뜬다.
    // 영문 빈 상태/로딩 문구 영역의 텍스트만 모아 한글 검사.
    const candidate = page.getByText(
      /No items match these filters\.|Loading…|Reset filters/
    );
    // 라우트가 살아있으면 최소 하나는 보임.
    await expect(candidate.first()).toBeVisible();

    const text = await candidate.first().innerText();
    expect(
      HANGUL.test(text),
      `영문 빈상태/로딩 문구에 한글 잔존: "${text}"`
    ).toBe(false);
  });

  test("en print/full 안내 바 문구에 한글이 없다", async ({ seededPage }) => {
    const page = seededPage;
    await page.goto(`/${EVENT}/en/print/full`);
    // 상단 print:hidden 안내 바 (영문). a4-page 가 없어도 안내 바는 뜬다.
    const banner = page
      .getByText(/preview|print dialog|Loading images|Print now|pages total/i)
      .first();
    await expect(banner).toBeVisible();
    const text = await banner.innerText();
    expect(HANGUL.test(text), `영문 print 안내 바에 한글 잔존: "${text}"`).toBe(false);
  });
});

/**
 * EN 페이지 정적 chrome 전체 한글 스캔.
 * 데이터 폴백(카테고리/패키지 ko 이름)을 피하려 header/footer/nav 등 라벨 영역만 본다.
 * 그래도 시드가 있어야 페이지가 정상 렌더되므로 데이터 주입 확정 전까지 fixme.
 */
test.describe("EN 정적 chrome — 한글 잔존 스캔 (데이터 의존)", () => {
  const EN_PAGES = [
    { name: "home(en)", path: `/${EVENT}/en` },
    { name: "sponsorships(en, card)", path: `/${EVENT}/en/sponsorships?view=card` },
    { name: "packages(en)", path: `/${EVENT}/en/packages` },
    { name: "compare(en)", path: `/${EVENT}/en/compare` },
    { name: "contact(en)", path: `/${EVENT}/en/contact` },
  ];

  for (const p of EN_PAGES) {
    test.fixme(`${p.name}: 정적 chrome 영역에 한글이 없다`, async ({ seededPage }) => {
      const page = seededPage;
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");

      const offenders: Array<{ selector: string; text: string }> = [];
      for (const sel of STATIC_CHROME_SELECTORS) {
        const loc = page.locator(sel);
        const n = await loc.count();
        for (let i = 0; i < n; i++) {
          const txt = await loc.nth(i).innerText().catch(() => "");
          if (HANGUL.test(txt)) {
            // 매칭된 한글 토막만 추려 리포트.
            const hits = (txt.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]+/g) ?? []).slice(0, 8);
            offenders.push({ selector: sel, text: hits.join(" / ") });
          }
        }
      }
      expect(
        offenders,
        `영문 페이지 정적 chrome 에 한글 잔존:\n${offenders
          .map((o) => `  [${o.selector}] ${o.text}`)
          .join("\n")}`
      ).toEqual([]);
    });
  }
});
