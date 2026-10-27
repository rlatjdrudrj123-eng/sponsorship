/**
 * KIMES 2027 — 2026 리뉴얼 기념 혜택 제거 (2026 한정 이벤트).
 *  - siteSettings.bundledPerks 를 빈 배열로 (필드를 지우면 패키지 상세가
 *    lib/perks.ts 의 K-PRINT 기본 혜택으로 폴백하므로 반드시 [] 로 둔다)
 *  - 메인 랜딩의 혜택 슬라이드(국/영 6쪽) 블록 제거 + Storage 파일 삭제
 *
 * 사용: node scripts/removeKimes2027Perks.mjs --dry | --confirm
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const EID = "kimes-2027";
const DRY = process.argv.includes("--dry");
const CONFIRM = process.argv.includes("--confirm");
if (!DRY && !CONFIRM) {
  console.error("flag 필요: --dry 또는 --confirm");
  process.exit(1);
}

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: "kprint-845c3", credential: loadCredentials() });
const fs = getFirestore(app);
const bucket = getStorage(app).bucket("kprint-845c3.firebasestorage.app");

const ref = fs.collection("siteSettings").doc(EID);
const s = (await ref.get()).data();
const isPerkSlide = (b) => ["ko_p06", "en_p06"].includes(b.data?.page?.name);
const removed = [...s.landing, ...s.landingEn].filter(isPerkSlide);
const files = removed.map((b) => decodeURIComponent(b.data.page.bgImageUrl.split("/o/")[1].split("?")[0]));

console.log(`${DRY ? "[DRY-RUN]" : "[LIVE]"} ${EID}`);
console.log(`  bundledPerks: ${(s.bundledPerks ?? []).map((p) => p.label).join(" / ") || "(없음)"} → []`);
console.log(`  랜딩 슬라이드 제거: ${removed.map((b) => b.data.page.name).join(", ")}`);
console.log(`  랜딩 남는 슬라이드: ko ${s.landing.length - s.landing.filter(isPerkSlide).length}, en ${s.landingEn.length - s.landingEn.filter(isPerkSlide).length}`);
if (removed.length !== 2) {
  console.error("✗ 혜택 슬라이드 2장(국/영)을 찾지 못함 — abort");
  process.exit(1);
}
if (DRY) process.exit(0);

await ref.update({
  bundledPerks: [],
  landing: s.landing.filter((b) => !isPerkSlide(b)),
  landingEn: s.landingEn.filter((b) => !isPerkSlide(b)),
  updatedAt: Timestamp.now(),
});
for (const f of files) await bucket.file(f).delete({ ignoreNotFound: true });
console.log(`✓ 완료 (Storage ${files.length}건 삭제)`);
process.exit(0);
