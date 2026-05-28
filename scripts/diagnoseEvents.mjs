/**
 * 행사별 카테고리/소분류/슬롯 카운트 진단.
 * 또한 "고아 subcategory/slot" — categoryId 가 다른 eventId 의 카테고리를
 * 가리키는 경우 — 도 탐지. 옛 import 버그의 흔적 진단용.
 *
 * 사용법:
 *   GOOGLE_APPLICATION_CREDENTIALS=./kprint-845c3-firebase-adminsdk-*.json \
 *     node scripts/diagnoseEvents.mjs
 *
 * 또는 키 파일이 .gcp-key.json 또는 ./*-firebase-adminsdk-*.json 패턴이면 자동 탐지.
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";

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

async function main() {
  console.log("─".repeat(70));
  console.log("Firestore 행사별 데이터 진단");
  console.log("─".repeat(70));

  const [cats, subs, slots] = await Promise.all([
    fs.collection("categories").get(),
    fs.collection("subcategories").get(),
    fs.collection("slots").get(),
  ]);

  // 행사별 그룹핑
  const byEvent = new Map(); // eventId → { cats:Set, subs:[], slots:[] }
  const catById = new Map(); // categoryId → category data
  const allCats = [];
  cats.forEach((d) => {
    const data = d.data();
    catById.set(d.id, { ...data, id: d.id });
    allCats.push({ ...data, id: d.id });
    const e = byEvent.get(data.eventId) ?? { cats: new Set(), subs: [], slots: [] };
    e.cats.add(d.id);
    byEvent.set(data.eventId, e);
  });
  subs.forEach((d) => {
    const data = d.data();
    const e = byEvent.get(data.eventId) ?? { cats: new Set(), subs: [], slots: [] };
    e.subs.push({ ...data, id: d.id });
    byEvent.set(data.eventId, e);
  });
  slots.forEach((d) => {
    const data = d.data();
    const e = byEvent.get(data.eventId) ?? { cats: new Set(), subs: [], slots: [] };
    e.slots.push({ ...data, id: d.id });
    byEvent.set(data.eventId, e);
  });

  for (const [eventId, e] of byEvent) {
    console.log(`\n[${eventId}]`);
    console.log(`  categories:    ${e.cats.size}`);
    console.log(`  subcategories: ${e.subs.length}`);
    console.log(`  slots:         ${e.slots.length}`);
  }

  // 고아 탐지 — subcategory.categoryId 가 가리키는 cat 의 eventId 가 subcategory 의 eventId 와 다름
  console.log("\n─".repeat(70));
  console.log("고아(orphan) 진단 — 옛 import 버그의 흔적");
  console.log("─".repeat(70));

  const orphanSubs = [];
  subs.forEach((d) => {
    const data = d.data();
    const cat = catById.get(data.categoryId);
    if (!cat) {
      orphanSubs.push({
        id: d.id,
        eventId: data.eventId,
        categoryId: data.categoryId,
        reason: "categoryId 가 존재하지 않는 카테고리를 가리킴",
      });
    } else if (cat.eventId !== data.eventId) {
      orphanSubs.push({
        id: d.id,
        nameKo: data.name?.ko ?? "",
        subEventId: data.eventId,
        catEventId: cat.eventId,
        catCode: cat.code,
        reason: `subcategory.eventId(${data.eventId}) ≠ category.eventId(${cat.eventId})`,
      });
    }
  });

  const orphanSlots = [];
  slots.forEach((d) => {
    const data = d.data();
    const cat = catById.get(data.categoryId);
    if (!cat) {
      orphanSlots.push({
        id: d.id,
        eventId: data.eventId,
        categoryId: data.categoryId,
        reason: "categoryId 가 존재하지 않는 카테고리를 가리킴",
      });
    } else if (cat.eventId !== data.eventId) {
      orphanSlots.push({
        id: d.id,
        code: data.code,
        slotEventId: data.eventId,
        catEventId: cat.eventId,
        catCode: cat.code,
        reason: `slot.eventId(${data.eventId}) ≠ category.eventId(${cat.eventId})`,
      });
    }
  });

  console.log(`\nOrphan subcategories: ${orphanSubs.length}`);
  orphanSubs.slice(0, 10).forEach((o, i) => {
    console.log(`  ${i + 1}. ${JSON.stringify(o)}`);
  });
  if (orphanSubs.length > 10) console.log(`  ... +${orphanSubs.length - 10} more`);

  console.log(`\nOrphan slots: ${orphanSlots.length}`);
  orphanSlots.slice(0, 5).forEach((o, i) => {
    console.log(`  ${i + 1}. ${JSON.stringify(o)}`);
  });
  if (orphanSlots.length > 5) console.log(`  ... +${orphanSlots.length - 5} more`);

  console.log("\n" + "─".repeat(70));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).then(() => process.exit(0));
