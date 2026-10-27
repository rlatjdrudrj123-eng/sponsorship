/**
 * KIMES 2026 시드 데이터 → KIMES 2027 판매용으로 갱신.
 * 먼저 renameEventSlug.mjs --from kimes-2026 --to kimes-2027 로 URL 을 옮긴 뒤 실행.
 *
 *  - 행사명·연도·일정(2027.3.18~21, kimes.kr 기준)·견적서(제42회, KMS27-)
 *  - 제출 마감은 2026 과 같은 월일에 연도만 +1 (2027 확정 일정 받으면 어드민에서 수정)
 *  - 문구 속 2026 일정 제거·교체 (XPACE 노출 기간, APP 푸시, 인터뷰 마감)
 *  - 상품 사진을 잘리지 않는 2:1 버전으로 교체, 신청 절차 슬라이드(7쪽) 마감 연도 교체
 *  - 교체된 옛 이미지는 Firestore 커밋 후 Storage 에서 삭제 (이 행사 경로의 파일만)
 *
 * 사용:
 *   node scripts/updateKimes2027.mjs <assetsDir> --dry
 *   node scripts/updateKimes2027.mjs <assetsDir> --confirm
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const PROJECT_ID = "kprint-845c3";
const BUCKET = "kprint-845c3.firebasestorage.app";
const EID = "kimes-2027";

const args = process.argv.slice(2);
const ASSETS = args.find((a) => !a.startsWith("--"));
const DRY = args.includes("--dry");
const CONFIRM = args.includes("--confirm");
if (!ASSETS || (!DRY && !CONFIRM)) {
  console.error("사용: node scripts/updateKimes2027.mjs <assetsDir> --dry | --confirm");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(path.join(ASSETS, "manifest.json"), "utf8"));

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);
fs.settings({ ignoreUndefinedProperties: true });
const bucket = getStorage(app).bucket(BUCKET);

console.log(`\n${DRY ? "[DRY-RUN]" : "[LIVE]"} ${EID} → KIMES 2027 갱신`);
console.log("=".repeat(60));

const ev = await fs.collection("events").doc(EID).get();
if (!ev.exists) {
  console.error(`✗ events/${EID} 없음 — renameEventSlug.mjs 먼저 실행`);
  process.exit(1);
}

const now = Timestamp.now();
const day = (s) => Timestamp.fromDate(new Date(`${s}T00:00:00Z`));
const plusYear = (ts) => {
  const d = ts.toDate();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return Timestamp.fromDate(d);
};
const storagePathOf = (url) => decodeURIComponent(url.split("/o/")[1].split("?")[0]);

const uploads = [];
const oldFiles = [];
function queueUpload(localRel, destDir, assign) {
  const local = path.join(ASSETS, localRel);
  if (!existsSync(local)) throw new Error(`이미지 없음: ${local}`);
  uploads.push({ local, dest: `${destDir}/${randomUUID()}_${path.basename(localRel)}`, assign });
}

// ── categories: 마감 연도, 2026 문구, 사진 ──
const TEXT = {
  XPA: {
    shortDesc: "월평균 120만명 유동인구 대상 디지털 사이니지, 7일간 노출, 영상은 참가업체 직접 제작",
    shortDescEn: "Digital signage reaching 1.2M visitors per month, displayed for 7 days, video provided by exhibitor",
  },
  APP: {
    shortDesc: "KIMES 공식 어플리케이션 푸시 알림(발송 일정 협의), KIMES 2027에서 진행되는 세미나, 이벤트 등 프로그램 홍보에 한정",
    shortDescEn: "Push notification via the KIMES official app (schedule coordinated), limited to promoting KIMES 2027 seminars, events and programs",
  },
};

const cats = await fs.collection("categories").where("eventId", "==", EID).get();
const catUpdates = [];
for (const d of cats.docs) {
  const c = d.data();
  const patch = { updatedAt: now, ...(TEXT[c.code] ?? {}) };
  if (c.deadline) patch.deadline = plusYear(c.deadline);
  const images = (c.heroImages?.images ?? []).map((img) => ({ ...img }));
  images.forEach((img) => {
    const asset = path.basename(img.storagePath, ".webp").split("_").slice(1).join("_");
    if (!manifest.hero[asset]) throw new Error(`[${c.code}] 사진 매칭 실패: ${img.storagePath}`);
    oldFiles.push(img.storagePath);
    queueUpload(manifest.hero[asset].file, `categories/${d.id}/hero`, (r) => Object.assign(img, r));
  });
  patch.heroImages = { ...c.heroImages, images };
  catUpdates.push({ ref: d.ref, code: c.code, patch, from: c.deadline?.toDate().toISOString().slice(0, 10) });
}

// ── subcategories: 인터뷰 마감 문구 ──
const subs = await fs.collection("subcategories").where("eventId", "==", EID).get();
const subUpdates = [];
for (const d of subs.docs) {
  const s = d.data();
  if (s.priceNote?.includes("2026") || s.priceNoteEn?.includes("2026")) {
    subUpdates.push({
      ref: d.ref,
      patch: {
        priceNote: s.priceNote?.replace("2026", "2027"),
        priceNoteEn: s.priceNoteEn?.replace("2026", "2027"),
      },
      label: s.name.ko,
    });
  }
}

// ── siteSettings: 행사 정보, 신청 절차 슬라이드 ──
const settingsRef = fs.collection("siteSettings").doc(EID);
const settings = (await settingsRef.get()).data();
const landing = settings.landing.map((b) => structuredClone(b));
const landingEn = settings.landingEn.map((b) => structuredClone(b));
for (const [blocks, lang] of [[landing, "ko"], [landingEn, "en"]]) {
  const file = `landing/${lang}_p07.webp`;
  const block = blocks.find((b) => b.data?.page?.name === `${lang}_p07`);
  if (!block || !manifest.landing[lang].includes(file)) throw new Error(`${lang} 신청 절차 슬라이드 없음`);
  oldFiles.push(storagePathOf(block.data.page.bgImageUrl));
  queueUpload(file, "landing/canvas-page-bg", (r) => {
    block.data.page.bgImageUrl = r.url;
  });
}
const settingsPatch = {
  event: {
    ...settings.event,
    nameKo: "KIMES 2027",
    nameEn: "KIMES 2027",
    dateRange: "2027년 3월 18일(목) ~ 21일(일)",
    dateRangeEn: "Mar 18 (Thu) ~ 21 (Sun), 2027",
    applicationDeadline: day("2027-02-28"),
  },
  landing,
  landingEn,
  updatedAt: now,
};

const quotePatch = {
  eventSubtitle: "제42회 국제의료기기+병원설비전시회",
  eventIntro:
    "오는 2027년 3월 18일부터 21일까지 서울 COEX 전시장에서 개최되는 KIMES 2027 전시회의 참가에 관하여, 다음과 같이 제안하오니 검토해주시기 바랍니다.",
  serialPrefix: "KMS27-",
  updatedAt: now,
};

console.log(`\n  events/${EID}: name KIMES 2027, year 2027`);
console.log(`  siteSettings: ${settingsPatch.event.dateRange}, 입금 마감 2027-02-28, 신청 절차 슬라이드 국/영 교체`);
console.log(`  quoteSettings: ${quotePatch.eventSubtitle}, ${quotePatch.serialPrefix}`);
for (const u of catUpdates) {
  const to = u.patch.deadline?.toDate().toISOString().slice(0, 10);
  console.log(`  [${u.code}] 마감 ${u.from ?? "-"} → ${to ?? "-"}, 사진 ${u.patch.heroImages.images.length}장${TEXT[u.code] ? ", 문구 교체" : ""}`);
}
for (const u of subUpdates) console.log(`  소분류 ${u.label}: ${u.patch.priceNote}`);
console.log(`  업로드 ${uploads.length}건, 옛 파일 삭제 ${oldFiles.length}건`);

if (DRY) {
  console.log("\n✓ Dry-run 완료. 실제 실행하려면 --confirm 으로 재실행.");
  process.exit(0);
}

console.log("\n[1] 이미지 업로드");
for (const u of uploads) {
  const token = randomUUID();
  await bucket.upload(u.local, {
    destination: u.dest,
    metadata: { contentType: "image/webp", metadata: { firebaseStorageDownloadTokens: token } },
  });
  u.assign({
    url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(u.dest)}?alt=media&token=${token}`,
    storagePath: u.dest,
  });
}
console.log(`    ${uploads.length}건 완료`);

console.log("\n[2] Firestore 쓰기 (단일 batch)");
const batch = fs.batch();
batch.update(ev.ref, { name: "KIMES 2027", year: 2027, updatedAt: now });
for (const u of catUpdates) batch.update(u.ref, u.patch);
for (const u of subUpdates) batch.update(u.ref, u.patch);
batch.update(settingsRef, settingsPatch);
batch.update(fs.collection("quoteSettings").doc(EID), quotePatch);
await batch.commit();
console.log("    완료");

console.log("\n[3] 옛 이미지 삭제");
let deleted = 0;
for (const p of oldFiles) {
  await bucket.file(p).delete({ ignoreNotFound: true });
  deleted++;
}
console.log(`    ${deleted}건 삭제`);

console.log("\n" + "=".repeat(60));
console.log(`✓ 완료. 공개 페이지: /${EID}  /${EID}/sponsorships  /${EID}/en`);
process.exit(0);
