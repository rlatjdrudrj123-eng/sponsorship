/**
 * KPRINT-2026 slot.noteEn 자동 보강.
 * 흔한 한국어 위치 표현을 영문으로 매핑 — 정확한 번역 X, 가독성 위주 치환.
 */

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

const KOR = /[가-힯]/;
const REPLACE = [
  // KPRINT 2026 = 제2전시장 7·8홀. "킨텍스 제2전시장 2층" 같은 표현은
  // 실제로 7·8홀 안의 2층을 의미.
  [/킨텍스 제2전시장/g, "KINTEX 2nd Exhibition Center"],
  [/킨텍스 제1전시장/g, "KINTEX 1st Exhibition Center"],
  [/킨텍스/g, "KINTEX"],
  [/(\d+)\s*층/g, "$1F"],
  [/(\d+)\s*홀/g, "Hall $1"],
  [/입구/g, "Entrance"],
  [/로비/g, "Lobby"],
  [/세미나실/g, "Seminar room"],
  [/세미나/g, "Seminar"],
  [/등록데스크/g, "Registration desk"],
  [/메인/g, "Main"],
  [/지하/g, "B"],
  [/옥외/g, "Outdoor"],
  [/이메일/g, "Email"],
];

function toEn(s) {
  if (!s) return s;
  let out = s;
  for (const [re, rep] of REPLACE) out = out.replace(re, rep);
  // 잔재 한글이 있으면 원본 그대로 두기 (모호한 치환 방지)
  if (KOR.test(out)) return null;
  return out.replace(/\s+/g, " ").trim();
}

const slots = await fs
  .collection("slots")
  .where("eventId", "==", EVENT_ID)
  .get();
// 옛 잘못된 영문 매핑 (예: "Hall 2") 를 강제 갱신하기 위해 --force 옵션 지원.
const FORCE = process.argv.includes("--force");

let count = 0;
for (const d of slots.docs) {
  const s = d.data();
  if (!s.note || !KOR.test(s.note)) continue; // 한글 없는 노트는 원본 그대로
  if (!FORCE && s.noteEn && s.noteEn.trim()) continue; // 이미 있으면 skip (force 모드 제외)
  const en = toEn(s.note);
  if (!en) {
    console.log(`  skip [${s.code}] "${s.note}" (자동 변환 불가)`);
    continue;
  }
  if (s.noteEn === en) continue; // 변동 없으면 write 생략
  await fs.collection("slots").doc(d.id).set({ noteEn: en }, { merge: true });
  console.log(`✓ [${s.code}] "${s.note}" → "${en}"`);
  count++;
}
console.log(`\n총 ${count} 슬롯 보강`);
process.exit(0);
