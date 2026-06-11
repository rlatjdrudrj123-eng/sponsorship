/** 두 행사 데이터가 ID 수준에서 완전히 분리됐는지 검증. */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: "kprint-845c3", credential: loadCredentials() });
const fs = getFirestore(app);

const A = "kprint-2026";
const B = "kmb26-2026";

// 1. doc id 겹침 검사 — 한 ID 가 양쪽 eventId 로 있으면 안 됨
console.log("[1] doc id 겹침 검사 (양 행사 사이에 같은 ID 없어야 함)");
const COLS = ["categories", "subcategories", "slots", "packages", "personas"];
let overlap = 0;
for (const col of COLS) {
  const aSnap = await fs.collection(col).where("eventId", "==", A).get();
  const bSnap = await fs.collection(col).where("eventId", "==", B).get();
  const aIds = new Set(aSnap.docs.map((d) => d.id));
  const bIds = new Set(bSnap.docs.map((d) => d.id));
  const inter = [...aIds].filter((id) => bIds.has(id));
  console.log(`  ${col}: A=${aSnap.size} B=${bSnap.size} 겹침=${inter.length}`);
  overlap += inter.length;
}

// 2. KMB 카테고리의 personas/inPackages/synergyTargets 가 모두 KMB 의 ID 만 가리키는지
console.log("\n[2] KMB 카테고리 참조가 KMB 내부 ID 만 가리키는지");
const kmbCats = await fs.collection("categories").where("eventId", "==", B).get();
const kmbCatIds = new Set(kmbCats.docs.map((d) => d.id));
const kmbPkgs = await fs.collection("packages").where("eventId", "==", B).get();
const kmbPkgIds = new Set(kmbPkgs.docs.map((d) => d.id));
const kmbPersonas = await fs.collection("personas").where("eventId", "==", B).get();
const kmbPersonaIds = new Set(kmbPersonas.docs.map((d) => d.id));
let crossRef = 0;
for (const d of kmbCats.docs) {
  const c = d.data();
  for (const pid of c.personas ?? []) {
    if (!kmbPersonaIds.has(pid)) {
      console.log(`  ✗ cat ${c.code} 의 personas[] 에 외부 ID: ${pid}`);
      crossRef++;
    }
  }
  for (const pid of c.inPackages ?? []) {
    if (!kmbPkgIds.has(pid)) {
      console.log(`  ✗ cat ${c.code} 의 inPackages[] 에 외부 ID: ${pid}`);
      crossRef++;
    }
  }
  for (const sid of c.synergyTargets ?? []) {
    if (!kmbCatIds.has(sid)) {
      console.log(`  ✗ cat ${c.code} 의 synergyTargets[] 에 외부 ID: ${sid}`);
      crossRef++;
    }
  }
}
if (crossRef === 0) console.log("  ✓ 모든 참조가 KMB 내부");

// 3. KMB subcategories 의 categoryId 가 KMB cat 만 가리키는지
console.log("\n[3] KMB subcategories 의 categoryId 검사");
const kmbSubs = await fs.collection("subcategories").where("eventId", "==", B).get();
let subBad = 0;
for (const d of kmbSubs.docs) {
  const s = d.data();
  if (!kmbCatIds.has(s.categoryId)) {
    console.log(`  ✗ sub ${d.id} categoryId=${s.categoryId} 가 KMB 카테고리 아님`);
    subBad++;
  }
}
if (subBad === 0) console.log(`  ✓ ${kmbSubs.size}개 모두 정상`);

// 4. KMB slots 의 categoryId / subcategoryId
console.log("\n[4] KMB slots 의 categoryId / subcategoryId 검사");
const kmbSubIds = new Set(kmbSubs.docs.map((d) => d.id));
const kmbSlots = await fs.collection("slots").where("eventId", "==", B).get();
let slotBad = 0;
for (const d of kmbSlots.docs) {
  const s = d.data();
  if (!kmbCatIds.has(s.categoryId)) {
    console.log(`  ✗ slot ${s.code} categoryId 외부: ${s.categoryId}`);
    slotBad++;
  }
  if (!kmbSubIds.has(s.subcategoryId)) {
    console.log(`  ✗ slot ${s.code} subcategoryId 외부: ${s.subcategoryId}`);
    slotBad++;
  }
}
if (slotBad === 0) console.log(`  ✓ ${kmbSlots.size}개 모두 정상`);

// 5. KMB packages 의 includedItems
console.log("\n[5] KMB packages 의 includedItems 참조 검사");
let pkgBad = 0;
for (const d of kmbPkgs.docs) {
  const p = d.data();
  for (const it of p.includedItems ?? []) {
    if (it.categoryId && !kmbCatIds.has(it.categoryId)) {
      console.log(`  ✗ pkg ${p.code} item.categoryId 외부: ${it.categoryId}`);
      pkgBad++;
    }
    if (it.subcategoryId && !kmbSubIds.has(it.subcategoryId)) {
      console.log(`  ✗ pkg ${p.code} item.subcategoryId 외부: ${it.subcategoryId}`);
      pkgBad++;
    }
  }
}
if (pkgBad === 0) console.log(`  ✓ ${kmbPkgs.size}개 패키지 모두 내부 ID 만 참조`);

console.log("\n" + "=".repeat(50));
console.log(
  overlap + crossRef + subBad + slotBad + pkgBad === 0
    ? "✓ 완전 격리 — 데이터 섞임 없음"
    : "✗ 격리 위반 발견"
);
process.exit(0);
