/** 모든 행사 + 핵심 컬렉션 데이터 카운트 점검 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: "kprint-845c3", credential: loadCredentials() });
const fs = getFirestore(app);

const events = await fs.collection("events").get();
console.log(`\n=== events (${events.size}) ===`);
for (const d of events.docs) {
  const e = d.data();
  console.log(`  - ${d.id} : ${e.name ?? e.nameKo ?? ""} (isActive=${e.isActive})`);
}

const COLS = ["categories", "subcategories", "slots", "packages", "personas", "siteSettings", "taxonomy", "quoteSettings"];
for (const col of COLS) {
  const snap = await fs.collection(col).get();
  const byEvent = new Map();
  for (const d of snap.docs) {
    const eid = d.data().eventId ?? d.id;
    byEvent.set(eid, (byEvent.get(eid) ?? 0) + 1);
  }
  console.log(`\n=== ${col} ===`);
  for (const [eid, n] of byEvent.entries()) {
    console.log(`  ${eid}: ${n}`);
  }
}
process.exit(0);
