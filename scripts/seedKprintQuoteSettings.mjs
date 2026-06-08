/**
 * quoteSettings/kprint-2026 를 KPRINT 전용 default 로 시드.
 *
 * 원래 어드민 → /admin/settings/quote 에서 KPRINT 선택 후 저장하면 만들어지는 문서.
 * 견적서 출력에서 cross-event 폴백 (main = KIMES) 으로 떨어지는 것 방지.
 *
 * 이미 존재하면 덮지 않음. 기존 값 보존.
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";

function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find(
    (f) => /-firebase-adminsdk-.+\.json$/.test(f)
  );
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("서비스 계정 키를 찾을 수 없습니다.");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

const KPRINT_DEFAULTS = {
  issuer: {
    companyName: "㈜한국이앤엑스",
    businessNumber: "120-81-813111",
    representative: "김정조",
    address: "서울시 강남구 영동대로 511 트레이드타워 2001호",
    businessType: "서비스",
    industry: "전시회장",
    phone: "02)551-0102",
    fax: "02)551-0103",
    contactDept: "전시사업부",
    contactName: "조준현 대리",
  },
  bank: {
    bankName: "우리은행",
    accountNumber: "424-04-132799",
    accountHolder: "(주)한국이앤엑스",
  },
  eventSubtitle: "K-PRINT 2026 — 국제 인쇄·디지털 프린팅 전시회",
  eventIntro:
    "오는 2026년 8월 19일부터 22일까지 킨텍스 제2전시장 7·8홀에서 개최되는 K-PRINT 2026 전시회의 스폰서십 참가에 관하여, 다음과 같이 제안하오니 검토해주시기 바랍니다.",
  serialPrefix: "KPR26-",
  serialNextNumber: 1,
  defaultPaymentTerms: "전액 현금 완납",
  defaultBenefitItems: [
    { label: "상위 고정", note: "참가업체 검색 페이지 내 상위 고정" },
    { label: "뱃지 표기", note: "주요 참가기업 뱃지 표기" },
    { label: "도면 내 로고 표기" },
    { label: "홍보자료 노출", note: "K-PRINT 뉴스레터 및 SNS 추가 노출" },
  ],
  footerSlogan: "한국의 전시문화를 선도하는 ㈜한국이앤엑스가 되겠습니다.",
};

const ref = fs.collection("quoteSettings").doc(EVENT_ID);
const snap = await ref.get();
if (snap.exists) {
  const cur = snap.data();
  console.log(`기존 eventSubtitle="${cur?.eventSubtitle ?? "(없음)"}"`);
  console.log(`기존 serialNextNumber=${cur?.serialNextNumber ?? "(없음)"}`);
}
// 강제 오버라이트 — KIMES 내용으로 잘못 들어가있던 케이스 복구.
// serialNextNumber 만 기존 값 보존 (발급된 번호 충돌 방지).
const cur = snap.exists ? snap.data() : null;
await ref.set({
  ...KPRINT_DEFAULTS,
  serialNextNumber: cur?.serialNextNumber ?? KPRINT_DEFAULTS.serialNextNumber,
  eventId: EVENT_ID,
  updatedAt: FieldValue.serverTimestamp(),
});
console.log(`✓ quoteSettings/${EVENT_ID} = KPRINT defaults 로 갱신`);

process.exit(0);
