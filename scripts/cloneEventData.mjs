/**
 * 행사 데이터 복제 — KPRINT 2026 → KIMES BUSAN 2026.
 *
 * 핵심 원칙:
 *  - 모든 도큐먼트 새 ID 발급 (소스 ID 와 절대 안 겹침)
 *  - 컬렉션 간 참조 (categoryId, subcategoryId, packageId, personaId, slotIds) 일괄 remap
 *  - 사용 전에 타겟이 비어있는지 pre-flight 검사 (이미 있으면 abort)
 *  - --dry 모드: 무엇이 복사될지 시뮬레이션만 (write 없음)
 *
 * 사용:
 *   node scripts/cloneEventData.mjs --dry        # 미리보기
 *   node scripts/cloneEventData.mjs --confirm    # 실제 실행
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const SOURCE_EID = "kprint-2026";
const TARGET_EID = "kmb26-2026";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const CONFIRM = args.includes("--confirm");
if (!DRY && !CONFIRM) {
  console.error("flag 필요: --dry (미리보기) 또는 --confirm (실제 실행)");
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
// 일부 카테고리는 optional 필드가 undefined — Firestore 가 거부하지 않게.
fs.settings({ ignoreUndefinedProperties: true });

console.log(`\n${DRY ? "[DRY-RUN]" : "[LIVE]"} ${SOURCE_EID} → ${TARGET_EID}`);
console.log("=" .repeat(60));

// ============================================================================
// Pre-flight — 타겟 비어있는지 검사
// ============================================================================

const COLS_BY_EID = ["categories", "subcategories", "slots", "packages", "personas"];
const COLS_BY_DOCID = ["siteSettings", "taxonomy", "quoteSettings"];

console.log("\n[1] Pre-flight: 타겟 비어있는지 검사");
let dirty = false;
for (const col of COLS_BY_EID) {
  const snap = await fs.collection(col).where("eventId", "==", TARGET_EID).get();
  console.log(`    ${col} (eventId=${TARGET_EID}): ${snap.size}`);
  if (snap.size > 0) dirty = true;
}
for (const col of COLS_BY_DOCID) {
  const d = await fs.collection(col).doc(TARGET_EID).get();
  console.log(`    ${col}/${TARGET_EID}: ${d.exists ? "EXISTS" : "—"}`);
  if (d.exists) dirty = true;
}

if (dirty && !DRY) {
  console.error(
    `\n✗ 타겟에 이미 데이터가 있습니다. 데이터 섞임 방지를 위해 abort.`
  );
  console.error(`  먼저 타겟 데이터를 정리하거나 --dry 로 검토하세요.`);
  process.exit(1);
}

// ============================================================================
// [2] 소스 로드
// ============================================================================

console.log("\n[2] 소스 로드");
const [
  srcCats,
  srcSubs,
  srcSlots,
  srcPkgs,
  srcPersonas,
] = await Promise.all(
  COLS_BY_EID.map((col) =>
    fs.collection(col).where("eventId", "==", SOURCE_EID).get()
  )
);
console.log(`    categories: ${srcCats.size}`);
console.log(`    subcategories: ${srcSubs.size}`);
console.log(`    slots: ${srcSlots.size}`);
console.log(`    packages: ${srcPkgs.size}`);
console.log(`    personas: ${srcPersonas.size}`);

const [srcSettings, srcTaxonomy, srcQuote] = await Promise.all(
  COLS_BY_DOCID.map((col) => fs.collection(col).doc(SOURCE_EID).get())
);
console.log(`    siteSettings: ${srcSettings.exists ? "EXISTS" : "—"}`);
console.log(`    taxonomy: ${srcTaxonomy.exists ? "EXISTS" : "—"}`);
console.log(`    quoteSettings: ${srcQuote.exists ? "EXISTS" : "—"}`);

// ============================================================================
// [3] ID 매핑 생성
// ============================================================================

console.log("\n[3] ID 매핑 생성");

function genId(col) {
  return fs.collection(col).doc().id;
}

const catIdMap = new Map();
const subIdMap = new Map();
const slotIdMap = new Map();
const pkgIdMap = new Map();
const personaIdMap = new Map();

for (const d of srcCats.docs) catIdMap.set(d.id, genId("categories"));
for (const d of srcSubs.docs) subIdMap.set(d.id, genId("subcategories"));
for (const d of srcSlots.docs) slotIdMap.set(d.id, genId("slots"));
for (const d of srcPkgs.docs) pkgIdMap.set(d.id, genId("packages"));
for (const d of srcPersonas.docs) personaIdMap.set(d.id, genId("personas"));

console.log(`    매핑 생성 완료 (총 ${
  catIdMap.size + subIdMap.size + slotIdMap.size + pkgIdMap.size + personaIdMap.size
}개)`);

// 이름 -> 새 ID 도 같이 (사용자 디버깅용)
console.log(`\n    카테고리 매핑 샘플 (처음 3개):`);
let cnt = 0;
for (const d of srcCats.docs) {
  if (cnt++ >= 3) break;
  console.log(`      [${d.data().code}] ${d.id} → ${catIdMap.get(d.id)}`);
}

// ============================================================================
// [4] 복제 — 참조 remap
// ============================================================================

const KMB_NAME_KO = "KIMES BUSAN 2026";
const KMB_NAME_EN = "KIMES BUSAN 2026";

function remapList(arr, map) {
  if (!Array.isArray(arr)) return arr;
  return arr.map((x) => map.get(x)).filter((x) => x != null);
}

// 4-1. categories
console.log("\n[4-1] 복제: categories");
for (const d of srcCats.docs) {
  const data = d.data();
  const newId = catIdMap.get(d.id);
  const newData = {
    ...data,
    id: newId,
    eventId: TARGET_EID,
    personas: remapList(data.personas, personaIdMap),
    inPackages: remapList(data.inPackages, pkgIdMap),
    synergyTargets: remapList(data.synergyTargets, catIdMap),
  };
  if (DRY) {
    if (catIdMap.size <= 5) console.log(`    [DRY] ${data.code} → ${newId}`);
  } else {
    await fs.collection("categories").doc(newId).set(newData);
  }
}
if (!DRY) console.log(`    ${catIdMap.size}개 완료`);

// 4-2. subcategories
console.log("\n[4-2] 복제: subcategories");
let subSkip = 0;
for (const d of srcSubs.docs) {
  const data = d.data();
  const newId = subIdMap.get(d.id);
  const newCatId = catIdMap.get(data.categoryId);
  if (!newCatId) {
    subSkip++;
    continue;
  }
  if (DRY) continue;
  await fs.collection("subcategories").doc(newId).set({
    ...data,
    id: newId,
    eventId: TARGET_EID,
    categoryId: newCatId,
  });
}
if (!DRY) console.log(`    ${subIdMap.size - subSkip}개 완료 (skip ${subSkip})`);

// 4-3. slots — 모든 slot 새 행사 시작이므로 status=available 로 reset
console.log("\n[4-3] 복제: slots (status 전부 available 로 reset)");
let slotSkip = 0;
for (const d of srcSlots.docs) {
  const data = d.data();
  const newId = slotIdMap.get(d.id);
  const newCatId = catIdMap.get(data.categoryId);
  const newSubId = subIdMap.get(data.subcategoryId);
  if (!newCatId || !newSubId) {
    slotSkip++;
    continue;
  }
  if (DRY) continue;
  await fs.collection("slots").doc(newId).set({
    ...data,
    id: newId,
    eventId: TARGET_EID,
    categoryId: newCatId,
    subcategoryId: newSubId,
    status: "available",
  });
}
if (!DRY) console.log(`    ${slotIdMap.size - slotSkip}개 완료 (skip ${slotSkip})`);

// 4-4. packages — includedItems 안의 categoryId/subcategoryId/referencedSlotIds 도 remap
console.log("\n[4-4] 복제: packages");
for (const d of srcPkgs.docs) {
  const data = d.data();
  const newId = pkgIdMap.get(d.id);
  const includedItems = (data.includedItems ?? []).map((it) => {
    const next = { ...it };
    if (it.categoryId) {
      const m = catIdMap.get(it.categoryId);
      if (m) next.categoryId = m;
      else delete next.categoryId; // orphan
    }
    if (it.subcategoryId) {
      const m = subIdMap.get(it.subcategoryId);
      if (m) next.subcategoryId = m;
      else delete next.subcategoryId;
    }
    if (Array.isArray(it.referencedSlotIds)) {
      next.referencedSlotIds = remapList(it.referencedSlotIds, slotIdMap);
    }
    return next;
  });
  if (DRY) continue;
  await fs.collection("packages").doc(newId).set({
    ...data,
    id: newId,
    eventId: TARGET_EID,
    includedItems,
    // composition (selectorId 배열) 은 안정 abstract ID 라 remap 불필요
  });
}
if (!DRY) console.log(`    ${pkgIdMap.size}개 완료`);

// 4-5. personas
console.log("\n[4-5] 복제: personas");
for (const d of srcPersonas.docs) {
  const data = d.data();
  const newId = personaIdMap.get(d.id);
  if (DRY) continue;
  await fs.collection("personas").doc(newId).set({
    ...data,
    id: newId,
    eventId: TARGET_EID,
  });
}
if (!DRY) console.log(`    ${personaIdMap.size}개 완료`);

// 4-6. siteSettings — event 정보는 KIMES 명칭으로, 나머지는 KPRINT 그대로 (어드민이 손볼 예정)
console.log("\n[4-6] 복제: siteSettings (event 이름만 KIMES 로 교체)");
if (srcSettings.exists) {
  const data = srcSettings.data();
  const next = {
    ...data,
    eventId: TARGET_EID,
    event: {
      ...(data.event ?? {}),
      nameKo: KMB_NAME_KO,
      nameEn: KMB_NAME_EN,
      // dateRange / venue / applicationDeadline 는 KPRINT 값 그대로 — 어드민이 직접 수정
    },
  };
  if (!DRY) {
    await fs.collection("siteSettings").doc(TARGET_EID).set(next);
    console.log(`    siteSettings/${TARGET_EID} 생성`);
  }
}

// 4-7. taxonomy
console.log("\n[4-7] 복제: taxonomy");
if (srcTaxonomy.exists) {
  const data = srcTaxonomy.data();
  if (!DRY) {
    await fs.collection("taxonomy").doc(TARGET_EID).set({
      ...data,
      eventId: TARGET_EID,
    });
    console.log(`    taxonomy/${TARGET_EID} 생성`);
  }
}

// 4-8. quoteSettings
console.log("\n[4-8] 복제: quoteSettings");
if (srcQuote.exists) {
  const data = srcQuote.data();
  if (!DRY) {
    await fs.collection("quoteSettings").doc(TARGET_EID).set({
      ...data,
      eventId: TARGET_EID,
    });
    console.log(`    quoteSettings/${TARGET_EID} 생성`);
  }
}

// ============================================================================
// 완료
// ============================================================================

console.log("\n" + "=".repeat(60));
if (DRY) {
  console.log("✓ Dry-run 완료. 실제 실행하려면 --confirm 으로 재실행.");
} else {
  console.log("✓ 복제 완료. 어드민에서 확인:");
  console.log(`    /admin/categories (행사 셀렉터 = KIMES BUSAN)`);
  console.log(`    /admin/settings (event 이름·날짜·장소 수정 필요)`);
  console.log(`    /admin/settings/quote (견적서 인삿말 KIMES 용으로)`);
}

void FieldValue; // import 유지
process.exit(0);
