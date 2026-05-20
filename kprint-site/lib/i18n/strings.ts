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
  "common.priceNegotiable": { ko: "별도 문의", en: "Contact for pricing" },
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
  "spons.size": { ko: "규격", en: "Size" },
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
    ko: "선택하신 항목과 함께 확인 후 빠르게 회신드릴게요.",
    en: "We'll review your items and reply shortly.",
  },
  "contact.companyName": { ko: "회사명", en: "Company name" },
  "contact.contactName": { ko: "담당자명", en: "Contact name" },
  "contact.email": { ko: "이메일", en: "Email" },
  "contact.phone": { ko: "전화", en: "Phone" },
  "contact.message": { ko: "문의 내용 (선택)", en: "Message (optional)" },
  "contact.submit": { ko: "보내기", en: "Send" },
  "contact.doneTitle": { ko: "문의가 접수됐어요", en: "Inquiry received" },
  "contact.doneBody": {
    ko: "사무국에서 확인 후 빠르게 회신드릴게요.",
    en: "Our team will review and reply shortly.",
  },
  "contact.toHome": { ko: "홈으로", en: "Back to home" },
  "contact.browseMore": { ko: "추가 둘러보기", en: "Browse more" },

  // ─── 진단 챗봇 (SponsorshipDiagnosisChat) ───────────────────
  "diag.advisor": { ko: "Sponsorship Advisor", en: "Sponsorship Advisor" },
  "diag.subtitle": { ko: "맞춤 진단", en: "Tailored advisor" },
  "diag.close": { ko: "닫기", en: "Close" },
  "diag.back": { ko: "이전", en: "Back" },

  // Intro
  "diag.intro.tagline": {
    ko: "귀사 참가 목표에 맞는 스폰서십을 4가지 질문으로 정리해 드립니다.",
    en: "Four questions to find the sponsorship that fits your goal.",
  },
  "diag.intro.duration": {
    ko: "소요 시간 약 1분",
    en: "About 1 minute",
  },
  "diag.intro.cta": { ko: "추천 받기 시작", en: "Start" },

  // Q5
  "diag.q5.lastStep": { ko: "마지막 확인", en: "Last step" },
  "diag.q5.title": {
    ko: "현재 가장 고려하고 계신 상품이 있나요?",
    en: "Anything you're already leaning toward?",
  },
  "diag.q5.hint": {
    ko: "선택하시면 해당 상품을 우선 안내하고, 보완 매체를 함께 추천드립니다.",
    en: "We'll feature that item and suggest complements around it.",
  },
  "diag.q5.empty": {
    ko: "추천 가능한 상품이 없습니다. 사무국에 직접 문의해 주세요.",
    en: "No matches — please contact the secretariat directly.",
  },
  "diag.q5.none": {
    ko: "특정 상품 없음 — 추천된 전체 목록 보기",
    en: "Nothing specific — show me the full list",
  },

  // Result
  "diag.result.title": { ko: "추천 결과", en: "Recommendations" },
  "diag.result.intro.early": {
    ko: "처음 알아보시는 단계네요. 부담 없이 시작해볼 수 있는 상품 위주로 정리했습니다.",
    en: "Just exploring — here are easy options to start with.",
  },
  "diag.result.intro.compare": {
    ko: "후보를 좁히고 계시네요. 비교해서 결정하세요.",
    en: "Narrowing it down — compare and decide.",
  },
  "diag.result.intro.decisionFocused": {
    ko: "고려하시는 상품을 중심으로 안내드립니다. 보완 매체도 함께 확인해 보세요.",
    en: "Centered on what you're considering, with complements alongside.",
  },
  "diag.result.intro.decision": {
    ko: "결정 단계시군요. 바로 진행하실 수 있도록 안내드립니다.",
    en: "Decision stage — here's everything to move forward.",
  },
  "diag.result.empty": {
    ko: "입력하신 예산 범위에 맞는 추천이 없습니다. 예산을 한 단계 올려보거나 사무국에 직접 문의해 주세요.",
    en: "No items in your budget range. Try a higher tier or contact the secretariat.",
  },
  "diag.result.restart": { ko: "다시 진단하기", en: "Start over" },
  "diag.result.inquireNow": { ko: "지금 문의하기", en: "Inquire now" },
  "diag.result.connect": { ko: "사무국 연결", en: "Contact secretariat" },

  // Decision focused / Cards
  "diag.focused.label": { ko: "고려 중인 상품", en: "Your pick" },
  "diag.focused.detailBtn": { ko: "상세 보기", en: "Details" },
  "diag.focused.inquireBtn": { ko: "지금 문의", en: "Inquire" },
  "diag.kind.package": { ko: "패키지", en: "Package" },
  "diag.kind.single": { ko: "단품", en: "Single" },
  "diag.vatExcluded": { ko: "부가세 별도", en: "VAT excluded" },
  "diag.supplements.title": {
    ko: "함께 고려하면 좋은 매체",
    en: "Worth pairing with",
  },

  // Upsell banner
  "diag.upsell.label": { ko: "패키지 추천", en: "Package upgrade" },
  "diag.upsell.matchedPrefix": {
    ko: "지금 고려 중인 매체 중",
    en: "Of your considered items,",
  },
  "diag.upsell.matchedItems": { ko: "개가", en: " are" },
  "diag.upsell.containedSuffix": {
    ko: "에 포함돼 있어요. 묶으면",
    en: "included in this package. Bundling saves",
  },
  "diag.upsell.cheaper": { ko: "저렴합니다.", en: "." },
  "diag.upsell.individualTotal": { ko: "단품 합계", en: "Individual total" },
  "diag.upsell.packagePrice": { ko: "패키지 가격", en: "Package price" },
  "diag.upsell.savings": { ko: "절감", en: "Savings" },
  "diag.upsell.bonusPrefix": {
    ko: "보너스: 패키지에는 추가로",
    en: "Bonus: the package also includes",
  },
  "diag.upsell.bonusSuffix": {
    ko: "개 매체가 더 포함돼요.",
    en: " more items.",
  },
  "diag.upsell.cta": { ko: "패키지 상세 보기", en: "View package details" },

  // Cards mode
  "diag.cards.reason": { ko: "추천 이유", en: "Why this" },
  "diag.cards.detailBtn": { ko: "상세 보기", en: "Details" },
  "diag.cards.inquireBtn": { ko: "문의하기", en: "Inquire" },

  // Comparison
  "diag.compare.col.product": { ko: "상품", en: "Product" },
  "diag.compare.col.price": { ko: "가격", en: "Price" },
  "diag.compare.col.kind": { ko: "구분", en: "Type" },
  "diag.compare.detail": { ko: "상세 →", en: "Details →" },

  // Footer
  "footer.contact": { ko: "사무국 연락처", en: "Secretariat" },
  "footer.quicklinks": { ko: "바로가기", en: "Quick links" },
  "footer.resources": { ko: "자료", en: "Resources" },
  "footer.catalog": { ko: "스폰서십 카탈로그", en: "Sponsorship catalog" },
  "footer.inquire": { ko: "스폰서십 문의", en: "Sponsorship inquiry" },
  "footer.fullPdf": { ko: "전체 스폰서십 PDF", en: "Full sponsorship PDF" },
  "footer.introPdf": { ko: "소개 자료 PDF", en: "Intro deck PDF" },
  "footer.tagline": {
    ko: "인쇄·라벨·패키징 산업 종사자를 한 자리에 모으는 국내 최대 규모 전시회.",
    en: "Korea's largest gathering for printing, label, and packaging professionals.",
  },
  "footer.companyLabel": {
    ko: "㈜한국이앤엑스 (Korea E&EX)",
    en: "Korea E&EX Co., Ltd.",
  },
  "footer.companyMeta": {
    ko: "사업자등록번호 220-87-30068 · 대표이사 김응식",
    en: "Biz reg. 220-87-30068 · CEO Eung-Sik Kim",
  },
  "footer.companyAddress": {
    ko: "서울특별시 강남구 영동대로 511 트레이드타워 7층",
    en: "7F, Trade Tower, 511 Yeongdong-daero, Gangnam-gu, Seoul, Korea",
  },
  "footer.copyright": {
    ko: "사무국. All rights reserved.",
    en: "Secretariat. All rights reserved.",
  },
} as const satisfies Record<string, Bilingual>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, locale: Locale): string {
  const v = STRINGS[key];
  if (!v) return key;
  return locale === "en" ? v.en || v.ko : v.ko;
}
