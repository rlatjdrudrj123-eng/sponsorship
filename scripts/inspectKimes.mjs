/** KIMES BUSAN 2026 전체 데이터 점검 */

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

// 행사 도큐먼트
const ev = await fs.collection("events").doc(EID).get();
console.log("=== events/" + EID + " ===");
console.log(JSON.stringify(ev.data(), null, 2));

// 모든 컬렉션을 sample
const ALL = [
  "categories",
  "subcategories",
  "slots",
  "packages",
  "personas",
  "siteSettings",
  "taxonomy",
  "quoteSettings",
  "inquiries",
  "sponsors",
  "diagnostic_logs",
  "events_pages",
  "pages",
];
for (const col of ALL) {
  const snap = await fs.collection(col).where("eventId", "==", EID).get();
  console.log(`\n--- ${col} where eventId=${EID}: ${snap.size} ---`);
  if (snap.size > 0 && snap.size <= 5) {
    for (const d of snap.docs) {
      console.log(`  [${d.id}]:`, JSON.stringify(d.data()).slice(0, 200) + "...");
    }
  }
}

// doc id == EID 인 케이스도 (siteSettings, taxonomy 등 일부 컬렉션은 doc id 기준)
console.log("\n=== doc id == " + EID + " ===");
for (const col of ["siteSettings", "taxonomy", "quoteSettings"]) {
  const d = await fs.collection(col).doc(EID).get();
  if (d.exists) {
    console.log(`  [${col}/${EID}]:`, JSON.stringify(d.data()).slice(0, 300) + "...");
  } else {
    console.log(`  [${col}/${EID}]: NOT FOUND`);
  }
}

process.exit(0);
