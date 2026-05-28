/**
 * KPRINT 카테고리·소분류·슬롯 전수 정합성 검사.
 * 패키지 편집의 sub 드롭다운 / 가격 표시 불일치 진단.
 */
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("키 없음");
}

const app = initializeApp({ projectId: "kprint-845c3", credential: loadCredentials() });
const fs = getFirestore(app);
const EVENT_ID = "kprint-2026";

const [catsSnap, subsSnap, slotsSnap] = await Promise.all([
  fs.collection("categories").where("eventId", "==", EVENT_ID).get(),
  fs.collection("subcategories").where("eventId", "==", EVENT_ID).get(),
  fs.collection("slots").where("eventId", "==", EVENT_ID).get(),
]);

const cats = catsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
const subs = subsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
const slots = slotsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));

const catById = new Map(cats.map((c) => [c.id, c]));

console.log("─".repeat(76));
console.log(`KPRINT 전수 정합성 검사  cats=${cats.length}, subs=${subs.length}, slots=${slots.length}`);
console.log("─".repeat(76));

// 카테고리 각각 — 그 안의 sub / slot 검증
cats
  .slice()
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .forEach((c) => {
    const mySubs = subs.filter((s) => s.categoryId === c.id);
    const mySlots = slots.filter((sl) => sl.categoryId === c.id);
    const issues = [];

    if (mySubs.length === 0) {
      issues.push("⚠ sub 0개");
    }
    mySubs.forEach((s) => {
      if (typeof s.priceKRW !== "number" || s.priceKRW < 0) {
        issues.push(`sub "${s.name?.ko ?? "(?)"}" priceKRW=${s.priceKRW} 이상`);
      } else if (s.priceKRW === 0 && c.code !== "CSP") {
        issues.push(`sub "${s.name?.ko ?? "(?)"}" priceKRW=0 (가격 협의 의도?)`);
      }
      if (!s.name?.ko && !s.name?.en) {
        issues.push(`sub id=${s.id.slice(0, 6)} 이름 비어있음`);
      }
      if (!s.unit?.ko && !s.unit?.en) {
        issues.push(`sub "${s.name?.ko ?? "(?)"}" unit 비어있음`);
      }
    });
    mySlots.forEach((sl) => {
      const subOk = !sl.subcategoryId || mySubs.some((s) => s.id === sl.subcategoryId);
      if (!subOk) {
        issues.push(`slot "${sl.code}" subcategoryId 매칭 sub 없음`);
      }
    });

    const flag = issues.length > 0 ? "✗" : "✓";
    console.log(
      `${flag} ${c.code.padEnd(5)} ${(c.name?.ko ?? "(?)").padEnd(22)} subs=${mySubs.length} slots=${mySlots.length}`
    );
    issues.forEach((iss) => console.log(`    └ ${iss}`));
    if (mySubs.length > 0 && issues.length === 0) {
      mySubs.forEach((s) => {
        console.log(
          `    · ${(s.name?.ko ?? "(빈이름)").padEnd(20)} ${s.priceKRW.toLocaleString().padStart(12)}원  unit=${s.unit?.ko ?? "?"}`
        );
      });
    }
  });

// orphan sub (categoryId 가 cats 에 없음)
const orphanSubs = subs.filter((s) => !catById.has(s.categoryId));
const orphanSlots = slots.filter((sl) => !catById.has(sl.categoryId));
console.log("\n" + "─".repeat(76));
console.log(`Orphan subs (categoryId 매칭 없음): ${orphanSubs.length}`);
orphanSubs.forEach((s) =>
  console.log(`  - id=${s.id} categoryId=${s.categoryId} name=${s.name?.ko ?? "?"}`)
);
console.log(`Orphan slots: ${orphanSlots.length}`);
orphanSlots.slice(0, 10).forEach((sl) =>
  console.log(`  - code=${sl.code} categoryId=${sl.categoryId}`)
);

process.exit(0);
