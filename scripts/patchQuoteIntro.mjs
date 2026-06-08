/** quoteSettings.eventIntro 의 옛 8/26-28 KINTEX 제1전시장 문구를 새 일정·장소로 패치. */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

const ref = fs.doc(`quoteSettings/${EVENT_ID}`);
const snap = await ref.get();
if (!snap.exists) {
  console.log("quoteSettings 도큐먼트 없음 — skip");
  process.exit(0);
}
const cur = snap.data();
console.log("기존 eventIntro:", cur?.eventIntro);

const NEW_INTRO =
  "오는 2026년 8월 19일부터 22일까지 킨텍스 제2전시장 7·8홀에서 개최되는 K-PRINT 2026 전시회의 스폰서십 참가에 관하여, 다음과 같이 제안하오니 검토해주시기 바랍니다.";

await ref.set({ eventIntro: NEW_INTRO }, { merge: true });
console.log("✓ eventIntro 갱신 완료");
process.exit(0);
