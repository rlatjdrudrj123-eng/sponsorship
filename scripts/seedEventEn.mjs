/**
 * KPRINT-2026 siteSettings 의 event.dateRangeEn / venueEn 시드.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find(
    (f) => /-firebase-adminsdk-.+\.json$/.test(f)
  );
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

const ref = fs.doc(`siteSettings/${EVENT_ID}`);
const snap = await ref.get();
if (!snap.exists) {
  console.log("siteSettings 도큐먼트 없음 — skip");
  process.exit(0);
}
const cur = snap.data();
const event = cur?.event ?? {};
console.log("기존 event:", JSON.stringify(event));

await ref.set(
  {
    event: {
      ...event,
      dateRangeEn: event.dateRangeEn || "Aug 26 (Wed) – 28 (Fri), 2026",
      venueEn: event.venueEn || "KINTEX Hall 1",
    },
  },
  { merge: true }
);
console.log("✓ event.dateRangeEn / venueEn 시드 완료");
process.exit(0);
