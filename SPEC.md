# K-PRINT 2026 스폰서십 소개 사이트 — 마스터 명세서

> Claude Code 작업 지시서. 이 문서를 첫 메시지로 통째로 붙여넣고 `STEP 1부터 시작해줘`라고 하면 됩니다.
>
> **단계별로 확인하면서 진행하세요. 한 번에 다 만들지 말 것.**

---

## 0. 프로젝트 개요

기존 KIMES 같은 피트페이퍼 PDF를 대체하는 **K-PRINT 스폰서십 소개 웹사이트**.

**고객 흐름**
1. 어딘가에서 링크 받음 (이메일/카톡/QR)
2. 새 소개 사이트에서 스폰서십 둘러보기
3. 관심 항목을 **견적 카트**에 담기 (구좌 단위)
4. 카트 합계 확인 → **문의 폼** 제출
5. 사무국이 어드민에서 문의 확인 → 수동 견적/상담
6. (이후 신청·결제·구좌 배정은 기존 사무국 시스템에서. 우리 영역 밖)

**어드민 흐름**
1. 행사 시작 전: **엑셀 일괄 업로드**로 100개+ 구좌 한 번에 생성
2. 카테고리별로 이미지 업로드, 도면형은 핀 좌표 편집
3. 상시: 마감 처리, 문의 응대
4. 매년 행사 끝나면 다음 해 엑셀 새로 받아 재업로드

**핵심 가치**: 피트페이퍼처럼 한 장씩 디자인하는 노가다를 없애는 것. 어드민이 디자인 결정 안 함, 정해진 슬롯에 끼워넣기만.

---

## 1. 기술 스택 (확정)

| 영역 | 선택 |
|---|---|
| 프레임워크 | **Next.js 14** (App Router, TypeScript) |
| 스타일링 | **Tailwind CSS** |
| DB | **Firebase Firestore** |
| 인증 | **Firebase Auth** (이메일/비밀번호, 화이트리스트 1개 이메일) |
| 스토리지 | **Firebase Storage** (이미지·PDF) |
| 폼 | `react-hook-form` + `zod` |
| 엑셀 파싱 | `xlsx` (sheetjs) |
| 풀페이지 스크롤 | CSS `scroll-snap-type` (라이브러리 없이) |
| 이미지 | `next/image` |
| 배포 | **Vercel** |
| 폰트 | Pretendard (한글), JetBrains Mono (코드) |

**메인 컬러**: `#00bfa6` (민트). Tailwind에 `mint` 컬러 팔레트 추가.

---

## 2. 디렉토리 구조

```
kprint-site/
├── app/
│   ├── (public)/                          # 공개 사이트 그룹
│   │   ├── layout.tsx                     # 풀페이지 스크롤 컨테이너
│   │   ├── page.tsx                       # 홈
│   │   ├── sponsorships/
│   │   │   ├── page.tsx                   # 전체 항목 리스트
│   │   │   └── [slug]/page.tsx            # 카테고리 상세 (유형별 분기)
│   │   ├── packages/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── cart/page.tsx                  # 카트 (localStorage)
│   │   └── contact/page.tsx               # 문의 폼
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── layout.tsx                 # 사이드바 + topbar
│   │   │   ├── page.tsx                   # 대시보드
│   │   │   ├── login/page.tsx
│   │   │   ├── import/page.tsx            # 엑셀 업로드
│   │   │   ├── categories/
│   │   │   │   ├── page.tsx               # 리스트
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx           # 편집
│   │   │   │       └── slots/page.tsx     # 마감 일괄 처리
│   │   │   ├── packages/
│   │   │   ├── inquiries/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── settings/page.tsx
│   ├── api/                               # 필요시 route handlers
│   ├── layout.tsx                         # root
│   └── globals.css
├── components/
│   ├── public/
│   │   ├── HomePage.tsx
│   │   ├── CategoryDetail/                # 유형별 9종
│   │   │   ├── FloorPlanType.tsx          # 도면형
│   │   │   ├── QuantityType.tsx           # 수량형
│   │   │   ├── MediaType.tsx              # 미디어형
│   │   │   ├── DigitalBannerType.tsx
│   │   │   ├── MailingType.tsx
│   │   │   ├── PrintPageType.tsx
│   │   │   ├── ContentType.tsx
│   │   │   ├── XpaceType.tsx
│   │   │   └── PackageType.tsx
│   │   ├── SlotPicker.tsx                 # 구좌 그리드 (공용)
│   │   ├── ImageCarousel.tsx
│   │   ├── PinOverlay.tsx                 # 도면 위 핀
│   │   ├── CartFloating.tsx               # 우측 하단 플로팅
│   │   ├── ContactForm.tsx
│   │   └── PageScroller.tsx               # scroll-snap wrapper
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   ├── ExcelImporter/
│   │   │   ├── DropZone.tsx
│   │   │   ├── ParsedPreview.tsx
│   │   │   ├── SyncModeRadio.tsx
│   │   │   └── index.tsx
│   │   ├── CategoryEditor/
│   │   │   ├── BasicInfoForm.tsx
│   │   │   ├── ImageSlot.tsx              # 캐러셀/단일/갤러리 표시 모드 지원
│   │   │   ├── PinEditor.tsx              # 모달, 도면형 전용
│   │   │   ├── SubcategoryTable.tsx
│   │   │   ├── LivePreview.tsx
│   │   │   └── CompletenessCheck.tsx
│   │   ├── SlotManager.tsx
│   │   ├── InquiryDetail.tsx
│   │   └── SettingsForm.tsx
│   └── ui/                                # 공용 (Button, Input, Pill, Modal 등)
├── lib/
│   ├── firebase/
│   │   ├── config.ts
│   │   ├── auth.ts
│   │   ├── firestore.ts
│   │   └── storage.ts
│   ├── cart/
│   │   ├── cartStore.ts                   # localStorage 기반 (zustand)
│   │   └── types.ts
│   ├── excel/
│   │   ├── parser.ts                      # xlsx 파싱 + validation
│   │   ├── importer.ts                    # Firestore 동기화
│   │   └── template.ts                    # 양식 다운로드용
│   └── types.ts                           # 전역 타입
├── public/
│   ├── templates/kprint_template.xlsx     # 어드민이 다운받는 양식
│   └── (정적 자산)
├── .env.local
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## 3. 데이터 모델 (Firestore)

### 3.1 컬렉션 개요

```
firestore/
├── categories/         # 대분류 (소개 페이지 1개 = 도큐먼트 1개)
├── subcategories/      # 소분류 (가격 단위)
├── slots/              # 구좌 (카트 담기 단위)
├── packages/           # 시그니처/스탠다드 패키지
├── inquiries/          # 고객 문의
├── siteSettings/       # 사이트 전반 설정 (단일 도큐먼트)
├── taxonomy/           # 태그·분류 정의 (단일 도큐먼트)
└── importHistory/      # 엑셀 업로드 이력
```

### 3.2 타입 정의 (`lib/types.ts`)

```typescript
// 카테고리 유형 — 9가지
export type CategoryType =
  | 'floor_plan'      // 도면형 (천장배너, 등록대, 라이팅월, 기둥광고)
  | 'quantity'        // 수량형 (목걸이, 초대장 삽지)
  | 'media'           // 미디어형 (경품 LED)
  | 'digital_banner'  // 디지털 배너 (검색 페이지, 통합검색)
  | 'mailing'         // 발송형 (뉴스레터, APP 푸시)
  | 'print_page'      // 지면형 (쇼가이드 표지)
  | 'content'         // 콘텐츠형 (SNS 인터뷰, 카드뉴스)
  | 'xpace'           // XPACE (옥외 LED, 도면+영상 hybrid)
  | 'package';        // 패키지

export type Channel = 'offline' | 'online' | 'package';

export type ImageDisplayMode = 'single' | 'carousel' | 'gallery';

export type ImageItem = {
  url: string;
  caption?: string;        // 선택, "Hall A 1F 입구측" 같은
  storagePath: string;     // 삭제용
  order: number;
};

export type ImageSlot = {
  mode: ImageDisplayMode;
  images: ImageItem[];
};

// 도면형/XPACE형의 도면 이미지 (소분류별 1장씩)
export type FloorImage = {
  subcategoryId: string;   // 어느 소분류 도면인지
  url: string;
  storagePath: string;
  pins: Pin[];             // 핀 좌표
};

export type Pin = {
  slotId: string;          // 어떤 슬롯과 연결
  x: number;               // 0~100 (% 단위)
  y: number;               // 0~100
  note?: string;           // 위치 메모 (고객 페이지 노출, "동측 동선 인접")
};

// ============= CATEGORY =============
export type Category = {
  id: string;
  code: string;                // "CBA" — 영문 3자리
  channel: Channel;
  type: CategoryType;
  slug: string;                // URL용 ("ceiling-banner")

  name: { ko: string; en: string };
  shortDesc?: string;          // 페이지 상단 strip 한 줄
  longDesc?: string;           // 본문 (선택)

  // 공통 스펙 (소분류별로 다르면 비워두고 subcategory에서)
  size?: string;
  fileFormat?: string;
  deadline?: Timestamp;
  designGuideText?: string;
  designGuideFileUrl?: string;
  designGuideFilePath?: string;

  // 이미지 슬롯들
  heroImages: ImageSlot;
  detailImages?: ImageSlot;
  floorImages?: FloorImage[]; // 도면형/XPACE만

  // 영상 (미디어형/XPACE형)
  videoUrl?: string;
  videoSpec?: {
    duration?: number;        // 초
    resolution?: string;      // "2480x2160"
    plays?: number;           // 송출 횟수
  };

  // 발송형
  mailingSpec?: {
    sendDates: string[];      // 발송 예정일들
    audience: number;         // 발송 대상 수
    audienceLabel?: string;   // "국내 등록자"
  };

  // 콘텐츠형
  contentSpec?: {
    channel: string;          // "Instagram"
    format: string;           // "릴스 + 카드뉴스 5장"
  };

  tags: string[];              // taxonomy의 태그 ID
  isPublished: boolean;
  order: number;

  // 잠금 상태 (엑셀 동기화 필드는 잠금)
  lockedFields: string[];      // ["name.ko", "code", "size", ...]

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastImportId?: string;       // 마지막 엑셀 임포트 ID
};

// ============= SUBCATEGORY =============
export type Subcategory = {
  id: string;
  categoryId: string;
  name: { ko: string; en: string };  // "Hall A", "표4(국/영문)"

  // 가격 — 소분류 단위 (같은 카테고리 안에서 다를 수 있음)
  priceKRW: number;
  priceUSD?: number;
  unit: { ko: string; en: string };  // "구좌당", "5,000개당"
  priceNote?: string;                // "제작설치비 포함, 부가세 별도"

  // 소분류별 사이즈 (카테고리와 다를 때만)
  size?: string;

  order: number;
};

// ============= SLOT =============
export type Slot = {
  id: string;
  subcategoryId: string;
  categoryId: string;          // 빠른 조회용 (denormalized)
  code: string;                // "CBA-1", "RGA-1-1"
  status: 'available' | 'sold' | 'reserved';
  note?: string;               // 위치 메모 (도면 핀에서도 사용)
  order: number;
};

// ============= PACKAGE =============
export type Package = {
  id: string;
  code: string;                // "PC-2"
  name: { ko: string; en: string };
  tier: 'signature' | 'standard';
  tagline?: string;

  // 포함 항목 — 자유 형식
  includedItems: Array<{
    label: string;             // "참관객 등록대 5구좌"
    referencedSlotIds?: string[]; // 선택, 실제 슬롯 연결 시
  }>;

  originalPrice: number;       // 원가
  discountPrice: number;       // 할인가
  unit?: string;               // "패키지"
  priceNote?: string;

  heroImages?: ImageSlot;

  isPublished: boolean;
  order: number;
};

// ============= INQUIRY =============
export type CartItem =
  | { type: 'slot'; slotId: string; categoryId: string; subcategoryId: string; code: string; price: number; }
  | { type: 'package'; packageId: string; code: string; price: number; };

export type Inquiry = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;

  cartItems: CartItem[];       // 카트에서 자동 첨부
  cartSubtotal: number;
  cartVat: number;
  cartTotal: number;

  message: string;

  status: 'new' | 'in_progress' | 'closed';
  adminNote?: string;          // 사무국 내부 메모

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ============= SITE SETTINGS =============
export type SiteSettings = {
  event: {
    nameKo: string;            // "K-PRINT 2026"
    nameEn: string;
    dateRange: string;         // "2026.08.19 — 22"
    venue: string;             // "KINTEX 제2전시장 7,8홀"
    applicationDeadline: Timestamp;
  };

  kv: {
    desktopUrl: string;
    mobileUrl?: string;
    overlayText?: string;      // 선택, KV 위 한 줄
  };

  why: {
    headline: string;          // "왜 K-PRINT인가?"
    stats: Array<{
      label: string;           // "방문객"
      value: string;           // "72,507"
      suffix?: string;         // "명"
      desc?: string;
    }>;
    chartData?: Array<{ year: number; visitors: number; exhibitors: number }>;
  };

  contact: {
    phone: string;
    email: string;
    address: string;
  };

  applicationSteps: Array<{ title: string; desc?: string }>;
};

// ============= TAXONOMY =============
export type Taxonomy = {
  tags: Array<{ id: string; label: string; color?: string }>;
  channels: Array<{ id: Channel; label: string }>;
};

// ============= IMPORT HISTORY =============
export type ImportHistory = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;          // email
  mode: 'overwrite' | 'merge' | 'add_only';
  counts: {
    categories: number;
    subcategories: number;
    slots: number;
    errors: number;
  };
  errors?: Array<{ row: number; reason: string }>;
  createdAt: Timestamp;
};
```

### 3.3 Firestore 인덱스

복합 인덱스 필요:
- `categories`: `isPublished` ASC + `order` ASC
- `subcategories`: `categoryId` ASC + `order` ASC
- `slots`: `categoryId` ASC + `status` ASC
- `slots`: `subcategoryId` ASC + `order` ASC
- `inquiries`: `status` ASC + `createdAt` DESC

### 3.4 Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 공개 읽기 (published만)
    match /categories/{id} {
      allow read: if resource.data.isPublished == true || isAdmin();
      allow write: if isAdmin();
    }
    match /subcategories/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /slots/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /packages/{id} {
      allow read: if resource.data.isPublished == true || isAdmin();
      allow write: if isAdmin();
    }
    match /siteSettings/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /taxonomy/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 문의 — 누구나 생성, 어드민만 읽기/수정
    match /inquiries/{id} {
      allow create: if request.resource.data.keys().hasAll(['companyName','contactName','email','phone','message'])
                    && request.resource.data.status == 'new';
      allow read, update, delete: if isAdmin();
    }

    match /importHistory/{id} {
      allow read, write: if isAdmin();
    }

    function isAdmin() {
      return request.auth != null
        && request.auth.token.email in ['admin@kprint.kr']; // 실제 이메일로 교체
    }
  }
}
```

### 3.5 Storage Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /categories/{categoryId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email in ['admin@kprint.kr'];
    }
    match /packages/{packageId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email in ['admin@kprint.kr'];
    }
    match /settings/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email in ['admin@kprint.kr'];
    }
  }
}
```

---

## 4. 페이지 구조

### 4.1 공개 사이트 (풀페이지 세로 스크롤)

전체 사이트는 `scroll-snap-type: y mandatory`로 한 화면이 한 페이지가 되게.

```
/                           홈
  ├─ #1  KV (통이미지 슬롯 + 행사 정보)
  ├─ #2  Why K-PRINT (통계 차트)
  ├─ #3  스폰서 혜택 (리뉴얼 기념)
  ├─ #4  스폰서십 한눈에 보기 (카테고리 그리드)
  ├─ #5  추천 패키지 (시그니처 카드)
  └─ #6  CTA (전체 둘러보기 / 문의하기)

/sponsorships               전체 항목 리스트
  ├─ 좌측 사이드바: 채널 + 태그 필터
  ├─ 카드 그리드 (대분류 단위)
  └─ 카드 클릭 → /sponsorships/[slug]

/sponsorships/[slug]        카테고리 상세 (유형별 컴포넌트로 분기)
  ├─ #1  히어로 (제목 + 한줄 설명 + 대표 이미지 캐러셀)
  ├─ #2  유형별 메인 (도면+핀 / 갤러리 / 영상 / 미리보기 등)
  ├─ #3  스펙 + 가이드 다운로드
  ├─ #4  소분류별 구좌 그리드 (카트 담기)
  └─ #5  CTA (다음 카테고리 / 카트 보기)

/packages                   패키지 리스트 (시그니처/스탠다드 탭)
/packages/[id]              패키지 상세

/cart                       견적 카트 (localStorage)
  ├─ 담은 항목 리스트 (수정/삭제)
  ├─ 합계 (소계 + VAT 10%)
  └─ [문의하기 →]

/contact                    문의 폼
  ├─ 카트 자동 첨부 (수정 가능)
  ├─ 회사/담당자/연락처/메시지
  └─ 제출 → Firestore inquiries 저장
```

**플로팅 요소 (전 페이지 공통)**:
- 우측 하단: 🛒 견적 카트 버튼 (담은 항목 수 배지)
- (네비게이터 인디케이터는 배제 — 카테고리별로 별도 URL이라 의미 없음)

### 4.2 어드민

```
/admin/login                 로그인 (이메일/비번)
/admin                       대시보드 (신규 문의 수, 카테고리 수, 최근 활동)
/admin/import                ⭐ 엑셀 일괄 업로드 (핵심)
/admin/categories            카테고리 리스트
/admin/categories/[id]       카테고리 편집 (이미지 + 텍스트)
/admin/categories/[id]/slots 슬롯 마감 일괄 처리
/admin/packages              패키지 CRUD
/admin/inquiries             문의 리스트
/admin/inquiries/[id]        문의 상세 + 상태 변경
/admin/settings              사이트 설정 (이벤트 정보 + KV + 통계 + 연락처)
/admin/settings/taxonomy     태그·분류 관리
```

---

## 5. 핵심 기능 상세

### 5.1 엑셀 일괄 업로드 (가장 중요)

**입력 양식** (xlsx, 1행 헤더 고정):

| 컬럼 | 필수 | 예시 | 설명 |
|---|---|---|---|
| `channel` | ✓ | offline | offline / online / package |
| `category_code` | ✓ | CBA | 영문 3자리 |
| `category_name_ko` | ✓ | 천장 배너 | |
| `category_name_en` | ✓ | Ceiling Banner | |
| `category_type` | ✓ | floor_plan | 9가지 유형 중 |
| `subcategory_name_ko` | | Hall A | 비우면 단일 소분류로 자동 생성 |
| `subcategory_name_en` | | Hall A | |
| `slot_code` | ✓ | CBA-1 | 전역 유니크 |
| `size` | | 1800mm × 3500mm | |
| `file_format` | | eps, ai, pdf | |
| `deadline` | | 2026-06-30 | ISO 또는 yyyy-mm-dd |
| `price_krw` | ✓ | 3000000 | 콤마 OK, 숫자만 추출 |
| `price_usd` | | 3000 | |
| `unit_ko` | | 구좌당 | |
| `unit_en` | | per slot | |
| `is_sold` | | FALSE | TRUE/FALSE 또는 마감/가능 |
| `note` | | 동측 동선 인접 | 위치 메모 |
| `tags` | | 브랜드_확산형, 온사이트 | 콤마 구분 |

**파싱 로직** (`lib/excel/parser.ts`):
1. `xlsx` 라이브러리로 시트 읽기
2. 헤더 검증 (필수 컬럼 누락 시 에러)
3. 행별 검증:
   - 코드 중복 체크
   - 가격 숫자 변환
   - `category_type`이 9개 유형 중 하나인지
   - 마감 컬럼 boolean 변환
4. 결과를 `ParseResult` 객체로 반환:
   ```ts
   type ParseResult = {
     rows: ParsedRow[];
     errors: Array<{ row: number; column?: string; reason: string }>;
     summary: { categories: number; subcategories: number; slots: number };
   };
   ```

**임포트 모드** (`lib/excel/importer.ts`):
- **overwrite** (덮어쓰기): 기존 categories/subcategories/slots 전부 삭제 후 재생성. 단, 이미지·핀 좌표·텍스트(longDesc 등)는 코드 매칭으로 보존.
- **merge** (병합): 같은 `category_code` + `slot_code`는 가격·마감·사이즈만 갱신. 새 항목 추가.
- **add_only** (신규만): 기존 코드 무시, 새 코드만 추가.

**보존 규칙** (overwrite 모드 핵심):
- 카테고리 이미지(`heroImages`, `detailImages`, `floorImages.url`, `floorImages.pins`), `longDesc`, `videoUrl`은 **코드 매칭으로 그대로 이전**.
- 잠금 필드(`lockedFields`)는 모든 모드에서 엑셀 값으로 갱신됨 (그래서 잠겼다는 표시).

**잠금 필드 자동 설정**:
엑셀 임포트로 들어온 모든 필드는 자동으로 `lockedFields`에 추가됨. 어드민이 카테고리 편집 화면에서 🔒 토글로 잠금 해제 가능. 잠금 해제하면 다음 임포트 때 덮어써지지 않음.

**진행 흐름 UI**:
1. 드롭존에 파일 업로드 → `parser.ts`가 즉시 파싱
2. 결과 4박스 표시 (대분류/소분류/구좌/경고)
3. 미리보기 테이블 (먼저 10행, 오류는 빨간 배경)
4. 동기화 모드 라디오 (덮어쓰기/병합/신규만)
5. `[N개 항목 업로드 →]` 버튼 클릭
6. Firestore batch write (500개 단위로 분할)
7. 완료 후 `importHistory`에 기록 + `categories` 목록으로 이동

**양식 다운로드**:
`/admin/import` 페이지에 `[엑셀 양식 다운로드]` 버튼. `public/templates/kprint_template.xlsx` 정적 파일 제공. 헤더 + 예시 3행 포함.

---

### 5.2 카테고리 편집

**레이아웃**: 좌측 폼 + 우측 sticky 미리보기/체크리스트.

**섹션 구성**:

1. **기본 정보**
   - 이름(KO/EN), 코드, 채널, 유형, 한 줄 설명, 본문
   - 엑셀 동기화된 필드는 🔒 표시 (클릭으로 토글)
   - 자동 저장 (debounce 1.5s)

2. **이미지 슬롯** (유형별 다름, 표 참조)
   - 각 슬롯마다 표시 모드 선택 (`single` / `carousel` / `gallery`)
   - 드래그앤드롭 업로드, 다중 파일 OK
   - 각 이미지에 캡션 입력 (선택)
   - 순서 변경 (드래그) / 삭제 / 일괄 폴더 업로드 버튼
   - 도면 슬롯은 별도 컴포넌트 — 핀 편집 버튼 표시

3. **스펙·가이드**
   - 사이즈, 파일 형식, 마감일 (모두 잠금 가능)
   - 디자인 가이드 PDF 업로드 (Storage)
   - 태그 다중 선택 (toggle chips)

4. **소분류·구좌 요약**
   - 테이블: 소분류명 / 구좌 수 / 가능 / 마감 / 단가 / [관리]
   - [슬롯 마감 일괄 처리 →] 버튼 → `/admin/categories/[id]/slots`

**우측 미리보기**:
- 16:10 프레임에 실제 페이지 축소 렌더 (CSS transform: scale)
- 데스크톱/모바일 토글
- "완성도 체크" 카드: 기본정보/이미지/도면핀/가이드/태그 상태

**유형별 이미지 슬롯 매트릭스**:

| 유형 | 히어로 | 도면 | 영상 | 디테일 | 추가 슬롯 |
|---|---|---|---|---|---|
| floor_plan | ✓ 캐러셀 | ✓ 소분류별 | | ✓ 캐러셀 | |
| quantity | ✓ 갤러리 | | | ✓ 캐러셀 | |
| media | ✓ 단일 | | ✓ 영상 | ✓ 캐러셀 | |
| digital_banner | ✓ 캐러셀 | | | ✓ 캐러셀 | (디바이스별 mockup) |
| mailing | ✓ 단일 | | | ✓ 캐러셀 | (메일 mockup) |
| print_page | ✓ 갤러리 | | | ✓ 캐러셀 | (책자 mockup) |
| content | ✓ 캐러셀 | | ✓ 영상(선택) | ✓ 캐러셀 | |
| xpace | ✓ 캐러셀 | ✓ 소분류별 | ✓ 영상 | ✓ 캐러셀 | |
| package | ✓ 캐러셀 | | | | |

---

### 5.3 핀 좌표 편집기 (도면형/XPACE 전용)

**진입**: 카테고리 편집 화면의 도면 이미지 타일에서 `[📍 핀 N개]` 버튼 클릭. 모달로 열림.

**레이아웃**: 좌측 캔버스 + 우측 사이드 (구좌 목록 + 선택된 핀 디테일).

**캔버스 동작**:
- 도면 이미지 위에 핀들이 절대 좌표(% 단위)로 배치
- 마우스 호버 시 십자 가이드선 표시, 우상단에 좌표 (X: 62%, Y: 38%)
- **클릭으로 핀 추가**: 다음 미배치 슬롯에 자동 배정 (예: CBA-3까지 배치됐으면 CBA-4가 다음)
- **드래그로 이동**: 핀 잡고 드래그
- **선택**: 핀 클릭하면 우측 디테일 패널에 표시
- 선택된 핀은 다른 색 + 살짝 확대

**우측 사이드**:
- 안내 문구 (민트 박스)
- **구좌 목록**: 슬롯마다 한 줄 (번호 / 코드 / 위치 메모 / 좌표 / × 삭제)
- 미배치 슬롯은 회색 점으로 표시
- 선택된 핀의 디테일 카드: 위치 메모 입력 + 좌표 미세 조정 (숫자 입력)

**저장**: 모달 하단 [저장] → `floorImages[].pins` 업데이트.

**데이터 형태**:
```ts
floorImages: [
  {
    subcategoryId: "...",   // Hall A
    url: "https://...",
    storagePath: "categories/CBA/floor-A.jpg",
    pins: [
      { slotId: "...", x: 18, y: 22, note: "A1 출입구 좌측" },
      { slotId: "...", x: 35, y: 22, note: "A1 출입구 우측" },
      // ...
    ]
  },
  // Hall B, Hall C
]
```

**1차 단순화 옵션** (초기 출시용):
도면 위 핀을 인터랙티브로 만드는 게 부담스러우면, **1차는 도면 통이미지만** (핀이 그려진 이미지를 어드민이 포토샵으로 만들어 통째로 업로드). 핀 편집기는 2차 기능으로 분리.
→ 우선 1차로 진행, 핀 편집기는 STEP 11에서.

---

### 5.4 견적 카트 (localStorage)

**스토리지 키**: `kprint:cart:v1`

**데이터 구조** (`lib/cart/types.ts`):
```ts
type CartState = {
  items: CartItem[];
  updatedAt: string;  // ISO
};
```

**인터랙션**:
- 카테고리 상세 페이지에서 슬롯 그리드의 슬롯 클릭 → 카트에 추가/제거 (토글)
- 패키지 상세 페이지에서 [+ 카트 담기] 클릭
- 우측 하단 플로팅 버튼: 🛒 N개 / 합계 표시
- 클릭 시 `/cart`로 이동

**카트 페이지 (`/cart`)**:
- 담은 항목 리스트 (그룹: 슬롯 / 패키지)
- 각 항목: 카테고리명 / 소분류 / 코드 / 단가 / [×]
- 합계: 소계 + VAT 10% + 합계
- [전체 비우기] [문의하기 →]

**문의 폼 (`/contact`)**:
- 카트 항목 자동 첨부 (편집 가능, 추가/제거)
- 회사명, 담당자, 이메일, 전화 (필수)
- 메시지
- 제출 → Firestore `inquiries.create` (cartItems 스냅샷 저장) → 카트 비움 → 완료 페이지

**상태 관리**: zustand + localStorage middleware. SSR 호환을 위해 `useEffect`에서 hydrate.

---

### 5.5 풀페이지 스크롤

**구현**: CSS scroll-snap (라이브러리 X).

```css
.scroll-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
}
.scroll-section {
  height: 100vh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

**경계 처리**:
- 카테고리 상세 페이지의 슬롯 영역 스크롤은 부모 스크롤과 충돌 가능 → `overscroll-behavior: contain`로 해결
- 모바일: 한 화면 부족하면 컨텐츠 압축 또는 부분적으로 스크롤 허용

**페이지 간 이동**:
- 카테고리 페이지 하단/상단에 [← 이전 카테고리] [다음 카테고리 →] 버튼
- 키보드: 좌우 화살표
- (좌측 사이드 목차는 옵션 — 카테고리 30개라 밀도 높음, 1차에서는 제외하고 추후 추가)

---

### 5.6 어드민 인증

- Firebase Auth 이메일/비밀번호
- 화이트리스트 1개 이메일 (env로 관리: `NEXT_PUBLIC_ADMIN_EMAILS`)
- 미들웨어 (`middleware.ts`): `/admin/*` 접근 시 인증 체크, 미인증 시 `/admin/login`으로 리다이렉트
- Firestore Rules에서도 동일 화이트리스트로 이중 보호

---

## 6. 디자인 토큰

### 6.1 컬러 (Tailwind config)

```ts
colors: {
  mint: {
    50:  '#e6faf6',
    100: '#ccf5ed',
    200: '#99ebdb',
    400: '#33ccb5',
    500: '#00bfa6',  // 메인
    600: '#00a892',
    700: '#00917f',
    900: '#003d35',
  },
  ink: {
    50:  '#f5f6f7',
    100: '#e5e7eb',
    300: '#d1d5db',
    500: '#94a3b8',
    700: '#475569',
    900: '#0f172a',  // 다크 베이스
  }
}
```

### 6.2 폰트

- 본문/UI: **Pretendard** (next/font 또는 CDN)
- 코드/모노: **JetBrains Mono**
- 디스플레이(선택, 표지 큰 활자용): **Pretendard 700/800**

### 6.3 컴포넌트 톤

- 흰 배경 + 절제된 여백 (KIMES PDF 톤)
- 강조는 민트 한 가지
- 카드 라운드 12px, 버튼 8px
- 슬롯 픽커: 가로 직사각형 (정사각형 X, 너무 큼)
  - 마감 = 회색 비활성, 라벨 "마감"
  - 가능 = 흰 배경 + 민트 테두리
  - 담김 = 민트 배경 + 검정 텍스트
- 표지(KV)는 통이미지로, AI스러운 그라데이션 글로우 / 대구법 카피 절대 금지
- 카피는 비워두거나 행사 정보(날짜·장소)만 큼지막하게

---

## 7. 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_ADMIN_EMAILS=admin@kprint.kr
```

---

## 8. 작업 순서 (STEP 1~14)

> **한 STEP 끝낼 때마다 멈추고 사용자에게 확인 받기.** 한꺼번에 진행 X.

### STEP 1 — 프로젝트 셋업
- `create-next-app` (TypeScript, Tailwind, App Router, ESLint)
- 디렉토리 구조 생성 (위 §2 참고)
- Tailwind config에 mint/ink 컬러 추가
- Pretendard 폰트 셋업 (next/font)
- 기본 layout.tsx 작성
- `lib/firebase/config.ts` 작성 (env 읽기)
- `package.json`에 필요 의존성 추가:
  - `firebase`, `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`, `xlsx`, `date-fns`, `lucide-react`
- README에 셋업 가이드

### STEP 2 — 타입 + 더미 데이터
- `lib/types.ts` 작성 (위 §3.2 전체)
- `lib/dummy.ts` — KIMES 데이터 기반 더미 (천장배너, 목걸이, XPACE, 통합검색배너, 뉴스레터 5종 정도)
- 임시로 더미를 import해서 페이지 렌더링 테스트할 수 있게

### STEP 3 — Firebase 셋업 + Auth
- `lib/firebase/config.ts`, `auth.ts`, `firestore.ts`, `storage.ts`
- `/admin/login` 페이지 (로그인 폼)
- `middleware.ts`로 `/admin/*` 보호
- 화이트리스트 체크
- Firestore Rules / Storage Rules 파일 작성 (`firestore.rules`, `storage.rules`)

### STEP 4 — 어드민 레이아웃
- `app/(admin)/admin/layout.tsx`: 사이드바 + topbar (admin-preview.html의 디자인 따라가기)
- 사이드바 메뉴 8개 (대시보드/엑셀업로드/카테고리/패키지/슬롯관리/문의/사이트설정/분류태그)
- 대시보드 페이지 (간단한 카운터 4개)

### STEP 5 — 엑셀 임포터 (⭐ 핵심)
- `lib/excel/parser.ts`: xlsx 파싱 + zod 검증
- `lib/excel/importer.ts`: 3가지 모드 동기화 + 이미지·핀 좌표 보존 로직
- `lib/excel/template.ts`: 양식 생성 (또는 `public/templates/kprint_template.xlsx`)
- `/admin/import` 페이지: 드롭존 + 파싱 결과 + 미리보기 테이블 + 모드 선택 + 실행
- `importHistory` 기록
- **여기서 멈추고 실제 엑셀로 테스트**

### STEP 6 — 카테고리 리스트 + 편집 (이미지·핀 제외)
- `/admin/categories` 리스트 (필터: 채널, 유형, 게시 여부)
- `/admin/categories/[id]` 편집 폼 (기본정보 + 스펙 + 태그)
- 잠금 필드 토글 동작
- 자동 저장 (debounce)

### STEP 7 — 카테고리 편집 (이미지 슬롯)
- `ImageSlot` 컴포넌트 (드래그앤드롭, 캐러셀/단일/갤러리 모드)
- Firebase Storage 업로드/삭제
- 캡션 입력, 순서 변경
- 라이브 미리보기 카드 (간단한 버전)

### STEP 8 — 슬롯 마감 일괄 처리
- `/admin/categories/[id]/slots` 페이지
- 체크박스 다중 선택 + 일괄 마감/가능
- 검색·필터

### STEP 9 — 패키지 CRUD + 사이트 설정
- `/admin/packages` 리스트 + 편집
- `/admin/settings` (이벤트 정보, KV, Why 통계, 연락처)
- `/admin/settings/taxonomy` (태그 관리)

### STEP 10 — 문의 관리
- `/admin/inquiries` 리스트 (상태 필터, 기간)
- `/admin/inquiries/[id]` 상세 (카트 항목 표시, 상태 변경, 어드민 메모)

### STEP 11 — 핀 좌표 편집기
- `PinEditor` 모달 컴포넌트
- 도면 위 클릭으로 핀 추가, 드래그 이동, 좌표 표시
- 우측 슬롯 목록 + 선택된 핀 디테일
- (이게 어려우면 1차는 통이미지만 받고 2차로 미루는 옵션도 OK)

### STEP 12 — 공개 사이트 (홈 + 카테고리 리스트)
- 풀페이지 스크롤 컨테이너
- 홈 (KV + Why + 한눈에 보기 + 추천 패키지)
- `/sponsorships` 리스트 (사이드바 필터)

### STEP 13 — 카테고리 상세 (9가지 유형 컴포넌트)
- 유형별 컴포넌트 9개 (`FloorPlanType.tsx` 등)
- 공용 `SlotPicker`, `ImageCarousel`, `PinOverlay`
- 슬롯 클릭으로 카트 추가
- 패키지 상세도

### STEP 14 — 카트 + 문의 폼 + 마무리
- 카트 zustand store + localStorage
- 플로팅 카트 버튼
- `/cart`, `/contact` 페이지
- 문의 제출 → Firestore + 완료 페이지
- 반응형 점검 (모바일)
- 빌드 + Vercel 배포 가이드

---

## 9. 받아들이지 말 것 (이전 시행착오)

다음은 명시적으로 **하지 않기로** 한 것들:

- ❌ 표지에 그라데이션 글로우, 빛나는 동그라미 (AI 클리셰)
- ❌ 표지 카피로 대구법 ("한 번의 X, 전체의 Y" 같은) — 카피는 비우거나 행사 정보만
- ❌ K-PRINT 포스터처럼 컬러풀한 잉크 스플래시 (어드민 운영 사이트에 부적합)
- ❌ 어드민에 페이지 빌더(섹션 드래그·이동) — 운영 부담만 늘어남. 유형별 고정 템플릿 + 이미지 슬롯으로.
- ❌ 우측 인디케이터 점 (카테고리별 별도 URL이라 의미 없음)
- ❌ 슬롯 버튼을 정사각형으로 (너무 큼) — 가로 직사각형으로
- ❌ 구좌 박스에 헤더·설명 같은 군더더기 — 한 줄 메타로 압축

---

## 10. 시작 방법

VS Code에서 새 폴더 만들고 Claude Code 실행 후 첫 메시지:

> 이 명세서를 그대로 첨부 (전체 복붙).
>
> "STEP 1부터 시작해줘. 한 STEP 끝나면 멈추고 다음으로 넘어갈지 물어봐줘."

---

## 부록 A: 9가지 카테고리 유형 매핑

KIMES 데이터 기준으로 K-PRINT에서 예상되는 항목 매핑:

| 유형 | 예시 카테고리 | 핵심 정보 |
|---|---|---|
| floor_plan | 천장배너, 등록대, 라이팅월, 기둥광고, 동선유도 바닥스티커 | 도면 위치, 핀 |
| quantity | 참관객 목걸이, 초대장 삽지 | 수량 단위 (5천/10만) |
| media | 경품 이벤트 LED | 영상 사양, 송출 횟수 |
| digital_banner | 통합검색, 세미나/전시품/참가업체 검색 페이지 배너 | 노출 페이지, 디바이스 |
| mailing | 뉴스레터(국내/해외), APP 푸시 | 발송일, 대상 수 |
| print_page | 쇼가이드 표4/표2/표3 | 어느 면 |
| content | SNS 인터뷰, 카드뉴스 | 채널, 형식 |
| xpace | 옥외 LED (브릿지/엣지칼럼/와이드/스퀘어) | 도면 + 영상 hybrid |
| package | 시그니처/스탠다드 패키지 | 포함 항목 + 할인가 |

## 부록 B: 어드민 시안 참고
별도 첨부된 `admin-preview.html`을 참고. 디자인 톤·레이아웃은 그 파일을 기준으로.
