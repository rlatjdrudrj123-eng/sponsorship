import type { Timestamp } from "firebase/firestore";

export type { Timestamp };

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
  code: string; // 영문 3자리
  channel: Channel;
  type: CategoryType;
  slug: string;

  name: { ko: string; en: string };
  shortDesc?: string;
  longDesc?: string;

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
    duration?: number; // 초
    resolution?: string; // "2480x2160"
    plays?: number; // 송출 횟수
  };

  // 발송형
  mailingSpec?: {
    sendDates: string[];
    audience: number;
    audienceLabel?: string;
  };

  // 콘텐츠형
  contentSpec?: {
    channel: string;
    format: string;
  };

  tags: string[];
  isPublished: boolean;
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
  categoryId: string;
  name: { ko: string; en: string };

  priceKRW: number;
  priceUSD?: number;
  unit: { ko: string; en: string };
  priceNote?: string;

  size?: string;

  order: number;
};

// ============= SLOT =============
export type Slot = {
  id: string;
  subcategoryId: string;
  categoryId: string; // 빠른 조회용 (denormalized)
  code: string;
  status: "available" | "sold" | "reserved";
  note?: string;
  order: number;
};

// ============= PACKAGE =============
export type Package = {
  id: string;
  code: string;
  name: { ko: string; en: string };
  tier: "signature" | "standard";
  tagline?: string;

  includedItems: Array<{
    label: string;
    referencedSlotIds?: string[];
  }>;

  originalPrice: number;
  discountPrice: number;
  unit?: string;
  priceNote?: string;

  heroImages?: ImageSlot;

  isPublished: boolean;
  order: number;
};

// ============= INQUIRY / CART =============
export type CartItem =
  | {
      type: "slot";
      slotId: string;
      categoryId: string;
      subcategoryId: string;
      code: string;
      price: number;
    }
  | {
      type: "package";
      packageId: string;
      code: string;
      price: number;
    };

export type Inquiry = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;

  cartItems: CartItem[];
  cartSubtotal: number;
  cartVat: number;
  cartTotal: number;

  message: string;

  status: "new" | "in_progress" | "closed";
  adminNote?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ============= SITE SETTINGS =============
export type SiteSettings = {
  event: {
    nameKo: string;
    nameEn: string;
    dateRange: string;
    venue: string;
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
  };

  applicationSteps: Array<{ title: string; desc?: string }>;
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
  packageId?: string;     // 옵션 — 패키지 연결
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
