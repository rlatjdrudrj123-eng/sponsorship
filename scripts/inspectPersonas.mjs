/** KPRINT-2026 페르소나 데이터 검사 — 추천 콤보 매칭 여부 점검. */

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

const personas = await fs
  .collection("personas")
  .where("eventId", "==", EVENT_ID)
  .get();
console.log(`=== personas ${personas.size} ===`);
for (const d of personas.docs) {
  const p = d.data();
  console.log(`\n[${p.title}]`);
  console.log("  id:", d.id);
  console.log("  emoji:", JSON.stringify(p.emoji));
  console.log("  packageTier:", p.packageTier);
  console.log("  targetTags:", JSON.stringify(p.targetTags));
  console.log("  recommendedCombo:", JSON.stringify(p.recommendedCombo ?? null));
}

const cats = await fs.collection("categories").where("eventId", "==", EVENT_ID).get();
console.log(`\n\n=== categories.personas 분포 ===`);
const personaMap = new Map();
for (const d of cats.docs) {
  const c = d.data();
  const pids = c.personas ?? [];
  for (const pid of pids) {
    personaMap.set(pid, (personaMap.get(pid) ?? []).concat(c.code));
  }
}
for (const [pid, codes] of personaMap.entries()) {
  console.log(`  ${pid}: ${codes.length} cats — ${codes.join(", ")}`);
}

process.exit(0);
