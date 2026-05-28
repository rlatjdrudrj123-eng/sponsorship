/**
 * KPRINT 데이터 무결성/품질 점검.
 *
 * 카테고리 / 소분류 / 슬롯의 누락·고아·이상 데이터를 한 번에 출력해
 * 사이트가 안 보이거나 어색하게 보이는 원인을 빠르게 진단.
 *
 * 사용법:
 *   node scripts/inspectKprint.mjs
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

async function main() {
  const [catsSnap, subsSnap, slotsSnap, pkgsSnap, settingsSnap] = await Promise.all([
    fs.collection("categories").where("eventId", "==", EVENT_ID).get(),
    fs.collection("subcategories").where("eventId", "==", EVENT_ID).get(),
    fs.collection("slots").where("eventId", "==", EVENT_ID).get(),
    fs.collection("packages").where("eventId", "==", EVENT_ID).get(),
    fs.collection("siteSettings").doc(EVENT_ID).get(),
  ]);

  const cats = catsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
  const subs = subsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
  const slots = slotsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
  const pkgs = pkgsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));

  const subsByCat = new Map();
  subs.forEach((s) => {
    const arr = subsByCat.get(s.categoryId) ?? [];
    arr.push(s);
    subsByCat.set(s.categoryId, arr);
  });
  const slotsByCat = new Map();
  const slotsBySub = new Map();
  slots.forEach((sl) => {
    const a = slotsByCat.get(sl.categoryId) ?? [];
    a.push(sl);
    slotsByCat.set(sl.categoryId, a);
    const b = slotsBySub.get(sl.subcategoryId) ?? [];
    b.push(sl);
    slotsBySub.set(sl.subcategoryId, b);
  });

  console.log("═".repeat(76));
  console.log("  KPRINT 데이터 점검");
  console.log("═".repeat(76));
  console.log(`siteSettings: ${settingsSnap.exists ? "✓ 있음" : "✗ 없음 (사이트 안 보일 수 있음)"}`);
  console.log(`categories:    ${cats.length}`);
  console.log(`subcategories: ${subs.length}`);
  console.log(`slots:         ${slots.length}`);
  console.log(`packages:      ${pkgs.length}`);

  // Settings 의 핵심 필드 점검
  if (settingsSnap.exists) {
    const s = settingsSnap.data();
    console.log("\n--- siteSettings ---");
    console.log(`  event.nameKo:      ${s.event?.nameKo ?? "(빈값)"}`);
    console.log(`  event.dateRange:   ${s.event?.dateRange ?? "(빈값)"}`);
    console.log(`  event.venue:       ${s.event?.venue ?? "(빈값)"}`);
    console.log(`  landing blocks:    ${s.landing?.length ?? 0}`);
    console.log(`  pdfFullUrl:        ${s.pdfFullUrl ? "✓ 있음" : "(빈값)"}`);
    console.log(`  bundledPerks:      ${s.bundledPerks?.length ?? 0}`);
  }

  // 카테고리 한 줄씩
  console.log("\n--- 카테고리 23개 ---");
  const issues = [];
  cats
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach((c) => {
      const subList = subsByCat.get(c.id) ?? [];
      const slotList = slotsByCat.get(c.id) ?? [];
      const avail = slotList.filter((s) => s.status === "available").length;
      const flags = [];
      if (!c.isPublished) flags.push("⛔ unpublished");
      if (subList.length === 0) flags.push("⚠ 소분류 0");
      if (slotList.length === 0) flags.push("⚠ 슬롯 0");
      if (!c.name?.ko) flags.push("⚠ name.ko 비어있음");
      if (!c.slug) flags.push("⚠ slug 비어있음");
      if (!c.shortDesc) flags.push("· shortDesc 비어있음");
      if (!c.heroImages?.images?.length) flags.push("· hero 이미지 0");

      const hero = c.heroImages?.images?.[0]?.url ? "🖼" : " ";
      const pub = c.isPublished ? "▶" : "⏸";
      const flagStr = flags.length > 0 ? `  [${flags.join(", ")}]` : "";
      console.log(
        `  ${pub} ${hero} ${c.code.padEnd(5)} ${(c.name?.ko ?? "").padEnd(22)} ` +
          `sub=${String(subList.length).padStart(2)} slot=${String(slotList.length).padStart(2)} avail=${String(avail).padStart(2)}${flagStr}`
      );
      if (flags.length > 0) issues.push({ code: c.code, flags });
    });

  // 소분류 점검
  console.log("\n--- 소분류 이상 ---");
  const subIssues = [];
  subs.forEach((s) => {
    const sl = slotsBySub.get(s.id) ?? [];
    const flags = [];
    if (!s.name?.ko && !s.name?.en) flags.push("이름 둘 다 비어있음");
    if (typeof s.priceKRW !== "number") flags.push("priceKRW 가 숫자 아님");
    if (sl.length === 0) flags.push("연결된 slot 0개");
    if (!s.unit?.ko && !s.unit?.en) flags.push("unit 비어있음");
    if (flags.length > 0) {
      subIssues.push({ id: s.id, name: s.name?.ko ?? s.name?.en ?? "(이름 없음)", flags });
    }
  });
  if (subIssues.length === 0) console.log("  (이상 없음)");
  else subIssues.slice(0, 10).forEach((s) => console.log(`  • ${s.name} — ${s.flags.join(", ")}`));

  // 슬롯 점검 — status 분포
  console.log("\n--- 슬롯 상태 분포 ---");
  const byStatus = slots.reduce((m, s) => {
    m[s.status] = (m[s.status] ?? 0) + 1;
    return m;
  }, {});
  Object.entries(byStatus).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} ${v}`));

  // 가격 통계
  console.log("\n--- 가격 분포 (KRW, subcategory 별) ---");
  const prices = subs.map((s) => s.priceKRW).filter((p) => typeof p === "number" && p > 0);
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    console.log(`  최저: ${min.toLocaleString()}원`);
    console.log(`  최고: ${max.toLocaleString()}원`);
    console.log(`  평균: ${avg.toLocaleString()}원`);
    console.log(`  가격 0원: ${subs.length - prices.length}개`);
  }

  // 패키지
  console.log("\n--- 패키지 ---");
  if (pkgs.length === 0) console.log("  (패키지 없음)");
  else
    pkgs.forEach((p) => {
      const orig = p.originalPrice ?? 0;
      const disc = p.discountPrice ?? null;
      const priceLabel = disc
        ? `${orig.toLocaleString()}원 → ${disc.toLocaleString()}원`
        : `${orig.toLocaleString()}원`;
      const itemsCount = p.includedItems?.length ?? 0;
      const pub = p.isPublished ? "▶" : "⏸";
      console.log(`  ${pub} ${p.name?.ko ?? p.id} — ${priceLabel}, 항목 ${itemsCount}개`);
    });

  // 마무리
  console.log("\n" + "═".repeat(76));
  console.log(`총 이상 카테고리: ${issues.length} / ${cats.length}`);
  console.log(`총 이상 소분류:  ${subIssues.length} / ${subs.length}`);
  console.log("═".repeat(76));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).then(() => process.exit(0));
