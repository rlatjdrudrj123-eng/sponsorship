/**
 * KPRINT 카테고리 / 패키지 / perks 의 영문 필드 일괄 채우기.
 *
 * 한국어 데이터에서 번역해 *En 필드에 write. 사용자는 어드민에서 자유 수정 가능.
 *
 * 실행:
 *   node scripts/fillEnTranslations.mjs --dry-run
 *   node scripts/fillEnTranslations.mjs        (실제 write)
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

// 카테고리 code 별 영문 shortDesc 번역.
const CATEGORY_SHORT_DESC_EN = {
  RGA: "Make the strongest first impression — your brand greets every visitor at the venue entrance.",
  RGK: "Place your brand logo or content on the bottom of the registration kiosk.",
  BGE: "Continuous brand exposure on the visitor badge lanyard worn throughout the show.",
  CBA: "A large overhead banner — visible from anywhere in the hall.",
  IVL: "Insert your promotional material in the official invitation sent to 50,000+ industry contacts.",
  GDB: "Full-page ad on the back of the official show guide distributed onsite.",
  LWA: "Lighting wall banner along the main traffic flow — sharp brand visibility.",
  LLB: "Lighting banner in the visitor lounge — sustained brand exposure during rest time.",
  CTW: "Your logo on the category-specific lighting walls installed by the organizer.",
  CSP: "Run your own seminar session to showcase your products and technology directly.",
  CFM: "Banner in the confirmation email sent after pre-registration — message delivered directly.",
  RGS: "Banner at the top of the pre-registration page — secure brand exposure before the show.",
  FPS: "Banner on the floor plan page that every visitor checks for booth locations.",
  EXS: "Top banner on the exhibitor search page — create business meeting opportunities.",
  PRS: "Top banner on the product search page — capture interest from buyers looking for specific items.",
  ISA: "Banner on the integrated search results page — broad brand reach to all visitors.",
  DNL: "Banner in the domestic industry newsletter — pre-event marketing before the show.",
  INL: "Banner in the English newsletter sent to overseas buyers — discover global business partners.",
  SMR: "Banner at the top of the seminar info page — focused targeting of attendees.",
  ITV: "An interview featuring your story and strengths, published on the official channels.",
  ICN: "Card news content on the official Instagram — showcase your products or content.",
  DSS: "Direct brand exposure to 200+ industry professionals — designers, marketers, and more.",
};

// 패키지 code 별 영문 tagline.
const PACKAGE_TAGLINE_EN = {
  PSG1: "Your brand presence across every visitor touchpoint",
  PSG2: "The most effective on/offline platforms for brand exposure",
  PST1: "Imprint your brand first on key domestic and global targets",
  PST2: "Direct brand exposure to 200+ designers and marketers",
  PST3: "Secure baseline exposure across the main traffic flow",
  PST4: "Drive online amplification through content",
};

// 추가 혜택(BundledPerk) — label/description/condition 영문.
const PERK_EN_BY_LABEL = {
  "참가업체 or 전시품 검색 배너": {
    labelEn: "Exhibitor / Product Search Banner",
  },
  "참가업체 검색 페이지 상위 고정": {
    labelEn: "Top Pin on Exhibitor Search Page",
  },
  "스폰서 참가업체 뱃지 표기": {
    labelEn: "Sponsor Exhibitor Badge",
  },
};

async function fillCategories() {
  const snap = await fs
    .collection("categories")
    .where("eventId", "==", EVENT_ID)
    .get();
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.shortDescEn) continue; // 이미 있으면 스킵
    const en = CATEGORY_SHORT_DESC_EN[data.code];
    if (!en) continue;
    console.log(`  [${data.code}] ${data.shortDesc?.slice(0, 30)}…`);
    console.log(`         → ${en}`);
    if (!DRY_RUN) {
      await d.ref.update({ shortDescEn: en });
    }
    count++;
  }
  return count;
}

async function fillPackages() {
  const snap = await fs
    .collection("packages")
    .where("eventId", "==", EVENT_ID)
    .get();
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.taglineEn) continue;
    const en = PACKAGE_TAGLINE_EN[data.code];
    if (!en) continue;
    console.log(`  [${data.code}] ${data.tagline?.slice(0, 30)}…`);
    console.log(`         → ${en}`);
    if (!DRY_RUN) {
      await d.ref.update({ taglineEn: en });
    }
    count++;
  }
  return count;
}

async function fillPerks() {
  const ref = fs.collection("siteSettings").doc(EVENT_ID);
  const snap = await ref.get();
  if (!snap.exists) return 0;
  const data = snap.data();
  const perks = data.bundledPerks ?? [];
  let updated = false;
  const newPerks = perks.map((p) => {
    const trans = PERK_EN_BY_LABEL[p.label];
    if (!trans) return p;
    if (p.labelEn) return p; // 이미 있으면 유지
    updated = true;
    console.log(`  ${p.label} → ${trans.labelEn}`);
    return { ...p, ...trans };
  });
  if (updated && !DRY_RUN) {
    await ref.update({ bundledPerks: newPerks });
  }
  return updated ? newPerks.length : 0;
}

console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}\n`);
console.log("── Categories ────────");
const cn = await fillCategories();
console.log(`\n── Packages ──────────`);
const pn = await fillPackages();
console.log(`\n── Perks ─────────────`);
const rn = await fillPerks();
console.log(`\n총: categories ${cn} / packages ${pn} / perks ${rn}`);
console.log(DRY_RUN ? "(DRY-RUN — no writes)" : "✓ done");
process.exit(0);
