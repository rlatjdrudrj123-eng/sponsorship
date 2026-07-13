/**
 * 결정론적 테스트용 최소 시드 데이터.
 *
 * 이 사이트의 page.tsx 들은 Firestore "클라이언트 SDK"(firebase v12) 의
 * getDocs/getDoc 으로 다음 컬렉션/도큐먼트를 읽는다 (eventId === eventSlug):
 *   - collection "categories"     where eventId == X, isPublished == true
 *   - collection "subcategories"  where eventId == X
 *   - collection "slots"          where eventId == X
 *   - collection "packages"       where eventId == X, isPublished == true
 *   - collection "personas"       where eventId == X
 *   - doc        "siteSettings/X"
 *   - doc        "taxonomy/X"
 *
 * 시드 의도 — print/full 페이지의 totalPages 계산을 명시적으로 구성:
 *   totalPages = coverPagesCount(랜딩 캔버스 없음 → 1)
 *              + atGlancePageCount(페르소나 2개 + 미매핑 카테고리 존재 → 2 + 1 = 3)
 *              + packageOverviewPageCount(패키지 있음 → 1)
 *              + sortedCategories.length(package 타입 제외한 published 카테고리 수 = 3)
 *              + 1(클로징)
 *            = 1 + 3 + 1 + 3 + 1 = 9
 *
 *   - persona-a 에 cat-1, cat-2 매핑
 *   - persona-b 에 cat-2 매핑 (cat-1 은 a 전용, cat-2 는 a/b 공유)
 *   - cat-3 은 어떤 페르소나에도 미매핑 → "기타/Others" 한눈에보기 페이지로 들어가야 함 (R2)
 */

export const SEED_EVENT_ID = "e2e-event";

export type SeedDoc = { id: string } & Record<string, unknown>;

export const seedCategories: SeedDoc[] = [
  {
    id: "cat-1",
    eventId: SEED_EVENT_ID,
    isPublished: true,
    code: "C1",
    slug: "cat-1",
    type: "print_page",
    channel: "offline",
    order: 1,
    name: { ko: "표지 광고", en: "Cover Ad" },
    shortDesc: "표지 노출",
    shortDescEn: "Cover exposure",
    heroImages: { images: [] },
    personas: ["persona-a"],
  },
  {
    id: "cat-2",
    eventId: SEED_EVENT_ID,
    isPublished: true,
    code: "C2",
    slug: "cat-2",
    type: "digital_banner",
    channel: "online",
    order: 2,
    name: { ko: "디지털 배너", en: "Digital Banner" },
    shortDesc: "온라인 배너",
    shortDescEn: "Online banner",
    heroImages: { images: [] },
    personas: ["persona-a", "persona-b"],
  },
  {
    id: "cat-3",
    eventId: SEED_EVENT_ID,
    isPublished: true,
    code: "C3",
    slug: "cat-3",
    type: "media",
    channel: "offline",
    order: 3,
    name: { ko: "현장 미디어", en: "On-site Media" },
    shortDesc: "현장 노출",
    shortDescEn: "On-site exposure",
    heroImages: { images: [] },
    // personas 없음 — 미매핑 카테고리 (R2 검증 대상)
  },
];

export const seedSubcategories: SeedDoc[] = [
  {
    id: "sub-1",
    eventId: SEED_EVENT_ID,
    categoryId: "cat-1",
    order: 1,
    name: { ko: "표4", en: "Back cover" },
    unit: { ko: "면", en: "page" },
    priceKRW: 3_000_000,
    priceUSD: 3000,
  },
  {
    id: "sub-2",
    eventId: SEED_EVENT_ID,
    categoryId: "cat-2",
    order: 1,
    name: { ko: "메인 배너", en: "Main banner" },
    unit: { ko: "구좌", en: "slot" },
    priceKRW: 800_000,
    priceUSD: 800,
  },
  {
    id: "sub-3",
    eventId: SEED_EVENT_ID,
    categoryId: "cat-3",
    order: 1,
    name: { ko: "LED 월", en: "LED wall" },
    unit: { ko: "구좌", en: "slot" },
    priceKRW: 5_000_000,
    priceUSD: 5000,
  },
];

export const seedSlots: SeedDoc[] = [
  { id: "slot-1", eventId: SEED_EVENT_ID, categoryId: "cat-1", subcategoryId: "sub-1", order: 1, status: "available" },
  { id: "slot-2", eventId: SEED_EVENT_ID, categoryId: "cat-2", subcategoryId: "sub-2", order: 1, status: "available" },
  { id: "slot-3", eventId: SEED_EVENT_ID, categoryId: "cat-2", subcategoryId: "sub-2", order: 2, status: "sold" },
  { id: "slot-4", eventId: SEED_EVENT_ID, categoryId: "cat-3", subcategoryId: "sub-3", order: 1, status: "available" },
];

export const seedPackages: SeedDoc[] = [
  {
    id: "pkg-1",
    eventId: SEED_EVENT_ID,
    isPublished: true,
    code: "P1",
    tier: "signature",
    order: 1,
    name: { ko: "시그니처 패키지", en: "Signature Package" },
    tagline: "핵심 동선 통합",
    taglineEn: "Key-route bundle",
    originalPrice: 10_000_000,
    discountPrice: 8_000_000,
    includedItems: [
      { label: "표지 광고", labelEn: "Cover Ad" },
      { label: "디지털 배너", labelEn: "Digital Banner" },
    ],
  },
  {
    id: "pkg-2",
    eventId: SEED_EVENT_ID,
    isPublished: true,
    code: "P2",
    tier: "standard",
    order: 2,
    name: { ko: "스탠다드 패키지", en: "Standard Package" },
    tagline: "실속형 구성",
    taglineEn: "Value bundle",
    originalPrice: 4_000_000,
    discountPrice: 3_500_000,
    includedItems: [{ label: "디지털 배너", labelEn: "Digital Banner" }],
  },
];

export const seedPersonas: SeedDoc[] = [
  {
    id: "persona-a",
    eventId: SEED_EVENT_ID,
    order: 1,
    emoji: "🎯",
    title: "브랜드 인지도",
    titleEn: "Brand awareness",
    description: "노출 극대화",
    descriptionEn: "Maximize exposure",
  },
  {
    id: "persona-b",
    eventId: SEED_EVENT_ID,
    order: 2,
    emoji: "🤝",
    title: "리드 확보",
    titleEn: "Lead generation",
    description: "상담 유도",
    descriptionEn: "Drive consultations",
  },
];

export const seedSiteSettings: SeedDoc = {
  id: SEED_EVENT_ID,
  event: {
    nameKo: "E2E 테스트 행사",
    nameEn: "E2E Test Event",
    venue: "COEX Hall A",
    dateRange: "2026-09-01 ~ 2026-09-03",
  },
  contact: {
    phone: "02-000-0000",
    email: "e2e@example.com",
    address: "서울특별시",
    addressEn: "Seoul",
  },
  // landing/landingEn 비움 → print/full 의 coverPagesCount = 1 (fallback CoverSlide).
};

export const seedTaxonomy: SeedDoc = {
  id: SEED_EVENT_ID,
  mediaBuckets: [],
  locationBuckets: [],
};

/**
 * print/full 페이지에 대해 시드로부터 기대 totalPages 를 계산.
 * page.tsx 의 공식과 동일하게 유지 — page.tsx 변경 시 이 함수도 같이 봐야 함.
 */
export function expectedFullPrintTotalPages(): number {
  const personasCount = seedPersonas.length; // 2
  const publishedNonPackageCats = seedCategories.filter(
    (c) => c.isPublished && c.type !== "package"
  );
  const mappedPersonaIds = new Set(seedPersonas.map((p) => p.id));
  const unmapped = publishedNonPackageCats.filter(
    (c) => !((c.personas as string[] | undefined) ?? []).some((pid) => mappedPersonaIds.has(pid))
  );
  const coverPagesCount = 1; // 랜딩 캔버스 없음
  const hasUnmappedPage = personasCount > 0 && unmapped.length > 0;
  const atGlancePageCount = personasCount > 0 ? personasCount + (hasUnmappedPage ? 1 : 0) : 1;
  const packageOverviewPageCount = seedPackages.length > 0 ? 1 : 0;
  const closing = 1;
  return (
    coverPagesCount +
    atGlancePageCount +
    packageOverviewPageCount +
    publishedNonPackageCats.length +
    closing
  );
}

/** 미매핑 카테고리(= "기타/Others" 한눈에보기 페이지에 들어가야 하는 항목) — R2 검증용 */
export function expectedUnmappedCategoryNames(): string[] {
  const mappedPersonaIds = new Set(seedPersonas.map((p) => p.id));
  return seedCategories
    .filter((c) => c.isPublished && c.type !== "package")
    .filter(
      (c) => !((c.personas as string[] | undefined) ?? []).some((pid) => mappedPersonaIds.has(pid))
    )
    .map((c) => (c.name as { ko: string }).ko);
}
