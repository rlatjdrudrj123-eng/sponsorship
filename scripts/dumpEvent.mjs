/** 행사 하나의 전체 데이터를 JSON 으로 덤프 (읽기 전용).
 *  사용: node scripts/dumpEvent.mjs <eventId> <out.json>
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const [EID, OUT] = process.argv.slice(2);
if (!EID || !OUT) {
  console.error("사용: node scripts/dumpEvent.mjs <eventId> <out.json>");
  process.exit(1);
}

const app = initializeApp({ projectId: "kprint-845c3", credential: loadCredentials() });
const fs = getFirestore(app);

const out = {};
const ev = await fs.collection("events").doc(EID).get();
out.event = ev.exists ? ev.data() : null;
for (const col of ["categories", "subcategories", "slots", "packages", "personas", "sponsors"]) {
  const snap = await fs.collection(col).where("eventId", "==", EID).get();
  out[col] = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
}
for (const col of ["siteSettings", "taxonomy", "quoteSettings"]) {
  const d = await fs.collection(col).doc(EID).get();
  out[col] = d.exists ? d.data() : null;
}
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(
  Object.entries(out)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : v ? "O" : "-"}`)
    .join(", ")
);
process.exit(0);
