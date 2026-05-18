import type { Locale } from "./locale";

/**
 * 공개 사이트 UI 하드코딩 문구. 동적 데이터(카테고리·패키지명)는 데이터 안의
 * name.ko / name.en 필드를 직접 쓰고, 이 파일은 버튼·헤딩·플레이스홀더 같은
 * static 문구만 담당한다.
 */

type Bilingual = { ko: string; en: string };

export const STRINGS = {
  // 공통
  "common.home": { ko: "홈", en: "Home" },
  "common.viewAll": { ko: "전체 보기", en: "View all" },
  "common.loading": { ko: "불러오는 중…", en: "Loading…" },
  "common.viewMore": { ko: "자세히", en: "Details" },
  "common.contact": { ko: "문의", en: "Inquire" },
  "common.cart": { ko: "관심 항목", en: "Cart" },
  "common.cartCount": { ko: "개", en: "" },
  "common.priceVatExcluded": { ko: "(부가세 별도)", en: "(VAT excluded)" },
  "common.priceNegotiable": { ko: "가격 협의", en: "Price on request" },
  "common.won": { ko: "원", en: "KRW" },
  "common.search": { ko: "검색", en: "Search" },
  "common.reset": { ko: "초기화", en: "Reset" },
  "common.required": { ko: "필수", en: "Required" },
  "common.optional": { ko: "선택", en: "Optional" },
  "common.submit": { ko: "제출", en: "Submit" },
  "common.close": { ko: "닫기", en: "Close" },

  // sponsorships
  "spons.title": { ko: "스폰서십 전체 보기", en: "All Sponsorships" },
  "spons.subtitle": {
    ko: "구좌 단위로 둘러보고 카트에 담은 뒤, 사무국에 한 번에 문의하세요.",
    en: "Browse slot by slot, save what you like, and send a single inquiry.",
  },
  "spons.filter": { ko: "필터", en: "Filter" },
  "spons.filterEmpty": {
    ko: "조건에 맞는 항목이 없어요.",
    en: "No items match the filters.",
  },
  "spons.resetFilters": { ko: "필터 초기화 →", en: "Reset filters →" },
  "spons.channel": { ko: "채널", en: "Channel" },
  "spons.channel.all": { ko: "전체", en: "All" },
  "spons.channel.offline": { ko: "오프라인", en: "Offline" },
  "spons.channel.online": { ko: "온라인", en: "Online" },
  "spons.channel.package": { ko: "패키지", en: "Package" },
  "spons.media": { ko: "매체 유형", en: "Media" },
  "spons.timing": { ko: "노출 시점", en: "Timing" },
  "spons.location": { ko: "위치", en: "Location" },
  "spons.budget": { ko: "예산 (최저가 기준)", en: "Budget (min price)" },
  "spons.deadline": { ko: "마감", en: "Deadline" },
  "spons.deadlineSoon": {
    ko: "7일 이내 마감만 보기",
    en: "Closing within 7 days only",
  },
  "spons.packagesSection": { ko: "추천 패키지", en: "Recommended Packages" },
  "spons.slotsSection": { ko: "개별 구좌", en: "Individual Slots" },
  "spons.viewCard": { ko: "카드형", en: "Card" },
  "spons.viewSlide": { ko: "슬라이드", en: "Slide" },
  "spons.searchPlaceholder": { ko: "이름·코드", en: "Name or code" },
  "spons.slotsAvailable": { ko: "가능", en: "available" },
  "spons.size": { ko: "사이즈", en: "Size" },
  "spons.fileFormat": { ko: "파일 형식", en: "File format" },
  "spons.submitDeadline": { ko: "제출 마감", en: "Submission deadline" },
  "spons.slots": { ko: "구좌", en: "Slots" },
  "spons.designGuide": {
    ko: "디자인 가이드 다운로드",
    en: "Download design guide",
  },
  "spons.minPrice": { ko: "최저가", en: "From" },

  // packages
  "pkg.title": { ko: "패키지", en: "Packages" },
  "pkg.subtitle": {
    ko: "오프라인·온라인 채널을 묶은 할인 구성. 협의 후 배정합니다.",
    en: "Bundles across channels with savings. Allocated after consultation.",
  },
  "pkg.all": { ko: "전체", en: "All" },
  "pkg.signature": { ko: "시그니처", en: "Signature" },
  "pkg.standard": { ko: "스탠다드", en: "Standard" },
  "pkg.empty": { ko: "패키지가 없습니다.", en: "No packages available." },
  "pkg.included": { ko: "포함 항목", en: "Includes" },

  // persona courses
  "persona.title": { ko: "어떤 회사세요?", en: "What kind of exhibitor?" },
  "persona.subtitle": {
    ko: "본인 상황과 가장 가까운 카드를 선택하시면 그에 맞는 스폰서십을 추려드려요.",
    en: "Pick the card that fits your situation and we'll surface the right sponsorships.",
  },
  "persona.matches": { ko: "개 매칭", en: " matches" },
  "persona.reset": { ko: "전체 다시 보기", en: "Show all" },

  // cart
  "cart.title": { ko: "관심 항목", en: "Cart" },
  "cart.empty": {
    ko: "아직 담은 항목이 없어요.",
    en: "Your cart is empty.",
  },
  "cart.browse": { ko: "스폰서십 둘러보기 →", en: "Browse sponsorships →" },
  "cart.inquire": { ko: "사무국에 문의하기", en: "Send inquiry" },
  "cart.print": { ko: "인쇄 / PDF 저장", en: "Print / Save as PDF" },
  "cart.remove": { ko: "제거", en: "Remove" },
  "cart.total": { ko: "합계", en: "Total" },

  // contact
  "contact.title": { ko: "사무국에 문의하기", en: "Send inquiry" },
  "contact.subtitle": {
    ko: "선택하신 항목과 함께 1영업일 내 회신드립니다.",
    en: "We'll reply within 1 business day with the items you selected.",
  },
  "contact.companyName": { ko: "회사명", en: "Company name" },
  "contact.contactName": { ko: "담당자명", en: "Contact name" },
  "contact.email": { ko: "이메일", en: "Email" },
  "contact.phone": { ko: "전화", en: "Phone" },
  "contact.message": { ko: "문의 내용 (선택)", en: "Message (optional)" },
  "contact.submit": { ko: "보내기", en: "Send" },
  "contact.doneTitle": { ko: "문의가 접수됐어요", en: "Inquiry received" },
  "contact.doneBody": {
    ko: "사무국이 1영업일 내 회신드립니다.",
    en: "We'll reply within 1 business day.",
  },
  "contact.toHome": { ko: "홈으로", en: "Back to home" },
  "contact.browseMore": { ko: "추가 둘러보기", en: "Browse more" },
} as const satisfies Record<string, Bilingual>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, locale: Locale): string {
  const v = STRINGS[key];
  if (!v) return key;
  return locale === "en" ? v.en || v.ko : v.ko;
}
