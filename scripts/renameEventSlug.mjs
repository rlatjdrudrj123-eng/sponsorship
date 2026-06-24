/**
 * 행사 URL slug 변경 (= Firestore events doc id 변경).
 *
 * 흐름:
 *   1. 새 slug 가 비어있는지 pre-flight
 *   2. events/<old> 도큐먼트 복제 → events/<new>
 *   3. 자식 컬렉션 (categories/subs/slots/packages/personas/inquiries/
 *      sponsors/diagnostic_logs) 의 eventId 필드 일괄 update
 *   4. doc-id-pinned 컬렉션 (siteSettings/taxonomy/quoteSettings) 의 <old> doc
 *      을 <new> doc 으로 복제 (eventId 필드도 갱신)
 *   5. 옛 events/<old> 도큐먼트 + 옛 doc-id-pinned 도큐먼트 삭제
 *
 * 사용:
 *   node scripts/renameEventSlug.mjs --from kmb26-2026 --to kimesbusan-2026 --dry
 *   node scripts/renameEventSlug.mjs --from kmb26-2026 --to kimesbusan-2026 --confirm
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const toIdx = args.indexOf("--to");
const DRY = args.includes("--dry");
const CONFIRM = args.includes("--confirm");

const FROM = fromIdx >= 0 ? args[fromIdx + 1] : null;
const TO = toIdx >= 0 ? args[toIdx + 1] : null;

if (!FROM || !TO) {
  console.error("usage: --from <oldSlug> --to <newSlug> [--dry|--confirm]");
  process.exit(1);
}
if (!DRY && !CONFIRM) {
  console.error("flag 필요: --dry 또는 --confirm");
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(TO)) {
  console.error(`new slug 형식 오류: "${TO}" — 영문 소문자·숫자·하이픈만`);
  process.exit(1);
}

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) =>
    /-firebase-adminsdk-.+\.json$/.test(f)
  );
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({
  projectId: PROJECT_ID,
  credential: loadCredentials(),
});
const fs = getFirestore(app);
fs.settings({ ignoreUndefinedProperties: true });

console.log(`\n${DRY ? "[DRY-RUN]" : "[LIVE]"} 행사 URL 변경: ${FROM} → ${TO}`);
console.log("=".repeat(60));

const COLS_BY_EID = [
  "categories",
  "subcategories",
  "slots",
  "packages",
  "personas",
  "inquiries",
  "sponsors",
  "diagnostic_logs",
];
const COLS_BY_DOCID = ["siteSettings", "taxonomy", "quoteSettings"];

// ============================================================================
// [1] Pre-flight
// ============================================================================
console.log("\n[1] Pre-flight");
const oldEv = await fs.collection("events").doc(FROM).get();
const newEv = await fs.collection("events").doc(TO).get();
console.log(`  events/${FROM}: ${oldEv.exists ? "EXISTS ✓" : "NOT FOUND ✗"}`);
console.log(`  events/${TO}: ${newEv.exists ? "EXISTS (충돌)" : "비어있음 ✓"}`);
if (!oldEv.exists) {
  console.error("\n✗ 옛 slug 도큐먼트가 없습니다.");
  process.exit(1);
}
if (newEv.exists) {
  console.error("\n✗ 새 slug 가 이미 사용 중입니다.");
  process.exit(1);
}
for (const col of COLS_BY_DOCID) {
  const d = await fs.collection(col).doc(TO).get();
  console.log(`  ${col}/${TO}: ${d.exists ? "EXISTS (충돌)" : "비어있음 ✓"}`);
  if (d.exists) {
    console.error(`\n✗ ${col}/${TO} 가 이미 있음 — abort.`);
    process.exit(1);
  }
}

// ============================================================================
// [2] 자식 컬렉션 카운트 (eventId 기반)
// ============================================================================
console.log("\n[2] 자식 컬렉션 카운트 (eventId 기준)");
const childSnaps = {};
let totalChildren = 0;
for (const col of COLS_BY_EID) {
  const snap = await fs.collection(col).where("eventId", "==", FROM).get();
  childSnaps[col] = snap;
  console.log(`  ${col}: ${snap.size}`);
  totalChildren += snap.size;
}

const docIdSnaps = {};
for (const col of COLS_BY_DOCID) {
  const d = await fs.collection(col).doc(FROM).get();
  docIdSnaps[col] = d;
  console.log(`  ${col}/${FROM}: ${d.exists ? "EXISTS" : "—"}`);
}

console.log(`\n  총 자식 도큐먼트: ${totalChildren}`);

// ============================================================================
// [3] 실행
// ============================================================================
if (DRY) {
  console.log("\n[DRY] 실제 변경 없음. --confirm 으로 실행.");
  process.exit(0);
}

console.log("\n[3] 마이그레이션 시작…");

// 3-1. 새 events 도큐먼트 생성 (id 만 갱신)
const newEventData = { ...oldEv.data(), id: TO };
await fs.collection("events").doc(TO).set(newEventData);
console.log(`  ✓ events/${TO} 생성`);

// 3-2. 자식 컬렉션 eventId 일괄 update (배치 단위 400 — 안전 마진)
const BATCH_SIZE = 400;
for (const col of COLS_BY_EID) {
  const snap = childSnaps[col];
  if (snap.size === 0) continue;
  let batch = fs.batch();
  let n = 0;
  let total = 0;
  for (const d of snap.docs) {
    batch.update(d.ref, { eventId: TO });
    n++;
    if (n >= BATCH_SIZE) {
      await batch.commit();
      total += n;
      batch = fs.batch();
      n = 0;
    }
  }
  if (n > 0) {
    await batch.commit();
    total += n;
  }
  console.log(`  ✓ ${col} ${total}건 eventId update`);
}

// 3-3. doc-id-pinned 컬렉션 — 새 doc 으로 복제 후 옛 doc 삭제
for (const col of COLS_BY_DOCID) {
  const d = docIdSnaps[col];
  if (!d.exists) continue;
  await fs
    .collection(col)
    .doc(TO)
    .set({ ...d.data(), eventId: TO });
  console.log(`  ✓ ${col}/${TO} 생성`);
  await fs.collection(col).doc(FROM).delete();
  console.log(`  ✓ ${col}/${FROM} 삭제`);
}

// 3-4. 옛 events 도큐먼트 삭제
await fs.collection("events").doc(FROM).delete();
console.log(`  ✓ events/${FROM} 삭제`);

// ============================================================================
// [4] 검증
// ============================================================================
console.log("\n[4] 검증");
const oldRemain = await fs
  .collection("events")
  .doc(FROM)
  .get();
console.log(`  events/${FROM}: ${oldRemain.exists ? "✗ 잔존" : "✓ 삭제됨"}`);

const newCheck = await fs.collection("events").doc(TO).get();
console.log(`  events/${TO}: ${newCheck.exists ? "✓ 존재" : "✗ 누락"}`);

for (const col of COLS_BY_EID) {
  const a = await fs.collection(col).where("eventId", "==", FROM).get();
  const b = await fs.collection(col).where("eventId", "==", TO).get();
  console.log(`  ${col}: old=${a.size} (0 이어야), new=${b.size}`);
}

console.log("\n" + "=".repeat(60));
console.log(`✓ 완료. 사이트 URL: /${TO}/...`);
process.exit(0);
