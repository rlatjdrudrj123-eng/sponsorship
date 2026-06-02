/** ICN / DSS / INL 의 카테고리·소분류 데이터 덤프. */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";
const TARGETS = ["ICN", "DSS", "INL"];

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

for (const code of TARGETS) {
  const snap = await fs
    .collection("categories")
    .where("eventId", "==", EVENT_ID)
    .where("code", "==", code)
    .get();
  if (snap.empty) {
    console.log(`\n[${code}] 카테고리 없음`);
    continue;
  }
  const d = snap.docs[0];
  const c = d.data();
  console.log(`\n========== [${code}] ${c.name?.ko ?? "?"} ==========`);
  console.log("size       :", JSON.stringify(c.size));
  console.log("sizeEn     :", JSON.stringify(c.sizeEn));
  console.log("fileFormat :", JSON.stringify(c.fileFormat));
  console.log("fileFormatEn:", JSON.stringify(c.fileFormatEn));
  console.log("type       :", c.type);

  const subs = await fs
    .collection("subcategories")
    .where("categoryId", "==", d.id)
    .get();
  for (const sd of subs.docs) {
    const s = sd.data();
    console.log(`  ↳ sub [${s.code ?? sd.id}] name.ko=${JSON.stringify(s.name?.ko)} name.en=${JSON.stringify(s.name?.en)}`);
    console.log(`     priceNote   :`, JSON.stringify(s.priceNote));
    console.log(`     priceNoteEn :`, JSON.stringify(s.priceNoteEn));
    console.log(`     unit        :`, JSON.stringify(s.unit));
  }
}

process.exit(0);
