/**
 * 로컬 개발용 더미 데이터.
 * STEP 3에서 Firestore 연동되면 이 파일은 시드 데이터/페이지 미리보기 용도로만 사용.
 *
 * Timestamp는 Firebase Timestamp 인스턴스로 만들지 않고 Date를 캐스트해서 사용한다.
 * Firestore에 쓸 때는 Date를 그대로 받아주고, 읽을 때만 Timestamp로 돌아오므로
 * 더미 단계에서는 형변환 비용 없이 호환된다.
 */

import type {
  Category,
  ImageItem,
  ImageSlot,
  Package,
  SiteSettings,
  Slot,
  Subcategory,
  Taxonomy,
  Timestamp,
} from "./types";

// ---- helpers --------------------------------------------------------------

/** Date 또는 ISO 문자열을 Timestamp 자리에 끼워 넣는 더미 헬퍼. */
export function ts(input: string | Date): Timestamp {
  const date = typeof input === "string" ? new Date(input) : input;
  return date as unknown as Timestamp;
}

const NOW = ts("2026-01-15T00:00:00+09:00");

/** placehold.co 기반 이미지 URL 생성. STEP 12 이후 next.config 도메인 등록 필요. */
function ph(label: string, w = 1600, h = 1000): string {
  return `https://placehold.co/${w}x${h}/00bfa6/ffffff?text=${encodeURIComponent(label)}`;
}

function img(
  label: string,
  storagePath: string,
  order: number,
  caption?: string,
  w = 1600,
  h = 1000
): ImageItem {
  return { url: ph(label, w, h), storagePath, caption, order };
}

function carousel(images: ImageItem[]): ImageSlot {
  return { mode: "carousel", images };
}

function single(image: ImageItem): ImageSlot {
  return { mode: "single", images: [image] };
}

function gallery(images: ImageItem[]): ImageSlot {
  return { mode: "gallery", images };
}

// ---- TAXONOMY -------------------------------------------------------------

export const dummyTaxonomy: Taxonomy = {
  channels: [
    { id: "offline", label: "오프라인" },
    { id: "online", label: "온라인" },
    { id: "package", label: "패키지" },
  ],
  tags: [
    { id: "brand_diffusion", label: "브랜드 확산형", kind: "purpose", order: 0, isActive: true, color: "#00bfa6" },
    { id: "onsite", label: "온사이트", kind: "custom", order: 0, isActive: true, color: "#0ea5e9" },
    { id: "digital", label: "디지털", kind: "custom", order: 1, isActive: true },
    { id: "global", label: "글로벌", kind: "custom", order: 2, isActive: true },
    { id: "outdoor", label: "옥외", kind: "custom", order: 3, isActive: true },
    { id: "registration_path", label: "등록경로", kind: "custom", order: 4, isActive: true },
    { id: "navigation", label: "동선", kind: "custom", order: 5, isActive: true },
  ],
};

// ---- SITE SETTINGS --------------------------------------------------------

export const dummySiteSettings: SiteSettings = {
  event: {
    nameKo: "K-PRINT 2026",
    nameEn: "K-PRINT 2026 International Print & Pack Expo",
    dateRange: "2026.08.19 — 22",
    venue: "KINTEX 제2전시장 7, 8홀",
    applicationDeadline: ts("2026-06-30T23:59:59+09:00"),
  },
  kv: {
    desktopUrl: ph("K-PRINT 2026 KV", 2400, 1200),
    mobileUrl: ph("K-PRINT 2026 KV Mobile", 800, 1200),
    overlayText: "2026.08.19 — 22 · KINTEX",
  },
  why: {
    headline: "왜 K-PRINT인가?",
    stats: [
      { label: "방문객", value: "72,507", suffix: "명", desc: "지난 회 누적 방문객" },
      { label: "참가사", value: "412", suffix: "사", desc: "국내외 인쇄·패키징 기업" },
      { label: "참가국", value: "23", suffix: "개국", desc: "해외 바이어 직접 방문" },
      { label: "전시 면적", value: "31,500", suffix: "㎡" },
    ],
    chartData: [
      { year: 2022, visitors: 54200, exhibitors: 312 },
      { year: 2023, visitors: 61800, exhibitors: 358 },
      { year: 2024, visitors: 72507, exhibitors: 412 },
    ],
  },
  contact: {
    phone: "02-555-1234",
    email: "sponsor@kprint.kr",
    address: "서울특별시 강남구 테헤란로 123, K-PRINT 사무국",
  },
  applicationSteps: [
    { title: "스폰서십 둘러보기", desc: "관심 항목을 카트에 담기" },
    { title: "문의 폼 제출", desc: "회사·연락처와 함께 견적 카트 전송" },
    { title: "사무국 상담", desc: "1영업일 내 회신, 견적서 발송" },
    { title: "신청·결제", desc: "신청서 작성 후 계약·결제" },
    { title: "구좌 배정 + 디자인 입고", desc: "마감 일정에 맞춰 소재 입고" },
  ],
};

// ---- CATEGORY 1: 천장 배너 (floor_plan) ------------------------------------

const CBA_HALL_A_ID = "sub-cba-a";
const CBA_HALL_B_ID = "sub-cba-b";
const CBA_HALL_C_ID = "sub-cba-c";

export const dummyCategory_CeilingBanner: Category = {
  id: "cat-cba",
    eventId: "kprint-2026",
  code: "CBA",
  channel: "offline",
  type: "floor_plan",
  slug: "ceiling-banner",
  name: { ko: "천장 배너", en: "Ceiling Banner" },
  shortDesc: "전시장 천장에서 멀리서도 보이는 대형 배너. 위치는 도면에서 선택.",
  longDesc:
    "Hall A·B·C 천장에 부착되는 대형 양면 배너. 7m 높이에서 노출되어 전시장 전역에서 인지됩니다.",
  size: "1800mm × 3500mm",
  fileFormat: "AI, EPS, PDF (CMYK)",
  deadline: ts("2026-07-15T23:59:59+09:00"),
  designGuideText: "양면 인쇄, 재단선 5mm 여유. CMYK 변환 후 입고.",
  heroImages: carousel([
    img("Ceiling Banner 1", "categories/CBA/hero-1.jpg", 0, "Hall A 천장 노출 예시"),
    img("Ceiling Banner 2", "categories/CBA/hero-2.jpg", 1, "전시 전경"),
    img("Ceiling Banner 3", "categories/CBA/hero-3.jpg", 2),
  ]),
  detailImages: carousel([
    img("Ceiling Banner Detail 1", "categories/CBA/detail-1.jpg", 0, "디자인 시안 예시"),
    img("Ceiling Banner Detail 2", "categories/CBA/detail-2.jpg", 1, "설치 디테일"),
  ]),
  floorImages: [
    {
      subcategoryId: CBA_HALL_A_ID,
      url: ph("Floor Plan Hall A", 2000, 1400),
      storagePath: "categories/CBA/floor-A.jpg",
      pins: [
        { slotId: "slot-cba-a-1", x: 18, y: 22, note: "A1 출입구 좌측" },
        { slotId: "slot-cba-a-2", x: 50, y: 30, note: "Hall A 중앙 동선" },
        { slotId: "slot-cba-a-3", x: 82, y: 22, note: "A1 출입구 우측" },
      ],
    },
    {
      subcategoryId: CBA_HALL_B_ID,
      url: ph("Floor Plan Hall B", 2000, 1400),
      storagePath: "categories/CBA/floor-B.jpg",
      pins: [
        { slotId: "slot-cba-b-1", x: 22, y: 28 },
        { slotId: "slot-cba-b-2", x: 64, y: 36, note: "B 핵심 동선" },
        { slotId: "slot-cba-b-3", x: 84, y: 28 },
      ],
    },
    {
      subcategoryId: CBA_HALL_C_ID,
      url: ph("Floor Plan Hall C", 2000, 1400),
      storagePath: "categories/CBA/floor-C.jpg",
      pins: [
        { slotId: "slot-cba-c-1", x: 28, y: 24 },
        { slotId: "slot-cba-c-2", x: 72, y: 24, note: "C 출입구 인접" },
      ],
    },
  ],
  tags: ["brand_diffusion", "onsite", "navigation"],
  isPublished: true,
  order: 1,
  lockedFields: ["code", "name.ko", "name.en", "size", "channel", "type"],
  createdAt: NOW,
  updatedAt: NOW,
};

const subcatsCBA: Subcategory[] = [
  {
    id: CBA_HALL_A_ID,
    eventId: "kprint-2026",
    categoryId: "cat-cba",
    name: { ko: "Hall A", en: "Hall A" },
    priceKRW: 3_000_000,
    priceUSD: 2400,
    unit: { ko: "구좌당", en: "per slot" },
    priceNote: "제작·설치비 포함, 부가세 별도",
    order: 0,
  },
  {
    id: CBA_HALL_B_ID,
    eventId: "kprint-2026",
    categoryId: "cat-cba",
    name: { ko: "Hall B", en: "Hall B" },
    priceKRW: 3_000_000,
    priceUSD: 2400,
    unit: { ko: "구좌당", en: "per slot" },
    priceNote: "제작·설치비 포함, 부가세 별도",
    order: 1,
  },
  {
    id: CBA_HALL_C_ID,
    eventId: "kprint-2026",
    categoryId: "cat-cba",
    name: { ko: "Hall C", en: "Hall C" },
    priceKRW: 2_700_000,
    priceUSD: 2200,
    unit: { ko: "구좌당", en: "per slot" },
    priceNote: "제작·설치비 포함, 부가세 별도",
    order: 2,
  },
];

const slotsCBA: Slot[] = [
  { id: "slot-cba-a-1", eventId: "kprint-2026", subcategoryId: CBA_HALL_A_ID, categoryId: "cat-cba", code: "CBA-A-1", status: "available", note: "A1 출입구 좌측", order: 0 },
  { id: "slot-cba-a-2", eventId: "kprint-2026", subcategoryId: CBA_HALL_A_ID, categoryId: "cat-cba", code: "CBA-A-2", status: "sold", note: "Hall A 중앙 동선", order: 1 },
  { id: "slot-cba-a-3", eventId: "kprint-2026", subcategoryId: CBA_HALL_A_ID, categoryId: "cat-cba", code: "CBA-A-3", status: "available", note: "A1 출입구 우측", order: 2 },
  { id: "slot-cba-b-1", eventId: "kprint-2026", subcategoryId: CBA_HALL_B_ID, categoryId: "cat-cba", code: "CBA-B-1", status: "available", order: 0 },
  { id: "slot-cba-b-2", eventId: "kprint-2026", subcategoryId: CBA_HALL_B_ID, categoryId: "cat-cba", code: "CBA-B-2", status: "available", note: "B 핵심 동선", order: 1 },
  { id: "slot-cba-b-3", eventId: "kprint-2026", subcategoryId: CBA_HALL_B_ID, categoryId: "cat-cba", code: "CBA-B-3", status: "sold", order: 2 },
  { id: "slot-cba-c-1", eventId: "kprint-2026", subcategoryId: CBA_HALL_C_ID, categoryId: "cat-cba", code: "CBA-C-1", status: "available", order: 0 },
  { id: "slot-cba-c-2", eventId: "kprint-2026", subcategoryId: CBA_HALL_C_ID, categoryId: "cat-cba", code: "CBA-C-2", status: "available", note: "C 출입구 인접", order: 1 },
];

// ---- CATEGORY 2: 참관객 목걸이 (quantity) ----------------------------------

const LNY_SUB_ID = "sub-lny-default";

export const dummyCategory_Lanyard: Category = {
  id: "cat-lny",
    eventId: "kprint-2026",
  code: "LNY",
  channel: "offline",
  type: "quantity",
  slug: "visitor-lanyard",
  name: { ko: "참관객 목걸이", en: "Visitor Lanyard" },
  shortDesc: "방문객 전원이 착용하는 등록 목걸이. 행사 기간 내내 노출.",
  longDesc:
    "사전등록·현장등록 방문객 전원에게 배포되는 목걸이로, 기업 로고가 4일간 행사장 전체에서 자연스럽게 노출됩니다.",
  size: "20mm × 900mm (실크인쇄 양면)",
  fileFormat: "AI, EPS (CMYK)",
  deadline: ts("2026-06-15T23:59:59+09:00"),
  designGuideText: "양면 1도 또는 2도, 폰트 두께 1.5pt 이상.",
  heroImages: gallery([
    img("Lanyard Hero 1", "categories/LNY/hero-1.jpg", 0),
    img("Lanyard Hero 2", "categories/LNY/hero-2.jpg", 1),
    img("Lanyard Hero 3", "categories/LNY/hero-3.jpg", 2),
    img("Lanyard Hero 4", "categories/LNY/hero-4.jpg", 3),
  ]),
  detailImages: carousel([
    img("Lanyard Detail 1", "categories/LNY/detail-1.jpg", 0, "착용 예시"),
    img("Lanyard Detail 2", "categories/LNY/detail-2.jpg", 1, "인쇄 도수"),
  ]),
  tags: ["brand_diffusion", "onsite", "registration_path"],
  isPublished: true,
  order: 2,
  lockedFields: ["code", "name.ko", "name.en", "size", "channel", "type"],
  createdAt: NOW,
  updatedAt: NOW,
};

const subcatsLNY: Subcategory[] = [
  {
    id: LNY_SUB_ID,
    eventId: "kprint-2026",
    categoryId: "cat-lny",
    name: { ko: "5,000개 묶음", en: "5,000 ea bundle" },
    priceKRW: 15_000_000,
    priceUSD: 12000,
    unit: { ko: "5,000개당", en: "per 5,000 ea" },
    priceNote: "제작비 포함, 부가세 별도. 행사 기간 4일 노출.",
    order: 0,
  },
];

const slotsLNY: Slot[] = [
  { id: "slot-lny-1", eventId: "kprint-2026", subcategoryId: LNY_SUB_ID, categoryId: "cat-lny", code: "LNY-1", status: "sold", order: 0 },
  { id: "slot-lny-2", eventId: "kprint-2026", subcategoryId: LNY_SUB_ID, categoryId: "cat-lny", code: "LNY-2", status: "available", order: 1 },
  { id: "slot-lny-3", eventId: "kprint-2026", subcategoryId: LNY_SUB_ID, categoryId: "cat-lny", code: "LNY-3", status: "available", order: 2 },
  { id: "slot-lny-4", eventId: "kprint-2026", subcategoryId: LNY_SUB_ID, categoryId: "cat-lny", code: "LNY-4", status: "available", order: 3 },
];

// ---- CATEGORY 3: XPACE 옥외 LED (xpace) ------------------------------------

const XPC_BR_ID = "sub-xpc-bridge";
const XPC_EC_ID = "sub-xpc-edge";
const XPC_WD_ID = "sub-xpc-wide";

export const dummyCategory_Xpace: Category = {
  id: "cat-xpc",
    eventId: "kprint-2026",
  code: "XPC",
  channel: "offline",
  type: "xpace",
  slug: "xpace-outdoor-led",
  name: { ko: "XPACE 옥외 LED", en: "XPACE Outdoor LED" },
  shortDesc: "KINTEX 외곽 4개 LED 거점에서 방문 전부터 노출되는 옥외 영상 광고.",
  longDesc:
    "행사장 진입 동선 4개 위치(브릿지·엣지칼럼·와이드·스퀘어)의 대형 LED에서 영상이 송출됩니다. 방문 전 단계부터 브랜드를 노출시키는 사전 인지 채널.",
  fileFormat: "MP4 (H.264, 30fps)",
  deadline: ts("2026-07-01T23:59:59+09:00"),
  designGuideText: "각 LED 해상도에 맞춘 별도 마스터 입고. 음성 없이 그래픽 중심.",
  heroImages: carousel([
    img("XPACE Hero 1", "categories/XPC/hero-1.jpg", 0, "브릿지 LED 정면"),
    img("XPACE Hero 2", "categories/XPC/hero-2.jpg", 1, "엣지칼럼 노출"),
    img("XPACE Hero 3", "categories/XPC/hero-3.jpg", 2),
  ]),
  detailImages: carousel([
    img("XPACE Detail 1", "categories/XPC/detail-1.jpg", 0),
    img("XPACE Detail 2", "categories/XPC/detail-2.jpg", 1),
  ]),
  floorImages: [
    {
      subcategoryId: XPC_BR_ID,
      url: ph("XPACE Floor Bridge", 2000, 1400),
      storagePath: "categories/XPC/floor-bridge.jpg",
      pins: [
        { slotId: "slot-xpc-br-1", x: 50, y: 38, note: "동측 브릿지 정면" },
      ],
    },
    {
      subcategoryId: XPC_EC_ID,
      url: ph("XPACE Floor Edge", 2000, 1400),
      storagePath: "categories/XPC/floor-edge.jpg",
      pins: [
        { slotId: "slot-xpc-ec-1", x: 28, y: 60, note: "메인 출입 동선" },
        { slotId: "slot-xpc-ec-2", x: 70, y: 60 },
      ],
    },
    {
      subcategoryId: XPC_WD_ID,
      url: ph("XPACE Floor Wide", 2000, 1400),
      storagePath: "categories/XPC/floor-wide.jpg",
      pins: [
        { slotId: "slot-xpc-wd-1", x: 45, y: 50, note: "와이드 LED" },
      ],
    },
  ],
  videoUrl: "https://example.com/xpace/sample-loop.mp4",
  videoSpec: {
    duration: 15,
    resolution: "2480x2160",
    plays: 480,
  },
  tags: ["brand_diffusion", "outdoor", "global"],
  isPublished: true,
  order: 3,
  lockedFields: ["code", "name.ko", "name.en", "channel", "type"],
  createdAt: NOW,
  updatedAt: NOW,
};

const subcatsXPC: Subcategory[] = [
  {
    id: XPC_BR_ID,
    eventId: "kprint-2026",
    categoryId: "cat-xpc",
    name: { ko: "브릿지", en: "Bridge" },
    priceKRW: 15_000_000,
    priceUSD: 12000,
    unit: { ko: "구좌당", en: "per slot" },
    priceNote: "행사 기간 4일 송출, 1구좌 = 15초 영상",
    size: "12m × 4m",
    order: 0,
  },
  {
    id: XPC_EC_ID,
    eventId: "kprint-2026",
    categoryId: "cat-xpc",
    name: { ko: "엣지칼럼", en: "Edge Column" },
    priceKRW: 8_000_000,
    priceUSD: 6500,
    unit: { ko: "구좌당", en: "per slot" },
    size: "2m × 6m (세로)",
    order: 1,
  },
  {
    id: XPC_WD_ID,
    eventId: "kprint-2026",
    categoryId: "cat-xpc",
    name: { ko: "와이드", en: "Wide" },
    priceKRW: 12_000_000,
    priceUSD: 9800,
    unit: { ko: "구좌당", en: "per slot" },
    size: "20m × 3m",
    order: 2,
  },
];

const slotsXPC: Slot[] = [
  { id: "slot-xpc-br-1", eventId: "kprint-2026", subcategoryId: XPC_BR_ID, categoryId: "cat-xpc", code: "XPC-BR-1", status: "available", note: "동측 브릿지 정면", order: 0 },
  { id: "slot-xpc-ec-1", eventId: "kprint-2026", subcategoryId: XPC_EC_ID, categoryId: "cat-xpc", code: "XPC-EC-1", status: "available", note: "메인 출입 동선", order: 0 },
  { id: "slot-xpc-ec-2", eventId: "kprint-2026", subcategoryId: XPC_EC_ID, categoryId: "cat-xpc", code: "XPC-EC-2", status: "sold", order: 1 },
  { id: "slot-xpc-wd-1", eventId: "kprint-2026", subcategoryId: XPC_WD_ID, categoryId: "cat-xpc", code: "XPC-WD-1", status: "available", note: "와이드 LED", order: 0 },
];

// ---- CATEGORY 4: 통합검색 배너 (digital_banner) ----------------------------

const ISB_MAIN_ID = "sub-isb-main";
const ISB_SEMINAR_ID = "sub-isb-seminar";

export const dummyCategory_IntegratedSearch: Category = {
  id: "cat-isb",
    eventId: "kprint-2026",
  code: "ISB",
  channel: "online",
  type: "digital_banner",
  slug: "integrated-search-banner",
  name: { ko: "통합검색 배너", en: "Integrated Search Banner" },
  shortDesc: "공식 사이트 검색 결과 페이지 상단에 노출되는 디지털 배너.",
  longDesc:
    "K-PRINT 공식 사이트 메인검색·세미나검색 결과 페이지 상단에 노출됩니다. 사전 정보 탐색 단계의 방문객을 직접 유입시키는 채널.",
  size: "1200 × 300 (PC) / 720 × 240 (Mobile)",
  fileFormat: "JPG, PNG, GIF (1MB 이하)",
  deadline: ts("2026-07-20T23:59:59+09:00"),
  heroImages: carousel([
    img("ISB Hero 1", "categories/ISB/hero-1.jpg", 0, "PC 노출 예시"),
    img("ISB Hero 2", "categories/ISB/hero-2.jpg", 1, "모바일 노출 예시"),
  ]),
  detailImages: carousel([
    img("ISB Detail 1", "categories/ISB/detail-1.jpg", 0, "PC 디바이스 mockup", 1200, 800),
    img("ISB Detail 2", "categories/ISB/detail-2.jpg", 1, "Mobile 디바이스 mockup", 800, 1200),
  ]),
  tags: ["digital", "registration_path"],
  isPublished: true,
  order: 4,
  lockedFields: ["code", "name.ko", "name.en", "size", "channel", "type"],
  createdAt: NOW,
  updatedAt: NOW,
};

const subcatsISB: Subcategory[] = [
  {
    id: ISB_MAIN_ID,
    eventId: "kprint-2026",
    categoryId: "cat-isb",
    name: { ko: "메인 검색", en: "Main Search" },
    priceKRW: 1_500_000,
    priceUSD: 1200,
    unit: { ko: "구좌당", en: "per slot" },
    priceNote: "행사 기간 + 전후 2주 노출",
    order: 0,
  },
  {
    id: ISB_SEMINAR_ID,
    eventId: "kprint-2026",
    categoryId: "cat-isb",
    name: { ko: "세미나 검색", en: "Seminar Search" },
    priceKRW: 1_000_000,
    priceUSD: 800,
    unit: { ko: "구좌당", en: "per slot" },
    priceNote: "행사 기간 + 전후 2주 노출",
    order: 1,
  },
];

const slotsISB: Slot[] = [
  { id: "slot-isb-m-1", eventId: "kprint-2026", subcategoryId: ISB_MAIN_ID, categoryId: "cat-isb", code: "ISB-M-1", status: "available", order: 0 },
  { id: "slot-isb-m-2", eventId: "kprint-2026", subcategoryId: ISB_MAIN_ID, categoryId: "cat-isb", code: "ISB-M-2", status: "available", order: 1 },
  { id: "slot-isb-m-3", eventId: "kprint-2026", subcategoryId: ISB_MAIN_ID, categoryId: "cat-isb", code: "ISB-M-3", status: "sold", order: 2 },
  { id: "slot-isb-s-1", eventId: "kprint-2026", subcategoryId: ISB_SEMINAR_ID, categoryId: "cat-isb", code: "ISB-S-1", status: "available", order: 0 },
  { id: "slot-isb-s-2", eventId: "kprint-2026", subcategoryId: ISB_SEMINAR_ID, categoryId: "cat-isb", code: "ISB-S-2", status: "available", order: 1 },
];

// ---- CATEGORY 5: 뉴스레터 (mailing) -----------------------------------------

const NWS_KR_ID = "sub-nws-kr";
const NWS_EN_ID = "sub-nws-en";

export const dummyCategory_Newsletter: Category = {
  id: "cat-nws",
    eventId: "kprint-2026",
  code: "NWS",
  channel: "online",
  type: "mailing",
  slug: "newsletter",
  name: { ko: "뉴스레터", en: "Newsletter" },
  shortDesc: "사전등록자 + 데이터베이스 대상 정기 뉴스레터에 배너로 삽입.",
  longDesc:
    "K-PRINT 사무국이 운영하는 국내·해외 뉴스레터에 스폰서 배너가 삽입됩니다. 행사 전 6주, 매주 금요일 발송.",
  fileFormat: "JPG / PNG (600px wide)",
  deadline: ts("2026-07-10T23:59:59+09:00"),
  heroImages: single(
    img("Newsletter Hero", "categories/NWS/hero-1.jpg", 0, "뉴스레터 미리보기")
  ),
  detailImages: carousel([
    img("Newsletter Detail 1", "categories/NWS/detail-1.jpg", 0, "메일 mockup"),
    img("Newsletter Detail 2", "categories/NWS/detail-2.jpg", 1),
  ]),
  mailingSpec: {
    sendDates: [
      "2026-07-10",
      "2026-07-17",
      "2026-07-24",
      "2026-07-31",
      "2026-08-07",
      "2026-08-14",
    ],
    audience: 24800,
    audienceLabel: "국내 사전등록자 + 산업 DB",
  },
  tags: ["digital", "registration_path"],
  isPublished: true,
  order: 5,
  lockedFields: ["code", "name.ko", "name.en", "channel", "type"],
  createdAt: NOW,
  updatedAt: NOW,
};

const subcatsNWS: Subcategory[] = [
  {
    id: NWS_KR_ID,
    eventId: "kprint-2026",
    categoryId: "cat-nws",
    name: { ko: "국내", en: "Domestic" },
    priceKRW: 2_000_000,
    priceUSD: 1600,
    unit: { ko: "회당", en: "per send" },
    priceNote: "1회 발송 기준, 부가세 별도",
    order: 0,
  },
  {
    id: NWS_EN_ID,
    eventId: "kprint-2026",
    categoryId: "cat-nws",
    name: { ko: "해외", en: "Global" },
    priceKRW: 5_000_000,
    priceUSD: 4000,
    unit: { ko: "회당", en: "per send" },
    priceNote: "글로벌 바이어 DB, 영문 뉴스레터",
    order: 1,
  },
];

const slotsNWS: Slot[] = [
  { id: "slot-nws-kr-1", eventId: "kprint-2026", subcategoryId: NWS_KR_ID, categoryId: "cat-nws", code: "NWS-KR-1", status: "available", note: "2026-07-10 발송", order: 0 },
  { id: "slot-nws-kr-2", eventId: "kprint-2026", subcategoryId: NWS_KR_ID, categoryId: "cat-nws", code: "NWS-KR-2", status: "sold", note: "2026-07-17 발송", order: 1 },
  { id: "slot-nws-kr-3", eventId: "kprint-2026", subcategoryId: NWS_KR_ID, categoryId: "cat-nws", code: "NWS-KR-3", status: "available", note: "2026-07-24 발송", order: 2 },
  { id: "slot-nws-en-1", eventId: "kprint-2026", subcategoryId: NWS_EN_ID, categoryId: "cat-nws", code: "NWS-EN-1", status: "available", note: "2026-07-10 발송", order: 0 },
  { id: "slot-nws-en-2", eventId: "kprint-2026", subcategoryId: NWS_EN_ID, categoryId: "cat-nws", code: "NWS-EN-2", status: "available", note: "2026-08-07 발송", order: 1 },
];

// ---- AGGREGATE EXPORTS ----------------------------------------------------

export const dummyCategories: Category[] = [
  dummyCategory_CeilingBanner,
  dummyCategory_Lanyard,
  dummyCategory_Xpace,
  dummyCategory_IntegratedSearch,
  dummyCategory_Newsletter,
];

export const dummySubcategories: Subcategory[] = [
  ...subcatsCBA,
  ...subcatsLNY,
  ...subcatsXPC,
  ...subcatsISB,
  ...subcatsNWS,
];

export const dummySlots: Slot[] = [
  ...slotsCBA,
  ...slotsLNY,
  ...slotsXPC,
  ...slotsISB,
  ...slotsNWS,
];

// ---- PACKAGES -------------------------------------------------------------

export const dummyPackages: Package[] = [
  {
    id: "pkg-pc-1",
    eventId: "kprint-2026",
    code: "PC-1",
    name: { ko: "시그니처 패키지", en: "Signature Package" },
    tier: "signature",
    tagline: "가장 강력한 노출 + 등록경로 + 디지털 통합 — 전 구간 커버",
    includedItems: [
      { label: "천장 배너 Hall A 1구좌", referencedSlotIds: ["slot-cba-a-1"] },
      { label: "참관객 목걸이 5,000개 묶음 1구좌", referencedSlotIds: ["slot-lny-2"] },
      { label: "XPACE 브릿지 LED 1구좌", referencedSlotIds: ["slot-xpc-br-1"] },
      { label: "통합검색 메인 배너 1구좌", referencedSlotIds: ["slot-isb-m-1"] },
      { label: "뉴스레터 국내 발송 2회", referencedSlotIds: ["slot-nws-kr-1", "slot-nws-kr-3"] },
    ],
    originalPrice: 36_500_000,
    discountPrice: 29_900_000,
    unit: "패키지",
    priceNote: "약 18% 할인. 부가세 별도. 본 구성은 예시이며 실제 구좌는 협의 후 배정.",
    heroImages: carousel([
      img("Signature Package", "packages/PC-1/hero-1.jpg", 0, "시그니처 노출 동선"),
      img("Signature Package 2", "packages/PC-1/hero-2.jpg", 1),
    ]),
    isPublished: true,
    order: 0,
  },
  {
    id: "pkg-pc-2",
    eventId: "kprint-2026",
    code: "PC-2",
    name: { ko: "스탠다드 패키지", en: "Standard Package" },
    tier: "standard",
    tagline: "오프라인 + 온라인 핵심 채널만 골라 담은 균형 패키지",
    includedItems: [
      { label: "천장 배너 Hall B 1구좌", referencedSlotIds: ["slot-cba-b-1"] },
      { label: "통합검색 세미나 배너 1구좌", referencedSlotIds: ["slot-isb-s-1"] },
      { label: "뉴스레터 국내 발송 1회", referencedSlotIds: ["slot-nws-kr-1"] },
    ],
    originalPrice: 6_500_000,
    discountPrice: 5_500_000,
    unit: "패키지",
    priceNote: "약 15% 할인. 부가세 별도.",
    heroImages: carousel([
      img("Standard Package", "packages/PC-2/hero-1.jpg", 0),
    ]),
    isPublished: true,
    order: 1,
  },
];

// ---- LOOKUP HELPERS -------------------------------------------------------

export function getDummyCategoryBySlug(slug: string): Category | undefined {
  return dummyCategories.find((c) => c.slug === slug);
}

export function getDummySubcategoriesByCategoryId(categoryId: string): Subcategory[] {
  return dummySubcategories
    .filter((s) => s.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
}

export function getDummySlotsByCategoryId(categoryId: string): Slot[] {
  return dummySlots
    .filter((s) => s.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
}

export function getDummySlotsBySubcategoryId(subcategoryId: string): Slot[] {
  return dummySlots
    .filter((s) => s.subcategoryId === subcategoryId)
    .sort((a, b) => a.order - b.order);
}
