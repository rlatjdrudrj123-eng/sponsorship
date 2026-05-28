/**
 * 특정 eventId 의 categories / subcategories / slots 를 통째로 삭제.
 * events 컬렉션의 행사 doc 자체는 보존 (사용자가 의도적으로 만든 것).
 *
 * 사용법:
 *   GOOGLE_APPLICATION_CREDENTIALS=./<key.json> node scripts/cleanupEvent.mjs <eventId> [--dry-run]
 *
 * 예:
 *   GOOGLE_APPLICATION_CREDENTIALS=./<key> node scripts/cleanupEvent.mjs kmb26-2026 --dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=./<key> node scripts/cleanupEvent.mjs kmb26-2026
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";

const args = process.argv.slice(2);
const targetEventId = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");

if (!targetEventId) {
  console.error("Usage: node scripts/cleanupEvent.mjs <eventId> [--dry-run]");
  process.exit(2);
}

function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find(
    (f) => /-firebase-adminsdk-.+\.json$/.test(f)
  );
  if (found) {
    console.log(`(키 자동 탐지: ${found})`);
    return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  }
  throw new Error("서비스 계정 키를 찾을 수 없습니다.");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

async function deleteByEventId(collectionName) {
  const snap = await fs
    .collection(collectionName)
    .where("eventId", "==", targetEventId)
    .get();
  console.log(`[${collectionName}] ${snap.size} docs to delete`);
  if (snap.empty) return { found: 0, deleted: 0 };
  if (DRY_RUN) {
    snap.docs.slice(0, 5).forEach((d, i) => {
      const data = d.data();
      console.log(`  ${i + 1}. ${d.id} (code=${data.code ?? "-"})`);
    });
    if (snap.size > 5) console.log(`  ... +${snap.size - 5} more`);
    return { found: snap.size, deleted: 0 };
  }
  let deleted = 0;
  const BATCH = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const chunk = snap.docs.slice(i, i + BATCH);
    const batch = fs.batch();
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
    deleted += chunk.length;
    console.log(`  ${deleted} / ${snap.size}...`);
  }
  return { found: snap.size, deleted };
}

async function main() {
  console.log("─".repeat(60));
  console.log(`Cleanup event data: ${targetEventId}`);
  console.log(`Mode:               ${DRY_RUN ? "DRY-RUN" : "DELETE"}`);
  console.log("─".repeat(60));

  // 순서: slots → subcategories → categories (FK-like 안전)
  const results = {
    slots: await deleteByEventId("slots"),
    subcategories: await deleteByEventId("subcategories"),
    categories: await deleteByEventId("categories"),
  };

  console.log("\n─".repeat(60));
  console.log("Summary:");
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name.padEnd(15)} found ${r.found}, deleted ${r.deleted}`);
  }
  console.log(DRY_RUN ? "\n(DRY-RUN — no deletes)" : "\n✓ Cleanup complete");
  console.log(`events/${targetEventId} 행사 doc 은 보존됨 (의도적).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
