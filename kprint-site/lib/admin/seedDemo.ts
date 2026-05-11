/**
 * 데모/테스트 데이터 시드 — 패키지·문의·스폰서.
 *
 * ⚠️ 테스트용입니다. 라이브 운영 전 데이터 정리 필요.
 *
 * - seedDemoPackages(): 8종 패키지 (시그니처 2 + 스탠다드 6)
 * - seedDemoInquiries(): 5건의 샘플 문의 (cart items 포함)
 * - seedDemoSponsors(): Slack 데이터 기반 ~15개 스폰서
 *
 * 모든 함수는 멱등(idempotent) 시도 — 같은 코드/companyName이면 덮어씀.
 */

"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "../firebase/firestore";
import type {
  CartItem,
  Category,
  Event as EventDoc,
  Inquiry,
  Package,
  Slot,
  Sponsor,
  Subcategory,
} from "../types";

// ============================================================================
// PACKAGES
// ============================================================================

type PackageSeed = Omit<Package, "id" | "eventId"> & { id: string };

const PACKAGE_SEEDS: PackageSeed[] = [
  {
    id: "pkg-atoz",
    code: "PKG-ATOZ",
    name: { ko: "A to Z 패키지", en: "A to Z Package" },
    tier: "signature",
    tagline: "참관객의 모든 방문 경로에서 기업의 영향력을 알리는 시그니처 패키지",
    includedItems: [
      { label: "Hall A 등록대 5구좌" },
      { label: "참관등록 페이지 배너 (단독)" },
      { label: "참관객 목걸이 5,000매" },
    ],
    originalPrice: 19_500_000,
    discountPrice: 17_000_000,
    unit: "패키지",
    priceNote: "정가 19,500,000원 → 할인가 17,000,000원 (12.8% 할인)",
    isPublished: true,
    order: 0,
  },
  {
    id: "pkg-outdoor",
    code: "PKG-OUTDOOR",
    name: { ko: "옥외광고 통합 패키지", en: "Outdoor Total Package" },
    tier: "signature",
    tagline: "월평균 120만 명 유동인구 대상 디지털 사이니지 패키지",
    includedItems: [
      { label: "XPACE 브릿지+빅브릿지 (XPA)" },
      { label: "XPACE 와이드+스퀘어 (XPB)" },
      { label: "XPACE 엣지컬럼 (XPE)" },
    ],
    originalPrice: 24_000_000,
    discountPrice: 20_000_000,
    unit: "패키지",
    priceNote: "정가 24,000,000원 → 할인가 20,000,000원 (16.7% 할인). XPACE 2종만 선택 시 10% 할인.",
    isPublished: true,
    order: 1,
  },
  {
    id: "pkg-prime",
    code: "PKG-PRIME",
    name: { ko: "프라임 노출 패키지", en: "Prime Exposure Package" },
    tier: "standard",
    tagline: "노출에 가장 효과적인 온·오프라인 플랫폼 결합",
    includedItems: [
      { label: "천장배너 1구좌" },
      { label: "라이팅월 1구좌" },
      { label: "참가업체 검색 페이지 배너" },
      { label: "전시품 검색 페이지 배너" },
    ],
    originalPrice: 9_000_000,
    discountPrice: 8_000_000,
    unit: "패키지",
    priceNote: "정가 9,000,000원 → 할인가 8,000,000원",
    isPublished: true,
    order: 2,
  },
  {
    id: "pkg-early",
    code: "PKG-EARLY",
    name: { ko: "얼리 노출 패키지", en: "Early Exposure Package" },
    tier: "standard",
    tagline: "국내외 핵심 타깃에게 브랜드를 가장 먼저 각인",
    includedItems: [
      { label: "초대장 삽지 (10만매)" },
      { label: "국내 뉴스레터 (2월·3월)" },
      { label: "해외 뉴스레터 (2월·3월)" },
    ],
    originalPrice: 19_000_000,
    discountPrice: 15_000_000,
    unit: "패키지",
    priceNote: "정가 19,000,000원 → 할인가 15,000,000원",
    isPublished: true,
    order: 3,
  },
  {
    id: "pkg-onsite",
    code: "PKG-ONSITE",
    name: { ko: "온사이트 실속 패키지", en: "On-site Essentials" },
    tier: "standard",
    tagline: "전시장 주요 동선을 활용해 기본 노출을 확보",
    includedItems: [
      { label: "천장배너 1구좌" },
      { label: "전시장 내부 바닥 스티커 2구좌" },
    ],
    originalPrice: 6_000_000,
    discountPrice: 5_000_000,
    unit: "패키지",
    priceNote: "정가 6,000,000원 → 할인가 5,000,000원",
    isPublished: true,
    order: 4,
  },
  {
    id: "pkg-seminar",
    code: "PKG-SEMINAR",
    name: { ko: "세미나 타겟 패키지", en: "Seminar Target Package" },
    tier: "standard",
    tagline: "산업 종사자 집중 타겟 — 세미나·교육 영역",
    includedItems: [
      { label: "세미나 페이지 상단 배너" },
      { label: "APP 푸시 알림 1회" },
      { label: "국내 뉴스레터 (3월 1회)" },
    ],
    originalPrice: 5_000_000,
    discountPrice: 4_000_000,
    unit: "패키지",
    priceNote: "정가 5,000,000원 → 할인가 4,000,000원",
    isPublished: true,
    order: 5,
  },
  {
    id: "pkg-app",
    code: "PKG-APP",
    name: { ko: "APP 디지털 패키지", en: "APP Digital Package" },
    tier: "standard",
    tagline: "공식 어플리케이션을 활용한 디지털 광고",
    includedItems: [
      { label: "APP 메인 팝업" },
      { label: "APP 메인 하단 배너" },
      { label: "APP 푸시 알림 2회" },
    ],
    originalPrice: 7_500_000,
    discountPrice: 6_000_000,
    unit: "패키지",
    priceNote: "정가 7,500,000원 → 할인가 6,000,000원",
    isPublished: true,
    order: 6,
  },
  {
    id: "pkg-sns",
    code: "PKG-SNS",
    name: { ko: "SNS 콘텐츠 패키지", en: "SNS Content Package" },
    tier: "standard",
    tagline: "콘텐츠로 온라인 확산을 유도",
    includedItems: [
      { label: "참가업체 사전 인터뷰" },
      { label: "참가업체 현장 인터뷰" },
      { label: "인스타그램 카드뉴스" },
    ],
    originalPrice: 6_500_000,
    discountPrice: 5_000_000,
    unit: "패키지",
    priceNote: "정가 6,500,000원 → 할인가 5,000,000원",
    isPublished: true,
    order: 7,
  },
];

export type PackageSeedResult = {
  created: string[];
  errors: Array<{ id: string; reason: string }>;
};

export async function seedDemoPackages(eventId: string): Promise<PackageSeedResult> {
  const db = getDb();
  const result: PackageSeedResult = { created: [], errors: [] };
  const batch = writeBatch(db);

  PACKAGE_SEEDS.forEach((p) => {
    try {
      batch.set(doc(db, "packages", `${eventId}-${p.id}`), {
        ...p,
        id: `${eventId}-${p.id}`,
        eventId,
        // heroImages는 별도 시드 또는 어드민에서 업로드
      });
      result.created.push(`${eventId}-${p.id}`);
    } catch (e) {
      result.errors.push({
        id: p.id,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  });

  await batch.commit();
  return result;
}

// ============================================================================
// INQUIRIES
// ============================================================================

type InquirySeed = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
  cartItemHints: Array<
    | { type: "slot"; categoryCode: string; slotIndex?: number }
    | { type: "package"; packageId: string }
  >;
  status: Inquiry["status"];
  daysAgo: number;
};

const INQUIRY_SEEDS: InquirySeed[] = [
  {
    companyName: "메디컬코리아",
    contactName: "이수진",
    email: "sjlee@medicalkorea.kr",
    phone: "010-2345-1111",
    message: "XPACE 브릿지 영상 광고에 관심 있습니다. 작년 KIMES 영상 사례 확인 가능할까요?",
    cartItemHints: [
      { type: "slot", categoryCode: "XPA" },
      { type: "slot", categoryCode: "XPA", slotIndex: 1 },
      { type: "slot", categoryCode: "CBA", slotIndex: 2 },
    ],
    status: "new",
    daysAgo: 0,
  },
  {
    companyName: "헬스플러스",
    contactName: "박민준",
    email: "minjun@healthplus.co.kr",
    phone: "010-3456-2222",
    message: "옥외광고 통합 패키지 견적과 일정 안내 부탁드립니다.",
    cartItemHints: [{ type: "package", packageId: "pkg-outdoor" }],
    status: "new",
    daysAgo: 1,
  },
  {
    companyName: "베스트바이오",
    contactName: "김하늘",
    email: "haneul@bestbio.kr",
    phone: "010-4567-3333",
    message: "Hall B 위주로 노출하고 싶습니다. 천장배너 + 등록대 조합 협의 가능할까요?",
    cartItemHints: [
      { type: "slot", categoryCode: "CBB" },
      { type: "slot", categoryCode: "RGB" },
    ],
    status: "in_progress",
    daysAgo: 3,
  },
  {
    companyName: "글로벌메드",
    contactName: "최서연",
    email: "syc@globalmed.com",
    phone: "010-5678-4444",
    message: "해외 바이어 타겟이라 영문 쇼가이드 + 해외 뉴스레터 견적 부탁드립니다.",
    cartItemHints: [
      { type: "slot", categoryCode: "GDB", slotIndex: 5 },
      { type: "slot", categoryCode: "INL" },
      { type: "slot", categoryCode: "INL", slotIndex: 1 },
    ],
    status: "in_progress",
    daysAgo: 5,
  },
  {
    companyName: "에이지스헬스케어",
    contactName: "정유진",
    email: "yj.jeong@aegis.kr",
    phone: "010-6789-5555",
    message: "참가업체 검색 배너 5구좌 한 번에 가능한가요?",
    cartItemHints: [
      { type: "slot", categoryCode: "EXS" },
      { type: "slot", categoryCode: "EXS", slotIndex: 1 },
      { type: "slot", categoryCode: "EXS", slotIndex: 2 },
    ],
    status: "closed",
    daysAgo: 12,
  },
];

export type InquirySeedResult = {
  created: string[];
  skipped: string[];
  errors: Array<{ company: string; reason: string }>;
};

export async function seedDemoInquiries(eventId: string): Promise<InquirySeedResult> {
  const db = getDb();
  const result: InquirySeedResult = { created: [], skipped: [], errors: [] };

  // 카테고리/소분류/슬롯/패키지 로드 (cart 매핑용)
  const [catSnap, subSnap, slotSnap, pkgSnap, existingInq] = await Promise.all([
    getDocs(collection(db, "categories")),
    getDocs(collection(db, "subcategories")),
    getDocs(collection(db, "slots")),
    getDocs(collection(db, "packages")),
    getDocs(collection(db, "inquiries")),
  ]);

  const catByCode = new Map<string, Category>();
  catSnap.docs.forEach((d) => {
    const c = { ...(d.data() as Category), id: d.id };
    catByCode.set(c.code, c);
  });
  const subByCategoryId = new Map<string, Subcategory[]>();
  subSnap.docs.forEach((d) => {
    const s = { ...(d.data() as Subcategory), id: d.id };
    const arr = subByCategoryId.get(s.categoryId) ?? [];
    arr.push(s);
    subByCategoryId.set(s.categoryId, arr);
  });
  const slotsByCategory = new Map<string, Slot[]>();
  slotSnap.docs.forEach((d) => {
    const s = { ...(d.data() as Slot), id: d.id };
    const arr = slotsByCategory.get(s.categoryId) ?? [];
    arr.push(s);
    slotsByCategory.set(s.categoryId, arr);
  });
  const pkgById = new Map<string, Package>();
  pkgSnap.docs.forEach((d) =>
    pkgById.set(d.id, { ...(d.data() as Package), id: d.id })
  );

  const existingCompanies = new Set(
    existingInq.docs.map((d) => (d.data() as Inquiry).companyName)
  );

  for (const seed of INQUIRY_SEEDS) {
    if (existingCompanies.has(seed.companyName)) {
      result.skipped.push(seed.companyName);
      continue;
    }

    try {
      // cart items 매핑
      const cartItems: CartItem[] = [];
      for (const hint of seed.cartItemHints) {
        if (hint.type === "package") {
          const pkg = pkgById.get(hint.packageId);
          if (!pkg) continue;
          cartItems.push({
            type: "package",
            eventId,
            packageId: pkg.id,
            code: pkg.code,
            price: pkg.discountPrice,
          });
        } else {
          const cat = catByCode.get(hint.categoryCode);
          if (!cat) continue;
          const slots = (slotsByCategory.get(cat.id) ?? []).sort(
            (a, b) => a.order - b.order
          );
          const slot = slots[hint.slotIndex ?? 0];
          if (!slot) continue;
          const subs = subByCategoryId.get(cat.id) ?? [];
          const sub = subs.find((s) => s.id === slot.subcategoryId);
          cartItems.push({
            type: "slot",
            eventId,
            slotId: slot.id,
            categoryId: cat.id,
            subcategoryId: slot.subcategoryId,
            code: slot.code,
            price: sub?.priceKRW ?? 0,
          });
        }
      }

      const subtotal = cartItems.reduce((s, it) => s + it.price, 0);
      const vat = Math.round(subtotal * 0.1);
      const total = subtotal + vat;
      const createdAt = Timestamp.fromDate(
        new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000)
      );

      await addDoc(collection(db, "inquiries"), {
        eventId,
        companyName: seed.companyName,
        contactName: seed.contactName,
        email: seed.email,
        phone: seed.phone,
        message: seed.message,
        cartItems,
        cartSubtotal: subtotal,
        cartVat: vat,
        cartTotal: total,
        status: seed.status,
        createdAt,
        updatedAt: createdAt,
      });
      result.created.push(seed.companyName);
    } catch (e) {
      result.errors.push({
        company: seed.companyName,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

// ============================================================================
// SPONSORS
// ============================================================================

type SponsorSeed = {
  companyName: string;
  amount: number;
  amountNote?: string;
  itemHints: Array<
    | { type: "slot"; categoryCode: string; label: string; slotIndex?: number }
    | { type: "free"; label: string }
    | { type: "package"; packageId: string; label: string }
  >;
  benefits?: Partial<Sponsor["benefits"]>;
  bannerType?: string;
  bannerNote?: string;
  contacts: Array<{ name: string; email?: string; phone?: string }>;
  status: Sponsor["status"];
  notes?: string;
};

// Slack 시트 데이터 기반 (테스트 데이터 — 실명 회사 이름은 가공된 데모용)
const SPONSOR_SEEDS: SponsorSeed[] = [
  {
    companyName: "유비케어",
    amount: 19_500_000,
    itemHints: [
      { type: "slot", categoryCode: "RGA", label: "Hall A 등록대 7구좌", slotIndex: 0 },
      { type: "slot", categoryCode: "RGC", label: "Hall C 등록대 3구좌", slotIndex: 0 },
      { type: "free", label: "Hall A 천장배너 1구좌" },
      { type: "free", label: "Hall C 천장배너 1구좌" },
    ],
    benefits: { eventNotice: true, topPin: true, badge: true, logoBanner: true },
    bannerType: "참가업체 배너",
    bannerNote: "준현조",
    contacts: [{ name: "명정호", email: "astrohippo@ubcare.co.kr" }],
    status: "in_progress",
    notes: "천장배너·등록대·라이팅월 디자인물 수령 진행 중",
  },
  {
    companyName: "텐텍",
    amount: 20_000_000,
    itemHints: [{ type: "package", packageId: "pkg-outdoor", label: "옥외광고 통합 패키지" }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "로고",
    bannerNote: "3월 4일 마감",
    contacts: [{ name: "김은희", email: "keh@tenlaser.com" }],
    status: "in_progress",
  },
  {
    companyName: "제이시스 대행사",
    amount: 20_000_000,
    itemHints: [{ type: "package", packageId: "pkg-outdoor", label: "옥외광고 통합 패키지" }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "로고",
    bannerNote: "준현 요청 / 3월 9일",
    contacts: [{ name: "김무늬", email: "mnkim@alliswell.co.kr" }],
    status: "in_progress",
  },
  {
    companyName: "테크노짐",
    amount: 16_000_000,
    itemHints: [
      { type: "free", label: "라이팅월 LTW-2" },
      { type: "free", label: "천장배너 B3" },
      { type: "free", label: "XPACE - A" },
    ],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "로고",
    contacts: [{ name: "이학선", email: "hslee@galaxiasme.com" }],
    status: "in_progress",
  },
  {
    companyName: "더블세이프",
    amount: 11_000_000,
    itemHints: [
      { type: "slot", categoryCode: "XPA", label: "XPACE 패키지 A", slotIndex: 0 },
    ],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "참가업체 배너",
    bannerNote: "이미지 — 15초 교차 노출",
    contacts: [{ name: "염래이", email: "raeyi@papers.co.kr" }],
    status: "in_progress",
  },
  {
    companyName: "리메드",
    amount: 11_000_000,
    itemHints: [
      { type: "slot", categoryCode: "XPA", label: "XPACE 패키지 A", slotIndex: 1 },
    ],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "전시품 배너",
    bannerNote: "성경김 / 3월 6일 오전 중",
    contacts: [{ name: "장혜윤", email: "gpdbs3744@remed.kr" }],
    status: "in_progress",
  },
  {
    companyName: "피아모리프팅",
    amount: 20_000_000,
    amountNote: "(할인가)",
    itemHints: [
      { type: "package", packageId: "pkg-outdoor", label: "옥외광고 통합 패키지" },
      { type: "free", label: "Hall A 천장배너 3구좌" },
      { type: "free", label: "해외 뉴스레터 1회" },
    ],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "로고",
    bannerNote: "해외 뉴스레터 2월 27일",
    contacts: [
      { name: "유승원", email: "mana@piamolifting.co.kr" },
      { name: "—", email: "des@piamolifting.co.kr" },
    ],
    status: "in_progress",
  },
  {
    companyName: "이지스헬스케어",
    amount: 9_000_000,
    itemHints: [
      { type: "slot", categoryCode: "CBC", label: "C홀 천장배너 2구좌" },
      { type: "slot", categoryCode: "GDB", label: "쇼가이드 표4 (국문)" },
    ],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "참가업체 배너",
    contacts: [{ name: "고우리", email: "u.ko@eghishc.co.kr" }],
    status: "in_progress",
  },
  {
    companyName: "아스테라시스",
    amount: 6_000_000,
    itemHints: [{ type: "slot", categoryCode: "PLA", label: "1층 기둥광고 4구좌" }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "전시품 배너",
    contacts: [{ name: "하철호", email: "chha@asterasys.co.kr" }],
    status: "in_progress",
  },
  {
    companyName: "미라셀",
    amount: 6_000_000,
    itemHints: [{ type: "slot", categoryCode: "CBA", label: "Hall A 천장배너 2구좌" }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "로고",
    contacts: [{ name: "박지용", email: "parkjiyong@miracell.co.kr" }],
    status: "in_progress",
  },
  {
    companyName: "Ayida (Xiamen) P&C Technology",
    amount: 3000,
    amountNote: "USD",
    itemHints: [
      { type: "slot", categoryCode: "OIC", label: "현장 인터뷰" },
      { type: "slot", categoryCode: "PRS", label: "전시품 검색 페이지 배너" },
      { type: "slot", categoryCode: "EXS", label: "참가업체 검색 페이지 배너" },
    ],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "해당없음",
    contacts: [{ name: "정해연", email: "sales06@ayida.onaliyun.com" }],
    status: "reviewing",
    notes: "USD 결제 — 일정 안내 진행 중",
  },
  {
    companyName: "제노레이",
    amount: 3_000_000,
    itemHints: [{ type: "slot", categoryCode: "CBC", label: "C홀 천장배너 1구좌" }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "참가업체 배너",
    contacts: [{ name: "심이한", email: "ih.sim@papers.co.kr" }],
    status: "in_progress",
  },
  {
    companyName: "디케이메디칼",
    amount: 3_000_000,
    itemHints: [{ type: "slot", categoryCode: "CBC", label: "C홀 천장배너 1구좌", slotIndex: 1 }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "참가업체 배너",
    contacts: [{ name: "허자경", email: "jin.huh@dk.co.kr" }],
    status: "in_progress",
  },
  {
    companyName: "서울바이오허브",
    amount: 3_000_000,
    itemHints: [{ type: "slot", categoryCode: "CBB", label: "B홀 천장배너 1구좌" }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "로고",
    contacts: [{ name: "김신영", email: "sy.kim@kist.re.kr" }],
    status: "in_progress",
  },
  {
    companyName: "마리스그룹코리아",
    amount: 3_000_000,
    itemHints: [{ type: "slot", categoryCode: "RGA", label: "A2 등록대 2구좌", slotIndex: 5 }],
    benefits: { topPin: true, badge: true, logoBanner: true },
    bannerType: "전시품 배너",
    bannerNote: "2/11까지 회신",
    contacts: [{ name: "김현령", email: "mariskorea@maris-reg.com" }],
    status: "in_progress",
  },
  {
    companyName: "MTI khidi",
    amount: 14_000_000,
    amountNote: "(11M + 세미나 3M)",
    itemHints: [
      { type: "package", packageId: "pkg-atoz", label: "A to Z 패키지" },
      { type: "free", label: "세미나 배너" },
      { type: "free", label: "라이팅월 + 만찬 피칭" },
    ],
    contacts: [{ name: "—" }],
    status: "in_kind",
    notes: "참가업체X — 협찬 (합계 제외)",
  },
  {
    companyName: "의사이야기",
    amount: 4_000_000,
    itemHints: [
      { type: "free", label: "세미나 패키지 (3/9)" },
      { type: "free", label: "푸시 알림 1회 추가" },
    ],
    contacts: [{ name: "—" }],
    status: "in_kind",
    notes: "참가업체X — 세미나 주관사 협찬",
  },
];

export type SponsorSeedResult = {
  created: string[];
  skipped: string[];
  errors: Array<{ company: string; reason: string }>;
};

export async function seedDemoSponsors(): Promise<SponsorSeedResult> {
  const db = getDb();
  const result: SponsorSeedResult = { created: [], skipped: [], errors: [] };

  // 활성 행사 찾기 (없으면 첫 행사)
  const eventsSnap = await getDocs(collection(db, "events"));
  const events = eventsSnap.docs.map(
    (d) => ({ ...(d.data() as EventDoc), id: d.id })
  );
  const activeEvent = events.find((e) => e.isActive) ?? events[0];
  if (!activeEvent) {
    result.errors.push({
      company: "(none)",
      reason: "행사가 없습니다. 먼저 /admin/events에서 행사를 생성해주세요.",
    });
    return result;
  }

  // 카테고리·슬롯·패키지 로드 (subcategories는 sponsor seed에서 직접 사용 안 함 — 슬롯 도큐먼트의 subcategoryId 참조)
  const [catSnap, slotSnap, pkgSnap, existingSpSnap] = await Promise.all([
    getDocs(collection(db, "categories")),
    getDocs(collection(db, "slots")),
    getDocs(collection(db, "packages")),
    getDocs(collection(db, "sponsors")),
  ]);

  const catByCode = new Map<string, Category>();
  catSnap.docs.forEach((d) => {
    const c = { ...(d.data() as Category), id: d.id };
    catByCode.set(c.code, c);
  });
  const slotsByCategory = new Map<string, Slot[]>();
  slotSnap.docs.forEach((d) => {
    const s = { ...(d.data() as Slot), id: d.id };
    const arr = slotsByCategory.get(s.categoryId) ?? [];
    arr.push(s);
    slotsByCategory.set(s.categoryId, arr);
  });
  const pkgById = new Map<string, Package>();
  pkgSnap.docs.forEach((d) =>
    pkgById.set(d.id, { ...(d.data() as Package), id: d.id })
  );

  const existing = new Set(
    existingSpSnap.docs.map(
      (d) => `${(d.data() as Sponsor).eventId}:${(d.data() as Sponsor).companyName}`
    )
  );

  for (const seed of SPONSOR_SEEDS) {
    const dedupeKey = `${activeEvent.id}:${seed.companyName}`;
    if (existing.has(dedupeKey)) {
      result.skipped.push(seed.companyName);
      continue;
    }

    try {
      const items = seed.itemHints.map((hint) => {
        if (hint.type === "package") {
          const pkg = pkgById.get(hint.packageId);
          return {
            label: hint.label,
            packageId: pkg?.id,
          };
        }
        if (hint.type === "slot") {
          const cat = catByCode.get(hint.categoryCode);
          if (!cat) return { label: hint.label };
          const slots = (slotsByCategory.get(cat.id) ?? []).sort(
            (a, b) => a.order - b.order
          );
          const slot = slots[hint.slotIndex ?? 0];
          return {
            label: hint.label,
            categoryId: cat.id,
            subcategoryId: slot?.subcategoryId,
            slotId: slot?.id,
          };
        }
        return { label: hint.label };
      });

      const id = `sp-${slugify(seed.companyName)}-${Date.now().toString(36).slice(-4)}`;
      const docData: Omit<Sponsor, "createdAt" | "updatedAt"> & {
        createdAt: unknown;
        updatedAt: unknown;
      } = {
        id,
        eventId: activeEvent.id,
        companyName: seed.companyName,
        amount: seed.amount,
        currency: seed.amountNote === "USD" ? "USD" : "KRW",
        amountNote: seed.amountNote,
        items,
        benefits: {
          eventNotice: seed.benefits?.eventNotice ?? false,
          topPin: seed.benefits?.topPin ?? false,
          badge: seed.benefits?.badge ?? false,
          logoBanner: seed.benefits?.logoBanner ?? false,
        },
        bannerType: seed.bannerType,
        bannerNote: seed.bannerNote,
        designItems: [],
        contacts: seed.contacts.map((c) => ({
          name: c.name,
          email: c.email,
          phone: c.phone,
        })),
        status: seed.status,
        notes: seed.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "sponsors", id), docData);
      result.created.push(seed.companyName);
    } catch (e) {
      result.errors.push({
        company: seed.companyName,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

// ============================================================================
// CLEAR HELPERS — 데모 데이터 정리용
// ============================================================================

export async function clearDemoInquiries(): Promise<number> {
  const db = getDb();
  const seedNames = new Set(INQUIRY_SEEDS.map((s) => s.companyName));
  const snap = await getDocs(collection(db, "inquiries"));
  const batch = writeBatch(db);
  let count = 0;
  snap.docs.forEach((d) => {
    if (seedNames.has((d.data() as Inquiry).companyName)) {
      batch.delete(d.ref);
      count++;
    }
  });
  if (count > 0) await batch.commit();
  return count;
}

export async function clearDemoSponsors(): Promise<number> {
  const db = getDb();
  const seedNames = new Set(SPONSOR_SEEDS.map((s) => s.companyName));
  const snap = await getDocs(collection(db, "sponsors"));
  const batch = writeBatch(db);
  let count = 0;
  snap.docs.forEach((d) => {
    if (seedNames.has((d.data() as Sponsor).companyName)) {
      batch.delete(d.ref);
      count++;
    }
  });
  if (count > 0) await batch.commit();
  return count;
}

// ============================================================================
// PERSONAS SEED — 기본 5종 페르소나를 현재 행사에 시드
// ============================================================================

const DEFAULT_PERSONAS = [
  {
    id: "first-time",
    emoji: "🌱",
    title: "처음 참가하는 회사",
    description:
      "예산 부담 적게 진입 채널 확보. 500만~1500만원 사이 단품·스탠다드 패키지 위주.",
    targetTags: ["온사이트", "프린트", "정보탐색"],
    budgetMax: 15_000_000,
    packageTier: "standard" as const,
    order: 0,
    isActive: true,
  },
  {
    id: "global",
    emoji: "🌏",
    title: "글로벌 바이어가 주 타겟",
    description:
      "해외 뉴스레터, 영문 쇼가이드, 옥외 LED 등 외국인 동선·해외 채널 집중.",
    targetTags: ["글로벌", "옥외", "정보탐색"],
    order: 1,
    isActive: true,
  },
  {
    id: "budget-friendly",
    emoji: "💰",
    title: "예산 효율 최우선",
    description:
      "단가 낮은 디지털 배너·SNS 콘텐츠 중심. 노출량 대비 비용이 가장 낮은 조합.",
    targetTags: ["온라인", "SNS", "콘텐츠"],
    budgetMax: 5_000_000,
    order: 2,
    isActive: true,
  },
  {
    id: "brand-leader",
    emoji: "🚀",
    title: "브랜드 인지도 강화",
    description:
      "전 동선 통합 노출. 시그니처 패키지 + 옥외 + 천장배너 같은 대형 자리.",
    targetTags: ["브랜드_확산형", "온사이트", "옥외"],
    budgetMin: 15_000_000,
    packageTier: "signature" as const,
    order: 3,
    isActive: true,
  },
  {
    id: "industry-target",
    emoji: "🎯",
    title: "산업 종사자 직접 도달",
    description:
      "참관등록 페이지, 세미나 배너, 직접 메일 발송 등 결정권자 타겟 채널.",
    targetTags: ["산업종사자", "등록경로", "직접도달"],
    order: 4,
    isActive: true,
  },
];

export type PersonaSeedResult = {
  created: string[];
  skipped: string[];
};

export async function seedDefaultPersonas(eventId: string): Promise<PersonaSeedResult> {
  const db = getDb();
  const result: PersonaSeedResult = { created: [], skipped: [] };
  const batch = writeBatch(db);

  for (const p of DEFAULT_PERSONAS) {
    const docId = `${eventId}-${p.id}`;
    batch.set(doc(db, "personas", docId), {
      ...p,
      id: docId,
      eventId,
    });
    result.created.push(docId);
  }
  await batch.commit();
  return result;
}

// ============================================================================
// POPULATE CLASSIFICATIONS — 현재 휴리스틱·태그 매칭 결과를 카테고리 도큐먼트에 일괄 저장
// (페르소나 자동 배정 + 시점/위치 override 채움)
// ============================================================================

type Timing = "pre" | "onsite" | "post";
type LocationTag = "hall_a" | "hall_b" | "hall_c" | "hall_d" | "outdoor" | "online";

function deriveTiming(c: Category): Timing[] {
  const out: Timing[] = [];
  if (c.type === "mailing") out.push("pre");
  if (c.type === "digital_banner") out.push("pre");
  if (c.type === "content") {
    if (c.code === "OIC" || c.name.ko.includes("현장")) out.push("onsite", "post");
    else out.push("pre");
  }
  if (
    c.type === "floor_plan" ||
    c.type === "xpace" ||
    c.type === "quantity" ||
    c.type === "media" ||
    c.type === "print_page"
  ) {
    out.push("onsite");
  }
  return Array.from(new Set(out));
}

function deriveLocations(c: Category): LocationTag[] {
  const out: LocationTag[] = [];
  const n = c.name.ko;
  if (c.channel === "online") out.push("online");
  if (n.includes("Hall A") || /A\b/.test(c.code)) out.push("hall_a");
  if (n.includes("Hall B") || /B\b/.test(c.code)) out.push("hall_b");
  if (n.includes("Hall C") || /C\b/.test(c.code)) out.push("hall_c");
  if (n.includes("Hall D") || /D\b/.test(c.code)) out.push("hall_d");
  if (c.type === "xpace" || n.includes("옥외")) out.push("outdoor");
  return Array.from(new Set(out));
}

export type PopulateResult = {
  personasSeeded: number;
  categoriesUpdated: number;
  personaMatches: Record<string, number>;
};

export async function populateClassifications(eventId: string): Promise<PopulateResult> {
  const db = getDb();
  const result: PopulateResult = {
    personasSeeded: 0,
    categoriesUpdated: 0,
    personaMatches: {},
  };

  // 1) 페르소나 시드 (이미 있으면 덮어쓰기)
  const personaBatch = writeBatch(db);
  for (const p of DEFAULT_PERSONAS) {
    const docId = `${eventId}-${p.id}`;
    personaBatch.set(doc(db, "personas", docId), {
      ...p,
      id: docId,
      eventId,
    });
    result.personasSeeded++;
  }
  await personaBatch.commit();

  // 2) 카테고리 로드 (해당 행사)
  const catSnap = await getDocs(
    query(collection(db, "categories"), where("eventId", "==", eventId))
  );
  const categories = catSnap.docs.map((d) => ({
    ...(d.data() as Category),
    id: d.id,
  }));

  // 3) 각 카테고리에 personas/timingOverride/locationOverride 일괄 저장
  for (let i = 0; i < categories.length; i += 400) {
    const slice = categories.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const c of slice) {
      // 페르소나 매칭 (targetTags vs category.tags)
      const matchedPersonas: string[] = [];
      for (const p of DEFAULT_PERSONAS) {
        const personaDocId = `${eventId}-${p.id}`;
        if (!p.targetTags || p.targetTags.length === 0) continue;
        const hasTag = p.targetTags.some((t) => (c.tags ?? []).includes(t));
        if (!hasTag) continue;
        // 예산 힌트도 체크 (있을 때만)
        matchedPersonas.push(personaDocId);
        result.personaMatches[personaDocId] =
          (result.personaMatches[personaDocId] ?? 0) + 1;
      }

      const timing = deriveTiming(c);
      const locations = deriveLocations(c);

      batch.update(doc(db, "categories", c.id), {
        personas: matchedPersonas,
        timingOverride: timing,
        locationOverride: locations,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      result.categoriesUpdated++;
    }
    await batch.commit();
  }

  return result;
}

// ============================================================================
// MIGRATION — 기존 데이터(eventId 없음)에 K-PRINT 2026 태깅
// ============================================================================

const DEFAULT_EVENT_ID = "kprint-2026";

export type TagMigrationResult = {
  collections: Record<string, { tagged: number; skipped: number }>;
  errors: Array<{ collection: string; reason: string }>;
};

async function tagCollection(
  db: ReturnType<typeof getDb>,
  name: string,
  eventId: string
): Promise<{ tagged: number; skipped: number }> {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) return { tagged: 0, skipped: 0 };

  const docs = snap.docs;
  let tagged = 0;
  let skipped = 0;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    let inBatch = 0;
    const slice = docs.slice(i, i + 450);
    slice.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      if (data.eventId) {
        skipped++;
        return;
      }
      batch.update(d.ref, {
        eventId,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      tagged++;
      inBatch++;
    });
    if (inBatch > 0) await batch.commit();
  }
  return { tagged, skipped };
}

export async function tagAllAsKPrint2026(): Promise<TagMigrationResult> {
  const db = getDb();
  const result: TagMigrationResult = { collections: {}, errors: [] };

  const targets = [
    "categories",
    "subcategories",
    "slots",
    "packages",
    "inquiries",
  ];

  for (const name of targets) {
    try {
      result.collections[name] = await tagCollection(db, name, DEFAULT_EVENT_ID);
    } catch (e) {
      result.errors.push({
        collection: name,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Settings/Taxonomy/QuoteSettings: doc('main')을 doc('kprint-2026')으로 복사 (있을 때만)
  const singletons = ["siteSettings", "taxonomy", "quoteSettings"];
  for (const name of singletons) {
    try {
      const mainSnap = await getDocs(collection(db, name));
      let copied = 0;
      let skipped = 0;
      for (const d of mainSnap.docs) {
        if (d.id !== "main") {
          skipped++;
          continue;
        }
        // main → kprint-2026 복사 (이미 있으면 건너뜀)
        const eventDocRef = doc(db, name, DEFAULT_EVENT_ID);
        // 단순화: 항상 복사 (덮어쓰기)
        await setDoc(eventDocRef, { ...d.data(), eventId: DEFAULT_EVENT_ID });
        copied++;
      }
      result.collections[name] = { tagged: copied, skipped };
    } catch (e) {
      result.errors.push({
        collection: name,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

// ============================================================================
// CLEAR ALL — 전체 콘텐츠 일괄 삭제 (카테고리/슬롯/패키지/문의/스폰서)
// ⚠️ 매우 파괴적입니다. 라이브 운영 데이터 손실 위험.
// ============================================================================

export type ClearAllOptions = {
  categories?: boolean;     // 카테고리·소분류·슬롯
  packages?: boolean;       // 패키지
  inquiries?: boolean;      // 문의
  sponsors?: boolean;       // 스폰서
  events?: boolean;         // 행사
  importHistory?: boolean;  // 임포트 이력
};

export type ClearAllResult = {
  deleted: Record<string, number>;
  errors: Array<{ collection: string; reason: string }>;
};

async function deleteAllInCollection(
  db: ReturnType<typeof getDb>,
  collectionName: string
): Promise<number> {
  const snap = await getDocs(collection(db, collectionName));
  if (snap.empty) return 0;

  // Firestore writeBatch는 최대 500 ops — 청크 단위로 나눠서 처리
  const docs = snap.docs;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    const slice = docs.slice(i, i + 450);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

export async function clearAllContent(opts: ClearAllOptions): Promise<ClearAllResult> {
  const db = getDb();
  const result: ClearAllResult = { deleted: {}, errors: [] };

  const targets: Array<{ flag: boolean | undefined; name: string; label: string }> = [
    // 순서 — 참조 관계 고려: slots → subcategories → categories
    { flag: opts.categories, name: "slots", label: "슬롯" },
    { flag: opts.categories, name: "subcategories", label: "소분류" },
    { flag: opts.categories, name: "categories", label: "카테고리" },
    { flag: opts.packages, name: "packages", label: "패키지" },
    { flag: opts.inquiries, name: "inquiries", label: "문의" },
    { flag: opts.sponsors, name: "sponsors", label: "스폰서" },
    { flag: opts.events, name: "events", label: "행사" },
    { flag: opts.importHistory, name: "importHistory", label: "임포트 이력" },
  ];

  for (const t of targets) {
    if (!t.flag) continue;
    try {
      const n = await deleteAllInCollection(db, t.name);
      result.deleted[t.label] = n;
    } catch (e) {
      result.errors.push({
        collection: t.label,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

