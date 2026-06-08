/**
 * KPRINT-2026 카테고리·소분류·패키지의 가격 분포 점검.
 * 필터 칩 범위 조정용.
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

// 카테고리별 최저가 (sub priceKRW)
const cats = await fs.collection("categories").where("eventId", "==", EVENT_ID).get();
const subs = await fs.collection("subcategories").get();
const subsByCat = new Map();
for (const d of subs.docs) {
  const s = d.data();
  if (!subsByCat.has(s.categoryId)) subsByCat.set(s.categoryId, []);
  subsByCat.get(s.categoryId).push(s);
}

const catPrices = [];
for (const d of cats.docs) {
  const c = d.data();
  const ss = subsByCat.get(d.id) ?? [];
  const prices = ss.map((s) => s.priceKRW).filter((p) => p > 0);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  catPrices.push({ code: c.code, name: c.name?.ko, min });
}
catPrices.sort((a, b) => a.min - b.min);

console.log("=== 카테고리 최저가 (KRW) ===");
for (const c of catPrices) {
  console.log(`  ${(c.min || 0).toLocaleString().padStart(12, " ")}원  [${c.code}] ${c.name}`);
}

// 패키지 가격
const pkgs = await fs.collection("packages").where("eventId", "==", EVENT_ID).get();
const pkgPrices = [];
for (const d of pkgs.docs) {
  const p = d.data();
  pkgPrices.push({ code: p.code, name: p.name?.ko, price: p.discountPrice ?? 0 });
}
pkgPrices.sort((a, b) => a.price - b.price);
console.log("\n=== 패키지 가격 (KRW) ===");
for (const p of pkgPrices) {
  console.log(`  ${(p.price || 0).toLocaleString().padStart(12, " ")}원  [${p.code}] ${p.name}`);
}

// 분포 통계
const allCatPrices = catPrices.map((c) => c.min).filter((p) => p > 0);
const allPkgPrices = pkgPrices.map((p) => p.price).filter((p) => p > 0);
console.log("\n=== 통계 (KRW, 가격 있는 항목만) ===");
console.log(`카테고리: ${allCatPrices.length} 건, 최저 ${Math.min(...allCatPrices).toLocaleString()} ~ 최고 ${Math.max(...allCatPrices).toLocaleString()}`);
console.log(`패키지  : ${allPkgPrices.length} 건, 최저 ${Math.min(...allPkgPrices).toLocaleString()} ~ 최고 ${Math.max(...allPkgPrices).toLocaleString()}`);

process.exit(0);
