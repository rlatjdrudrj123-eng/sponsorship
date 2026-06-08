/**
 * KPRINT-2026 패키지의 includedItems[].labelEn 자동 보강.
 *
 * 옛 데이터는 it.label="등록 키오스크 1구좌" 식 한국어. it.labelEn 비어있음.
 * categoryId / subcategoryId / count 가 있는 항목은 카테고리·소분류 영문 이름을
 * 조합해서 labelEn 생성 (예: "Registration Kiosk · 1 slot").
 * 자동 매핑이 불가하면 KO 라벨을 영문 단위로 부분 치환.
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

// 카테고리·소분류 인덱스 로드
const cats = await fs.collection("categories").where("eventId", "==", EVENT_ID).get();
const catsById = new Map();
for (const d of cats.docs) catsById.set(d.id, { id: d.id, ...d.data() });

const subs = await fs.collection("subcategories").get();
const subsById = new Map();
for (const d of subs.docs) subsById.set(d.id, { id: d.id, ...d.data() });

function autoFixUnitKor(s) {
  if (!s) return s;
  return s
    .replace(/(\d+)\s*구좌/g, "$1 slot")
    .replace(/(\d+)\s*개/g, "$1")
    .replace(/(\d+)\s*회/g, "$1 send")
    .replace(/(\d+)\s*장/g, "$1 sheet");
}

const pkgs = await fs.collection("packages").where("eventId", "==", EVENT_ID).get();
let fixedCount = 0;
for (const d of pkgs.docs) {
  const p = d.data();
  if (!Array.isArray(p.includedItems)) continue;
  let dirty = false;
  const next = p.includedItems.map((it) => {
    if (it.labelEn && it.labelEn.trim() && !KOR.test(it.labelEn)) return it;
    // categoryId / subcategoryId / count 로 영문 라벨 합성
    const cat = it.categoryId ? catsById.get(it.categoryId) : null;
    const sub = it.subcategoryId ? subsById.get(it.subcategoryId) : null;
    let labelEn = "";
    if (cat) {
      const catEn = cat.name?.en?.trim() || cat.name?.ko || cat.code || "";
      const subEn = sub?.name?.en?.trim() || sub?.name?.ko || "";
      const unitEn =
        sub?.unit?.en?.trim() && !KOR.test(sub.unit.en)
          ? sub.unit.en
          : "slot";
      const count = it.count ?? 1;
      const parts = [catEn];
      if (subEn) parts.push(`(${subEn})`);
      parts.push(`· ${count} ${unitEn}`);
      labelEn = parts.join(" ");
    } else {
      // categoryId 없으면 KO 라벨에서 단위만 치환
      labelEn = autoFixUnitKor(it.label) || "";
    }
    if (labelEn && labelEn !== it.labelEn) {
      dirty = true;
      return { ...it, labelEn };
    }
    return it;
  });
  if (dirty) {
    await fs.collection("packages").doc(d.id).set({ includedItems: next }, { merge: true });
    console.log(`✓ [${p.code || d.id}] ${p.name?.ko ?? ""} — labelEn ${next.filter((x, i) => x.labelEn !== p.includedItems[i]?.labelEn).length} 개 보강`);
    fixedCount++;
  }
}
console.log(`\n총 ${fixedCount} 패키지 갱신`);
process.exit(0);
