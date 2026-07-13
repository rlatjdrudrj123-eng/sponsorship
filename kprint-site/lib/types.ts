import type { Timestamp } from "firebase/firestore";

export type { Timestamp };

// ============= PURPOSE (참가업체 시점의 광고 목적) =============
// 페르소나 3종과 1:1 매칭 — 신제품 홍보형 / 현장 방문객 유도형 / 브랜드 확산형.
// 카테고리는 명시적 purposeOverride 또는 휴리스틱(derivePurposes)으로 매핑됨.
export type Purpose =
  | "new_product"        // 신제품 홍보 — 새 제품·서비스 인지 확보
  | "traffic_driver"     // 현장 방문객 유도 — 부스 동선·트래픽
  | "brand_awareness";   // 브랜드 확산 — 전 동선 통합 노출

export const PURPOSE_ORDER: Purpose[] = [
  "new_product",
  "traffic_driver",
  "brand_awareness",
];

export const PURPOSE_META: Record<
  Purpose,
  { ko: string; en: string; desc: string }
> = {
  new_product: {
    ko: "신제품 홍보",
    en: "New product launch",
    desc: "새 제품·서비스 인지 확보 (사전·온라인 노출 + 발표 채널)",
  },
  traffic_driver: {
    ko: "현장 방문객 유도",
    en: "Drive on-floor traffic",
    desc: "참관객 동선 위에서 부스로 유도",
  },
  brand_awareness: {
    ko: "브랜드 확산",
    en: "Brand awareness",
    desc: "전 동선 통합 노출로 브랜드 인지",
  },
};

// ============= CATEGORY TYPE =============
export type CategoryType =
  | "floor_plan" // 도면형 (천장배너, 등록대, 라이팅월, 기둥광고)
  | "quantity" // 수량형 (목걸이, 초대장 삽지)
  | "media" // 미디어형 (경품 LED)
  | "digital_banner" // 디지털 배너 (검색 페이지, 통합검색)
  | "mailing" // 발송형 (뉴스레터, APP 푸시)
  | "print_page" // 지면형 (쇼가이드 표지)
  | "content" // 콘텐츠형 (SNS 인터뷰, 카드뉴스)
  | "xpace" // XPACE (옥외 LED, 도면+영상 hybrid)
  | "package"; // 패키지

export type Channel = "offline" | "online" | "package";

export type ImageDisplayMode = "single" | "carousel" | "gallery";

export type ImageItem = {
  url: string;
  caption?: string;
  storagePath: string;
  order: number;
};

export type ImageSlot = {
  mode: ImageDisplayMode;
  images: ImageItem[];
};

// 도면형/XPACE형의 도면 이미지 (소분류별 1장씩)
export type FloorImage = {
  subcategoryId: string;
  url: string;
  storagePath: string;
  pins: Pin[];
};

export type Pin = {
  slotId: string;
  x: number; // 0~100 (% 단위)
  y: number; // 0~100
  note?: string;
};

// ============= CATEGORY =============
export type Category = {
  id: string;
  eventId: string;  // 행사 분리 (전시회별 콘텐츠)
  code: string; // 영문 3자리
  /**
   * 진단 챗봇 (룩업 매트릭스) 가 참조하는 안정적 ID. 예: 'registration_logo', 'visitor_lanyard'.
   * 코드(RGA, BGE 등) 는 시드 / 어드민용 식별자, selectorId 는 신규 챗봇·외부 스펙용.
   */
  selectorId?: string;
  channel: Channel;
  type: CategoryType;
  slug: string;

  name: { ko: string; en: string };
  shortDesc?: string;
  /** 영문 사이트(/[eventSlug]/en) 용 한 줄 설명. 비어있으면 shortDesc(한국어) 폴백. */
  shortDescEn?: string;
  longDesc?: string;
  /** 영문 사이트용 긴 설명. 비어있으면 longDesc 폴백. */
  longDescEn?: string;

  // 공통 스펙 (소분류별로 다르면 비워두고 subcategory에서)
  size?: string;
  /** 영문 사이트용 규격. 비어있으면 size 폴백. */
  sizeEn?: string;
  fileFormat?: string;
  /** 영문 사이트용 파일 형식. 비어있으면 fileFormat 폴백. */
  fileFormatEn?: string;
  deadline?: Timestamp;
  designGuideText?: string;
  /** 영문 사이트용 디자인 가이드 텍스트. 비어있으면 designGuideText 폴백. */
  designGuideTextEn?: string;
  designGuideFileUrl?: string;
  designGuideFilePath?: string;

  // 이미지 슬롯들
  heroImages: ImageSlot;
  detailImages?: ImageSlot;
  floorImages?: FloorImage[]; // 도면형/XPACE만

  // 히어로 영역 영상 — 슬라이드 우측 메인 영역에 이미지 대신 영상을 보여주고 싶을 때.
  // (YouTube / Vimeo / Drive / Firebase Storage / 직접 mp4 등 모두 지원 — toEmbedUrl 로 파싱)
  // 값이 있으면 슬라이드 / 모달의 메인 영역에 영상이 재생되고, 없으면 heroImages 첫 장이 노출.
  heroVideoUrl?: string;

  // 영상 (미디어형/XPACE형) — 카테고리 콘텐츠 영상 (예: LED 송출 샘플)
  videoUrl?: string;
  videoSpec?: {
    duration?: number; // 초
    resolution?: string; // "2480x2160"
    plays?: number; // 송출 횟수
  };

  // 발송형
  mailingSpec?: {
    sendDates: string[];
    audience: number;
    audienceLabel?: string;
    /** 영문 사이트용 audienceLabel. 비어있으면 KO 폴백. */
    audienceLabelEn?: string;
  };

  // 콘텐츠형
  contentSpec?: {
    channel: string;
    format: string;
  };

  tags: string[];
  isPublished: boolean;
  isFeatured?: boolean;   // 인기·추천 뱃지 (어드민 수동)
  caseStudies?: Array<{
    company: string;
    year?: string;
    quote?: string;
    logoUrl?: string;
  }>;                     // 이전 행사 사례
  personas?: string[];    // 이 카테고리가 어떤 페르소나에 속하는지 (Persona.id 배열)
  timingOverride?: Array<"pre" | "onsite" | "post">;  // 어드민 수동 지정 (없으면 휴리스틱)
  locationOverride?: Array<"hall_a" | "hall_b" | "hall_c" | "hall_d" | "outdoor" | "online">;  // 어드민 수동 지정
  purposeOverride?: Purpose[];  // 참가업체 목적별 필터링 (없으면 휴리스틱)

  // 사회적 증거 (작년 데이터) — 시드 후 어드민 편집
  lastYear?: {
    buyers?: string[];      // 작년 이 카테고리 구매 회사명
    soldOutDate?: string;   // ISO date, 작년 매진된 날
    avgRoiNote?: string;    // 자유 텍스트, 예: "부스 방문 +27%"
  };

  // 한정 재고 — 슬롯 단위에서도 가능하지만 카테고리 전체 단독 수량 등
  inventoryNote?: string;     // "한정 1자리" 등 자유 텍스트

  // 패키지 크로스 표시 — 이 카테고리에 포함된 슬롯이 어느 패키지에 속하는지
  inPackages?: string[];      // Package.id 배열

  // ── 1분 진단 v3 (점수 기반 추천) 매칭용 ──
  /**
   * 목표 친화도 — Purpose 키마다 0~3 점. 진단 점수 모델의 핵심 입력.
   *   3: 이 목적에 거의 완벽히 부합
   *   2: 잘 맞음
   *   1: 보조적
   *   0: 무관
   * 카테고리 편집 페이지에서 어드민이 슬라이더로 설정.
   */
  goalAffinity?: Partial<Record<Purpose, number>>;
  /**
   * 시너지 페어 — 이 카테고리와 함께 추천될 때 점수 가산되는 다른 카테고리 ID 들.
   *  예: ceiling_banner 의 synergyTargets = ["lighting_wall"] (동선 강화)
   * 단방향만 입력해도 진단 로직이 양방향으로 처리.
   */
  synergyTargets?: string[];   // Category.id 배열
  /**
   * 어드민 큐레이션 가중치 — 진단 결과에서 동률일 때 살짝 위로 끌어올리는 약한 레버.
   * 0 ~ 1 사이. 기본 0.
   */
  recommendBoost?: number;

  order: number;

  // 잠금 상태 (엑셀 동기화 필드는 잠금)
  lockedFields: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastImportId?: string;
};

// ============= SUBCATEGORY =============
export type Subcategory = {
  id: string;
  eventId: string;  // 행사 분리
  categoryId: string;
  name: { ko: string; en: string };

  priceKRW: number;
  priceUSD?: number;
  unit: { ko: string; en: string };
  priceNote?: string;
  /** 영문 사이트용 가격 주석. 비어있으면 priceNote 폴백. */
  priceNoteEn?: string;

  size?: string;

  order: number;
};

// ============= SLOT =============
export type Slot = {
  id: string;
  eventId: string;  // 행사 분리
  subcategoryId: string;
  categoryId: string; // 빠른 조회용 (denormalized)
  code: string;
  status: "available" | "sold" | "reserved";
  note?: string;
  /** 영문 사이트용 메모. 비어있으면 note 폴백. */
  noteEn?: string;
  order: number;
};

// ============= PACKAGE =============
export type Package = {
  id: string;
  eventId: string;  // 행사 분리
  code: string;
  /** 진단 챗봇 룩업 매트릭스용 안정 ID. 예: 'visitor_atoz_package'. */
  selectorId?: string;
  /**
   * 패키지를 구성하는 카테고리의 selectorId 목록.
   * 진단 챗봇 업셀 로직(사용자가 고른 단품 + 보완재가 어느 패키지에 포함되는지 매칭)
   * + 카트/비교 페이지의 "이 카테고리가 어느 패키지에 포함됨" 표시용.
   */
  composition?: string[];
  name: { ko: string; en: string };
  tier: "signature" | "standard";
  tagline?: string;
  /** 영문 사이트용 태그라인. 비어있으면 tagline 폴백. */
  taglineEn?: string;

  includedItems: Array<{
    label: string;
    /** 영문 사이트용 항목 라벨. 비어있으면 label 폴백. resolveItems 가 자동 채움. */
    labelEn?: string;
    referencedSlotIds?: string[];
    /**
     * 자동 구성용 — 카테고리/소분류 단위 선택 시 자동 채워짐.
     * 어드민에서 카테고리·수량 고르면 label/referencedSlotIds/가격까지 자동 계산.
     * 채워져있으면 'auto' 모드, 비어있으면 수기 label 모드 (legacy).
     */
    categoryId?: string;
    subcategoryId?: string;
    count?: number;
  }>;

  originalPrice: number;
  discountPrice: number;
  /** 영문(USD) 가격. 비우면 KRW 에서 1USD=1,000KRW 자동 변환. */
  originalPriceUSD?: number;
  discountPriceUSD?: number;
  unit?: string;
  priceNote?: string;
  /** 영문 사이트용 가격 주석. 비어있으면 priceNote 폴백. */
  priceNoteEn?: string;

  heroImages?: ImageSlot;

  isPublished: boolean;
  /**
   * 매진 여부 — 단독구좌 패키지(예: A to Z)가 판매되면 true.
   * 공개 사이트에서 노출은 유지하되 '매진' 뱃지를 표시하고 카트 담기를 차단한다.
   * (게시 여부 isPublished 와 별개 — 매진돼도 계속 노출)
   */
  soldOut?: boolean;
  order: number;
};

// ============= INQUIRY / CART =============
export type CartItem =
  | {
      type: "slot";
      eventId: string;  // 행사 분리 — 카트는 행사별로 보기
      slotId: string;
      categoryId: string;
      subcategoryId: string;
      code: string;
      price: number;
    }
  | {
      type: "package";
      eventId: string;
      packageId: string;
      code: string;
      price: number;
    };

export type Inquiry = {
  id: string;
  eventId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;

  cartItems: CartItem[];
  cartSubtotal: number;
  cartVat: number;
  cartTotal: number;

  message: string;

  /** 1분 진단을 거쳐 문의한 경우의 컨텍스트 — 어드민에 답·추천 매체 그대로 보여줌 */
  diagnosisContext?: {
    primaryGoal: string;
    secondaryGoal?: string;
    budgetKRW: number;
    mustHave: string[];
    /** 진단이 추천한 카테고리 (ID + 이름 함께 저장해서 어드민에서 카테고리 fetch 불필요) */
    recommendedCategories: Array<{ id: string; nameKo: string }>;
  };

  status: "new" | "in_progress" | "closed";
  adminNote?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ============= SITE SETTINGS =============
export type SiteSettings = {
  eventId?: string; // doc id 와 동일 — 보조 인덱스용
  theme?: {
    primary?: string; // hex color, 예: "#DB0711" — 행사별 brand color
  };
  event: {
    nameKo: string;
    nameEn: string;
    dateRange: string;
    /** 영문 사이트용 일정 표기. 비어있으면 dateRange 폴백. */
    dateRangeEn?: string;
    venue: string;
    /** 영문 사이트용 장소 표기. 비어있으면 venue 폴백. */
    venueEn?: string;
    applicationDeadline: Timestamp;
  };

  kv: {
    desktopUrl: string;
    mobileUrl?: string;
    overlayText?: string;
  };

  why: {
    headline: string;
    stats: Array<{
      label: string;
      value: string;
      suffix?: string;
      desc?: string;
    }>;
    chartData?: Array<{ year: number; visitors: number; exhibitors: number }>;
  };

  contact: {
    phone: string;
    email: string;
    address: string;
    /** 영문 사이트용 주소. 비어있으면 한국어 address 폴백. */
    addressEn?: string;
  };

  applicationSteps: Array<{
    title: string;
    desc?: string;
    /** 영문 사이트용. 비어있으면 한국어 폴백. */
    titleEn?: string;
    descEn?: string;
  }>;

  /** 메인 랜딩(/[eventSlug]) 페이지의 블록 시퀀스 (한국어). 비어있으면 빈 상태 안내. */
  landing?: LandingBlock[];

  /** 영문 랜딩(/[eventSlug]/en) 페이지의 블록 시퀀스. 비어있으면 ko landing 으로 폴백.
   *  어드민에서 ko/en 탭으로 별도 편집. */
  landingEn?: LandingBlock[];

  /** 카테고리 유형별 슬라이드 레이아웃 — 어떤 스펙 행을 어떤 순서로 보일지.
   *  값이 없으면 기본 레이아웃(getDefaultTypeLayout) 사용. */
  typeLayouts?: Partial<Record<CategoryType, TypeLayout>>;

  /** 스폰서십 신청 시 모두에게 동봉되는 혜택 (등록대 로고·도면 로고·검색 배너 등).
   *  공개 슬라이드 / PDF 에서 "추가 혜택" 섹션으로 노출. */
  bundledPerks?: BundledPerk[];

  /** 어드민이 미리 만들어둔 전체 패키지 PDF 의 Storage URL.
   *  값이 있으면 공개 "전체 PDF 다운로드" 버튼이 /print/full 인쇄 페이지 대신
   *  이 URL 을 직접 다운로드 (=0 초). 어드민이 데이터 바뀌면 새로 업로드해야 함. */
  pdfFullUrl?: string;
  /** 어드민이 업로드한 PDF 파일의 Storage 경로 — 교체 시 이전 파일 삭제용. */
  pdfFullStoragePath?: string;
  /** PDF 업로드 시각 — 어드민에 "마지막 업로드: HH:MM" 표시용. */
  pdfFullUploadedAt?: Timestamp;

  /** 영문 사이트 (/[eventSlug]/en) 에서 사용할 별도 영문 PDF Storage URL.
   *  비어있으면 한국어 PDF (pdfFullUrl) 로 폴백. */
  pdfFullUrlEn?: string;
  pdfFullStoragePathEn?: string;
  pdfFullUploadedAtEn?: Timestamp;

};

/** 진단 로그 한 건 — diagnostic_logs 컬렉션에 저장 (v3 형식) */
export type DiagnosticLog = {
  id: string;
  eventId: string;
  sessionId: string;
  completed: boolean;
  exitedAt?: string;
  primaryGoal?: Purpose | null;
  secondaryGoal?: Purpose | null;
  budgetKRW?: number;
  mustHave?: string[];
  recommendedCategoryIds: string[];
  createdAt: Timestamp;
};

/** 스폰서십 동봉 혜택 — 카테고리·패키지별로 노출 범위 지정 가능 */
export type BundledPerk = {
  /** 표시 라벨 (예: "등록대 스폰서 로고") */
  label: string;
  /** 영문 사이트용 라벨. 비어있으면 label 폴백. */
  labelEn?: string;
  /** 한 줄 설명 (예: "전시장 입구 등록대 전체에 로고 노출") */
  description?: string;
  /** 영문 사이트용 설명. 비어있으면 description 폴백. */
  descriptionEn?: string;
  /** 상당 가치 (KRW) — 영업 시 "총 X만원 상당" 계산용. 0/없음이면 비표시 */
  valueKRW?: number;
  /** 조건부 혜택 (예: 큰 회사만 등) — 표시는 하되 가치 합산에서 제외 */
  condition?: string;
  /** 영문 사이트용 조건 텍스트. 비어있으면 condition 폴백. */
  conditionEn?: string;
  /**
   * 적용 범위 — 비어있으면 "모든 곳" (전 패키지 + 전 단품 카테고리에 노출).
   * 채워지면 해당 카테고리 코드 (예: "CB") 또는 패키지 코드 (예: "PKG-AZ") 에만 노출.
   * 단품 카테고리 슬라이드와 패키지 상세 페이지에서 각각 필터링.
   */
  appliesToCodes?: string[];
};

/** 슬라이드 스펙 영역에 노출 가능한 행 종류 */
export type SpecField =
  | "location"   // 게재 위치 (subcategory 이름 모음)
  | "size"       // 사이즈
  | "fileFormat" // 파일 형식
  | "deadline"   // 제출 마감
  | "detail"     // 세부사항 (subcategory + slot count)
  | "slots"      // 단순 잔여/총 구좌
  | "video"      // 영상 스펙 (videoSpec)
  | "mailing"    // 발송 스펙 (mailingSpec)
  | "content";   // 콘텐츠 스펙 (contentSpec)

/** 어드민이 자유롭게 정의하는 커스텀 스펙 행 */
export type CustomSpecRow = {
  /** 표시 라벨 (예: "보너스 혜택") */
  label: string;
  /** 표시 값 — 카테고리 데이터와 무관한 정적 텍스트 */
  value: string;
};

/** 카테고리 유형별 슬라이드 레이아웃 */
export type TypeLayout = {
  /** 노출할 스펙 필드들 (순서 = 표시 순서) */
  specFields: SpecField[];
  /** 해시태그 노출 (기본 true) */
  showHashtags?: boolean;
  /** 작년 buyers / 매진일 노출 (기본 true) */
  showLastYear?: boolean;
  /** 동봉 혜택 미니 배너 노출 (기본 true) */
  showPerksBanner?: boolean;
  /** 제목 크기 — 기본 large */
  titleSize?: "small" | "medium" | "large";
  /** 커스텀 정적 스펙 행들 — specFields 끝에 추가 노출 */
  customRows?: CustomSpecRow[];
  /**
   * 자유 캔버스 마스터 슬라이드 (1920×1080).
   * 있으면 공개 페이지에서 이 캔버스로 렌더하고, 텍스트 노드 안의 토큰
   * (예: {{title}}, {{location}}, {{minPrice}}) 을 실데이터로 치환.
   * 없으면 기존 form-based 레이아웃(specFields 등)으로 fallback.
   */
  canvasPage?: CanvasPage;
};

// ============= LANDING BLOCKS =============
// /[eventSlug] 페이지의 콘텐츠를 어드민에서 자유롭게 구성할 수 있는 블록 단위 schema.
// 각 블록 = 한 화면(스냅 슬라이드) 또는 한 섹션. 타입별 디자인은 시스템 디자인 톤으로 고정.

/** 블록 공통 스타일 override — 어드민이 블록 단위로 자유 조정 가능 */
export type BlockStyle = {
  /** 배경: hex, 또는 'canvas'/'surface'/'ink'/'brand'/'transparent' 키워드 */
  bg?: string;
  /** 텍스트 색상 hex */
  text?: string;
  /** 액센트 색상 hex (없으면 행사 brand color) */
  accent?: string;
  /** 최소 높이: 'screen' (h-screen, 기본) | 'half' | 'auto' */
  minHeight?: "screen" | "half" | "auto";
  /** 정렬 */
  align?: "left" | "center" | "right";
  /** 패딩 강도 */
  pad?: "tight" | "normal" | "loose";
  /** 풀브리드 (가로 max-w 제거) */
  fullBleed?: boolean;
};

export type LandingBlockBase = {
  id: string; // 안정 키 (re-render·드래그용)
  style?: BlockStyle;
};

export type CoverBlock = LandingBlockBase & {
  type: "cover";
  data: {
    eyebrow?: string;   // 상단 작은 라벨 (uppercase tracking)
    title: string;      // 큰 제목 (행사명)
    subtitle?: string;  // 부제 (일정·장소)
    bgImageUrl?: string;
  };
};

export type Stats3YearBlock = LandingBlockBase & {
  type: "stats3year";
  data: {
    eyebrow?: string;
    headline: string;
    years: Array<{ year: number; visitors: number; overseas?: number; note?: string }>;
    footnote?: string;
  };
};

export type AdGoals4Block = LandingBlockBase & {
  type: "adGoals4";
  data: {
    eyebrow?: string;
    headline: string;
    cards: Array<{ label: string; description: string; emoji?: string }>;
  };
};

export type Benefits4Block = LandingBlockBase & {
  type: "benefits4";
  data: {
    eyebrow?: string;
    headline: string;
    cards: Array<{ title: string; description?: string; emoji?: string }>;
  };
};

export type Steps4Block = LandingBlockBase & {
  type: "steps4";
  data: {
    eyebrow?: string;
    headline: string;
    steps: Array<{ title: string; description?: string }>;
  };
};

export type TextHeroBlock = LandingBlockBase & {
  type: "textHero";
  data: {
    eyebrow?: string;
    lines: string[]; // 한 줄당 큰 타이포 한 줄. 빨강 강조 라인은 prefix "*"
    description?: string;
  };
};

export type BigStatBlock = LandingBlockBase & {
  type: "bigStat";
  data: {
    eyebrow?: string;
    value: string;
    valueSuffix?: string;
    label: string;
    description?: string;
  };
};

export type CtaBlock = LandingBlockBase & {
  type: "cta";
  data: {
    eyebrow?: string;
    lines: string[];
    primaryLabel?: string;
    primaryHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
    showContact?: boolean;
  };
};

export type ImageBlock = LandingBlockBase & {
  type: "image";
  data: {
    url: string;
    alt?: string;
    caption?: string;
    fullBleed?: boolean;
  };
};

export type RichTextBlock = LandingBlockBase & {
  type: "richText";
  data: {
    eyebrow?: string;
    headline?: string;
    body: string; // plain text, \n preserved
    align?: "left" | "center";
  };
};

// ── 자유도 확장: 추가 블록 타입 ──

/** 두 컬럼 좌우 배치. 좌·우 각각 자유 텍스트 + 이미지 */
export type TwoColumnBlock = LandingBlockBase & {
  type: "twoColumn";
  data: {
    left: {
      kind: "text" | "image";
      // text:
      eyebrow?: string;
      headline?: string;
      body?: string;
      // image:
      imageUrl?: string;
      imageAlt?: string;
    };
    right: {
      kind: "text" | "image";
      eyebrow?: string;
      headline?: string;
      body?: string;
      imageUrl?: string;
      imageAlt?: string;
    };
    ratio?: "1:1" | "1.5:1" | "1:1.5";
  };
};

/** 이미지 그리드 (2~6열, 1~12장) */
export type ImageGridBlock = LandingBlockBase & {
  type: "imageGrid";
  data: {
    eyebrow?: string;
    headline?: string;
    columns: 2 | 3 | 4 | 5 | 6;
    images: Array<{ url: string; alt?: string; caption?: string }>;
  };
};

/** 구분선 / 여백 */
export type DividerBlock = LandingBlockBase & {
  type: "divider";
  data: {
    label?: string; // "Appendix" 같은 라벨
    accent?: boolean; // 빨강 강조 줄
  };
};

export type SpacerBlock = LandingBlockBase & {
  type: "spacer";
  data: {
    size: "sm" | "md" | "lg" | "xl";
  };
};

/** 버튼 행 — CTA 만들기용 */
export type ButtonRowBlock = LandingBlockBase & {
  type: "buttonRow";
  data: {
    eyebrow?: string;
    headline?: string;
    description?: string;
    buttons: Array<{
      label: string;
      href: string;
      variant?: "primary" | "outline" | "ghost";
    }>;
  };
};

/** 동영상 임베드 (YouTube / Vimeo / 직접 mp4 URL) */
export type VideoEmbedBlock = LandingBlockBase & {
  type: "videoEmbed";
  data: {
    eyebrow?: string;
    headline?: string;
    url: string; // YouTube / Vimeo / mp4
    aspect?: "16:9" | "4:3" | "1:1" | "9:16";
  };
};

/** 자유 HTML — 최후의 escape hatch (어드민 신뢰 전제) */
export type CustomHtmlBlock = LandingBlockBase & {
  type: "customHtml";
  data: {
    html: string;
  };
};

/** 슬롯 미리보기 — 카테고리 slug 들을 직접 임베드 */
export type SlotsTeaserBlock = LandingBlockBase & {
  type: "slotsTeaser";
  data: {
    eyebrow?: string;
    headline?: string;
    categorySlugs: string[]; // 보일 카테고리 slug
    layout?: "grid" | "row"; // 카드 그리드 / 가로 스크롤
  };
};

/**
 * 1920×1080 자유 캔버스 — Figma-like 한 페이지.
 * 어드민이 노드를 자유 배치, 모바일은 stack 으로 자동 변환.
 */
export type CanvasPageBlock = LandingBlockBase & {
  type: "canvasPage";
  data: {
    page: CanvasPage;
  };
};

/** 전체 패키지 PDF 다운로드 슬라이드. 이벤트 컨텍스트로 URL 자동 해석. */
export type PdfDownloadBlock = LandingBlockBase & {
  type: "pdfDownload";
  data: {
    eyebrow?: string;       // 작은 라벨 (기본: "Download")
    headline?: string;      // 제목 (기본: "전체 패키지 한 장에 담기")
    description?: string;   // 보조 설명
    buttonLabel?: string;   // 버튼 라벨 (기본: "전체 패키지 PDF 다운로드")
  };
};

export type LandingBlock =
  | CoverBlock
  | Stats3YearBlock
  | AdGoals4Block
  | Benefits4Block
  | Steps4Block
  | TextHeroBlock
  | BigStatBlock
  | CtaBlock
  | ImageBlock
  | RichTextBlock
  | TwoColumnBlock
  | ImageGridBlock
  | DividerBlock
  | SpacerBlock
  | ButtonRowBlock
  | VideoEmbedBlock
  | CustomHtmlBlock
  | SlotsTeaserBlock
  | CanvasPageBlock
  | PdfDownloadBlock;

export type LandingBlockType = LandingBlock["type"];

// ============= CANVAS NODES (Figma-like free positioning) =============
// 1920×1080 캔버스 위에 자유 배치하는 노드. 데스크톱은 절대 좌표,
// 모바일은 어드민이 지정한 stack 순서대로 vertical reflow.

/** 1920×1080 캔버스 안에서의 위치·크기 (px 단위) */
export type CanvasRect = {
  x: number;       // 0~1920
  y: number;       // 0~1080
  w: number;       // 픽셀 너비
  h: number;       // 픽셀 높이
  rotate?: number; // deg, 옵션
  z?: number;      // z-index
};

/** 모바일 reflow 옵션 — 노드별로 어떻게 변환할지 */
export type CanvasMobile = {
  hidden?: boolean;       // 모바일에서 숨김
  order?: number;         // stack 순서 (낮을수록 먼저)
  fullWidth?: boolean;    // 모바일에서 가로 꽉
};

/** 공통 노드 베이스 */
export type CanvasNodeBase = {
  id: string;
  rect: CanvasRect;
  mobile?: CanvasMobile;
  opacity?: number;        // 0~1
  lockAspect?: boolean;    // 리사이즈 시 비율 잠금
  locked?: boolean;        // 편집 잠금 (이동·리사이즈 불가)
  hidden?: boolean;        // 에디터·렌더 모두 숨김
  name?: string;           // 레이어 패널 표시명 (없으면 type 기준 자동)
};

export type CanvasTextNode = CanvasNodeBase & {
  type: "text";
  data: {
    content: string;             // plain (\n 보존)
    fontSize?: number;           // 16~200, 기본 32
    fontWeight?: 300 | 400 | 500 | 600 | 700 | 800 | 900;
    color?: string;              // hex
    align?: "left" | "center" | "right";
    lineHeight?: number;         // 0.9~2
    letterSpacing?: number;      // px
    accent?: boolean;            // brand-500 컬러 사용
    family?: "sans" | "num" | "mono";
    /** 자유 입력 — 우선 적용. 예: "Noto Serif KR" / "Roboto" / "Georgia, serif" */
    fontFamily?: string;
    fontStyle?: "normal" | "italic";
    textDecoration?: "none" | "underline" | "line-through";
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  };
};

export type CanvasImageNode = CanvasNodeBase & {
  type: "image";
  data: {
    url: string;
    alt?: string;
    fit?: "cover" | "contain";
    radius?: number;             // px corner radius
    shadow?: ShadowEffect;
  };
};

/** 그라디언트 stop */
export type GradientStop = { offset: number; color: string };

/** 그라디언트 fill */
export type Gradient =
  | { kind: "linear"; angle: number; stops: GradientStop[] }
  | { kind: "radial"; stops: GradientStop[] };

/** 채움 종류 — 단색 / 그라디언트 / 이미지(클리핑) */
export type ShapeFill =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; gradient: Gradient }
  | { kind: "image"; url: string; fit?: "cover" | "contain" };

export type CanvasShapeNode = CanvasNodeBase & {
  type: "shape";
  data: {
    shape:
      | "rect"
      | "ellipse"
      | "line"
      | "triangle"
      | "star"
      | "polygon"
      | "arrow";
    /** 신규: fill 객체. 기존 단색 hex 도 호환 (legacy) */
    fill?: string | ShapeFill;
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;    // SVG 대시 패턴 (예: "4 4")
    radius?: number;             // rect only
    sides?: number;              // polygon only (3~12)
    points?: number;             // star only
    shadow?: ShadowEffect;
  };
};

/** 박스 그림자 — 모든 노드에 추가 가능 */
export type ShadowEffect = {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string; // hex 또는 rgba
};

export type CanvasButtonNode = CanvasNodeBase & {
  type: "button";
  data: {
    label: string;
    href: string;
    variant?: "primary" | "outline" | "ghost";
    fontSize?: number;
  };
};

export type CanvasVideoNode = CanvasNodeBase & {
  type: "video";
  data: {
    url: string;                  // YouTube / Vimeo / mp4
  };
};

/** 차트 노드 — 슬라이드 1·2 류의 데이터 시각화 */
export type ChartSeries = {
  name: string;
  color?: string;             // 라인/막대 색 (없으면 자동 팔레트)
  data: number[];             // 카테고리 길이와 일치
  kind?: "line" | "bar" | "area"; // 시리즈별 종류 (혼합 차트)
  showDots?: boolean;         // 라인 위 마커
  showLabels?: boolean;       // 데이터 포인트마다 값 표시
  endLabel?: boolean;         // 마지막 데이터 포인트 오른쪽에 시리즈 이름 표시
};

export type CanvasChartNode = CanvasNodeBase & {
  type: "chart";
  data: {
    kind: "line" | "bar" | "area" | "mixed"; // 기본 종류
    categories: string[];                     // x축 라벨
    series: ChartSeries[];
    background?: string;                      // 차트 배경색 (hex 또는 css 색)
    showLegend?: boolean;
    showGrid?: boolean;
    showAxes?: boolean;
    xLabel?: string;
    yLabel?: string;
    yMin?: number;
    yMax?: number;
    annotations?: Array<{
      kind: "vline" | "hline" | "label" | "bracket";
      // vline/hline: at = 카테고리 인덱스 또는 y값
      // label: at + text + (offsetX/Y)
      // bracket: fromIdx, toIdx, text
      at?: number;
      from?: number;
      to?: number;
      text?: string;
      color?: string;
    }>;
  };
};

/** 아이콘 노드 — lucide-react 아이콘 또는 3D emoji */
export type CanvasIconNode = CanvasNodeBase & {
  type: "icon";
  data: {
    set: "lucide" | "emoji";
    name: string;             // lucide: "Pin", "Star", ... / emoji: 단일 emoji 문자
    color?: string;            // lucide 만
    strokeWidth?: number;      // lucide 만
  };
};

/**
 * 캔버스 위에 놓는 "디자인 완성된 컴포넌트" — 어드민이 정해진 디자인의 위젯을 자유 위치에 배치.
 * 기존 블록 시스템의 컴포넌트들 (Cover, Stats3Year, AdGoals4, Benefits4, Steps4, TextHero, BigStat, CTA, SlotsTeaser)
 * 을 canvas-level node 로 흡수.
 */
export type CanvasComponentKind =
  | "cover"
  | "stats3year"
  | "adGoals4"
  | "benefits4"
  | "steps4"
  | "textHero"
  | "bigStat"
  | "cta"
  | "slotsTeaser"
  | "richText";

export type CanvasComponentNode = CanvasNodeBase & {
  type: "component";
  componentKind: CanvasComponentKind;
  // 데이터 스키마는 기존 블록과 동일 (블록의 data 와 1:1 호환)
  data: Record<string, unknown>;
};

export type CanvasNode =
  | CanvasTextNode
  | CanvasImageNode
  | CanvasShapeNode
  | CanvasButtonNode
  | CanvasVideoNode
  | CanvasChartNode
  | CanvasIconNode
  | CanvasComponentNode;

export type CanvasNodeType = CanvasNode["type"];

/** 캔버스 한 페이지 = 1920×1080 슬라이드 */
export type CanvasPage = {
  id: string;
  name?: string;                 // 어드민 식별용
  bg?: string;                   // bg hex 또는 canvas/surface/ink/brand
  bgImageUrl?: string;           // 배경 이미지
  nodes: CanvasNode[];
};


// ============= TAXONOMY =============
export type TagKind = "purpose" | "package" | "custom";

export type Tag = {
  id: string;
  label: string;
  kind: TagKind;        // 사이드바 필터 그룹 결정 ('purpose'만 광고목적 필터에 노출)
  color?: string;
  order: number;        // kind별 독립 정렬
  isActive?: boolean;   // 기본 true. false면 필터에서 숨김 (카테고리 데이터에는 유지)
};

export type Taxonomy = {
  tags: Tag[];
  channels: Array<{ id: Channel; label: string }>;
  /** 분류 관리에서 사용자가 수정·삭제 가능한 매체 유형 버킷. 없으면 코드 기본값. labelEn 은 /en 사이트 노출용. */
  mediaBuckets?: Array<{ id: string; label: string; labelEn?: string; description?: string }>;
  /** 노출 시점 버킷. */
  timingBuckets?: Array<{ id: string; label: string; labelEn?: string; description?: string }>;
  /** 노출 위치 버킷 (예: K-PRINT 는 Hall 7·8). 행사별로 다름. */
  locationBuckets?: Array<{ id: string; label: string; labelEn?: string; description?: string }>;
};

// ============= EVENT (다년도/다행사) =============
export type Event = {
  id: string;            // doc id, e.g. "kprint-2026"
  name: string;          // "K-PRINT 2026"
  shortName: string;     // "K-PRINT"
  year: number;          // 2026
  isActive: boolean;     // 사이드바 기본 선택 후보
  order: number;
  lastYearTotal?: number;  // 작년 합계 (협찬제외, KRW)
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ============= SPONSOR =============
export type SponsorStatus = "in_progress" | "reviewing" | "declined" | "in_kind";
// in_progress: 진행중 / reviewing: 검토중 / declined: 진행X / in_kind: 참가업체X(협찬, 합계 제외)

export type SponsorContact = {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
};

export type SponsorItem = {
  label: string;          // 자유 텍스트 (예: "옥외광고 패키지", "C홀 천장배너 1")
  slotId?: string;        // 옵션 — 슬롯 연결
  categoryId?: string;    // 옵션 — 카테고리 연결
  subcategoryId?: string; // 옵션 — 소분류 연결 (단가 조회용)
  packageId?: string;     // 옵션 — 패키지 연결
  /**
   * 품목 단가 (KRW, VAT 별도 공급가액). 라이브러리에서 선택 시 자동 채움
   * (슬롯→소분류 priceKRW, 패키지→discountPrice||originalPrice). 수기 조정 가능.
   * 비용(amount)은 이 단가들의 합계를 기반으로 계산한다.
   */
  price?: number;
  /**
   * 패키지 품목 전용 — 패키지에 포함된 단품들에 대해 어드민이 직접 확보한
   * 구좌(slot) ID 목록. 저장 시 해당 슬롯들이 'sold' 처리되어 공개 사이트의
   * 카테고리 매진 뱃지(슬롯 기반 자동 계산)에 반영된다.
   */
  allocatedSlotIds?: string[];
  note?: string;
};

export type DesignItem = {
  label: string;          // "천장배너", "쇼가이드", "인스타그램카드뉴스"
  deadline?: string;      // 자유 텍스트 (예: "2026-03-04", "3월 4일")
  status?: "pending" | "received" | "done";
  note?: string;
};

export type Sponsor = {
  id: string;
  eventId: string;        // FK to events
  companyName: string;

  amount: number;         // 비용
  currency: "KRW" | "USD";
  amountNote?: string;    // "(할인가)" 같은 메모

  items: SponsorItem[];

  benefits: {
    eventNotice: boolean; // 이벤트 안내
    topPin: boolean;      // 혜택1 상위고정
    badge: boolean;       // 혜택2 뱃지표기
    logoBanner: boolean;  // 혜택3 로고/배너
  };

  bannerType?: string;    // "참가업체 배너" / "로고" / "전시품 배너" / "해당없음(마감, 2부스)"
  bannerNote?: string;    // 부가 메모 (예: "- 준현조")

  designItems: DesignItem[];
  contacts: SponsorContact[];

  status: SponsorStatus;
  notes?: string;

  inquiryId?: string;     // 파이프라인 — 원본 문의

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ============= PERSONA (참가업체 페르소나) =============
export type Persona = {
  id: string;
  eventId: string;
  emoji: string;
  title: string;
  /** 영문 사이트용 타이틀. 비어있으면 title 폴백. */
  titleEn?: string;
  description: string;
  /** 영문 사이트용 설명. 비어있으면 description 폴백. */
  descriptionEn?: string;
  purposes?: Purpose[];    // 사이드바 필터와 단일 진실원 공유
  packageTier?: "signature" | "standard";
  /** 페르소나 카드 사회적 증거 한 줄 — "작년 N개 회사가 선택" */
  socialProofNote?: string;
  socialProofNoteEn?: string;
  /** 페르소나 카드 예산 anchor 한 줄 — "평균 ○○만원" */
  budgetNote?: string;
  budgetNoteEn?: string;
  order: number;
  isActive: boolean;
};

// ============= QUOTE SETTINGS (사무국 정보 + 견적서 기본값) =============
export type QuoteSettings = {
  // 사무국(발행자) 정보
  issuer: {
    companyName: string;       // ㈜한국이앤엑스
    businessNumber: string;    // 120-81-813111
    representative: string;    // 김정조
    address: string;           // 서울시 강남구 영동대로 511 트레이드타워 2001호
    businessType: string;      // 서비스
    industry: string;          // 전시회장
    phone: string;             // 02)551-0102
    fax: string;               // 02)551-0103
    contactDept: string;       // 전시사업부
    contactName: string;       // 조준현 대리
  };
  // 입금 계좌
  bank: {
    bankName: string;          // 우리은행
    accountNumber: string;     // 424-04-132799
    accountHolder: string;     // (주)한국이앤엑스
  };
  // 행사 안내 (견적서 본문 상단)
  eventSubtitle: string;       // 제41회 국제의료기기+병원설비전시회
  eventIntro: string;          // "오는 2026년 3월 19일부터 22일까지 서울 COEX..."
  // 일련번호 prefix (예: KMS26-)
  serialPrefix: string;
  serialNextNumber: number;    // 다음 발급 번호 (1부터)
  // 지불조건/추가제공 기본값
  defaultPaymentTerms: string; // "전액 현금 완납"
  defaultBenefitItems: Array<{ label: string; note?: string }>; // 추가제공 기본 4종
  // 푸터 슬로건
  footerSlogan: string;        // "한국의 전시문화를 선도하는 ㈜한국이앤엑스가 되겠습니다."
  // 로고 이미지 (선택)
  logoUrl?: string;
  logoStoragePath?: string;
};

// ============= IMPORT HISTORY =============
export type ImportHistory = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  mode: "overwrite" | "merge" | "add_only";
  counts: {
    categories: number;
    subcategories: number;
    slots: number;
    errors: number;
  };
  errors?: Array<{ row: number; reason: string }>;
  createdAt: Timestamp;
};
