/**
 * Subcategory.priceNote 정정:
 * "제작설치비 포함" 문구가 들어간 priceNote 들을 "부가세 별도" 로만 변경.
 * 사유: 일부 매체는 제작/설치비 미포함이라 "포함" 문구가 거짓 정보가 됨.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";

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

const REPLACE_FROM = /제작\s*[·]?\s*설치비\s*포함\s*[,，]?\s*/g;

const snap = await fs.collection("subcategories").get();
let fixed = 0;
let checked = 0;
for (const d of snap.docs) {
  const s = d.data();
  checked++;
  let dirty = false;

  // priceNote (KO)
  if (s.priceNote && REPLACE_FROM.test(s.priceNote)) {
    const next = s.priceNote.replace(REPLACE_FROM, "").trim();
    const cleaned = next || "부가세 별도";
    await fs.collection("subcategories").doc(d.id).update({ priceNote: cleaned });
    console.log(`✓ [${s.code ?? d.id}] priceNote: "${s.priceNote}" → "${cleaned}"`);
    dirty = true;
    REPLACE_FROM.lastIndex = 0;
  }

  // priceNoteEn (영문 변형)
  if (
    s.priceNoteEn &&
    /production\s*&?\s*install|install\s*included|incl\.?\s*install/i.test(
      s.priceNoteEn
    )
  ) {
    const cleaned = "VAT excluded";
    await fs.collection("subcategories").doc(d.id).update({
      priceNoteEn: cleaned,
    });
    console.log(`✓ [${s.code ?? d.id}] priceNoteEn: "${s.priceNoteEn}" → "${cleaned}"`);
    dirty = true;
  }

  if (dirty) fixed++;
}

console.log(`\n총 ${checked}개 sub 점검, ${fixed}개 정정`);
process.exit(0);
