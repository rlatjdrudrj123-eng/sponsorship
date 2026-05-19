# K-PRINT 2026 스폰서십 진단 챗봇 — 전면 개편 작업 지시서

> 본 문서는 기존 진단 챗봇 (5문항 / 가중치 13개 / 점수 기반 추천) 을 폐기하고, 새 구조 (4문항 / 룩업 테이블 기반 추천) 로 전면 교체하기 위한 작업 명세서입니다.

---

## 1. 폐기 대상

기존 챗봇의 다음 구성을 모두 제거합니다.

- 5단계 질문 흐름 (`goal`, `budget`, `segment`, `companySize`, `experience`)
- 13개 스코어링 가중치 (`goalMatch`, `budgetInRange`, `budgetOverPenalty` ... `onOffBalanceBonus`)
- 점수 합산 기반 추천 로직
- 가중치 조정 어드민 UI (단, 룩업 테이블 어드민 UI는 신설)

---

## 2. 신규 챗봇 구조

### 2.1 첫 화면 (질문 진입 전)

```
K-PRINT 2026
KINTEX 제2전시장 7·8홀
8월 19일(수) — 22일(토)

참가업체 평균
잠재고객 발굴 120건 · 유망고객 확보 33건
(2024 K-PRINT 사무국 집계)

이 트래픽 위에 어떤 스폰서십이 맞는지
3분 만에 알려드립니다.

[추천 받기 시작]   [전체 카탈로그 보기]
```

**구현 요구사항**
- 행사 정보 영역 (날짜·장소) + 평균 트래픽 영역 + CTA 2개
- CTA "추천 받기 시작" → 진단 시작
- CTA "전체 카탈로그 보기" → 카탈로그 전체 인덱스 페이지

---

### 2.2 진단 질문 (4문항)

#### Q1. 목적
```
이번 K-PRINT 참가, 가장 우선하는 목적 하나를 선택해주세요.

○ 신제품·신기술 런칭
○ 신규 거래선·대리점 발굴
○ 기존 고객·파트너 관계 강화
○ 브랜드 인지도·점유율 확대
```

- `value` 키: `launch` / `acquisition` / `retention` / `awareness`
- 보조 설명 (질문 하단): "목적에 따라 채널 매칭이 달라집니다. 가장 우선하는 하나만 선택해주세요."

#### Q2. 부스 규모
```
부스 규모를 알려주세요.

○ 1~2부스 (소형)
○ 3~6부스 (중형)
○ 7부스 이상 (대형)
```

- `value` 키: `small` / `medium` / `large`
- 보조 설명: "광고 예산과 별개로, 부스 규모에 적합한 노출 채널을 매칭합니다."

#### Q3. 예산
```
집행 가능한 최대 예산은?

○ 100만원 수준
○ 500만원 수준
○ 1,500만원 수준
○ 1,500만원 이상
```

- `value` 키: `under_100` / `under_500` / `under_1500` / `over_1500`
- 숫자값 (필터링용): 1000000 / 5000000 / 15000000 / 100000000

#### Q4. 검토 단계
```
검토 단계는 어디쯤이세요?

○ 초기 정보 수집
○ 상품 비교·검토
○ 결정 직전 단계
```

- `value` 키: `early` / `compare` / `decision`
- 보조 설명: "검토 단계에 따라 결과 화면을 다르게 보여드립니다."

---

## 3. 추천 로직 — 룩업 테이블 기반

가중치 점수 계산 X. **Q1 × Q2 = 12개 셀** 각각에 추천 상품 ID 배열을 미리 정의하고, Q3 예산으로 가격 필터링, Q4 검토 단계로 결과 화면 구성 변경.

### 3.1 추천 셀 정의 (예시 — 실제 ID는 카탈로그 ID 사용)

```typescript
const recommendationMatrix: Record<string, Record<string, string[]>> = {
  // Q1 = launch (신제품·신기술 런칭)
  launch: {
    small: ['seminar_banner', 'instagram_card', 'company_search_banner'],
    medium: ['seminar_package', 'interview_sns', 'distribution_stand'],
    large: ['custom_seminar_package', 'seminar_title_sponsor', 'guidebook_back'],
  },
  // Q1 = acquisition (신규 거래선·대리점 발굴)
  acquisition: {
    small: ['company_search_banner', 'product_search_banner', 'category_wall'],
    medium: ['prime_spot_package', 'floor_map_banner', 'floor_map_logo'],
    large: ['prime_spot_package', 'floor_map_banner', 'floor_map_logo', 'pre_registration_banner'],
  },
  // Q1 = retention (기존 고객·파트너 관계 강화)
  retention: {
    small: ['invitation_insert', 'pre_registration_email', 'instagram_card'],
    medium: ['pre_registration_banner', 'invitation_insert', 'newsletter_domestic_aug'],
    large: ['invitation_insert', 'visitor_atoz_package', 'newsletter_domestic_aug'],
  },
  // Q1 = awareness (브랜드 인지도·점유율 확대)
  awareness: {
    small: ['floor_sticker', 'integrated_search_banner', 'category_wall'],
    medium: ['onsite_package', 'ceiling_banner', 'lighting_wall'],
    large: ['visitor_atoz_package', 'ceiling_banner', 'visitor_lanyard'],
  },
};

function getRecommendations(
  q1: string,
  q2: string,
  q3: number,
  q4: string,
): string[] {
  const baseIds = recommendationMatrix[q1]?.[q2] ?? [];
  // Q3 예산으로 필터링
  return baseIds.filter((id) => {
    const product = catalogProducts[id];
    return product && product.minPrice <= q3;
  });
}
```

### 3.2 Q4 검토 단계별 결과 화면 구성

```typescript
type ResultLayout = 'cards' | 'comparison' | 'index';

function getResultLayout(q4: string): ResultLayout {
  if (q4 === 'early') return 'cards';        // 추천 카드 3개 + 짧은 설명
  if (q4 === 'compare') return 'comparison'; // 비교표 (가격·시점·잔여)
  if (q4 === 'decision') return 'cards';     // 카드 + CTA 강조 (문의·견적)
}
```

- `early` (초기 정보 수집): 추천 카드 3개 + 친절한 설명. 진입 가격대 우선
- `compare` (상품 비교·검토): 비교표 형식. 가격·노출 시점·잔여 자리 한눈에
- `decision` (결정 직전): 추천 카드 + 강한 CTA ("견적 문의", "사무국 연결")

---

## 4. 카탈로그 데이터 구조

### 4.1 Product 인터페이스

```typescript
interface Product {
  id: string;                    // 'company_search_banner'
  name: string;                  // '참가업체 검색 배너'
  category: 'offline' | 'online' | 'package' | 'new';
  subCategory: string;           // 'search' | 'banner' | 'sponsor' 등
  minPrice: number;              // 최저 단가 (원)
  pricePerSlot?: number;         // 구좌당 단가
  totalSlots: number;            // 전체 구좌 수
  remainingSlots: number;        // 잔여 구좌 수
  exposureTiming: ('pre' | 'during' | 'post')[];
  location?: string[];           // ['hallA', 'hallB', 'online']
  description: string;           // 상품 설명 (1~2줄)
  recommendationReason: {        // Q1별 추천 이유
    launch?: string;
    acquisition?: string;
    retention?: string;
    awareness?: string;
  };
  imageUrl?: string;
  isPublished: boolean;          // 공개 여부
  isNew?: boolean;               // 신규 상품 뱃지
  deadline?: string;             // 마감일
}
```

### 4.2 카탈로그 데이터 (확정)

#### 패키지 (4개)

```typescript
const packages = [
  {
    id: 'visitor_atoz_package',
    name: '참관객 A to Z 패키지',
    tier: 'signature',
    originalPrice: 15500000,
    discountPrice: 12000000,
    discount: 0.40,
    composition: ['registration_logo', 'pre_registration_banner', 'pre_registration_email', 'visitor_lanyard', 'lighting_wall'],
  },
  {
    id: 'prime_spot_package',
    name: '프라임 스팟 패키지',
    tier: 'signature',
    originalPrice: 9000000,
    discountPrice: 7500000,
    discount: 0.17,
    composition: ['ceiling_banner_x2', 'floor_map_banner', 'company_search_banner'],
  },
  {
    id: 'onsite_package',
    name: '온사이트 패키지',
    tier: 'standard',
    originalPrice: 5500000,
    discountPrice: 4000000,
    discount: 0.27,
    isNew: true,
    composition: ['ceiling_banner', 'floor_sticker_x2', 'lighting_wall'],
  },
  {
    id: 'seminar_package',
    name: '세미나/컨퍼런스 패키지',
    tier: 'standard',
    originalPrice: 4050000,
    discountPrice: 3200000,
    discount: 0.21,
    composition: ['seminar_banner', 'newsletter_domestic_aug', 'interview_sns', 'instagram_card'],
  },
];
```

#### 오프라인 단품 (8개)

| id | name | minPrice | totalSlots | remainingSlots | isNew |
|---|---|---|---|---|---|
| `registration_logo` | 등록데스크 (스폰서 로고) | 1,000,000 | 1 | 1 | - |
| `visitor_lanyard` | 참관객 목걸이 | 8,000,000 | 3 | 3 | - |
| `ceiling_banner` | 천장배너 | 2,000,000 | - | - | - |
| `invitation_insert` | 초대장 삽지 | 8,000,000 | 1 | 1 | - |
| `guidebook_back` | 현장 가이드북 표4 | 4,000,000 | - | - | - |
| `lighting_wall` | 라이팅월 | 1,500,000 | - | - | - |
| `floor_sticker` | 전시장 바닥 스티커 | 1,000,000 | - | - | true |
| `prize_event` | 경품 협찬 이벤트 | 0 (협의) | - | - | true |

#### 온라인 단품 (11개)

| id | name | minPrice | totalSlots | remainingSlots | isNew |
|---|---|---|---|---|---|
| `pre_registration_banner` | 사전등록 페이지 배너 | 3,000,000 | 1 | 1 | - |
| `pre_registration_email` | 참관등록 완료 이메일 | 2,000,000 | 1 | 1 | true |
| `floor_map_banner` | 도면 검색 페이지 배너 | 4,000,000 | 1 | 1 | - |
| `company_search_banner` | 참가업체 검색 배너 | 1,000,000 | 3 | 3 | - |
| `product_search_banner` | 전시품 검색 배너 | 1,000,000 | 3 | 3 | - |
| `integrated_search_banner` | 통합검색 배너 | 1,000,000 | 3 | 3 | true |
| `floor_map_logo` | 도면 내 참가기업 로고 | 2,000,000 | - | - | true |
| `newsletter_domestic_jul` | 국내 뉴스레터 (7월) | 1,500,000 | 1 | 1 | - |
| `newsletter_domestic_aug` | 국내 뉴스레터 (8월) | 2,000,000 | 1 | 1 | - |
| `newsletter_overseas_jul` | 해외 뉴스레터 (7월) | 1,000,000 | 1 | 1 | - |
| `newsletter_overseas_aug` | 해외 뉴스레터 (8월) | 1,500,000 | 1 | 1 | - |
| `seminar_banner` | 세미나 페이지 배너 | 750,000 | 3 | 3 | - |
| `interview_sns` | 참가업체 인터뷰 + SNS | 1,000,000 | 3 | 3 | true |
| `instagram_card` | 인스타 카드뉴스 | 300,000 | - | - | true |

#### 신규 상품 (5개)

| id | name | minPrice | totalSlots | remainingSlots |
|---|---|---|---|---|
| `distribution_stand` | 배포대 스폰서 (자료 거치형) | 1,500,000 | 2 | 2 |
| `category_wall` | 분야별 홍보월 안내 | 1,000,000 | 35 (7면 × 5구좌) | 35 |
| `custom_seminar_package` | 자체 세미나 패키지 | null (별도 문의) | - | - |
| `seminar_title_sponsor` | 세미나 타이틀 스폰서 | 5,000,000 | - | - |
| `seminar_goods_sponsor` | 세미나 굿즈 스폰서 | 500,000 (현물) | - | - |

**중요: `custom_seminar_package`의 가격은 UI에 표시하지 않음. "별도 문의" 표기.**

---

## 5. 결과 화면 구성

### 5.1 공통 요소

각 추천 카드는 다음을 포함:

```
┌─────────────────────────────────────┐
│ [상품명]                  [신규]    │
│ ────────────────────────────────── │
│ 가격: 1,000,000원/구좌              │
│ 잔여: 3구좌                         │
│ 노출 시점: 사전 + 현장              │
│                                     │
│ 왜 추천했는지:                      │
│ 거래선 발굴이 우선하는 1~2부스 업체에│
│ 검색 상위 노출은 가장 효율적인 채널 │
│                                     │
│ [상세 보기]  [문의하기]             │
└─────────────────────────────────────┘
```

### 5.2 Q4 = `early` (초기 정보 수집)

```
[추천 결과]

처음 알아보시는 단계네요. 부담 없이 시작해볼 수 있는 상품 위주로 정리했습니다.

[추천 카드 1]
[추천 카드 2]
[추천 카드 3]

────────────────────────────────────
[더 둘러보기 →]  [사무국 연결 →]
```

### 5.3 Q4 = `compare` (상품 비교·검토)

```
[추천 결과]

후보를 좁히고 계시네요. 비교해서 결정하세요.

┌─────────────────────────────────────────────┐
│ 상품         가격     노출 시점   잔여      │
│ ───────────────────────────────────────── │
│ A 상품      750만    행사 중      O        │
│ B 상품      400만    행사 전+중   O        │
│ C 상품      300만    행사 전      O        │
└─────────────────────────────────────────────┘

[각 상품 상세 카드 ↓]

────────────────────────────────────
[견적서 받기]  [사무국 연결]
```

### 5.4 Q4 = `decision` (결정 직전)

```
[추천 결과]

결정 단계시군요. 바로 진행하실 수 있도록 안내드립니다.

[추천 카드 (CTA 강조)]
[추천 카드 (CTA 강조)]

────────────────────────────────────
[지금 문의하기]  [전화 연결: 02-551-0102]
```

---

## 6. 추천 카드의 "왜 추천했는지" 1줄 — 매핑

```typescript
const reasonTemplates = {
  // Q1 × 상품 카테고리 매핑
  launch: {
    seminar: '신제품 발표는 세미나 채널이 가장 효율적입니다',
    content: '발표 후 콘텐츠 자산화로 사후 마케팅까지 활용',
    signature: '대규모 런칭은 통합 노출로 임팩트 극대화',
  },
  acquisition: {
    search: '검색 상위 노출은 부스 도달의 가장 짧은 경로',
    floor_map: '도면 위 노출로 부스 방문 의사를 직접 자극',
    package: '검색·도면 통합으로 거래선 발굴 동선 풀커버',
  },
  retention: {
    invitation: '기존 거래선·VIP 바이어에게 직접 도달',
    newsletter: '재참가 알림 + 부스 이벤트 안내',
    signature: '관계자 전 동선에서 브랜드 존재감 확보',
  },
  awareness: {
    ceiling: '입장 시 가장 먼저 보이는 대형 매체',
    lanyard: '전 참관객 노출 시간 최장',
    package: '전 동선 통합 노출로 점유율 시각화',
  },
};
```

이 매핑을 카드 렌더 시 적용.

---

## 7. 데이터 추적 — 분석용 로그

다음 이벤트를 모두 기록:

```typescript
interface DiagnosticLog {
  sessionId: string;
  timestamp: Date;
  q1Answer?: string;
  q2Answer?: string;
  q3Answer?: string;
  q4Answer?: string;
  recommendedProductIds: string[];
  userClickedProductIds: string[];
  userClickedCta: ('inquiry' | 'quote' | 'phone' | 'browse_all')[];
  completedFunnel: boolean;     // 4문항 다 답했는지
  exitedAt?: 'q1' | 'q2' | 'q3' | 'q4' | 'result';
}
```

Firebase Firestore에 `diagnostic_logs` 컬렉션으로 저장.

---

## 8. 어드민 UI

기존 가중치 조정 UI 폐기. 신규 UI는 다음 기능:

### 8.1 추천 매트릭스 편집
- Q1 (4개) × Q2 (3개) = 12개 셀
- 각 셀당 추천 상품 ID 1~5개 드래그앤드롭으로 편집
- 변경 즉시 반영

### 8.2 추천 카드 "왜 추천했는지" 문구 편집
- 16개 매핑 (Q1 4개 × 카테고리 4개) 텍스트 편집

### 8.3 카탈로그 상품 편집
- 가격, 잔여 구좌, 공개 여부, 신규 뱃지 토글
- 신규 상품 추가/삭제

### 8.4 진단 로그 대시보드
- Q1 답변 분포 (파이 차트)
- Q2 답변 분포
- Q3 답변 분포
- Q4 답변 분포
- 가장 많이 추천된 상품 TOP 10
- 가장 많이 클릭된 추천 상품 TOP 10
- 이탈 지점 분포 (Q1~결과 화면)
- CTA 클릭률

---

## 9. 카탈로그 페이지 (별도)

기존 카탈로그 페이지 유지하되 다음 정리:

### 9.1 필터
- 가격대: 100만 이하 / 100~500 / 500~1500 / 1500만+
- 노출 시점: 사전 / 현장 / 사후
- 위치: Hall A~D / 온라인
- 카테고리: 오프라인 / 온라인 / 패키지 / 신규
- 마감 임박: 7일 이내

### 9.2 카드 디자인
- 상품 사진 (없으면 카테고리별 일러스트 폴백)
- 가격 (별도 문의 상품은 "별도 문의" 명시)
- 잔여 구좌
- 신규/마감임박 뱃지
- 노출 시점 아이콘
- "자세히 보기" → 상세 페이지

### 9.3 상세 페이지
- 사진 (또는 도면 위치 시각화)
- 상세 설명
- 스펙 (그래픽 사이즈, 위치 등)
- 잔여 구좌
- 가격
- 패키지 조합 시 할인 정보
- CTA: 문의 / 견적 / 사무국 연결

---

## 10. 톤·문구 가이드

- B2B 명사형. 결재 문서에 들어갈 수 있는 어휘.
- 광고 안 산 사람 비교 X. 사회적 증명 강조 X.
- "잔여 X자리" 거짓 표기 X. 실제 잔여 구좌만 표시.
- 신규 상품은 "신규" 뱃지만, 작년 미판매 사실 노출 X.
- 가격 표시: "1,000,000원" 또는 "100만원" 통일 (한 사이트 내에서 일관).
- 추천 카드 설명은 1~2줄. 장황 X.

---

## 11. 우선순위·단계

### Phase 1 (즉시)
1. 기존 5문항 챗봇·가중치 시스템 제거
2. 새 4문항 챗봇 구현
3. 룩업 테이블 기반 추천 로직 구현
4. 추천 결과 카드 (3가지 레이아웃)
5. 신규 상품 5개 카탈로그 추가

### Phase 2 (Phase 1 완료 후)
6. 어드민 UI 신설 (매트릭스 편집, 카탈로그 편집)
7. 진단 로그 수집 + 대시보드
8. CTA 흐름 (문의·견적·전화 연결)

### Phase 3 (선택)
9. A/B 테스트 인프라
10. 신규 상품 렌더링 이미지 추가
11. 모바일 UX 최적화

---

## 12. 검증 체크리스트

구현 완료 후 다음을 확인:

- [ ] Q1~Q4 모두 답하면 추천 결과 표시되는가
- [ ] 예산 답에 따라 가격 초과 상품이 필터링되는가
- [ ] Q4 답에 따라 결과 화면 레이아웃이 바뀌는가
- [ ] 각 추천 카드에 "왜 추천했는지" 1줄이 있는가
- [ ] 잔여 구좌가 실제 데이터와 일치하는가
- [ ] 자체 세미나 패키지 가격이 "별도 문의"로 표시되는가
- [ ] 신규 상품에 "신규" 뱃지가 표시되는가
- [ ] 첫 화면에 데이터 출처 표기가 있는가
- [ ] 진단 로그가 Firestore에 정상 저장되는가
- [ ] 모바일에서 4문항 답하기 부담 없는가
- [ ] CTA 클릭 시 정상 동작하는가 (문의 폼, 전화 등)

---

## 13. 외부 데이터 — 제공된 가격표 기준

작년(2025) 대비 가격 변동은 다음을 반영했음:

- 사전등록 페이지 배너: 600만 → 300만 (-50%)
- 참관등록 완료 이메일: 통합 → 200만 분리
- 도면 검색 페이지 배너: 600만 → 400만 (-33%)
- 참가업체 검색 배너: 200만 → 100만/구좌 (-50%)
- 전시품 검색 배너: 200만 → 100만/구좌 (-50%)
- 통합검색 배너: 신규 100만/구좌
- 도면 내 참가기업 로고: 신규 200만
- 국내 뉴스레터: 300만 → 7월 150만 / 8월 200만
- 해외 뉴스레터: 300만 → 7월 100만 / 8월 150만
- 세미나 페이지 배너: 150만 → 75만/구좌 (-50%)
- 참가업체 인터뷰+SNS: 신규 100만 (KIMES 이식)
- 인스타 카드뉴스: 신규 30만
- 등록대: 200만/패널 → 100만/구좌 (-50%, 스폰서 로고로 구조 변경)
- 바닥 스티커: 신규 100만/구좌
- 경품 협찬: 신규 (협의)

패키지 가격 변동:
- 참관객 A to Z: 2,000만 → 1,200만 (-40%)
- 프라임 스팟: 1,000만 → 750만 (-25%)
- 온사이트 패키지: 신규 400만
- 세미나/컨퍼런스: 400만 → 320만 (-20%)

---

## 14. 마지막 — 변경 금지 사항

다음은 사용자/사무국 외부에 노출되지 않아야 합니다:

- 작년 스폰서십 구매 업체 수 (3개사) 노출 금지
- "12배 노출 효과" 같은 베이스 트래픽 적은 수치 노출 금지 — "상위 고정 노출"만 명시
- "가격 평균 40% 인하" 같이 사무국 약점 드러내는 표현 금지 — "30만원부터 시작 가능" 같이 사실 기반만
- 작년 미판매 상품 표기 금지 (모든 상품을 동등하게 표시)
