/**
 * 2차 번역 채우기 — Package.includedItems[].labelEn.
 *
 * 한국어 라벨 → 영문 번역 매핑. 단순 includes 매치 — ko 라벨에 키워드 포함되면
 * 해당 영문 라벨 적용.
 */
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");

function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("키 없음");
}

const app = initializeApp({ projectId: "kprint-845c3", credential: loadCredentials() });
const fs = getFirestore(app);
const EVENT_ID = "kprint-2026";

// ko 라벨 → en 라벨 직접 매핑. 정확히 매칭되는 텍스트만 변환.
const LABEL_MAP = {
  "등록 키오스크 1구좌": "Registration Kiosk · 1 slot",
  "등록데스크(무인등록대) 1구좌": "Self Registration Desk · 1 slot",
  "참관객 목걸이 1구좌 (구좌당 5,000개)": "Visitor Lanyard · 1 slot (5,000 lanyards)",
  "참관등록 페이지 배너 1구좌": "Pre-registration Page Banner · 1 slot",
  "참관등록 완료 이메일 1구좌": "Registration Confirmation Email · 1 slot",
  "천장배너 1구좌": "Ceiling Banner · 1 slot",
  "천장배너 2구좌": "Ceiling Banner · 2 slots",
  "라이팅월 1구좌": "Lighting Wall · 1 slot",
  "전시장 도면 검색 페이지 배너 1구좌": "Floor Plan Page Banner · 1 slot",
  "참가업체 인터뷰 + SNS 1건": "Exhibitor Interview + SNS · 1 piece",
  "초대장 삽지 1구좌": "Invitation Insert · 1 slot",
  "국내 뉴스레터 (7월 발송) 1회": "Domestic Newsletter (July) · 1 send",
  "국내 뉴스레터 (8월 발송) 1회": "Domestic Newsletter (August) · 1 send",
  "해외 뉴스레터 (7월 발송) 1회": "International Newsletter (July) · 1 send",
  "해외 뉴스레터 (8월 발송) 1회": "International Newsletter (August) · 1 send",
  "세미나 페이지 상단 배너 1구좌": "Seminar Page Banner · 1 slot",
  "디자인세미나 스폰서 (라벨 생수) 1구좌": "Design Seminar Sponsor (Labeled Water) · 1 slot",
  "디자인세미나 스폰서 (런치 박스) 1구좌": "Design Seminar Sponsor (Lunch Box) · 1 slot",
  "디자인세미나 스폰서 (커피 케이터링) 1구좌": "Design Seminar Sponsor (Coffee Catering) · 1 slot",
  "라운지 라이팅 배너 2구좌": "Lounge Lighting Banner · 2 slots",
  "라이팅월 로고 노출 (전시 분야별) 1구좌": "Lighting Wall Logo (by Category) · 1 slot",
  "전시품 검색 상단 배너 1구좌": "Product Search Banner · 1 slot",
  "인스타그램 카드뉴스 2회": "Instagram Card News · 2 posts",
};

async function fillPackages() {
  const snap = await fs
    .collection("packages")
    .where("eventId", "==", EVENT_ID)
    .get();
  let totalUpdated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const items = data.includedItems ?? [];
    if (items.length === 0) continue;
    let touched = false;
    const newItems = items.map((it) => {
      if (it.labelEn) return it;
      const en = LABEL_MAP[it.label];
      if (!en) {
        console.log(`  ✗ no mapping for: "${it.label}"`);
        return it;
      }
      console.log(`  ✓ ${it.label}\n     → ${en}`);
      touched = true;
      return { ...it, labelEn: en };
    });
    if (touched) {
      if (!DRY_RUN) await d.ref.update({ includedItems: newItems });
      totalUpdated++;
    }
  }
  return totalUpdated;
}

console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}\n`);
console.log("── Package includedItems[].labelEn ───");
const n = await fillPackages();
console.log(`\n총: ${n}개 패키지 update`);
console.log(DRY_RUN ? "(DRY-RUN — no writes)" : "✓ done");
process.exit(0);
