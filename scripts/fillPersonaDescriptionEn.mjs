/**
 * KPRINT-2026 페르소나 description / title / socialProofNote / budgetNote 의 영문 보강.
 * Firestore 의 personas 컬렉션을 읽어, 한글 description 등이 있는데 *En 이 비어있으면 매핑으로 채움.
 * 매핑은 title.en (또는 title) 기준 — 어드민이 title 을 바꾸면 매핑 실패 → 콘솔에 skip 표기.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) =>
    /-firebase-adminsdk-.+\.json$/.test(f)
  );
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

// title (KO 또는 EN) 기준 영문 매핑.
const MAP = {
  "신제품 출시 회사": {
    titleEn: "New Product Launch",
    descriptionEn:
      "Companies entering KPRINT for the first time, or launching a new product/service that needs awareness from zero.",
    socialProofNoteEn: "The most common starting course for new exhibitors",
    budgetNoteEn: "≈12M KRW avg — Visitor A to Z + interview",
  },
  "New Product Launch": {
    titleEn: "New Product Launch",
    descriptionEn:
      "Companies entering KPRINT for the first time, or launching a new product/service that needs awareness from zero.",
    socialProofNoteEn: "The most common starting course for new exhibitors",
    budgetNoteEn: "≈12M KRW avg — Visitor A to Z + interview",
  },
  "재참가 — 부스 트래픽 늘리기": {
    titleEn: "Drive On-floor Traffic",
    descriptionEn:
      "Companies returning to KPRINT whose goal this year is to increase booth visitors — on-floor footfall is what matters.",
    socialProofNoteEn: "60% of repeat exhibitors pick this combo",
    budgetNoteEn: "≈8M KRW avg — prime spot + ceiling banner",
  },
  "Drive On-floor Traffic": {
    titleEn: "Drive On-floor Traffic",
    descriptionEn:
      "Companies returning to KPRINT whose goal this year is to increase booth visitors — on-floor footfall is what matters.",
    socialProofNoteEn: "60% of repeat exhibitors pick this combo",
    budgetNoteEn: "≈8M KRW avg — prime spot + ceiling banner",
  },
  "해외 바이어 도달": {
    titleEn: "Reach Overseas Buyers",
    descriptionEn:
      "Focused on overseas sales and buyer matching. Search, newsletter and floor-plan visibility are the levers.",
    socialProofNoteEn: "Preferred mix for export-focused companies",
    budgetNoteEn: "≈5M KRW avg — prime spot + overseas newsletter",
  },
  "Reach Overseas Buyers": {
    titleEn: "Reach Overseas Buyers",
    descriptionEn:
      "Focused on overseas sales and buyer matching. Search, newsletter and floor-plan visibility are the levers.",
    socialProofNoteEn: "Preferred mix for export-focused companies",
    budgetNoteEn: "≈5M KRW avg — prime spot + overseas newsletter",
  },
  "콘텐츠·SNS 자산 확보": {
    titleEn: "Build Content & Social Assets",
    descriptionEn:
      "Companies that need marketing assets (video, photo, interviews) they can use after the show. Content-format media first.",
    socialProofNoteEn: "Most-picked course by marketing teams",
    budgetNoteEn: "≈4M KRW avg — seminar + interview SNS",
  },
  "Build Content & Social Assets": {
    titleEn: "Build Content & Social Assets",
    descriptionEn:
      "Companies that need marketing assets (video, photo, interviews) they can use after the show. Content-format media first.",
    socialProofNoteEn: "Most-picked course by marketing teams",
    budgetNoteEn: "≈4M KRW avg — seminar + interview SNS",
  },
  "Brand Awareness": {
    titleEn: "Brand Awareness",
    descriptionEn:
      "Maximize brand recognition through persistent, repeated exposure across on-site and digital channels.",
    socialProofNoteEn: "The repeat-exposure play across all channels",
    budgetNoteEn: "≈10M KRW avg — onsite + digital combo",
  },
  "브랜드 인지도 강화": {
    titleEn: "Brand Awareness",
    descriptionEn:
      "Maximize brand recognition through persistent, repeated exposure across on-site and digital channels.",
    socialProofNoteEn: "The repeat-exposure play across all channels",
    budgetNoteEn: "≈10M KRW avg — onsite + digital combo",
  },
  "첫 KPRINT — 일단 발 담그기": {
    titleEn: "First KPRINT — Test the Waters",
    descriptionEn:
      "First-time exhibitors who can't commit a big budget. Start with minimum spend and validate exposure.",
    socialProofNoteEn: "The lowest-risk way for first-timers to start",
    budgetNoteEn: "≈2M KRW avg — 1-2 single items + card news",
  },
  "First KPRINT — Test the Waters": {
    titleEn: "First KPRINT — Test the Waters",
    descriptionEn:
      "First-time exhibitors who can't commit a big budget. Start with minimum spend and validate exposure.",
    socialProofNoteEn: "The lowest-risk way for first-timers to start",
    budgetNoteEn: "≈2M KRW avg — 1-2 single items + card news",
  },
};

const KOR = /[가-힯]/;

const personas = await fs
  .collection("personas")
  .where("eventId", "==", EVENT_ID)
  .get();

let updated = 0;
for (const d of personas.docs) {
  const p = d.data();
  const key = p.titleEn || p.title;
  const map = MAP[key];
  if (!map) {
    console.log(`✗ skip [${p.title}] — 매핑 없음`);
    continue;
  }
  const patch = {};
  if ((!p.titleEn || KOR.test(p.titleEn)) && map.titleEn) patch.titleEn = map.titleEn;
  if ((!p.descriptionEn || KOR.test(p.descriptionEn)) && map.descriptionEn)
    patch.descriptionEn = map.descriptionEn;
  if (
    (!p.socialProofNoteEn || KOR.test(p.socialProofNoteEn)) &&
    map.socialProofNoteEn
  )
    patch.socialProofNoteEn = map.socialProofNoteEn;
  if ((!p.budgetNoteEn || KOR.test(p.budgetNoteEn)) && map.budgetNoteEn)
    patch.budgetNoteEn = map.budgetNoteEn;

  if (Object.keys(patch).length === 0) {
    console.log(`· skip [${p.title}] — 이미 채워짐`);
    continue;
  }
  await fs.collection("personas").doc(d.id).set(patch, { merge: true });
  console.log(`✓ [${p.title}] → ${Object.keys(patch).join(", ")}`);
  updated++;
}
console.log(`\n총 ${updated} 페르소나 영문 보강`);
process.exit(0);
