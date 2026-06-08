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
      // KPRINT 2026 = 2026년 8월 19일(수) ~ 22일(토), 킨텍스 제2전시장 7·8홀.
      dateRange: "2026년 8월 19일(수) – 22일(토)",
      dateRangeEn: "Aug 19 (Wed) – 22 (Sat), 2026",
      venue: "킨텍스 제2전시장 7·8홀",
      venueEn: "KINTEX 2nd Exhibition Center, Halls 7-8",
    },
  },
  { merge: true }
);
console.log("✓ event venue/dateRange 갱신 완료");
process.exit(0);
