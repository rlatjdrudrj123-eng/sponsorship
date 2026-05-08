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
export type Taxonomy = {
  tags: Array<{ id: string; label: string; color?: string }>;
  channels: Array<{ id: Channel; label: string }>;
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
