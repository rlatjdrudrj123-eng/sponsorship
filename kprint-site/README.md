# K-PRINT 2026 스폰서십 사이트

K-PRINT 2026 스폰서십 소개 + 견적 카트 + 어드민 운영 사이트.
프로젝트 명세는 상위 폴더의 [`SPEC.md`](../SPEC.md) 참고.

## 기술 스택

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (mint/ink 팔레트)
- **Firebase** (Firestore / Auth / Storage)
- `react-hook-form` + `zod` / `zustand` / `xlsx` / `date-fns` / `lucide-react`
- 폰트: Pretendard (CDN), JetBrains Mono

## 셋업

```bash
cd kprint-site
npm install
cp .env.local.example .env.local   # 그리고 Firebase 값 채워넣기
npm run dev
```

`http://localhost:3000` 에서 시작 페이지 확인.

## 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

NEXT_PUBLIC_ADMIN_EMAILS=admin@kprint.kr   # 콤마로 여러 개 지정 가능
```

## 디렉토리 구조 (요약)

```
kprint-site/
├── app/
│   ├── (public)/        공개 사이트 (홈, 스폰서십, 패키지, 카트, 문의)
│   ├── (admin)/admin/   어드민 (대시보드, 엑셀 임포트, 카테고리 등)
│   ├── layout.tsx       루트 레이아웃 (Pretendard)
│   └── globals.css      Tailwind + Pretendard CDN
├── components/
│   ├── public/          공개 사이트 컴포넌트
│   ├── admin/           어드민 컴포넌트
│   └── ui/              공용 UI (Button, Pill, Modal 등)
├── lib/
│   ├── firebase/        config, auth, firestore, storage
│   ├── cart/            zustand + localStorage
│   ├── excel/           xlsx 파싱 + Firestore 동기화
│   └── types.ts         전역 타입
└── public/templates/    어드민 다운로드용 엑셀 양식
```

## 개발 명령어

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint
```

## 진행 상태

- [x] STEP 1: 프로젝트 셋업
- [ ] STEP 2: 타입 + 더미 데이터
- [ ] STEP 3: Firebase + Auth
- [ ] STEP 4: 어드민 레이아웃
- [ ] STEP 5: 엑셀 임포터
- [ ] STEP 6~14: ...
