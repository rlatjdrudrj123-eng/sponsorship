/**
 * 3차 영문 번역 채우기 — Persona / Category 추가필드 / siteSettings.
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

// Persona title 매핑 — ko → en
const PERSONA_TITLE_EN = {
  "현장 방문객 유도형": "Drive On-floor Traffic",
  "브랜드 확산형": "Brand Awareness",
  "신제품 홍보형": "New Product Launch",
  "디자이너·마케터 직접 노출": "Direct Reach to Designers & Marketers",
  "온라인 확산형": "Online Amplification",
};

// Persona description 매핑 — 한국어 → 영문 (있는 경우)
const PERSONA_DESC_EN = {
  // 비어있으면 자동 변환은 어려움. 일반적인 매핑 가능한 것만.
};

// Category fileFormat ko → en (기술명사)
const FILE_FORMAT_EN = {
  "예: eps, ai, pdf 등의 인쇄용 파일형태(고해상도)":
    "e.g. eps, ai, pdf, etc. (high-resolution print files)",
  "예: eps, ai, pdf 등의 인쇄용 파일형태 (고해상도)":
    "e.g. eps, ai, pdf, etc. (high-resolution print files)",
  "eps, ai, pdf 등의 인쇄용 파일형태 (고해상도)":
    "eps, ai, pdf, etc. (high-resolution print files)",
  "eps, ai, pdf 등의 인쇄용 파일형태(고해상도)":
    "eps, ai, pdf, etc. (high-resolution print files)",
  "eps, ai, pdf": "eps, ai, pdf",
  "ai, pdf": "ai, pdf",
  "ai, pdf, 인쇄물": "ai, pdf, printed materials",
  "ai, pdf, png (투명배경)": "ai, pdf, png (transparent background)",
  "jpg, png": "jpg, png",
  "jpg, png, jpeg": "jpg, png, jpeg",
  "로고파일(화이트)": "Logo file (white)",
};

// size ko → en
const SIZE_EN = {
  TBA: "TBA",
  "사무국 문의": "Contact secretariat",
  "W 2,000mm x H 1,000mm": "W 2,000mm × H 1,000mm",
  "W 1,800mm x H 3,500mm (세부 위치 사무국 문의)":
    "W 1,800mm × H 3,500mm (location: contact secretariat)",
  "W 176mm x H 80mm": "W 176mm × H 80mm",
  "A4, 표4": "A4, back cover",
  "W 2,000mm × H 2,500mm": "W 2,000mm × H 2,500mm",
  "W 600mm x H 1,800mm": "W 600mm × H 1,800mm",
  "(PC)2,400px x 200px / (TAB)2,000px x 200px / (MO)720px x 200px":
    "(PC) 2,400px × 200px / (TAB) 2,000px × 200px / (MO) 720px × 200px",
  "20mm × 900mm / 5000개": "20mm × 900mm / 5,000 units",
  "W 630px x H 160px": "W 630px × H 160px",
};

// Subcategory name ko → en (이름 단순 매핑, 다국어 분리 안된 경우)
// 이미 { ko, en } 구조라 skip.

// siteSettings.contact.address — 사용자 입력 데이터
const ADDRESS_EN_MAP = {
  // 한국 주소 → 영문 매핑은 직접 작성하기 어려움. 운영자가 입력해야.
};

async function fillPersonas() {
  const snap = await fs
    .collection("personas")
    .where("eventId", "==", EVENT_ID)
    .get();
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.titleEn) continue;
    const en = PERSONA_TITLE_EN[data.title];
    if (!en) {
      console.log(`  ✗ no persona mapping for: "${data.title}"`);
      continue;
    }
    console.log(`  ✓ ${data.title} → ${en}`);
    if (!DRY_RUN) await d.ref.update({ titleEn: en });
    count++;
  }
  return count;
}

async function fillCategoryExtras() {
  const snap = await fs
    .collection("categories")
    .where("eventId", "==", EVENT_ID)
    .get();
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const updates = {};
    if (data.fileFormat && !data.fileFormatEn) {
      const en = FILE_FORMAT_EN[data.fileFormat];
      if (en) {
        updates.fileFormatEn = en;
        console.log(`  ✓ [${data.code}] fileFormat: ${data.fileFormat}\n      → ${en}`);
      }
    }
    if (data.size && !data.sizeEn) {
      const en = SIZE_EN[data.size];
      if (en) {
        updates.sizeEn = en;
        console.log(`  ✓ [${data.code}] size: ${data.size}\n      → ${en}`);
      }
    }
    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) await d.ref.update(updates);
      count++;
    }
  }
  return count;
}

console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}\n`);
console.log("── Personas titleEn ───");
const pn = await fillPersonas();
console.log(`\n── Category fileFormatEn / sizeEn ───`);
const cn = await fillCategoryExtras();
console.log(`\n총: personas ${pn} / categories ${cn}`);
console.log(DRY_RUN ? "(DRY-RUN — no writes)" : "✓ done");
process.exit(0);
