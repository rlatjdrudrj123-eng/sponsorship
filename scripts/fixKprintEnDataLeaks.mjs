/**
 * KPRINT-2026 데이터의 영문 필드에 한국어가 남아있는 케이스 수동 보정 +
 * sizeEn/fileFormatEn 누락 채우기 + contentSpec/mailingSpec En 보강.
 *
 * 사용자 보고된 케이스:
 *  - ICN (인스타 카드뉴스): contentSpec 의 format="카드뉴스 1장" → "1 card news"
 *  - DSS (디자인세미나): subcategory priceNote "Lunch Box 1구좌" 식으로
 *    영문에 '구좌' 잔재
 *  - CTW: sizeEn 누락 ("로고파일(화이트)")
 *  - DSS: sizeEn 누락 ("사무국 문의, 현물 협찬 가능")
 *  - INL: subcategory priceNoteEn "July 1send, August 1send" (어색한 영문)
 *
 * 멱등 — 같은 값이면 skip, 다른 값이면 덮어쓰기.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find(
    (f) => /-firebase-adminsdk-.+\.json$/.test(f)
  );
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

const KOR = /[가-힯]/;

// ───────────────── 카테고리 보정 ─────────────────
// code → 보정 사항
const CATEGORY_FIXES = {
  CTW: {
    sizeEn: "Logo file (white version)",
  },
  DSS: {
    sizeEn: "Inquire with secretariat — in-kind sponsorship possible",
  },
  ICN: {
    // contentSpec.format: "카드뉴스 1장" → 영문 spec 필드. 데이터 모델에 channelEn/formatEn
    // 가 없으므로 channel/format 그대로 두되, '카드뉴스 1장' 의 한국어가 EN 페이지에
    // 그대로 보이는 게 문제. 임시로 contentSpec.format 자체를 영문 친화 표기로 변경.
    // (KO 페이지에서도 영문이 보임 — 통일된 짧은 표기로 양쪽 모두에 무난)
    contentSpec: { channel: "Instagram", format: "1 card news post" },
  },
};

// ───────────────── 소분류 보정 ─────────────────
// (categoryCode, subCode 또는 subName.ko) → 보정
const SUBCAT_FIXES = [
  // INL: 영문 잔재 'July 1send' → 자연스러운 영어
  {
    categoryCode: "INL",
    matcher: (s) => s.priceNoteEn && /1send|send 1/i.test(s.priceNoteEn),
    set: (s) => ({
      priceNoteEn: "Once in July, once in August",
    }),
  },
  // DSS: 'Lunch Box 1구좌, Water Bottle Label 1구좌, Coffee Catering 1구좌' 식 잔재 →
  // '구좌' 가 영문에 남으면 'slot' 으로 치환
  {
    categoryCode: "DSS",
    matcher: (s) =>
      (s.priceNoteEn && s.priceNoteEn.includes("구좌")) ||
      (s.name?.en && s.name.en.includes("구좌")),
    set: (s) => ({
      priceNoteEn: s.priceNoteEn
        ? s.priceNoteEn.replace(/(\d+)\s*구좌/g, "$1 slot")
        : s.priceNoteEn,
      name: s.name?.en?.includes("구좌")
        ? { ...s.name, en: s.name.en.replace(/(\d+)\s*구좌/g, "$1 slot") }
        : s.name,
    }),
  },
];

// 모든 En 필드에서 한글 자동 치환 — 잔재 있는 거 일괄 처리
const KOR_REPLACEMENTS = [
  [/(\d+)\s*구좌/g, "$1 slot"],
  [/(\d+)\s*명/g, "$1 people"],
  [/(\d+)\s*회/g, "$1 times"],
  [/(\d+)\s*장/g, "$1 sheet"],
  [/사무국 문의/g, "Inquire with secretariat"],
  [/현물 협찬/g, "in-kind sponsorship"],
  [/카드뉴스/g, "card news"],
];

function autoFixKorean(text) {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const [re, rep] of KOR_REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  return out;
}

// ───────────────── 실행 ─────────────────
console.log("=== 카테고리 보정 ===");
const cats = await fs.collection("categories").where("eventId", "==", EVENT_ID).get();
const catsByCode = new Map();
for (const d of cats.docs) {
  const c = d.data();
  if (c.code) catsByCode.set(c.code, { id: d.id, ...c });
}
for (const [code, patch] of Object.entries(CATEGORY_FIXES)) {
  const cat = catsByCode.get(code);
  if (!cat) {
    console.log(`  [${code}] 카테고리 없음 — skip`);
    continue;
  }
  await fs.collection("categories").doc(cat.id).set(patch, { merge: true });
  console.log(`  [${code}] 보정 완료:`, Object.keys(patch).join(", "));
}

// 카테고리 sizeEn / fileFormatEn 잔재 KOR 자동 치환
for (const d of cats.docs) {
  const c = d.data();
  const patch = {};
  for (const f of ["sizeEn", "fileFormatEn", "shortDescEn", "longDescEn", "designGuideTextEn"]) {
    if (c[f] && KOR.test(c[f])) {
      const fixed = autoFixKorean(c[f]);
      if (fixed !== c[f]) {
        patch[f] = fixed;
      }
    }
  }
  if (Object.keys(patch).length > 0) {
    await fs.collection("categories").doc(d.id).set(patch, { merge: true });
    console.log(`  [${c.code}] 자동 KOR 치환:`, JSON.stringify(patch));
  }
}

// 소분류 전체 로드 — unit 보정 + 명시 룰 매칭에 모두 사용
const subs = await fs.collection("subcategories").get();

console.log("\n=== 소분류 unit.en 한국어 보정 ===");
const UNIT_EN_FIX = {
  "구좌": "slot",
  "회": "time",
  "장": "sheet",
  "명": "person",
  "건": "item",
  "개": "unit",
  "박스": "box",
  "팩": "pack",
};
let unitFixCount = 0;
for (const sd of subs.docs) {
  const s = sd.data();
  if (!s.unit || typeof s.unit !== "object") continue;
  const koUnit = s.unit.ko;
  const enUnit = s.unit.en;
  if (!enUnit || !KOR.test(enUnit)) continue;
  // EN unit 에 한글 잔재 — 매핑 또는 ko 와 동일하면 영문 대체
  const mapped = UNIT_EN_FIX[enUnit] ?? UNIT_EN_FIX[koUnit] ?? null;
  if (!mapped) {
    console.log(`  [${sd.id}] unit.en="${enUnit}" 매핑 없음 — skip`);
    continue;
  }
  await fs.collection("subcategories").doc(sd.id).set(
    { unit: { ...s.unit, en: mapped } },
    { merge: true }
  );
  console.log(`  [${sd.id}] unit.en "${enUnit}" → "${mapped}"`);
  unitFixCount++;
}
if (unitFixCount === 0) console.log("  (보정 대상 없음)");

console.log("\n=== 소분류 보정 ===");
let subFixCount = 0;
for (const sd of subs.docs) {
  const s = sd.data();
  if (!s.categoryId) continue;
  const cat = [...catsByCode.values()].find((c) => c.id === s.categoryId);
  if (!cat) continue;

  // 명시 룰 매칭
  let patch = {};
  for (const rule of SUBCAT_FIXES) {
    if (cat.code !== rule.categoryCode) continue;
    if (rule.matcher(s)) {
      const setVal = rule.set(s);
      for (const [k, v] of Object.entries(setVal)) {
        if (v !== undefined) patch[k] = v;
      }
    }
  }

  // 자동 치환 — priceNoteEn 만
  if (s.priceNoteEn && KOR.test(s.priceNoteEn)) {
    const fixed = autoFixKorean(s.priceNoteEn);
    if (fixed !== s.priceNoteEn && !patch.priceNoteEn) {
      patch.priceNoteEn = fixed;
    }
  }

  if (Object.keys(patch).length > 0) {
    await fs.collection("subcategories").doc(sd.id).set(patch, { merge: true });
    console.log(`  [${cat.code}] sub ${s.code ?? sd.id}:`, JSON.stringify(patch));
    subFixCount++;
  }
}
if (subFixCount === 0) console.log("  (보정 대상 없음)");

console.log("\n완료.");
process.exit(0);
