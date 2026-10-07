/**
 * 엑셀 임포트(overwrite) 계산 검증 — 운영 실데이터 "읽기 전용".
 *
 * 무엇을 하나:
 *   1) 운영 Firestore 에서 한 행사의 카테고리(공개분)·소분류·구좌·패키지(공개분)를
 *      REST 로 읽기만 한다 (쓰기 0, 로그인 불필요한 공개 읽기 범위).
 *   2) 실제 엑셀을 실제 파서(lib/excel/parser.ts)로 파싱한다.
 *   3) lib/excel/importPlan.ts 의 planOverwrite 에 넣어 "무엇을 쓰고 지울지" 만 계산하고
 *      불변식(구좌 ID 유지·스폰서 구좌 보호·추천 필드 보존·다른 행사 불침범)을 검사한다.
 *   4) 엑셀을 일부러 바꾼 시나리오(구좌 삭제·이름 변경·신규 구좌·가격 변경·다른 행사 혼입)도 검사.
 *
 * 스폰서 문서는 어드민 전용이라 읽지 않고, 일부 구좌를 '스폰서 확보'로 가정해 보호 로직을 검사한다.
 *
 * 실행 (Node 24+, 별도 설치 불필요 — TypeScript 를 Node 가 직접 실행):
 *   cd kprint-site
 *   node scripts/verify-import-plan.mjs [엑셀경로] [eventId]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseExcelBuffer } from "../lib/excel/parser.ts";
import {
  collectPackageSlotIds,
  planOverwrite,
} from "../lib/excel/importPlan.ts";

const XLSX_PATH =
  process.argv[2] ?? "C:/Users/rlatj/Downloads/kmb2026_spon_작년기준.xlsx";
const EVENT_ID = process.argv[3] ?? "kimesbusan-2026";
const OTHER_EVENT_ID = "kprint-2026";

// ---------------------------------------------------------------------------
// Firestore REST (읽기 전용)
// ---------------------------------------------------------------------------
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
    return Object.fromEntries(
      Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fv(x)])
    );
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fv);
  return undefined;
}
const toDoc = (d) => ({
  ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, x]) => [k, fv(x)])),
  id: d.name.split("/").pop(),
});

async function listAll(col) {
  const out = [];
  let token = "";
  do {
    const url = `${BASE}/${col}?key=${KEY}&pageSize=300${token ? `&pageToken=${token}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${col} list ${res.status}`);
    const j = await res.json();
    out.push(...(j.documents ?? []).map(toDoc));
    token = j.nextPageToken ?? "";
  } while (token);
  return out;
}

async function listPublished(col) {
  const res = await fetch(`${BASE}:runQuery?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: col }],
        where: {
          fieldFilter: {
            field: { fieldPath: "isPublished" },
            op: "EQUAL",
            value: { booleanValue: true },
          },
        },
        limit: 1000,
      },
    }),
  });
  if (!res.ok) throw new Error(`${col} runQuery ${res.status}`);
  return (await res.json()).filter((r) => r.document).map((r) => toDoc(r.document));
}

// ---------------------------------------------------------------------------
// 검사 도구
// ---------------------------------------------------------------------------
let failures = 0;
let passes = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passes++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? `\n      → ${detail}` : ""}`);
  }
}
const clone = (x) => structuredClone(x);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let idSeq = 0;
const deps = {
  newId: (col) => `NEW-${col}-${++idSeq}`,
  now: () => ({ __ts: "NOW" }),
  fromDate: (d) => ({ __ts: d.toISOString() }),
};

function run(label, { parsed, exCats, exSubs, exSlots, sponsorSlotIds, packageSlotIds }) {
  const plan = planOverwrite({
    parsed,
    eventId: EVENT_ID,
    importHistoryId: "TEST-IMPORT",
    existingCategories: exCats,
    existingSubcategories: exSubs,
    existingSlots: exSlots,
    sponsorSlotIds,
    packageSlotIds,
    knownTags: new Set(),
    deps,
  });
  const writesById = new Map(plan.writes.map((w) => [`${w.col}/${w.id}`, w]));
  const deleted = new Set(plan.deletes.map((d) => `${d.col}/${d.id}`));
  console.log(`\n[${label}]`);
  console.log(
    `  계산 결과 — 쓰기 ${plan.writes.length} · 삭제 ${plan.deletes.length} · 경고 ${plan.warnings.length}`
  );
  console.log(`  counts: ${JSON.stringify(plan.counts)}`);
  return { plan, writesById, deleted };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
console.log(`행사: ${EVENT_ID}`);
console.log(`엑셀: ${XLSX_PATH}`);

const parsed0 = parseExcelBuffer(new Uint8Array(readFileSync(XLSX_PATH)));
console.log(
  `파싱: 카테고리 ${parsed0.categories.length} · 소분류 ${parsed0.subcategories.length} · 구좌 ${parsed0.slots.length} · 오류 ${parsed0.errors.length} · 경고 ${parsed0.warnings.length}`
);
if (!parsed0.ok) {
  console.log("파싱 오류가 있어 중단:", parsed0.errors.slice(0, 5));
  process.exit(1);
}

const [allCats, allSubs, allSlots, allPkgs] = await Promise.all([
  listPublished("categories"),
  listAll("subcategories"),
  listAll("slots"),
  listPublished("packages"),
]);
const exCats0 = allCats.filter((c) => c.eventId === EVENT_ID);
const exSubs0 = allSubs.filter((s) => s.eventId === EVENT_ID);
const exSlots0 = allSlots.filter((s) => s.eventId === EVENT_ID);
const pkgs = allPkgs.filter((p) => p.eventId === EVENT_ID);
const packageSlotIds = collectPackageSlotIds(pkgs);
const otherEventSlots = allSlots.filter((s) => s.eventId === OTHER_EVENT_ID);
console.log(
  `운영 데이터(읽기): 카테고리 ${exCats0.length} · 소분류 ${exSubs0.length} · 구좌 ${exSlots0.length} · 패키지 ${pkgs.length} (패키지 구성 구좌 ${packageSlotIds.size})`
);

const kimesIds = new Set([
  ...exCats0.map((c) => `categories/${c.id}`),
  ...exSubs0.map((s) => `subcategories/${s.id}`),
  ...exSlots0.map((s) => `slots/${s.id}`),
]);
const excelCodes = new Set(parsed0.categories.map((c) => c.code));
const catIdsInExcel = new Set(exCats0.filter((c) => excelCodes.has(c.code)).map((c) => c.id));

// 스폰서 확보 가정: 엑셀에 있는 카테고리마다 첫 구좌 1개씩 (+ 그중 하나는 매진 상태로 강제)
const sponsorSlotIds = new Set();
for (const catId of catIdsInExcel) {
  const s = exSlots0
    .filter((x) => x.categoryId === catId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  if (s) sponsorSlotIds.add(s.id);
}
const exSlotsBase = clone(exSlots0);
const forcedSoldSlot = exSlotsBase.find((s) => sponsorSlotIds.has(s.id));
if (forcedSoldSlot) forcedSoldSlot.status = "sold";
console.log(
  `가정: 스폰서 확보 구좌 ${sponsorSlotIds.size}개 (그중 ${forcedSoldSlot?.code ?? "-"} 는 매진 상태로 설정)`
);

// 추천 필드 보존 검사를 위해 카테고리 하나에 진단 점수·페르소나 등을 심어둠
const exCatsBase = clone(exCats0);
const seededCat = exCatsBase.find((c) => catIdsInExcel.has(c.id));
if (seededCat) {
  seededCat.goalAffinity = { traffic_driver: 3, brand_awareness: 2, new_product: 1 };
  seededCat.personas = ["persona-A", "persona-B"];
  seededCat.synergyTargets = ["cat-X"];
  seededCat.recommendBoost = 0.4;
  seededCat.lastYear = { buyers: ["테스트사"] };
}
const exSubsBase = clone(exSubs0);
const seededSub = exSubsBase.find((s) => catIdsInExcel.has(s.categoryId));
if (seededSub) seededSub.priceNote = "어드민 입력 가격 주석";
const seededSlot = exSlotsBase.find(
  (s) => catIdsInExcel.has(s.categoryId) && !sponsorSlotIds.has(s.id)
);
if (seededSlot) seededSlot.noteEn = "admin english note";

const base = {
  exCats: exCatsBase,
  exSubs: exSubsBase,
  exSlots: exSlotsBase,
  sponsorSlotIds,
  packageSlotIds,
};

// =========================================================================
// A. 이 엑셀을 지금 그대로 올리면
// =========================================================================
{
  const { plan, writesById, deleted } = run("A. 현재 엑셀을 지금 그대로 재업로드", {
    ...base,
    parsed: parsed0,
  });

  const touched = [...plan.writes.map((w) => `${w.col}/${w.id}`), ...deleted];
  const foreign = touched.filter((k) => !kimesIds.has(k) && !k.includes("/NEW-"));
  check("다른 행사·출처 불명 문서를 건드리지 않음", foreign.length === 0, foreign.slice(0, 5).join(", "));

  // 같은 코드의 기존 구좌는 반드시 같은 ID 로 쓰임 (새 ID 발급 X)
  const existingByCode = new Map(exSlotsBase.map((s) => [s.code, s]));
  const reissued = parsed0.slots.filter((ps) => {
    const ex = existingByCode.get(ps.code);
    return ex && !writesById.has(`slots/${ex.id}`);
  });
  check(
    "기존 구좌는 같은 ID 유지 (새 ID로 다시 만들지 않음)",
    reissued.length === 0,
    reissued.map((r) => r.code).join(", ")
  );

  const sponsorDeleted = [...sponsorSlotIds].filter((id) => deleted.has(`slots/${id}`));
  check("스폰서 확보 구좌는 삭제되지 않음", sponsorDeleted.length === 0, sponsorDeleted.join(", "));

  const downgraded = [...sponsorSlotIds].filter((id) => {
    const ex = exSlotsBase.find((s) => s.id === id);
    const w = writesById.get(`slots/${id}`);
    return ex && w && ex.status !== "available" && w.data.status === "available";
  });
  check("스폰서 확보 구좌의 매진이 풀리지 않음", downgraded.length === 0, downgraded.join(", "));

  const refDeleted = [...packageSlotIds].filter((id) => deleted.has(`slots/${id}`));
  check("패키지 구성 구좌는 삭제되지 않음", refDeleted.length === 0, refDeleted.join(", "));

  if (seededCat) {
    const w = writesById.get(`categories/${seededCat.id}`);
    const keep = ["goalAffinity", "personas", "synergyTargets", "recommendBoost", "lastYear", "floorImages", "heroImages"];
    const lost = keep.filter((k) => seededCat[k] !== undefined && !same(w?.data[k], seededCat[k]));
    check(`추천·이미지 필드 보존 (${seededCat.code})`, w && lost.length === 0, `잃은 필드: ${lost.join(", ")}`);
  }
  if (seededSub) {
    const w = writesById.get(`subcategories/${seededSub.id}`);
    check("소분류 어드민 입력값(가격 주석) 보존", w?.data.priceNote === seededSub.priceNote);
  }
  if (seededSlot && writesById.has(`slots/${seededSlot.id}`)) {
    check(
      "구좌 어드민 입력값(영문 메모) 보존",
      writesById.get(`slots/${seededSlot.id}`).data.noteEn === seededSlot.noteEn
    );
  }

  // 도면이 가리키는 소분류가 남아 있는지 (지워지면 경고가 있어야 함)
  const deletedSubIds = new Set(plan.deletes.filter((d) => d.col === "subcategories").map((d) => d.id));
  const orphaned = [];
  for (const c of exCatsBase.filter((x) => catIdsInExcel.has(x.id))) {
    for (const fi of c.floorImages ?? []) {
      if (deletedSubIds.has(fi.subcategoryId)) orphaned.push(`${c.code}:${fi.subcategoryId}`);
    }
  }
  const warnedFloor = plan.warnings.filter((w) => w.includes("연결 끊긴 도면")).length;
  check(
    "삭제되는 소분류에 도면이 있으면 경고",
    orphaned.length === 0 || warnedFloor >= orphaned.length,
    orphaned.join(", ")
  );

  const outOfScope = plan.deletes.filter((d) => {
    const src = d.col === "slots" ? exSlotsBase : exSubsBase;
    const doc = src.find((x) => x.id === d.id);
    return !doc || !catIdsInExcel.has(doc.categoryId);
  });
  check("엑셀에 없는 카테고리 쪽은 아무것도 지우지 않음", outOfScope.length === 0);

  if (plan.warnings.length) {
    console.log("  경고 전체:");
    for (const w of plan.warnings) console.log(`    · ${w}`);
  }
}

// =========================================================================
// B. 엑셀을 일부러 바꾼 시나리오
// =========================================================================
{
  const parsed = clone(parsed0);
  // parseExcelBuffer 결과의 Date 는 structuredClone 으로 유지됨
  const excelSlotCodes = new Set(parsed.slots.map((s) => s.code));
  const exSlotInExcel = exSlotsBase.filter(
    (s) => catIdsInExcel.has(s.categoryId) && excelSlotCodes.has(s.code)
  );

  // B1 — 연결 없는 구좌 행 삭제
  const freeSlot = exSlotInExcel.find(
    (s) => !sponsorSlotIds.has(s.id) && !packageSlotIds.has(s.id)
  );
  // B2 — 스폰서 확보 구좌 행 삭제
  const sponsorSlot = exSlotInExcel.find((s) => sponsorSlotIds.has(s.id) && s.id !== forcedSoldSlot?.id);
  parsed.slots = parsed.slots.filter((s) => s.code !== freeSlot?.code && s.code !== sponsorSlot?.code);

  // B3 — 매진인 스폰서 구좌를 엑셀에서 '판매 가능'으로
  const b3 = parsed.slots.find((s) => s.code === forcedSoldSlot?.code);
  if (b3) b3.isSold = false;

  // B4 — 소분류가 1개인 카테고리의 소분류 이름 변경
  const singleSubCat = parsed.categories.find((pc) => {
    const ps = parsed.subcategories.filter((s) => s.categoryCode === pc.code);
    const ex = exCatsBase.find((c) => c.code === pc.code);
    return ps.length === 1 && ex && exSubsBase.filter((s) => s.categoryId === ex.id).length === 1;
  });
  let renamedFrom = "";
  if (singleSubCat) {
    const ps = parsed.subcategories.find((s) => s.categoryCode === singleSubCat.code);
    renamedFrom = ps.nameKo;
    ps.nameKo = `${ps.nameKo || singleSubCat.nameKo}(변경)`;
    for (const sl of parsed.slots) {
      if (sl.categoryCode === singleSubCat.code && sl.subcategoryNameKo === renamedFrom) {
        sl.subcategoryNameKo = ps.nameKo;
      }
    }
  }

  // B5 — 신규 구좌 추가
  const hostSub = parsed.subcategories.find((s) => s.categoryCode !== singleSubCat?.code);
  if (hostSub) {
    parsed.slots.push({
      code: "TEST-NEW-1",
      categoryCode: hostSub.categoryCode,
      subcategoryNameKo: hostSub.nameKo,
      isSold: false,
      note: "",
    });
  }

  // B6 — 가격 변경 (운영 데이터에 같은 이름의 소분류가 있는 것 중에서 고름)
  const priceSub = parsed.subcategories.find((s) => {
    if (s.categoryCode === singleSubCat?.code) return false;
    const pc = parsed.categories.find((c) => c.code === s.categoryCode);
    const ex = exCatsBase.find((c) => c.code === s.categoryCode);
    if (!pc || !ex) return false;
    const effective = s.nameKo || pc.nameKo;
    return exSubsBase.some((x) => x.categoryId === ex.id && x.name?.ko === effective);
  });
  const priceSubExisting = priceSub
    ? exSubsBase.find((x) => {
        const ex = exCatsBase.find((c) => c.code === priceSub.categoryCode);
        const pc = parsed.categories.find((c) => c.code === priceSub.categoryCode);
        return x.categoryId === ex?.id && x.name?.ko === (priceSub.nameKo || pc?.nameKo);
      })
    : undefined;
  if (priceSub) priceSub.priceKRW = priceSub.priceKRW + 12345;

  // B7 — 다른 행사의 같은 코드 구좌가 입력에 섞여 들어옴
  const foreignTwin = otherEventSlots.find((s) => excelSlotCodes.has(s.code));
  const exSlotsWithForeign = foreignTwin
    ? [...exSlotsBase, { ...foreignTwin, id: "FOREIGN-TWIN" }]
    : exSlotsBase;

  const { plan, writesById, deleted } = run("B. 엑셀 일부 수정 시나리오", {
    ...base,
    exSlots: exSlotsWithForeign,
    parsed,
  });

  if (freeSlot) check(`B1 연결 없는 구좌(${freeSlot.code})를 엑셀에서 빼면 삭제`, deleted.has(`slots/${freeSlot.id}`));
  if (sponsorSlot)
    check(
      `B2 스폰서 확보 구좌(${sponsorSlot.code})는 엑셀에서 빼도 남김 + 경고`,
      !deleted.has(`slots/${sponsorSlot.id}`) &&
        plan.warnings.some((w) => w.includes(sponsorSlot.code) && w.includes("삭제하지 않음"))
    );
  if (b3 && forcedSoldSlot)
    check(
      `B3 매진 스폰서 구좌(${forcedSoldSlot.code})는 엑셀이 '판매 가능'이어도 매진 유지 + 경고`,
      writesById.get(`slots/${forcedSoldSlot.id}`)?.data.status === "sold" &&
        plan.warnings.some((w) => w.includes(forcedSoldSlot.code) && w.includes("유지"))
    );
  if (singleSubCat) {
    const ex = exCatsBase.find((c) => c.code === singleSubCat.code);
    const exSub = exSubsBase.find((s) => s.categoryId === ex.id);
    check(
      `B4 소분류 이름만 바꾸면 같은 소분류로 유지 (${singleSubCat.code})`,
      writesById.has(`subcategories/${exSub.id}`) &&
        !deleted.has(`subcategories/${exSub.id}`) &&
        plan.warnings.some((w) => w.includes("이름 변경"))
    );
  }
  if (hostSub) {
    const w = plan.writes.find((x) => x.col === "slots" && x.data.code === "TEST-NEW-1");
    check("B5 신규 구좌는 새 ID로 생성", w && w.id.startsWith("NEW-slots"));
  }
  if (priceSub && priceSubExisting) {
    const w = writesById.get(`subcategories/${priceSubExisting.id}`);
    check(
      `B6 가격 변경은 기존 소분류 ID 그대로 반영 (${priceSub.categoryCode} "${priceSubExisting.name.ko}")`,
      w && w.data.priceKRW === priceSub.priceKRW
    );
  } else {
    console.log("  (B6 생략 — 이름이 일치하는 소분류 없음)");
  }
  if (foreignTwin) {
    check(
      `B7 다른 행사(${OTHER_EVENT_ID}) 구좌 ${foreignTwin.code} 는 섞여 들어와도 건드리지 않음`,
      !writesById.has("slots/FOREIGN-TWIN") && !deleted.has("slots/FOREIGN-TWIN")
    );
  } else {
    console.log("  (B7 생략 — 다른 행사에 겹치는 코드 없음)");
  }
}

console.log(`\n결과: 통과 ${passes} · 실패 ${failures}`);
process.exit(failures > 0 ? 1 : 0);
