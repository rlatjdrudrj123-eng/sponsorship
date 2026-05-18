/**
 * KPRINT 2026 — 단일 행사 라인업 시드 (확정본).
 *
 * 사용: /admin/seed 페이지의 [KPRINT 2026 으로 완전 초기화] 버튼.
 *
 * 동작:
 *  1. 기존 Firestore 데이터 전부 삭제 (categories / subcategories / slots / packages / events / siteSettings / inquiries / sponsors / importHistory)
 *  2. KPRINT 2026 행사 생성
 *  3. 최소한의 siteSettings (테마·이벤트 정보)
 *  4. 카테고리 20개 + 패키지 4개 + 각 카테고리의 소분류·슬롯
 */
import {
  collection,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Category, SiteSettings } from "@/lib/types";
import { DEFAULT_BUNDLED_PERKS } from "@/lib/perks";
import { DEFAULT_KPRINT_PERSONAS } from "@/lib/kprintPersonas";
import { clearAllContent, type ClearAllResult } from "./seedDemo";

const EVENT_ID = "kprint-2026";

// =============================================================
// 카테고리 시드 데이터
// =============================================================

type CategorySeed = {
  code: string;
  slug: string;
  channel: "offline" | "online";
  type: Category["type"];
  name: { ko: string; en: string };
  shortDesc: string;
  size?: string;
  fileFormat?: string;
  tags: string[];
  subcategories: Array<{
    name: { ko: string; en: string };
    unit: { ko: string; en: string };
    priceKRW: number;
    slotCount: number;
  }>;
};

const KPRINT_CATEGORIES: CategorySeed[] = [
  // ─── OFFLINE (8) ────────────────────────────────────────────
  {
    code: "CB",
    slug: "ceiling-banner",
    channel: "offline",
    type: "floor_plan",
    name: { ko: "천장배너", en: "Ceiling Banner" },
    shortDesc: "전시장 천장에 매달리는 대형 배너 — 진입 시 가장 먼저 보이는 매체.",
    fileFormat: "eps, ai, pdf 등의 인쇄용 파일형태 (고해상도)",
    tags: ["천장", "배너"],
    subcategories: [
      { name: { ko: "천장배너", en: "Ceiling Banner" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 2_000_000, slotCount: 4 },
    ],
  },
  {
    code: "VL",
    slug: "visitor-lanyard",
    channel: "offline",
    type: "quantity",
    name: { ko: "참관객 목걸이", en: "Visitor Lanyard" },
    shortDesc: "사전 + 현장 등록자 전원이 착용 — 노출 시간이 가장 긴 매체.",
    fileFormat: "eps, ai, pdf",
    tags: ["목걸이", "수량"],
    subcategories: [
      { name: { ko: "참관객 목걸이 (5,000개)", en: "Visitor Lanyard (5,000 pcs)" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 8_000_000, slotCount: 1 },
    ],
  },
  {
    code: "RD",
    slug: "registration-desk",
    channel: "offline",
    type: "floor_plan",
    name: { ko: "등록대", en: "Registration Desk" },
    shortDesc: "전 참관객이 거치는 첫 접점 — 자체 브랜딩 + 스폰서 로고.",
    fileFormat: "eps, ai, pdf",
    tags: ["등록", "입구"],
    subcategories: [
      { name: { ko: "등록대 스폰서 로고", en: "Logo Slot" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 1_000_000, slotCount: 6 },
    ],
  },
  {
    code: "II",
    slug: "invitation-insert",
    channel: "offline",
    type: "quantity",
    name: { ko: "초대장 삽지", en: "Invitation Insert" },
    shortDesc: "공식 초대장에 함께 발송되는 삽지 — 2개사 한정.",
    fileFormat: "ai, pdf",
    tags: ["초대장", "한정"],
    subcategories: [
      { name: { ko: "초대장 삽지", en: "Invitation Insert" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 8_000_000, slotCount: 2 },
    ],
  },
  {
    code: "GB",
    slug: "guidebook-back-cover",
    channel: "offline",
    type: "print_page",
    name: { ko: "가이드북 후표지", en: "Guidebook Back Cover" },
    shortDesc: "공식 가이드북 뒷면 전면 광고 (표2 대면 확인 필요).",
    fileFormat: "ai, pdf",
    tags: ["가이드북", "지면"],
    subcategories: [
      { name: { ko: "후표지", en: "Back Cover" }, unit: { ko: "면", en: "page" }, priceKRW: 4_000_000, slotCount: 1 },
    ],
  },
  {
    code: "FS",
    slug: "floor-sticker",
    channel: "offline",
    type: "floor_plan",
    name: { ko: "전시장 바닥 스티커", en: "Floor Sticker" },
    shortDesc: "전시장 바닥 동선 위에 부착하는 스티커.",
    fileFormat: "ai, pdf",
    tags: ["바닥", "스티커"],
    subcategories: [
      { name: { ko: "바닥 스티커", en: "Floor Sticker" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 1_000_000, slotCount: 10 },
    ],
  },
  {
    code: "LW",
    slug: "lighting-wall",
    channel: "offline",
    type: "floor_plan",
    name: { ko: "라이팅월", en: "Lighting Wall" },
    shortDesc: "전시장 주요 동선의 라이팅 벽 — 사진 인증샷 매체.",
    fileFormat: "ai, pdf",
    tags: ["라이팅", "포토존"],
    subcategories: [
      { name: { ko: "라이팅월", en: "Lighting Wall" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 1_500_000, slotCount: 4 },
    ],
  },
  {
    code: "GP",
    slug: "giveaway-event",
    channel: "offline",
    type: "content",
    name: { ko: "경품 협찬 이벤트", en: "Giveaway Sponsor" },
    shortDesc: "현장 경품 협찬 — 가격 협의.",
    tags: ["경품", "협의"],
    subcategories: [
      { name: { ko: "경품 협찬", en: "Giveaway" }, unit: { ko: "건", en: "deal" }, priceKRW: 0, slotCount: 1 },
    ],
  },

  // ─── ONLINE (12) ────────────────────────────────────────────
  {
    code: "PR",
    slug: "preregister-banner",
    channel: "online",
    type: "digital_banner",
    name: { ko: "사전등록 페이지 배너", en: "Pre-Reg Page Banner" },
    shortDesc: "사전등록 페이지 상단 배너.",
    fileFormat: "jpg, png, jpeg",
    tags: ["사전등록", "배너"],
    subcategories: [
      { name: { ko: "사전등록 페이지 배너", en: "Banner" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 3_000_000, slotCount: 1 },
    ],
  },
  {
    code: "CM",
    slug: "confirm-mail",
    channel: "online",
    type: "mailing",
    name: { ko: "참관등록 완료 이메일", en: "Confirmation Email" },
    shortDesc: "참관 등록 완료 시 발송되는 이메일 배너.",
    fileFormat: "jpg, png, jpeg",
    tags: ["이메일", "사전등록"],
    subcategories: [
      { name: { ko: "완료 이메일 배너", en: "Email Banner" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 2_000_000, slotCount: 1 },
    ],
  },
  {
    code: "FB",
    slug: "floor-search-banner",
    channel: "online",
    type: "digital_banner",
    name: { ko: "도면 검색 페이지 배너", en: "Floor Plan Page Banner" },
    shortDesc: "전시장 도면 검색 페이지 상단 배너.",
    fileFormat: "jpg, png, jpeg",
    tags: ["도면", "배너"],
    subcategories: [
      { name: { ko: "도면 검색 배너", en: "Floor Search Banner" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 4_000_000, slotCount: 1 },
    ],
  },
  {
    code: "CS",
    slug: "company-search-banner",
    channel: "online",
    type: "digital_banner",
    name: { ko: "참가업체 검색 배너", en: "Exhibitor Search Banner" },
    shortDesc: "참가업체 검색 페이지 배너.",
    fileFormat: "jpg, png, jpeg",
    tags: ["검색", "배너"],
    subcategories: [
      { name: { ko: "참가업체 검색 배너", en: "Exhibitor Search" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 1_000_000, slotCount: 4 },
    ],
  },
  {
    code: "PS",
    slug: "product-search-banner",
    channel: "online",
    type: "digital_banner",
    name: { ko: "전시품 검색 배너", en: "Product Search Banner" },
    shortDesc: "전시품 검색 페이지 배너.",
    fileFormat: "jpg, png, jpeg",
    tags: ["검색", "배너"],
    subcategories: [
      { name: { ko: "전시품 검색 배너", en: "Product Search" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 1_000_000, slotCount: 4 },
    ],
  },
  {
    code: "IS",
    slug: "integrated-search-banner",
    channel: "online",
    type: "digital_banner",
    name: { ko: "통합검색 배너", en: "Integrated Search Banner" },
    shortDesc: "통합검색 결과 페이지 배너.",
    fileFormat: "jpg, png, jpeg",
    tags: ["검색", "배너"],
    subcategories: [
      { name: { ko: "통합검색 배너", en: "Integrated Search" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 1_000_000, slotCount: 4 },
    ],
  },
  {
    code: "FL",
    slug: "floor-logo",
    channel: "online",
    type: "digital_banner",
    name: { ko: "도면 내 참가기업 로고", en: "Floor Plan Logo" },
    shortDesc: "전시장 도면 위 참가기업 로고 노출.",
    fileFormat: "ai, png (투명배경)",
    tags: ["도면", "로고"],
    subcategories: [
      { name: { ko: "도면 내 로고", en: "Floor Logo" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 2_000_000, slotCount: 8 },
    ],
  },
  {
    code: "DN",
    slug: "domestic-newsletter",
    channel: "online",
    type: "mailing",
    name: { ko: "국내 뉴스레터", en: "Domestic Newsletter" },
    shortDesc: "국내 참관객 대상 뉴스레터 배너. 7월·8월 회차 선택.",
    fileFormat: "jpg, png, jpeg",
    tags: ["뉴스레터", "국내"],
    subcategories: [
      { name: { ko: "7월 발송", en: "July" }, unit: { ko: "회", en: "send" }, priceKRW: 1_500_000, slotCount: 1 },
      { name: { ko: "8월 발송", en: "August" }, unit: { ko: "회", en: "send" }, priceKRW: 2_000_000, slotCount: 1 },
    ],
  },
  {
    code: "IN",
    slug: "international-newsletter",
    channel: "online",
    type: "mailing",
    name: { ko: "해외 뉴스레터", en: "Intl Newsletter" },
    shortDesc: "해외 바이어 대상 뉴스레터 배너. 7월·8월 회차 선택.",
    fileFormat: "jpg, png, jpeg",
    tags: ["뉴스레터", "해외"],
    subcategories: [
      { name: { ko: "7월 발송", en: "July" }, unit: { ko: "회", en: "send" }, priceKRW: 1_000_000, slotCount: 1 },
      { name: { ko: "8월 발송", en: "August" }, unit: { ko: "회", en: "send" }, priceKRW: 1_500_000, slotCount: 1 },
    ],
  },
  {
    code: "SB",
    slug: "seminar-banner",
    channel: "online",
    type: "digital_banner",
    name: { ko: "세미나 페이지 배너", en: "Seminar Page Banner" },
    shortDesc: "세미나/컨퍼런스 페이지 상단 배너.",
    fileFormat: "jpg, png, jpeg",
    tags: ["세미나", "배너"],
    subcategories: [
      { name: { ko: "세미나 페이지 배너", en: "Seminar Banner" }, unit: { ko: "구좌", en: "slot" }, priceKRW: 750_000, slotCount: 3 },
    ],
  },
  {
    code: "IT",
    slug: "interview-sns",
    channel: "online",
    type: "content",
    name: { ko: "참가업체 인터뷰 + SNS", en: "Interview + SNS" },
    shortDesc: "참가업체 인터뷰 콘텐츠 제작 + 공식 SNS 채널 발행.",
    tags: ["인터뷰", "콘텐츠"],
    subcategories: [
      { name: { ko: "인터뷰 + SNS", en: "Interview" }, unit: { ko: "건", en: "deal" }, priceKRW: 1_000_000, slotCount: 5 },
    ],
  },
  {
    code: "IC",
    slug: "insta-cardnews",
    channel: "online",
    type: "content",
    name: { ko: "인스타 카드뉴스", en: "Instagram Card News" },
    shortDesc: "공식 인스타그램 카드뉴스 1회 게재.",
    tags: ["인스타", "콘텐츠"],
    subcategories: [
      { name: { ko: "카드뉴스 1회", en: "Card News 1x" }, unit: { ko: "회", en: "post" }, priceKRW: 300_000, slotCount: 10 },
    ],
  },
];

// =============================================================
// 패키지 시드 데이터
// =============================================================

type PackageSeed = {
  code: string;
  name: { ko: string; en: string };
  tier: "signature" | "standard";
  tagline: string;
  includedItems: Array<{ label: string }>;
  originalPrice: number;
  discountPrice: number;
  priceNote?: string;
};

const KPRINT_PACKAGES: PackageSeed[] = [
  {
    code: "PKG-AZ",
    name: { ko: "참관객 A to Z 패키지", en: "Visitor A to Z Package" },
    tier: "signature",
    tagline: "다수 참관객에게 기업 영향력을 알리는 통합 패키지.",
    includedItems: [
      { label: "등록대 스폰서 로고 1구좌" },
      { label: "사전등록 페이지 배너" },
      { label: "참관등록 완료 이메일" },
      { label: "참관객 목걸이 1구좌 (5,000개)" },
      { label: "라이팅월 1구좌" },
    ],
    originalPrice: 15_500_000,
    discountPrice: 12_000_000,
    priceNote: "2025 대비 가격 -40%",
  },
  {
    code: "PKG-PS",
    name: { ko: "프라임 스팟 패키지", en: "Prime Spot Package" },
    tier: "signature",
    tagline: "온라인 + 오프라인 최고 노출 빈도 채널을 결합한 패키지.",
    includedItems: [
      { label: "천장배너 2구좌" },
      { label: "도면 검색 페이지 배너" },
      { label: "참가업체 검색 배너" },
    ],
    originalPrice: 9_000_000,
    discountPrice: 7_500_000,
    priceNote: "2025 대비 가격 -25%",
  },
  {
    code: "PKG-OS",
    name: { ko: "온사이트 패키지", en: "Onsite Package" },
    tier: "standard",
    tagline: "현장 노출 위주 — 진입형 시그니처.",
    includedItems: [
      { label: "천장배너 1구좌" },
      { label: "전시장 바닥 스티커 2구좌" },
      { label: "라이팅월 1구좌" },
    ],
    originalPrice: 5_500_000,
    discountPrice: 4_000_000,
    priceNote: "2026 신규 패키지",
  },
  {
    code: "PKG-SC",
    name: { ko: "세미나/컨퍼런스 패키지", en: "Seminar/Conference Package" },
    tier: "standard",
    tagline: "핵심 산업 관계자에게 배너와 뉴스레터로 노출.",
    includedItems: [
      { label: "세미나 페이지 배너 1구좌" },
      { label: "국내 뉴스레터 1회 (8월)" },
      { label: "참가업체 인터뷰 + SNS" },
      { label: "인스타 카드뉴스 1회" },
    ],
    originalPrice: 4_050_000,
    discountPrice: 3_200_000,
    priceNote: "2025 대비 가격 -20%",
  },
];

// =============================================================
// Reset + seed 실행 함수
// =============================================================

export type Kprint2026FinalSeedResult = {
  cleared: ClearAllResult;
  created: {
    event: boolean;
    siteSettings: boolean;
    categories: number;
    subcategories: number;
    slots: number;
    packages: number;
    personas: number;
  };
};

export async function resetAndSeedKprint2026(): Promise<Kprint2026FinalSeedResult> {
  const db = getDb();

  // 1) 기존 데이터 전부 초기화
  const cleared = await clearAllContent({
    categories: true,
    packages: true,
    inquiries: true,
    sponsors: true,
    events: true,
    importHistory: true,
    siteSettings: true,
  });

  // 2) KPRINT 2026 행사 생성
  await setDoc(doc(db, "events", EVENT_ID), {
    id: EVENT_ID,
    slug: EVENT_ID,
    name: { ko: "K-PRINT 2026", en: "K-PRINT 2026" },
    isActive: true,
    order: 0,
    createdAt: Timestamp.now(),
  });

  // 3) 최소한의 siteSettings — 테마·이벤트 정보·필수 필드만
  const settings: SiteSettings = {
    eventId: EVENT_ID,
    theme: { primary: "#DB0711" },
    event: {
      nameKo: "K-PRINT 2026",
      nameEn: "K-PRINT 2026",
      dateRange: "2026년 8월 26일(수) - 28일(금)",
      venue: "KINTEX 제1전시장",
      applicationDeadline: Timestamp.fromDate(new Date("2026-02-28")),
    },
    kv: { desktopUrl: "" },
    why: { headline: "", stats: [] },
    contact: { phone: "", email: "", address: "" },
    applicationSteps: [],
    bundledPerks: DEFAULT_BUNDLED_PERKS,
  };
  await setDoc(doc(db, "siteSettings", EVENT_ID), settings);

  // 4) 카테고리 + 소분류 + 슬롯 시드
  let catCount = 0;
  let subCount = 0;
  let slotCount = 0;
  let categoryOrder = 0;

  for (const cat of KPRINT_CATEGORIES) {
    const catRef = doc(collection(db, "categories"));
    const catId = catRef.id;
    categoryOrder++;

    await setDoc(catRef, {
      id: catId,
      eventId: EVENT_ID,
      code: cat.code,
      channel: cat.channel,
      type: cat.type,
      slug: cat.slug,
      name: cat.name,
      shortDesc: cat.shortDesc,
      ...(cat.size ? { size: cat.size } : {}),
      ...(cat.fileFormat ? { fileFormat: cat.fileFormat } : {}),
      heroImages: { mode: "single", images: [] },
      tags: cat.tags,
      isPublished: true,
      order: categoryOrder,
    });
    catCount++;

    let subOrder = 0;
    for (const sub of cat.subcategories) {
      const subRef = doc(collection(db, "subcategories"));
      subOrder++;
      await setDoc(subRef, {
        id: subRef.id,
        eventId: EVENT_ID,
        categoryId: catId,
        name: sub.name,
        priceKRW: sub.priceKRW,
        unit: sub.unit,
        order: subOrder,
      });
      subCount++;

      // 각 소분류마다 슬롯 N개 생성
      let slotOrderInSub = 0;
      for (let i = 0; i < sub.slotCount; i++) {
        const slotRef = doc(collection(db, "slots"));
        slotOrderInSub++;
        const slotCode =
          sub.slotCount === 1
            ? `${cat.code}`
            : `${cat.code}-${slotOrderInSub}`;
        await setDoc(slotRef, {
          id: slotRef.id,
          eventId: EVENT_ID,
          subcategoryId: subRef.id,
          categoryId: catId,
          code: slotCode,
          status: "available",
          order: slotCount,
        });
        slotCount++;
      }
    }
  }

  // 5) KPRINT 페르소나 시드 — 인쇄 업계 회사 5유형
  let personaCount = 0;
  for (const persona of DEFAULT_KPRINT_PERSONAS) {
    const personaRef = doc(collection(db, "personas"));
    const { idHint, ...rest } = persona;
    void idHint; // 참고용 — 실제로는 Firestore auto id 사용
    await setDoc(personaRef, {
      id: personaRef.id,
      eventId: EVENT_ID,
      ...rest,
    });
    personaCount++;
  }

  // 6) 패키지 시드
  let pkgCount = 0;
  let pkgOrder = 0;
  for (const pkg of KPRINT_PACKAGES) {
    const pkgRef = doc(collection(db, "packages"));
    pkgOrder++;
    await setDoc(pkgRef, {
      id: pkgRef.id,
      eventId: EVENT_ID,
      code: pkg.code,
      name: pkg.name,
      tier: pkg.tier,
      tagline: pkg.tagline,
      includedItems: pkg.includedItems,
      originalPrice: pkg.originalPrice,
      discountPrice: pkg.discountPrice,
      ...(pkg.priceNote ? { priceNote: pkg.priceNote } : {}),
      isPublished: true,
      order: pkgOrder,
    });
    pkgCount++;
  }

  return {
    cleared,
    created: {
      event: true,
      siteSettings: true,
      categories: catCount,
      subcategories: subCount,
      slots: slotCount,
      packages: pkgCount,
      personas: personaCount,
    },
  };
}
