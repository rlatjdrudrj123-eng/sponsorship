import { defineConfig, devices } from "@playwright/test";

/**
 * E2E 테스트 하네스 — K·print 스폰서십 사이트 (Next.js 14, App Router).
 *
 * 실행 전 준비 (사용자):
 *   1) npm i -D @playwright/test  (devDependencies 에 추가만 되어 있음. 설치는 수동)
 *   2) npx playwright install chromium
 *   3) .env.local 에 NEXT_PUBLIC_FIREBASE_* 값 (dev 서버 기동에 필요)
 *
 * 데이터 결정론:
 *   이 사이트는 Firestore "클라이언트 SDK"(firebase v12, getDocs/getDoc)를 쓴다.
 *   네트워크는 REST fetch 가 아니라 gRPC-Web Listen/Write 채널이라
 *   page.route 로 시드 JSON 을 직접 주입하기가 매우 까다롭다.
 *   tests/fixtures/seed.ts 의 전략 노트 참고. 데이터 의존 테스트는 현재
 *   test.fixme 로 표시되어 있고, 시드 전략 확정 후 활성화한다.
 */

const PORT = 3000;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  // 데이터 의존 + window.print() 자동 호출 페이지가 많아 직렬 실행이 안전.
  // 안정화 후 fullyParallel: true 로 올릴 수 있다.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    // 실패 시에만 흔적 남김 — 회귀 디버깅용.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // 인쇄(PDF) 페이지 검증 전용 — print 미디어 에뮬레이션.
      // 테스트 내부에서 page.emulateMedia({ media: "print" }) 도 호출하지만,
      // 프로젝트 단위로도 분리해 "지금 인쇄"/스크린샷을 print 레이아웃으로 본다.
      name: "print",
      use: {
        ...devices["Desktop Chrome"],
        // A4 가로 비율에 가까운 큰 뷰포트 — 캔버스 스케일 계산이 viewport 의존적.
        viewport: { width: 1400, height: 900 },
        colorScheme: "light",
      },
      // print 미디어 검증 스펙만 이 프로젝트로 (파일명 *.print.spec.ts).
      testMatch: /.*\.print\.spec\.ts/,
    },
  ],

  // Next dev 서버 자동 기동. 이미 떠 있으면 재사용.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // dev 서버 stdout/stderr 를 테스트 로그로 흘림 (Firebase config 누락 등 조기 발견).
    stdout: "pipe",
    stderr: "pipe",
  },
});
