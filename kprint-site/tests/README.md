# E2E 테스트 하네스 (Playwright)

K·print 스폰서십 사이트(Next.js 14, App Router)의 E2E 뼈대.

## 빠른 시작

```bash
# 1) @playwright/test 설치 (package.json devDependencies 에 추가만 되어 있음)
npm install

# 2) 브라우저 바이너리 설치
npx playwright install chromium

# 3) .env.local 에 NEXT_PUBLIC_FIREBASE_* 채워두기 (dev 서버 기동 조건)

# 4) 실행 (webServer 가 `npm run dev` 를 자동 기동)
npm test            # 전체
npm run test:print  # 인쇄(print 미디어) 프로젝트만
npm run test:ui     # UI 모드
npm run test:report # 마지막 HTML 리포트
```

## 파일 구조

- `playwright.config.ts` — webServer(`npm run dev`, :3000), baseURL, print 프로젝트, 실패 시 trace/스크린샷/비디오.
- `tests/fixtures/seed.ts` — 최소 시드(카테고리 3 / 패키지 2 / 페르소나 2 / 서브카테고리·슬롯·설정). `print/full` 의 기대 totalPages 와 미매핑 카테고리를 코드로 계산하는 헬퍼 포함.
- `tests/fixtures/firestore.ts` — `window.print()` 차단, Firestore 네트워크 차단, 시드 주입 스켈레톤, `test`/`expect` 픽스처 export.
- `tests/print-full.print.spec.ts` — R1(페이지번호 정합성), R2(미매핑 카테고리 누락) + 데이터 무관 스모크.
- `tests/sponsorships-filter.spec.ts` — budget/persona/search 필터 + 0건 빈 상태 + 스모크.
- `tests/i18n-en.spec.ts` — 영문 페이지 한글 잔존 검출(`/[가-힣ㄱ-ㅎㅏ-ㅣ]/`).

## ⚠️ 활성화에 필요한 결정 (TODO)

이 사이트는 **Firestore 클라이언트 SDK(firebase v12)** 를 쓴다. 브라우저 통신이
REST `fetch` 가 아니라 `firestore.googleapis.com/.../Listen/channel` 형태의 gRPC-Web
스트림이라, **`page.route` 로 시드 JSON 을 단순 주입할 수 없다.** 따라서 데이터 의존
테스트(R1/R2/필터/EN chrome 스캔)는 현재 모두 `test.fixme` 로 비활성화돼 있다.

활성화하려면 아래 중 하나를 확정해야 한다(상세는 `fixtures/firestore.ts` 상단 노트):

- **(A) 권장 — Firestore 에뮬레이터.** `lib/firebase/firestore.ts` 에
  `connectFirestoreEmulator` 분기 추가(앱 소스 수정) + globalSetup 에서 admin SDK 로 seed 적재.
- **(B) 앱 테스트 주입 훅.** `window.__E2E_SEED__` 가 있으면 page 들이 그 데이터를
  state 로 쓰도록 어댑터 추가(앱 소스 수정). `fixtures/firestore.ts` 의 `injectSeed` 가 이미 주입한다.

확정 후 각 spec 의 `test.fixme(...)` 를 `test(...)` 로 바꾸면 된다.

### 추가로 검증/확정이 필요한 부분

- `sponsorships-filter.spec.ts`: 카테고리 카드에 안정적 셀렉터(`data-testid`)가 없다. CardGrid 마크업 확인 후 셀렉터 교체 또는 `data-testid` 추가 요청.
- 페르소나 필터: 실제 매칭은 `components/public/PersonaCourses` 의 `matchesPersona` 규칙을 따른다. 시드 `personas` 배열만으로 결과가 결정되지 않을 수 있어 규칙 확인 필요.
- `i18n-en.spec.ts`: 데이터(카테고리/패키지 이름)는 EN 비면 KO 폴백이 정책이라(`lib/i18n/locale.ts`) 통짜 한글 스캔은 오탐이 난다. 정적 chrome 영역으로 범위를 좁혀 두었다.
