/**
 * 행사 복제 계획(lib/admin/clonePlan.ts) 검증 — 운영 실데이터 "읽기 전용".
 *
 * 운영 Firestore 에서 원본 행사의 공개 범위 데이터(공개 카테고리·패키지, 소분류·구좌·페르소나·
 * 분류·사이트 설정)를 REST 로 읽고, planClone 으로 "무엇을 쓸지"만 계산해 불변식을 검사한다.
 * 쓰기 0. (견적서 설정은 내부 전용이라 가짜 값으로 시험)
 *
 * 실행 (Node 24+):
 *   cd kprint-site
 *   node scripts/verify-clone-plan.mjs [원본 eventId]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { planClone } from "../lib/admin/clonePlan.ts";

const SOURCE = process.argv[2] ?? "kimesbusan-2026";
const TARGET = { id: "test-clone-2027", name: "시험 복제 2027", shortName: "TEST", year: 2027 };

const env = Object.fromEntries(
  readFileSync(resolve(".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function fv(v) {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return { __ts: v.timestampValue };
  if ("mapValue" in v)
    return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fv(x)]));
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fv);
  return undefined;
}
const toDoc = (d) => ({
  ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, x]) => [k, fv(x)])),
  id: d.name.split("/").pop(),
});

async function query(col, filters) {
  const res = await fetch(`${BASE}:runQuery?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: col }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: filters.map(([f, v]) => ({
              fieldFilter: {
                field: { fieldPath: f },
                op: "EQUAL",
                value: typeof v === "boolean" ? { booleanValue: v } : { stringValue: v },
              },
            })),
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`${col} query ${res.status}`);
  const j = await res.json();
  return j.filter((x) => x.document).map((x) => toDoc(x.document));
}
async function getOne(col, id) {
  const res = await fetch(`${BASE}/${col}/${id}?key=${KEY}`);
  if (!res.ok) return null;
  const d = toDoc(await res.json());
  delete d.id;
  return d;
}

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const [categories, subcategories, slots, packages, personas, taxonomy, siteSettings] = await Promise.all([
  query("categories", [["eventId", SOURCE], ["isPublished", true]]),
  query("subcategories", [["eventId", SOURCE]]),
  query("slots", [["eventId", SOURCE]]),
  query("packages", [["eventId", SOURCE], ["isPublished", true]]),
  query("personas", [["eventId", SOURCE]]),
  getOne("taxonomy", SOURCE),
  getOne("siteSettings", SOURCE),
]);
const quoteSettings = {
  issuer: { companyName: "㈜한국이앤엑스", businessNumber: "120-81-81311", contactName: "원본 담당자" },
  bank: { bankName: "은행" },
  eventSubtitle: "원본 행사 부제",
  eventIntro: "원본 행사 안내",
  serialPrefix: "OLD26-",
  serialNextNumber: 57,
};
console.log(
  `원본 ${SOURCE}: 카테고리 ${categories.length}(공개분) · 소분류 ${subcategories.length} · 구좌 ${slots.length} · 패키지 ${packages.length}(공개분) · 페르소나 ${personas.length}`
);

let seq = 0;
const plan = planClone(
  { categories, subcategories, slots, packages, personas, taxonomy, siteSettings, quoteSettings },
  TARGET,
  { catalog: true, packages: true, personas: true, site: true, quote: true },
  (col) => `new-${col}-${++seq}`,
  () => "NOW"
);

const byCol = (c) => plan.writes.filter((w) => w.col === c);
const sourceIds = new Set(
  [...categories, ...subcategories, ...slots, ...packages, ...personas].map((d) => d.id)
);
const catIds = new Set(byCol("categories").map((w) => w.id));
const subIds = new Set(byCol("subcategories").map((w) => w.id));
const slotIds = new Set(byCol("slots").map((w) => w.id));
const pkgIds = new Set(byCol("packages").map((w) => w.id));
const personaIds = new Set(byCol("personas").map((w) => w.id));

// 1) 행사 ID
const scoped = ["categories", "subcategories", "slots", "packages", "personas"];
const wrongEvent = plan.writes.filter((w) => scoped.includes(w.col) && w.data.eventId !== TARGET.id);
check("모든 상품 문서의 eventId 가 새 행사", wrongEvent.length === 0, `${wrongEvent.length}건 불일치`);

// 2) 원본 ID 잔존 없음 (문서 내용 전체 문자열 검사)
const leaks = [];
for (const w of plan.writes.filter((x) => scoped.includes(x.col))) {
  const s = JSON.stringify(w.data);
  for (const id of sourceIds) if (s.includes(`"${id}"`)) leaks.push(`${w.col}/${w.id} → ${id}`);
}
check("원본 문서 ID 참조가 남지 않음", leaks.length === 0, leaks.slice(0, 3).join(", "));

// 3) 참조 무결성
const subBad = byCol("subcategories").filter((w) => !catIds.has(w.data.categoryId));
check("소분류 → 새 카테고리", subBad.length === 0, `${subBad.length}건`);
const slotBad = byCol("slots").filter((w) => !subIds.has(w.data.subcategoryId) || !catIds.has(w.data.categoryId));
check("구좌 → 새 소분류·카테고리", slotBad.length === 0, `${slotBad.length}건`);
const pinBad = [];
for (const w of byCol("categories")) {
  for (const f of w.data.floorImages ?? []) {
    if (!subIds.has(f.subcategoryId)) pinBad.push(`${w.id} 도면 소분류`);
    for (const p of f.pins ?? []) if (!slotIds.has(p.slotId)) pinBad.push(`${w.id} 핀`);
  }
  for (const id of w.data.synergyTargets ?? []) if (!catIds.has(id)) pinBad.push(`${w.id} 시너지`);
  for (const id of w.data.personas ?? []) if (!personaIds.has(id)) pinBad.push(`${w.id} 페르소나`);
  for (const id of w.data.inPackages ?? []) if (!pkgIds.has(id)) pinBad.push(`${w.id} 패키지`);
}
check("카테고리의 도면 핀·시너지·페르소나·패키지 → 새 ID", pinBad.length === 0, pinBad.slice(0, 3).join(", "));
const pkgBad = [];
for (const w of byCol("packages")) {
  for (const it of w.data.includedItems ?? []) {
    if (it.categoryId && !catIds.has(it.categoryId)) pkgBad.push("카테고리");
    if (it.subcategoryId && !subIds.has(it.subcategoryId)) pkgBad.push("소분류");
    for (const s of it.referencedSlotIds ?? []) if (!slotIds.has(s)) pkgBad.push("구좌");
  }
}
check("패키지 포함 품목 → 새 ID", pkgBad.length === 0, `${pkgBad.length}건`);

// 4) 초기화
check("구좌 전부 판매 중", byCol("slots").every((w) => w.data.status === "available"));
check("패키지 매진 해제", byCol("packages").every((w) => w.data.soldOut === false));

// 5) 개수 — 공개 카테고리에 속한 소분류·구좌만 복제 대상
const pubCat = new Set(categories.map((c) => c.id));
const expSubs = subcategories.filter((s) => pubCat.has(s.categoryId));
const expSubIds = new Set(expSubs.map((s) => s.id));
const expSlots = slots.filter((s) => expSubIds.has(s.subcategoryId));
check(
  "개수 일치",
  plan.counts.categories === categories.length &&
    plan.counts.subcategories === expSubs.length &&
    plan.counts.slots === expSlots.length &&
    plan.counts.packages === packages.length &&
    plan.counts.personas === personas.length,
  JSON.stringify(plan.counts)
);

// 6) 설정
const site = byCol("siteSettings")[0]?.data;
check(
  "사이트 설정: 새 행사명, 원본 PDF 제거",
  !!site &&
    site.event?.nameKo === TARGET.name &&
    !("pdfFullUrl" in site) &&
    !("pdfFullStoragePath" in site) &&
    site.eventId === TARGET.id
);
const q = byCol("quoteSettings")[0]?.data;
check(
  "견적서: 새 행사 문구·일련번호 1·담당자 비움·회사 정보 유지",
  !!q &&
    q.eventSubtitle === TARGET.name &&
    q.serialPrefix === "TES27-" &&
    q.serialNextNumber === 1 &&
    q.issuer?.contactName === "" &&
    q.issuer?.businessNumber === "120-81-81311"
);
check("분류(태그) 복사", byCol("taxonomy").length === (taxonomy ? 1 : 0));

// 7) 선택 해제 시 — 패키지 제외, 상품 제외 시 패키지도 제외
const p2 = planClone(
  { categories, subcategories, slots, packages, personas, taxonomy, siteSettings, quoteSettings },
  TARGET,
  { catalog: true, packages: false, personas: false, site: false, quote: false },
  (col) => `x-${col}-${++seq}`,
  () => "NOW"
);
check(
  "패키지·페르소나 제외 시 카테고리의 패키지·페르소나 참조도 비움",
  p2.writes.filter((w) => w.col === "categories").every((w) => (w.data.inPackages ?? []).length === 0 && (w.data.personas ?? []).length === 0) &&
    p2.writes.every((w) => ["categories", "subcategories", "slots"].includes(w.col))
);
const p3 = planClone(
  { categories, subcategories, slots, packages, personas, taxonomy, siteSettings, quoteSettings },
  TARGET,
  { catalog: false, packages: true, personas: false, site: false, quote: false },
  (col) => `y-${col}-${++seq}`,
  () => "NOW"
);
check("상품(카테고리) 없이 패키지만은 복제하지 않음", p3.writes.length === 0);

console.log(`\n통과 ${pass} · 실패 ${fail}`);
console.log("확인 목록:", plan.checklist.join(" / "));
process.exit(fail ? 1 : 0);
