/**
 * K-PRINT 2026 실제 스폰서십 샘플 시드.
 *
 * 작년 K-PRINT 2025 운영 데이터 기준으로 12개 카테고리 + 25+ 슬롯 + 3 패키지 일괄 생성.
 * 사용처: admin/seed 페이지의 「K-PRINT 스폰서십 시드」 버튼.
 *
 * 호출 시:
 *  - 활성 행사(eventId) 의 categories/subcategories/slots/packages 에 K-PRINT 자료 주입
 *  - 같은 code 가 이미 있으면 건너뜀 (중복 안전)
 */

"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { getDb } from "../firebase/firestore";
import type {
  Category,
  CategoryType,
  Channel,
  Package,
  Slot,
  Subcategory,
} from "../types";

export type KprintSeedResult = {
  categoriesCreated: number;
  categoriesSkipped: number;
  subcategoriesCreated: number;
  slotsCreated: number;
  packagesCreated: number;
  packagesSkipped: number;
  notes: string[];
};

/** code → 카테고리 정의 */
type CategoryDef = {
  code: string;          // 영문 3자리
  channel: Channel;
  type: CategoryType;
  slug: string;
  nameKo: string;
  nameEn: string;
  shortDesc: string;
  longDesc: string;
  size?: string;
  fileFormat?: string;
  tags: string[];
  // 서브카테고리들
  subs: Array<{
    nameKo: string;
    nameEn: string;
    priceKRW: number;
    unitKo: string;
    unitEn: string;
    priceNote?: string;
    slots: Array<{ code: string; status?: "available" | "sold" | "reserved"; note?: string }>;
  }>;
};

// 작년 K-PRINT 2025 운영 데이터 기준
const KPRINT_CATEGORIES: CategoryDef[] = [
  // ─── 오프라인 ───
  {
    code: "RGA",
    channel: "offline",
    type: "floor_plan",
    slug: "registration-desk",
    nameKo: "등록데스크 (출입증 발급대)",
    nameEn: "Registration Desk",
    shortDesc: "입구 앞 등록대 패널 광고 — 모든 참관객 통과 동선.",
    longDesc:
      "전시회 입구 등록대 앞에 설치되는 2,000mm × 1,000mm 패널. 사전등록·현장등록 모든 참관객이 반드시 통과하는 동선이라 노출 보장.",
    size: "2,000mm × 1,000mm",
    fileFormat: "eps, ai, pdf (인쇄용 고해상도)",
    tags: ["등록", "입구", "오프라인", "동선"],
    subs: [
      {
        nameKo: "패널 광고 (5구좌)",
        nameEn: "Desk Panel (5 slots)",
        priceKRW: 2_000_000,
        unitKo: "1구좌",
        unitEn: "per slot",
        priceNote: "제작 설치비 포함, 부가세 별도",
        slots: [
          { code: "RGA-1-1" },
          { code: "RGA-1-2" },
          { code: "RGA-1-3" },
          { code: "RGA-1-4" },
          { code: "RGA-1-5" },
        ],
      },
    ],
  },
  {
    code: "CBA",
    channel: "offline",
    type: "floor_plan",
    slug: "ceiling-banner",
    nameKo: "천장 배너 (Hall 7·8)",
    nameEn: "Ceiling Banner",
    shortDesc: "전시 홀 7·8 내부 천장 배너 — 부스 위 상시 노출.",
    longDesc:
      "Hall 7, 8홀 내부 천장에 매다는 2,500mm × 4,000mm 배너. 부스 위에서 모든 방문객에게 동시 노출, 7일간 상시 노출.",
    size: "2,500mm × 4,000mm",
    fileFormat: "eps, ai, pdf",
    tags: ["천장", "부스", "Hall7", "Hall8", "오프라인"],
    subs: [
      {
        nameKo: "천장 배너 (4구좌)",
        nameEn: "Ceiling Banner (4 slots)",
        priceKRW: 2_000_000,
        unitKo: "1배너",
        unitEn: "per banner",
        priceNote: "제작 설치비 포함, 부가세 별도",
        slots: [
          { code: "CBA-1" },
          { code: "CBA-2" },
          { code: "CBA-3" },
          { code: "CBA-4" },
        ],
      },
    ],
  },
  {
    code: "BGE",
    channel: "offline",
    type: "quantity",
    slug: "visitor-badge",
    nameKo: "참관객 목걸이 (출입증)",
    nameEn: "Visitor Badge",
    shortDesc: "전체 20,000개 / 5,000개 단위 1구좌 — 모든 참관객 착용 노출.",
    longDesc:
      "전시회 출입증 목걸이에 인쇄. 전체 제작 수량 20,000개 중 5,000개를 1구좌로 지정. 행사 기간 내내 모든 참관객이 착용하므로 가장 친밀한 노출 채널.",
    fileFormat: "eps, ai, pdf",
    tags: ["목걸이", "수량", "참관객", "오프라인"],
    subs: [
      {
        nameKo: "목걸이 광고 (3구좌)",
        nameEn: "Badge Print (3 slots)",
        priceKRW: 8_000_000,
        unitKo: "5,000개 / 구좌",
        unitEn: "5,000 pcs / slot",
        priceNote: "제작 및 배포비 포함, 부가세 별도",
        slots: [{ code: "BGE-1" }, { code: "BGE-2" }, { code: "BGE-3" }],
      },
    ],
  },
  {
    code: "IVL",
    channel: "offline",
    type: "quantity",
    slug: "invitation-insert",
    nameKo: "초대장 삽지",
    nameEn: "Invitation Card Insert",
    shortDesc: "70,000장 초대장에 삽지 — 최대 2개사 한정.",
    longDesc:
      "사전 발송 초대장에 동봉되는 100mm × 180mm 삽지. 70,000장 발송 / 최대 2개사 접수.",
    size: "100mm × 180mm",
    fileFormat: "eps, ai, pdf",
    tags: ["초대장", "삽지", "사전", "오프라인"],
    subs: [
      {
        nameKo: "초대장 삽지 (2구좌 / 마감)",
        nameEn: "Invitation Insert (2 slots / closed)",
        priceKRW: 8_000_000,
        unitKo: "70,000장",
        unitEn: "70,000 pcs",
        priceNote: "부가세 별도, 마감",
        slots: [
          { code: "IVL-1", status: "sold", note: "마감" },
          { code: "IVL-2", status: "sold", note: "마감" },
        ],
      },
    ],
  },
  {
    code: "GDB",
    channel: "offline",
    type: "print_page",
    slug: "guidebook-ad",
    nameKo: "전시회 가이드북 광고 (표4)",
    nameEn: "Guidebook Cover Ad",
    shortDesc: "행사 가이드북 후표지 — 국문·영문·국영문 3종.",
    longDesc:
      "현장 가이드북 후표지(표4) 전면 광고. 국문/영문/국영문 통합 옵션. 행사 후에도 회수 가이드북으로 잔존 노출.",
    fileFormat: "eps, ai, pdf",
    tags: ["가이드북", "표4", "인쇄물", "오프라인"],
    subs: [
      {
        nameKo: "표4 국·영문 통합",
        nameEn: "Cover (KR/EN)",
        priceKRW: 4_000_000,
        unitKo: "1면",
        unitEn: "1 page",
        priceNote: "부가세 별도, 마감",
        slots: [{ code: "GDB-1", status: "sold", note: "마감" }],
      },
      {
        nameKo: "표4 국문",
        nameEn: "Cover (KR)",
        priceKRW: 3_000_000,
        unitKo: "1면",
        unitEn: "1 page",
        priceNote: "부가세 별도, 마감",
        slots: [{ code: "GDB-2", status: "sold", note: "마감" }],
      },
      {
        nameKo: "표4 영문",
        nameEn: "Cover (EN)",
        priceKRW: 2_000_000,
        unitKo: "1면",
        unitEn: "1 page",
        priceNote: "부가세 별도, 마감",
        slots: [{ code: "GDB-3", status: "sold", note: "마감" }],
      },
    ],
  },

  // ─── 온라인 ───
  {
    code: "FPS",
    channel: "online",
    type: "digital_banner",
    slug: "floor-plan-search-banner",
    nameKo: "전시장 도면 검색 페이지 배너",
    nameEn: "Floor Plan Search Banner",
    shortDesc: "kprint.kr 도면 검색 페이지 상단 — 부스 찾는 참관객 도달.",
    longDesc:
      "전시회 공식 사이트의 전시장 도면 검색 페이지 상단 배너. 부스 위치를 찾는 참관객에게 직접 노출.",
    size: "PC 1,200px × 120px / 모바일 360px × 160px",
    fileFormat: "jpg, png, jpeg",
    tags: ["도면", "검색", "온라인", "사이트"],
    subs: [
      {
        nameKo: "도면 검색 배너 (1구좌)",
        nameEn: "Banner (1 slot)",
        priceKRW: 6_000_000,
        unitKo: "1구좌",
        unitEn: "per slot",
        priceNote: "부가세 별도",
        slots: [{ code: "FPS-1" }],
      },
    ],
  },
  {
    code: "RGS",
    channel: "online",
    type: "digital_banner",
    slug: "registration-page-banner",
    nameKo: "사전등록 페이지 / 완료메일 배너",
    nameEn: "Pre-registration Banner",
    shortDesc: "사전등록 페이지 + 완료 안내 메일 상단 — 가장 강한 인텐트.",
    longDesc:
      "kprint.kr 참관 사전등록 페이지 상단 + 등록 완료 안내 이메일 상단 동시 노출. 참관 의향이 가장 높은 사용자에게 도달.",
    size: "PC 2,400px × 400px / 태블릿 2,000px × 400px / 모바일 720px × 200px",
    fileFormat: "jpg, png, jpeg",
    tags: ["사전등록", "메일", "온라인"],
    subs: [
      {
        nameKo: "등록 페이지 + 완료메일 (1구좌)",
        nameEn: "Banner (1 slot)",
        priceKRW: 6_000_000,
        unitKo: "1구좌",
        unitEn: "per slot",
        priceNote: "부가세 별도",
        slots: [{ code: "RGS-1" }],
      },
    ],
  },
  {
    code: "EXS",
    channel: "online",
    type: "digital_banner",
    slug: "exhibitor-search-banner",
    nameKo: "참가업체 검색 페이지 배너",
    nameEn: "Exhibitor Search Banner",
    shortDesc: "참가업체 검색 페이지 상단 (5구좌) — 1천만원+ 스폰서십 시 자동 상단 고정.",
    longDesc:
      "kprint.kr 참가업체 검색 페이지 상단 배너. 부스 정보·연락처 찾는 참관객에게 직접 도달. 1천만원 이상 스폰서십 진행 시 검색 결과 상단 고정 혜택 자동 포함.",
    size: "PC/태블릿 1,200px × 200px / 모바일 720px × 200px",
    fileFormat: "jpg, png, jpeg",
    tags: ["참가업체", "검색", "온라인"],
    subs: [
      {
        nameKo: "참가업체 검색 배너 (5구좌)",
        nameEn: "Banner (5 slots)",
        priceKRW: 2_000_000,
        unitKo: "1구좌",
        unitEn: "per slot",
        priceNote: "부가세 별도",
        slots: [
          { code: "EXS-1" },
          { code: "EXS-2" },
          { code: "EXS-3" },
          { code: "EXS-4" },
          { code: "EXS-5" },
        ],
      },
    ],
  },
  {
    code: "PRS",
    channel: "online",
    type: "digital_banner",
    slug: "product-search-banner",
    nameKo: "전시품 검색 페이지 배너",
    nameEn: "Product Search Banner",
    shortDesc: "전시품 검색 페이지 상단 (5구좌) — 특정 품목 검색 인텐트.",
    longDesc:
      "kprint.kr 전시품 검색 페이지 상단 배너. 특정 인쇄 장비·자재를 찾는 바이어에게 직접 도달.",
    size: "PC/태블릿 1,200px × 200px / 모바일 720px × 200px",
    fileFormat: "jpg, png, jpeg",
    tags: ["전시품", "검색", "온라인"],
    subs: [
      {
        nameKo: "전시품 검색 배너 (5구좌)",
        nameEn: "Banner (5 slots)",
        priceKRW: 2_000_000,
        unitKo: "1구좌",
        unitEn: "per slot",
        priceNote: "부가세 별도",
        slots: [
          { code: "PRS-1" },
          { code: "PRS-2" },
          { code: "PRS-3" },
          { code: "PRS-4" },
          { code: "PRS-5" },
        ],
      },
    ],
  },
  {
    code: "SMR",
    channel: "online",
    type: "content",
    slug: "seminar-page-banner",
    nameKo: "세미나 페이지 상단 배너",
    nameEn: "Seminar Page Banner",
    shortDesc: "K-PRINT 세미나 페이지 상단 (3구좌) — 지식 교류 인텐트.",
    longDesc:
      "kprint.kr 세미나·컨퍼런스 페이지 상단 배너. 지식 교류·전문 정보를 찾는 산업 관계자에게 도달.",
    size: "PC/태블릿 1,200px × 200px / 모바일 720px × 200px",
    fileFormat: "jpg, png, jpeg",
    tags: ["세미나", "컨퍼런스", "온라인"],
    subs: [
      {
        nameKo: "세미나 배너 (3구좌)",
        nameEn: "Banner (3 slots)",
        priceKRW: 1_500_000,
        unitKo: "1구좌",
        unitEn: "per slot",
        priceNote: "부가세 별도",
        slots: [{ code: "SMR-1" }, { code: "SMR-2" }, { code: "SMR-3" }],
      },
    ],
  },
  {
    code: "DNL",
    channel: "online",
    type: "mailing",
    slug: "domestic-newsletter",
    nameKo: "국내 뉴스레터 배너",
    nameEn: "Domestic Newsletter Banner",
    shortDesc: "국내 참관객 뉴스레터 상단 (회당) — 사전 인지·리마인드.",
    longDesc:
      "K-PRINT 국내 참관객 대상 뉴스레터 상단 배너. 1회당 단가. 행사 전 사전 인지 형성 및 리마인드용.",
    size: "630px × 160px",
    fileFormat: "jpg, png, jpeg",
    tags: ["뉴스레터", "국내", "사전", "온라인"],
    subs: [
      {
        nameKo: "국내 뉴스레터 (3회)",
        nameEn: "Domestic NL (3 slots)",
        priceKRW: 3_000_000,
        unitKo: "1회",
        unitEn: "per send",
        priceNote: "부가세 별도",
        slots: [{ code: "DNL-1" }, { code: "DNL-2" }, { code: "DNL-3" }],
      },
    ],
  },
  {
    code: "INL",
    channel: "online",
    type: "mailing",
    slug: "international-newsletter",
    nameKo: "해외 뉴스레터 배너",
    nameEn: "International Newsletter Banner",
    shortDesc: "해외 참관객 뉴스레터 상단 (회당) — 글로벌 바이어 도달.",
    longDesc:
      "K-PRINT 해외 참관객 대상 뉴스레터 상단 배너. 글로벌 바이어 진출을 노리는 기업에 적합.",
    size: "630px × 160px",
    fileFormat: "jpg, png, jpeg",
    tags: ["뉴스레터", "해외", "글로벌", "온라인"],
    subs: [
      {
        nameKo: "해외 뉴스레터 (3회)",
        nameEn: "International NL (3 slots)",
        priceKRW: 3_000_000,
        unitKo: "1회",
        unitEn: "per send",
        priceNote: "부가세 별도",
        slots: [{ code: "INL-1" }, { code: "INL-2" }, { code: "INL-3" }],
      },
    ],
  },
];

// 패키지 (PC = 인쇄용 코드)
const KPRINT_PACKAGES: Array<{
  code: string;
  nameKo: string;
  nameEn: string;
  tier: "signature" | "standard";
  tagline: string;
  includedLabels: string[];
  originalPrice: number;
  discountPrice: number;
  priceNote: string;
}> = [
  {
    code: "PC-1",
    nameKo: "참관객 A to Z 패키지",
    nameEn: "Visitor A to Z Package",
    tier: "signature",
    tagline:
      "사전등록부터 현장 목걸이까지 — 참관객 동선 전체를 함께. 다수 참관객에게 기업 영향력을 알리는 통합 패키지.",
    includedLabels: [
      "등록데스크 광고 (5구좌)",
      "사전등록 페이지 + 완료메일",
      "참관객 목걸이 (1구좌, 5,000개)",
    ],
    originalPrice: 24_000_000,
    discountPrice: 20_000_000,
    priceNote: "부가세 별도",
  },
  {
    code: "PC-2",
    nameKo: "프라임 스팟 패키지",
    nameEn: "Prime Spot Package",
    tier: "signature",
    tagline:
      "온라인 + 오프라인 최고 노출 빈도 채널을 한 번에. 산업 전반 마케팅이 필요한 기업에 추천.",
    includedLabels: [
      "천장 배너 (2구좌)",
      "전시장 도면 검색 페이지 배너",
      "참가업체 검색 페이지 배너",
    ],
    originalPrice: 12_000_000,
    discountPrice: 10_000_000,
    priceNote: "부가세 별도",
  },
  {
    code: "PC-3",
    nameKo: "세미나/컨퍼런스 패키지",
    nameEn: "Seminar Package",
    tier: "standard",
    tagline:
      "지식 교류 인텐트가 강한 산업 관계자에게 세미나 + 뉴스레터로 정조준.",
    includedLabels: ["세미나 페이지 배너", "국내 뉴스레터 배너 (1회)"],
    originalPrice: 4_500_000,
    discountPrice: 4_000_000,
    priceNote: "부가세 별도",
  },
];

export async function seedKprintSponsorship(
  eventId: string
): Promise<KprintSeedResult> {
  const db = getDb();
  const now = Timestamp.now();
  const result: KprintSeedResult = {
    categoriesCreated: 0,
    categoriesSkipped: 0,
    subcategoriesCreated: 0,
    slotsCreated: 0,
    packagesCreated: 0,
    packagesSkipped: 0,
    notes: [],
  };

  // 기존 code 들 조회 (중복 방지)
  const existingCatsSnap = await getDocs(
    query(collection(db, "categories"), where("eventId", "==", eventId))
  );
  const existingCodes = new Set(
    existingCatsSnap.docs.map((d) => (d.data() as Category).code)
  );

  const existingPkgsSnap = await getDocs(
    query(collection(db, "packages"), where("eventId", "==", eventId))
  );
  const existingPkgCodes = new Set(
    existingPkgsSnap.docs.map((d) => (d.data() as Package).code)
  );

  let catOrder = existingCatsSnap.size;

  for (const def of KPRINT_CATEGORIES) {
    if (existingCodes.has(def.code)) {
      result.categoriesSkipped++;
      result.notes.push(`${def.code} 이미 존재 → 건너뜀`);
      continue;
    }

    const catRef = doc(collection(db, "categories"));
    const cat: Category = {
      id: catRef.id,
      eventId,
      code: def.code,
      channel: def.channel,
      type: def.type,
      slug: def.slug,
      name: { ko: def.nameKo, en: def.nameEn },
      shortDesc: def.shortDesc,
      longDesc: def.longDesc,
      size: def.size,
      fileFormat: def.fileFormat,
      heroImages: { mode: "carousel", images: [] },
      tags: def.tags,
      isPublished: true,
      order: catOrder++,
      lockedFields: [],
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(catRef, cat);
    result.categoriesCreated++;

    let subOrder = 0;
    for (const subDef of def.subs) {
      const subRef = doc(collection(db, "subcategories"));
      const sub: Subcategory = {
        id: subRef.id,
        eventId,
        categoryId: catRef.id,
        name: { ko: subDef.nameKo, en: subDef.nameEn },
        priceKRW: subDef.priceKRW,
        unit: { ko: subDef.unitKo, en: subDef.unitEn },
        priceNote: subDef.priceNote,
        order: subOrder++,
      };
      await setDoc(subRef, sub);
      result.subcategoriesCreated++;

      let slotOrder = 0;
      for (const slotDef of subDef.slots) {
        const slotRef = doc(collection(db, "slots"));
        const slot: Slot = {
          id: slotRef.id,
          eventId,
          subcategoryId: subRef.id,
          categoryId: catRef.id,
          code: slotDef.code,
          status: slotDef.status ?? "available",
          note: slotDef.note,
          order: slotOrder++,
        };
        await setDoc(slotRef, slot);
        result.slotsCreated++;
      }
    }
  }

  // 패키지
  let pkgOrder = existingPkgsSnap.size;
  for (const pkgDef of KPRINT_PACKAGES) {
    if (existingPkgCodes.has(pkgDef.code)) {
      result.packagesSkipped++;
      result.notes.push(`${pkgDef.code} 패키지 이미 존재 → 건너뜀`);
      continue;
    }
    const pkgRef = doc(collection(db, "packages"));
    const pkg: Package = {
      id: pkgRef.id,
      eventId,
      code: pkgDef.code,
      name: { ko: pkgDef.nameKo, en: pkgDef.nameEn },
      tier: pkgDef.tier,
      tagline: pkgDef.tagline,
      includedItems: pkgDef.includedLabels.map((label) => ({ label })),
      originalPrice: pkgDef.originalPrice,
      discountPrice: pkgDef.discountPrice,
      priceNote: pkgDef.priceNote,
      isPublished: true,
      order: pkgOrder++,
    };
    await setDoc(pkgRef, pkg);
    result.packagesCreated++;
  }

  return result;
}
