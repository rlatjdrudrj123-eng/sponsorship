/**
 * KPRINT-2026 siteSettings 의 contact.addressEn 시드 (한국어 주소 영문 변환).
 * 영문 페이지 ClosingSlide / Footer 의 주소가 한국어로 보이던 거 해결.
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
const contact = cur?.contact ?? {};
console.log("기존 contact:", JSON.stringify(contact));

await ref.set(
  {
    contact: {
      ...contact,
      addressEn:
        contact.addressEn ||
        "Trade Tower #2001, 511 Yeongdong-daero, Gangnam-gu, Seoul, Korea",
    },
  },
  { merge: true }
);
console.log("✓ contact.addressEn 시드 완료");
process.exit(0);
