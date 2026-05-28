/**
 * KPRINT-2026 카테고리/패키지 En 필드 채워졌는지 점검.
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";

function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find(
    (f) => /-firebase-adminsdk-.+\.json$/.test(f)
  );
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("서비스 계정 키를 찾을 수 없습니다.");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

const cats = await fs.collection("categories").where("eventId", "==", EVENT_ID).get();
console.log(`\n=== Categories (${cats.size}) ===`);
let catMissing = 0;
for (const d of cats.docs) {
  const c = d.data();
  const hasEn = !!(c.shortDescEn && c.shortDescEn.trim());
  if (!hasEn && c.shortDesc) catMissing++;
  console.log(`${c.code || d.id}: shortDesc="${(c.shortDesc || "").slice(0, 30)}" / shortDescEn="${(c.shortDescEn || "").slice(0, 30)}"`);
}
console.log(`\n카테고리 중 shortDescEn 누락: ${catMissing}/${cats.size}`);

const pkgs = await fs.collection("packages").where("eventId", "==", EVENT_ID).get();
console.log(`\n=== Packages (${pkgs.size}) ===`);
let pkgMissing = 0;
for (const d of pkgs.docs) {
  const p = d.data();
  const hasEn = !!(p.taglineEn && p.taglineEn.trim());
  if (!hasEn && p.tagline) pkgMissing++;
  console.log(`${p.code || d.id}: tagline="${(p.tagline || "").slice(0, 30)}" / taglineEn="${(p.taglineEn || "").slice(0, 30)}"`);
}
console.log(`\n패키지 중 taglineEn 누락: ${pkgMissing}/${pkgs.size}`);

process.exit(0);
