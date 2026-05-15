import type { Timestamp } from "firebase/firestore";

export type { Timestamp };

// ============= PURPOSE (참가업체 시점의 광고 목적) =============
// 참가업체가 "왜 사는지" — 사이드바 필터·페르소나 매칭의 단일 진실원.
// 카테고리는 명시적 purposeOverride 또는 휴리스틱(derivePurposes)으로 매핑됨.
export type Purpose =
  | "traffic_driver"     // 부스 방문 유도 (현장 동선 위 광고)
  | "brand_awareness"    // 브랜드 인지도 확보 (대형 노출 채널)
  | "buyer_reach"        // 해외/특정 바이어 도달 (타겟팅 직접 도달)
  | "post_asset";        // 행사 후 자산 (콘텐츠·SNS·인터뷰)

export const PURPOSE_ORDER: Purpose[] = [
  "traffic_driver",
  "brand_awareness",
  "buyer_reach",
  "post_asset",
];

export const PURPOSE_META: Record<
  Purpose,
  { ko: string; en: string; desc: string }
> = {
  traffic_driver: {
    ko: "부스 방문 유도",
    en: "Drive booth traffic",
    desc: "참관객 동선 위에서 부스로 유도",
  },
  brand_awareness: {
    ko: "브랜드 인지도 확보",
    en: "Brand awareness",
    desc: "전 동선 통합 노출로 브랜드 인지",
  },
  buyer_reach: {
    ko: "해외·특정 바이어 도달",
    en: "Reach key buyers",
    desc: "결정권자에게 직접 도달 (메일·등록·세미나)",
  },
  post_asset: {
    ko: "행사 후 자산 남기기",
    en: "Post-event assets",
    desc: "콘텐츠·SNS·인터뷰로 사후 활용",
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
  order: number;
};

// ============= PACKAGE =============
export type Package = {
  id: string;
  eventId: string;  // 행사 분리
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
  eventId: string;  // 어느 행사를 둘러보다 문의했는지
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
  eventId?: string; // doc id 와 동일 — 보조 인덱스용
  theme?: {
    primary?: string; // hex color, 예: "#DB0711" — 행사별 brand color
  };
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

  /** 메인 랜딩(/[eventSlug]) 페이지의 블록 시퀀스. 비어있으면 자동 생성된 기본 랜딩 사용 */
  landing?: LandingBlock[];
};

// ============= LANDING BLOCKS =============
// /[eventSlug] 페이지의 콘텐츠를 어드민에서 자유롭게 구성할 수 있는 블록 단위 schema.
// 각 블록 = 한 화면(스냅 슬라이드) 또는 한 섹션. 타입별 디자인은 KIMES Figma 톤으로 고정.

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
  | CanvasPageBlock;

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
    fontWeight?: 300 | 400 | 500 | 600 | 700 | 800;
    color?: string;              // hex
    align?: "left" | "center" | "right";
    lineHeight?: number;         // 0.9~2
    letterSpacing?: number;      // px
    accent?: boolean;            // brand-500 컬러 사용
    family?: "sans" | "num" | "mono";
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
  eventId: string;       // 행사별 분리
  emoji: string;
  title: string;
  description: string;
  targetTags?: string[];   // 카테고리 자동 추천용 (옵션 — 명시적 personas 필드가 우선)
  purposes?: Purpose[];    // 이 페르소나가 강조하는 광고 목적 — 사이드바 필터와 단일 진실원 공유
  budgetMin?: number;
  budgetMax?: number;
  packageTier?: "signature" | "standard";

  // ── 강화: 결정 부담을 줄이고 행동을 유도하는 메타 ──

  /** 페르소나 카드와 결과 배너에 들어갈 사회적 증거 한 줄 — 예: "작년 18개 회사가 이 코스 선택" */
  socialProofNote?: string;

  /** 예산 anchor 한 줄 — 예: "평균 1,200만원 (단품 + 시그니처 콤보)" */
  budgetNote?: string;

  /**
   * 페르소나 선택 시 결과 화면 상단 배너에 보여주는 "정석 조합" — 어드민이 큐레이션.
   * 추천 콤보 = (slot/package id 배열) + 한 줄 카피.
   * "한 번에 카트 담기" 버튼이 자동 생성됨.
   */
  recommendedCombo?: {
    headline?: string;       // "당신 같은 회사가 보통 이렇게 합니다"
    rationale?: string;      // "동선 + 인지 + 자산 3박자"
    categorySlugs?: string[]; // 최저가 슬롯 1개를 자동 선택해 카트에 담음
    packageIds?: string[];   // 패키지 직접 명시
    expectedKRW?: number;    // 예상 총액 (정보용)
  };

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
