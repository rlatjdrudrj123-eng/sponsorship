/**
 * 패키지의 includedItems 가 실제 카테고리/소분류/슬롯 ID 와 매칭되는지 진단.
 * 패키지 편집 화면에서 카테고리 select 가 비어보이는 케이스 진단용.
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

const [catsSnap, subsSnap, slotsSnap, pkgsSnap] = await Promise.all([
  fs.collection("categories").where("eventId", "==", EVENT_ID).get(),
  fs.collection("subcategories").where("eventId", "==", EVENT_ID).get(),
  fs.collection("slots").where("eventId", "==", EVENT_ID).get(),
  fs.collection("packages").where("eventId", "==", EVENT_ID).get(),
]);

const catIds = new Set(catsSnap.docs.map((d) => d.id));
const subIds = new Set(subsSnap.docs.map((d) => d.id));
const slotIds = new Set(slotsSnap.docs.map((d) => d.id));

console.log(`categories: ${catIds.size}, subs: ${subIds.size}, slots: ${slotIds.size}, packages: ${pkgsSnap.size}`);
console.log("─".repeat(60));

for (const d of pkgsSnap.docs) {
  const p = d.data();
  console.log(`\n[${p.name?.ko ?? d.id}]`);
  const items = p.includedItems ?? [];
  console.log(`  includedItems: ${items.length}`);
  items.forEach((it, i) => {
    const catOk = catIds.has(it.categoryId);
    const subOk = !it.subcategoryId || subIds.has(it.subcategoryId);
    const slotsOk = (it.referencedSlotIds ?? []).every((sid) => slotIds.has(sid));
    const issues = [];
    if (!catOk) issues.push(`✗ categoryId=${it.categoryId} 매칭 카테고리 없음`);
    if (!subOk) issues.push(`✗ subcategoryId=${it.subcategoryId} 매칭 없음`);
    if (!slotsOk) issues.push(`✗ 일부 referencedSlotIds 매칭 없음`);
    const ok = issues.length === 0 ? "✓" : "✗";
    console.log(`  ${i + 1}. ${ok} ${it.label ?? "(라벨 없음)"} catId=${it.categoryId?.slice(0, 8)}…`);
    issues.forEach((iss) => console.log(`     ${iss}`));
  });
}

process.exit(0);
