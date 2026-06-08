/**
 * KPRINT-2026 카테고리에 1분 진단 v3 매칭 데이터 시드.
 *  - goalAffinity: 카테고리 type + 이름 키워드 기반으로 4목표(Purpose) 점수 부여
 *  - synergyTargets: 같은 패키지에 포함된 카테고리들끼리 양방향 시너지 (단방향만 저장해도 진단 로직이 양쪽으로 처리)
 *
 * 어드민이 직접 /admin/categories/[id] 의 "1분 진단 매칭" 섹션에서 fine-tune 가능.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROJECT_ID = "kprint-845c3";
const EVENT_ID = "kprint-2026";

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);

// type → 기본 친화도 벡터 (0~3) — Purpose 3개: new_product / traffic_driver / brand_awareness
const TYPE_AFFINITY = {
  // 도면형 (천장 배너, 라이팅월, 등록데스크) — 부스 동선 강력
  floor_plan: { new_product: 1, traffic_driver: 3, brand_awareness: 2 },
  // 수량형 (목걸이, 초대장 삽지) — 노출 시간 길어 인지도 강
  quantity: { new_product: 1, traffic_driver: 1, brand_awareness: 3 },
  // 미디어형 (LED 영상) — 시각 임팩트 → 인지도 + 신제품 시각화
  media: { new_product: 2, traffic_driver: 2, brand_awareness: 3 },
  // 디지털 배너 — 사전 검색 노출 → 신제품 인지
  digital_banner: { new_product: 3, traffic_driver: 1, brand_awareness: 1 },
  // 발송형 (뉴스레터, 푸시, 사전등록 메일) — 사전 신제품 알림
  mailing: { new_product: 3, traffic_driver: 1, brand_awareness: 1 },
  // 지면형 (가이드북) — 브랜드 인지
  print_page: { new_product: 1, traffic_driver: 1, brand_awareness: 2 },
  // 콘텐츠형 (인터뷰, SNS, 카드뉴스) — 신제품 인지 + 브랜드
  content: { new_product: 3, traffic_driver: 0, brand_awareness: 2 },
  // X-Pace (옥외 하이브리드)
  xpace: { new_product: 1, traffic_driver: 2, brand_awareness: 3 },
};

/** 키워드별 추가 가산 (이름·코드·태그에 포함되면 +). */
const KEYWORD_BUMPS = [
  // 세미나·발표 → new_product +1 (신제품 발표 채널)
  { re: /세미나|seminar|발표/i, key: "new_product", bump: 1 },
  // 인터뷰 → new_product 이미 max 이므로 brand 가산
  { re: /인터뷰|interview/i, key: "brand_awareness", bump: 1 },
];

function clamp(v) {
  return Math.max(0, Math.min(3, v));
}

function inferAffinity(cat) {
  let base = TYPE_AFFINITY[cat.type];
  if (!base) {
    // 어드민이 만든 커스텀 type 처리 — 이름으로 mailing vs content 분기
    const name = `${cat.code ?? ""} ${cat.name?.ko ?? ""} ${cat.name?.en ?? ""}`.toLowerCase();
    if (/뉴스레터|newsletter|이메일|email|메일|mail|초대장|invitation|푸시|push/.test(name)) {
      console.log(`  · [${cat.code}] type="${cat.type}" → mailing 매핑 (이름 기반)`);
      base = TYPE_AFFINITY.mailing;
    } else if (/인터뷰|interview|sns|카드뉴스|card|콘텐츠|content|영상|video|블로그|blog/.test(name)) {
      console.log(`  · [${cat.code}] type="${cat.type}" → content 매핑 (이름 기반)`);
      base = TYPE_AFFINITY.content;
    } else {
      console.log(`  ! [${cat.code}] type="${cat.type}" — 이름 매핑 실패, brand_awareness:1 폴백`);
      base = { traffic_driver: 0, brand_awareness: 1, buyer_reach: 0, post_asset: 0 };
    }
  }
  const result = { ...base };
  const hay = `${cat.code ?? ""} ${cat.name?.ko ?? ""} ${cat.name?.en ?? ""} ${(cat.tags ?? []).join(" ")} ${cat.selectorId ?? ""}`;
  for (const b of KEYWORD_BUMPS) {
    if (b.re.test(hay)) {
      result[b.key] = clamp((result[b.key] ?? 0) + b.bump);
    }
  }
  // 0 인 키는 저장 안 함 — 도큐먼트 클린
  const out = {};
  for (const k of Object.keys(result)) {
    if (result[k] > 0) out[k] = result[k];
  }
  return out;
}

// 1) categories 로드
const catsSnap = await fs
  .collection("categories")
  .where("eventId", "==", EVENT_ID)
  .get();
const cats = catsSnap.docs.map((d) => ({ ...(d.data()), id: d.id }));
console.log(`카테고리 ${cats.length}개 로드`);

// 2) packages 로드 — 시너지 페어 추론용
const pkgsSnap = await fs
  .collection("packages")
  .where("eventId", "==", EVENT_ID)
  .get();
const pkgs = pkgsSnap.docs.map((d) => ({ ...(d.data()), id: d.id }));
console.log(`패키지 ${pkgs.length}개 로드`);

// 패키지별 categoryId 묶음 → 같은 패키지에 묶이면 양방향 시너지
const synergyMap = new Map(); // categoryId → Set<categoryId>
for (const pkg of pkgs) {
  const ids = (pkg.includedItems ?? [])
    .map((it) => it.categoryId)
    .filter(Boolean);
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      if (!synergyMap.has(a)) synergyMap.set(a, new Set());
      synergyMap.get(a).add(b);
    }
  }
}

let updated = 0;
let skipped = 0;
for (const cat of cats) {
  // 패키지 타입 카테고리는 진단 후보 아님 — 시드 스킵
  if (cat.channel === "package" || cat.type === "package") {
    skipped++;
    continue;
  }
  const affinity = inferAffinity(cat);
  const synergy = synergyMap.has(cat.id)
    ? Array.from(synergyMap.get(cat.id))
    : [];

  const patch = {};
  if (affinity && Object.keys(affinity).length > 0) {
    // Firestore merge 가 중첩 객체를 재귀 merge — 옛 키(buyer_reach/post_asset)
    // 가 남아있을 수 있으니 명시 삭제 후 새 값 채움.
    const fullAffinity = {
      new_product: affinity.new_product ?? FieldValue.delete(),
      traffic_driver: affinity.traffic_driver ?? FieldValue.delete(),
      brand_awareness: affinity.brand_awareness ?? FieldValue.delete(),
      buyer_reach: FieldValue.delete(),
      post_asset: FieldValue.delete(),
    };
    patch.goalAffinity = fullAffinity;
  }
  if (synergy.length > 0) {
    patch.synergyTargets = synergy;
  }

  if (Object.keys(patch).length === 0) {
    skipped++;
    continue;
  }

  await fs.collection("categories").doc(cat.id).set(patch, { merge: true });
  const summary = Object.entries(affinity ?? {})
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  console.log(
    `✓ [${cat.code}] ${cat.name?.ko ?? ""} — ${summary}${synergy.length > 0 ? ` · syn:${synergy.length}` : ""}`
  );
  updated++;
}

console.log(`\n총 ${updated}개 카테고리 갱신, ${skipped}개 skip (패키지/매칭 불가)`);
process.exit(0);
