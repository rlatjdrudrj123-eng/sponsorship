/**
 * KPRINT-2026 의 모든 카테고리/소분류/패키지/perk 의 En 필드를 점검 —
 * (1) 비어있는 En 필드 (ko 있는데 en 없음)
 * (2) En 필드에 한글이 섞인 경우
 * (3) 명백히 어색한 En (Korean 잔재 단어들)
 *
 * 사용법: node scripts/auditEnTexts.mjs
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

const KOR = /[가-힯]/;

function check(label, text) {
  if (!text) return null;
  if (KOR.test(text)) return `한글 잔재: "${text}"`;
  return null;
}

const cats = await fs.collection("categories").where("eventId", "==", EVENT_ID).get();
const subs = await fs.collection("subcategories").get();
const subsByCat = new Map();
for (const d of subs.docs) {
  const s = d.data();
  if (!s.categoryId) continue;
  if (!subsByCat.has(s.categoryId)) subsByCat.set(s.categoryId, []);
  subsByCat.get(s.categoryId).push({ id: d.id, ...s });
}

console.log("=== 카테고리 ===");
for (const d of cats.docs) {
  const c = d.data();
  const issues = [];
  const fields = [
    ["shortDescEn", c.shortDescEn],
    ["longDescEn", c.longDescEn],
    ["sizeEn", c.sizeEn],
    ["fileFormatEn", c.fileFormatEn],
    ["designGuideTextEn", c.designGuideTextEn],
  ];
  for (const [k, v] of fields) {
    const r = check(k, v);
    if (r) issues.push(`  ${k}: ${r}`);
  }
  // size 가 있는데 sizeEn 이 비어있으면 누락
  if (c.size && !c.sizeEn) issues.push(`  sizeEn 누락 (ko="${c.size}")`);
  if (c.fileFormat && !c.fileFormatEn)
    issues.push(`  fileFormatEn 누락 (ko="${c.fileFormat}")`);
  if (issues.length > 0) {
    console.log(`\n[${c.code || d.id}] ${c.name?.ko ?? "(?)"}`);
    issues.forEach((i) => console.log(i));
  }

  // 소분류
  const ss = subsByCat.get(d.id) ?? [];
  for (const s of ss) {
    const sIssues = [];
    const sFields = [
      ["priceNoteEn", s.priceNoteEn],
      ["nameEn(혹시)", s.name?.en],
    ];
    for (const [k, v] of sFields) {
      const r = check(k, v);
      if (r) sIssues.push(`    ${k}: ${r}`);
    }
    if (s.priceNote && !s.priceNoteEn)
      sIssues.push(`    priceNoteEn 누락 (ko="${s.priceNote}")`);
    if (sIssues.length > 0) {
      console.log(`  ↳ sub [${s.code || s.id}] ${s.name?.ko ?? "(?)"}`);
      sIssues.forEach((i) => console.log(i));
    }
  }
}

const pkgs = await fs.collection("packages").where("eventId", "==", EVENT_ID).get();
console.log("\n\n=== 패키지 ===");
for (const d of pkgs.docs) {
  const p = d.data();
  const issues = [];
  const fields = [
    ["taglineEn", p.taglineEn],
    ["priceNoteEn", p.priceNoteEn],
  ];
  for (const [k, v] of fields) {
    const r = check(k, v);
    if (r) issues.push(`  ${k}: ${r}`);
  }
  for (let i = 0; i < (p.includedItems?.length ?? 0); i++) {
    const it = p.includedItems[i];
    const r = check(`includedItems[${i}].labelEn`, it.labelEn);
    if (r) issues.push(`  ${r}`);
    if (it.label && !it.labelEn)
      issues.push(`  includedItems[${i}].labelEn 누락 (ko="${it.label}")`);
  }
  if (issues.length > 0) {
    console.log(`\n[${p.code || d.id}] ${p.name?.ko ?? "(?)"}`);
    issues.forEach((i) => console.log(i));
  }
}

const settings = await fs.doc(`siteSettings/${EVENT_ID}`).get();
const sd = settings.data();
if (sd?.bundledPerks) {
  console.log("\n\n=== 번들 perk ===");
  for (let i = 0; i < sd.bundledPerks.length; i++) {
    const bp = sd.bundledPerks[i];
    const issues = [];
    const r1 = check("labelEn", bp.labelEn);
    if (r1) issues.push(`  ${r1}`);
    const r2 = check("descriptionEn", bp.descriptionEn);
    if (r2) issues.push(`  ${r2}`);
    const r3 = check("conditionEn", bp.conditionEn);
    if (r3) issues.push(`  ${r3}`);
    if (bp.label && !bp.labelEn) issues.push(`  labelEn 누락 (ko="${bp.label}")`);
    if (issues.length > 0) {
      console.log(`\n[bundledPerks[${i}]] ${bp.label}`);
      issues.forEach((i2) => console.log(i2));
    }
  }
}

process.exit(0);
