/**
 * KPRINT 의 영문 미입력 필드들의 한국어 텍스트를 출력 — 번역 참고용.
 */
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

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

const [catsSnap, pkgsSnap, settingsSnap] = await Promise.all([
  fs.collection("categories").where("eventId", "==", EVENT_ID).get(),
  fs.collection("packages").where("eventId", "==", EVENT_ID).get(),
  fs.collection("siteSettings").doc(EVENT_ID).get(),
]);

console.log("## CATEGORIES — shortDesc (ko)\n");
catsSnap.docs
  .map((d) => ({ ...d.data(), id: d.id }))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .forEach((c) => {
    console.log(`[${c.code}] ${c.name?.ko}`);
    if (c.shortDesc) console.log(`  ko: ${c.shortDesc}`);
    if (c.shortDescEn) console.log(`  en: ${c.shortDescEn}`);
    console.log();
  });

console.log("\n## PACKAGES — tagline / priceNote / includedItems.label (ko)\n");
pkgsSnap.docs
  .map((d) => ({ ...d.data(), id: d.id }))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .forEach((p) => {
    console.log(`[${p.code}] ${p.name?.ko}`);
    if (p.tagline) console.log(`  tagline ko: ${p.tagline}`);
    if (p.priceNote) console.log(`  priceNote ko: ${p.priceNote}`);
    (p.includedItems ?? []).forEach((it, i) => {
      console.log(`  item ${i + 1} ko: ${it.label}`);
    });
    console.log();
  });

console.log("\n## SETTINGS — bundledPerks (ko)\n");
const settings = settingsSnap.exists ? settingsSnap.data() : null;
(settings?.bundledPerks ?? []).forEach((p, i) => {
  console.log(`Perk ${i + 1}:`);
  console.log(`  label ko: ${p.label}`);
  if (p.description) console.log(`  desc ko:  ${p.description}`);
  if (p.condition) console.log(`  cond ko:  ${p.condition}`);
});

process.exit(0);
