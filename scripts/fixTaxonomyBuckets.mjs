/**
 * KPRINT taxonomy.locationBuckets / timingBuckets / mediaBuckets 의 label 이
 * 한국어로 들어있는 경우 → 영문 자동 매핑 OR 사전 매핑으로 정리.
 *
 * 현재 사이트는 locationBuckets.label 단일 string 만 사용 → EN 페이지에서 한국어
 * 그대로 보임. 차선책: 자주 쓰이는 한국어 → 영문 매핑 테이블로 자동 치환.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

// id → 영문 라벨 매핑. ID 가 영문이거나 KO 라벨일 수 있음.
const LOC_EN_BY_ID = {
  hall_a: "Hall A",
  hall_b: "Hall B",
  hall_c: "Hall C",
  hall_d: "Hall D",
  outdoor: "Outdoor",
  online: "Online",
  indoor: "Inside venue",
  lobby: "Venue lobby",
};
const KOR_FALLBACK = {
  "전시장 내부": "Inside venue",
  "전시장 로비": "Venue lobby",
  "옥외": "Outdoor",
  "온라인": "Online",
};

// taxonomy 문서들 — eventId 별
const taxs = await fs.collection("taxonomy").get();
console.log(`taxonomies: ${taxs.size}`);
let updateCount = 0;
for (const d of taxs.docs) {
  const t = d.data();
  let dirty = false;
  for (const key of ["locationBuckets", "timingBuckets", "mediaBuckets"]) {
    const arr = t[key];
    if (!Array.isArray(arr)) continue;
    const next = arr.map((b) => {
      if (!b?.label) return b;
      // 이미 영문이면 skip
      if (!/[가-힯]/.test(b.label)) return b;
      const en = LOC_EN_BY_ID[b.id] || KOR_FALLBACK[b.label.trim()] || b.label;
      if (en !== b.label) {
        dirty = true;
        return { ...b, label: en };
      }
      return b;
    });
    if (dirty) t[key] = next;
  }
  if (dirty) {
    await fs.collection("taxonomy").doc(d.id).set(t);
    console.log(`✓ ${d.id} 갱신`);
    updateCount++;
  }
}
console.log(`\n총 ${updateCount} 갱신`);
process.exit(0);
