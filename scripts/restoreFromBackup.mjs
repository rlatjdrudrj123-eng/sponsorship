/**
 * KPRINT 데이터 복원 스크립트
 *
 * restore-20260526-0350 DB (= 2026-05-26 12:50 KST 시점 snapshot) 에서
 * KPRINT 데이터를 default DB 로 복사. importer 버그로 덮어쓰여진 KPRINT
 * 카테고리/소분류/슬롯을 복구.
 *
 * 사용법:
 *   1) Firebase Console > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성
 *   2) 다운받은 JSON 을 c:\dev\eandex\sponsorship\.gcp-key.json 으로 이동
 *   3) cd c:\dev\eandex\sponsorship
 *   4) npm install firebase-admin --no-save (한 번)
 *   5) GOOGLE_APPLICATION_CREDENTIALS=./.gcp-key.json node scripts/restoreFromBackup.mjs
 *
 * 동작:
 *   - restore DB 의 categories / subcategories / slots 중 eventId="kprint-2026" 만 fetch
 *   - default DB 에 setDoc (덮어쓰기) 로 복원
 *   - 다른 eventId (kimes-busan-2026 등) 는 손대지 않음
 *   - dryRun=true 면 실제 쓰기 없이 카운트만 출력
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const SOURCE_DB = "restore-20260526-0350";
const TARGET_DB = "(default)";
const EVENT_ID_TO_RESTORE = "kprint-2026";

// 안전 — 실제 쓰기 전에 한 번 dryRun=true 로 카운트만 확인
const DRY_RUN = process.argv.includes("--dry-run");

const KEY_PATH = "./.gcp-key.json";

function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  if (existsSync(KEY_PATH)) {
    const json = JSON.parse(readFileSync(KEY_PATH, "utf8"));
    return cert(json);
  }
  throw new Error(
    `서비스 계정 키를 찾을 수 없습니다.\n` +
      `Firebase Console > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"\n` +
      `다운받은 JSON 을 ${KEY_PATH} 로 이동하거나\n` +
      `환경변수 GOOGLE_APPLICATION_CREDENTIALS 에 경로 지정.`
  );
}

const credential = loadCredentials();

const sourceApp = initializeApp(
  { projectId: PROJECT_ID, credential },
  "source"
);
const targetApp = initializeApp(
  { projectId: PROJECT_ID, credential },
  "target"
);

const sourceFs = getFirestore(sourceApp, SOURCE_DB);
const targetFs = getFirestore(targetApp, TARGET_DB);

async function copyByEventId(collectionName) {
  console.log(`\n[${collectionName}] fetch...`);
  const snap = await sourceFs
    .collection(collectionName)
    .where("eventId", "==", EVENT_ID_TO_RESTORE)
    .get();
  console.log(
    `[${collectionName}] ${snap.size} docs found (eventId="${EVENT_ID_TO_RESTORE}")`
  );
  if (snap.empty) {
    console.log(`[${collectionName}] nothing to restore — skip`);
    return { found: 0, written: 0 };
  }

  if (DRY_RUN) {
    snap.docs.slice(0, 5).forEach((d) => {
      const data = d.data();
      const summary =
        collectionName === "categories"
          ? `code=${data.code}, name=${data.name?.ko ?? "?"}`
          : `id=${d.id}, categoryId=${data.categoryId ?? "?"}`;
      console.log(`  - ${summary}`);
    });
    if (snap.size > 5) console.log(`  ... +${snap.size - 5} more`);
    return { found: snap.size, written: 0 };
  }

  // batch 단위 500 (firestore limit)
  let written = 0;
  const BATCH = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const chunk = snap.docs.slice(i, i + BATCH);
    const batch = targetFs.batch();
    for (const d of chunk) {
      batch.set(targetFs.collection(collectionName).doc(d.id), d.data());
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  ${written} / ${snap.size}...`);
  }
  return { found: snap.size, written };
}

async function main() {
  console.log("─".repeat(60));
  console.log(`Restore from snapshot: ${SOURCE_DB}`);
  console.log(`Restore to:            ${TARGET_DB}`);
  console.log(`Event filter:          ${EVENT_ID_TO_RESTORE}`);
  console.log(`Mode:                  ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);
  console.log("─".repeat(60));

  const results = {
    categories: await copyByEventId("categories"),
    subcategories: await copyByEventId("subcategories"),
    slots: await copyByEventId("slots"),
  };

  console.log("\n─".repeat(60));
  console.log("Summary:");
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name.padEnd(15)} found ${r.found}, written ${r.written}`);
  }
  console.log(DRY_RUN ? "\n(DRY-RUN — no writes)" : "\n✓ Restore complete");
}

main()
  .catch((e) => {
    console.error("\n✗ Failed:");
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
