/** KIMES BUSAN 데이터 일괄 삭제 (실패한 복제 정리용). */

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

const EID = "kmb26-2026";

const COLS_BY_EID = ["categories", "subcategories", "slots", "packages", "personas"];
const COLS_BY_DOCID = ["siteSettings", "taxonomy", "quoteSettings"];

for (const col of COLS_BY_EID) {
  const snap = await fs.collection(col).where("eventId", "==", EID).get();
  for (const d of snap.docs) await d.ref.delete();
  console.log(`  ${col}: ${snap.size} 삭제`);
}
for (const col of COLS_BY_DOCID) {
  const d = await fs.collection(col).doc(EID).get();
  if (d.exists) {
    await d.ref.delete();
    console.log(`  ${col}/${EID}: 삭제`);
  }
}
console.log("✓ KIMES BUSAN 데이터 정리 완료 (events/kmb26-2026 도큐먼트는 유지)");
process.exit(0);
