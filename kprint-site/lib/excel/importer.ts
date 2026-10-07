/**
 * 엑셀 임포트 → Firestore 동기화.
 *
 * 모드 3종:
 *   - overwrite: 엑셀에 들어온 카테고리를 엑셀 기준으로 맞춘다. 기존 카테고리·소분류·
 *     구좌는 코드·이름으로 찾아 ID 를 그대로 쓰고(스폰서 확보 구좌·도면 핀·패키지
 *     구성 연결 유지), 엑셀에 없는 필드(진단 점수·페르소나·시너지·이미지·도면 등)는
 *     보존한다. 엑셀에서 빠진 소분류·구좌만 삭제하되, 스폰서·패키지·도면 핀에 연결된
 *     구좌는 남기고 경고한다. 계산은 importPlan.planOverwrite (순수 함수) 가 한다.
 *   - merge: 같은 (cat_code, slot_code) 슬롯의 가격·마감·사이즈만 갱신. 신규는 추가.
 *   - add_only: 기존 코드 무시, 새 코드만 추가.
 *
 * 외부 API:
 *   importParsedData(parseResult, mode, uploadedBy, fileName, fileSize, eventId, onProgress)
 *
 * 정책:
 *   1) slug = name_en kebab-case + 충돌 시 -2/-3
 *   2) order = 등장 순서. 기존은 보존, 신규는 max+1...
 *   3) isPublished 신규는 false. 기존은 보존.
 *   4) deadline 없으면 null.
 *   5) taxonomy에 없는 태그는 warning만 남기고 그대로 저장.
 *   6) 모든 조회는 이 행사(eventId) 범위 — 행사 복제로 코드가 겹쳐도 다른 행사를 건드리지 않음.
 *   7) 스폰서가 확보한 구좌는 엑셀이 '판매 가능' 이어도 매진을 풀지 않음 (이중판매 방지).
 *   8) overwrite 는 쓰기를 먼저, 삭제를 나중에 커밋 — 중간 실패 시 데이터가 사라지지 않게.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  query,
  Timestamp,
  where,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from "firebase/firestore";
import { getDb } from "../firebase/firestore";
import type { ImportHistory, Taxonomy } from "../types";
import type { ParseResult } from "./parser";
import {
  buildCategory,
  buildSlot,
  buildSubcategory,
  collectPackageSlotIds,
  collectSponsorSlotIds,
  nz,
  pickUniqueSlug,
  planOverwrite,
  resolveSlotStatus,
  unknownTagsWarning,
  type BuildContext,
  type ExistingCategory,
  type ExistingSlot,
  type ExistingSubcategory,
  type PlanCollection,
  type TimeDeps,
} from "./importPlan";

// ============================================================================
// Public types
// ============================================================================

export type ImportMode = "overwrite" | "merge" | "add_only";

export type ImportPhase = "preserve" | "delete" | "write" | "history";

export type ImportProgress = (
  phase: ImportPhase,
  current: number,
  total: number
) => void;

export type ImportError = {
  phase: ImportPhase | "init";
  reason: string;
};

export type ImportCounts = {
  categoriesCreated: number;
  categoriesUpdated: number;
  subcategoriesWritten: number;
  slotsWritten: number;
  slotsDeleted: number;
  /** overwrite — 엑셀에서 빠진 소분류 삭제 수 */
  subcategoriesDeleted?: number;
  /** overwrite — 엑셀에서 빠졌지만 연결돼 있어 남겨둔 구좌 */
  slotsKeptReferenced?: number;
  /** 엑셀은 판매 가능이지만 스폰서 확보 구좌라 매진 유지 */
  slotsSoldKept?: number;
};

export type ImportResult = {
  importHistoryId: string;
  counts: ImportCounts;
  errors: ImportError[];
  /** 진행은 됐지만 확인이 필요한 사항 (보호한 구좌, 이름 변경 처리, 태그 등) */
  warnings: string[];
};

// ============================================================================
// Constants
// ============================================================================

const COL_CATEGORIES = "categories";
const COL_SUBCATEGORIES = "subcategories";
const COL_SLOTS = "slots";
const COL_SPONSORS = "sponsors";
const COL_PACKAGES = "packages";
const COL_TAXONOMY = "taxonomy";
const COL_IMPORT_HISTORY = "importHistory";
const TAXONOMY_FALLBACK_DOC_ID = "main";

const FIRESTORE_BATCH_LIMIT = 500;

const TIME: TimeDeps = {
  now: () => Timestamp.fromDate(new Date()),
  fromDate: (d: Date) => Timestamp.fromDate(d),
};

const EMPTY_COUNTS: ImportCounts = {
  categoriesCreated: 0,
  categoriesUpdated: 0,
  subcategoriesWritten: 0,
  slotsWritten: 0,
  slotsDeleted: 0,
};

function nowTs(): Timestamp {
  return TIME.now();
}

// ============================================================================
// Existing-state fetch — 전부 이 행사(eventId) 범위
// ============================================================================

type ExistingState = {
  categoriesByCode: Map<string, ExistingCategory>;
  categories: ExistingCategory[];
  slugsInUse: Set<string>;
  maxOrder: number;
};

async function fetchExistingCategories(eventId: string): Promise<ExistingState> {
  // ⚠️ eventId 필터 필수 — 없으면 다른 행사의 같은 code 카테고리를 "preserved"
  // 로 매칭해서 import 가 그 행사 데이터를 덮어쓰는 데이터 손실 버그 발생.
  const snap = await getDocs(
    query(collection(getDb(), COL_CATEGORIES), where("eventId", "==", eventId))
  );
  const byCode = new Map<string, ExistingCategory>();
  const categories: ExistingCategory[] = [];
  const slugs = new Set<string>();
  let maxOrder = -1;
  snap.forEach((d) => {
    const cat = { ...(d.data() as ExistingCategory), id: d.id };
    categories.push(cat);
    byCode.set(cat.code, cat);
    if (cat.slug) slugs.add(cat.slug);
    if (typeof cat.order === "number" && cat.order > maxOrder) {
      maxOrder = cat.order;
    }
  });
  return { categoriesByCode: byCode, categories, slugsInUse: slugs, maxOrder };
}

async function fetchEventDocs<T>(col: string, eventId: string): Promise<T[]> {
  const snap = await getDocs(
    query(collection(getDb(), col), where("eventId", "==", eventId))
  );
  return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
}

async function fetchSubcategoriesByCategoryId(
  categoryId: string
): Promise<ExistingSubcategory[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), COL_SUBCATEGORIES),
      where("categoryId", "==", categoryId)
    )
  );
  return snap.docs.map((d) => ({ ...(d.data() as ExistingSubcategory), id: d.id }));
}

/**
 * 이 행사에서 코드가 같은 구좌.
 * ⚠️ eventId 필터 필수 — 행사 복제로 다른 행사에 같은 코드(RGA-1-1 등)가 있으면
 *    예전에는 그 행사의 구좌를 수정(merge)하거나 생성을 건너뛰었다(add_only).
 */
async function fetchSlotByCode(
  code: string,
  eventId: string
): Promise<ExistingSlot | null> {
  const snap = await getDocs(
    query(
      collection(getDb(), COL_SLOTS),
      where("eventId", "==", eventId),
      where("code", "==", code),
      fsLimit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...(d.data() as ExistingSlot), id: d.id };
}

/** 행사별 태그 목록 (없으면 공용 main 폴백). */
async function fetchKnownTagIds(eventId: string): Promise<Set<string>> {
  for (const id of [eventId, TAXONOMY_FALLBACK_DOC_ID]) {
    try {
      const snap = await getDoc(doc(getDb(), COL_TAXONOMY, id));
      if (!snap.exists()) continue;
      const data = snap.data() as Taxonomy;
      return new Set((data.tags ?? []).map((t) => t.id));
    } catch {
      // 다음 후보로
    }
  }
  return new Set();
}

/** 이 행사 스폰서가 확보한 구좌 — 조회 실패하면 보호를 못 하므로 임포트를 중단한다. */
async function fetchSponsorSlotIds(eventId: string): Promise<Set<string>> {
  const sponsors = await fetchEventDocs<{
    items?: Array<{ slotId?: string; allocatedSlotIds?: string[] }>;
  }>(COL_SPONSORS, eventId);
  return collectSponsorSlotIds(sponsors);
}

async function fetchPackageSlotIds(eventId: string): Promise<Set<string>> {
  const packages = await fetchEventDocs<{
    includedItems?: Array<{ referencedSlotIds?: string[] }>;
  }>(COL_PACKAGES, eventId);
  return collectPackageSlotIds(packages);
}

// ============================================================================
// Batch commit helper
// ============================================================================

type WriteOp =
  | { kind: "set"; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: "update"; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: "delete"; ref: DocumentReference };

// 담당자 권한 규칙은 쓰기마다 members 문서를 get() 한다. 일괄 쓰기 1건당 문서 조회
// 한도(20)는 같은 문서 재조회가 캐시되면 문제없지만, 혹시 한도에 걸려 거부되면
// (실패한 batch 는 하나도 반영되지 않으므로) 작은 묶음으로 나눠 다시 시도한다.
const FALLBACK_BATCH_SIZE = 15;

async function commitChunk(chunk: WriteOp[]): Promise<void> {
  const batch: WriteBatch = writeBatch(getDb());
  for (const op of chunk) {
    if (op.kind === "set") batch.set(op.ref, op.data);
    else if (op.kind === "update") batch.update(op.ref, op.data);
    else batch.delete(op.ref);
  }
  await batch.commit();
}

async function commitOps(
  ops: WriteOp[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (ops.length === 0) return;
  const total = ops.length;
  let done = 0;
  for (let i = 0; i < ops.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = ops.slice(i, i + FIRESTORE_BATCH_LIMIT);
    try {
      await commitChunk(chunk);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "permission-denied" || chunk.length <= FALLBACK_BATCH_SIZE) throw e;
      for (let j = 0; j < chunk.length; j += FALLBACK_BATCH_SIZE) {
        await commitChunk(chunk.slice(j, j + FALLBACK_BATCH_SIZE));
      }
    }
    done += chunk.length;
    onProgress?.(done, total);
  }
}

// ============================================================================
// Mode handlers
// ============================================================================

type HandlerInput = {
  parseResult: ParseResult;
  state: ExistingState;
  knownTags: Set<string>;
  importHistoryId: string;
  eventId: string; // 행사 분리 (필수 — 모든 신규 도큐먼트에 태깅)
  sponsorSlotIds: Set<string>;
  onProgress: ImportProgress;
  warnings: string[];
};

type HandlerOutput = {
  ops: WriteOp[];
  counts: ImportCounts;
};

// ----- OVERWRITE -----

async function handleOverwrite(input: HandlerInput): Promise<HandlerOutput> {
  const { parseResult, state, knownTags, importHistoryId, eventId, sponsorSlotIds, onProgress, warnings } =
    input;
  const db = getDb();

  onProgress("preserve", 0, 3);
  const [existingSubcategories, existingSlots, packageSlotIds] = await Promise.all([
    fetchEventDocs<ExistingSubcategory>(COL_SUBCATEGORIES, eventId),
    fetchEventDocs<ExistingSlot>(COL_SLOTS, eventId),
    fetchPackageSlotIds(eventId),
  ]);
  onProgress("preserve", 3, 3);

  const plan = planOverwrite({
    parsed: parseResult,
    eventId,
    importHistoryId,
    existingCategories: state.categories,
    existingSubcategories,
    existingSlots,
    sponsorSlotIds,
    packageSlotIds,
    knownTags,
    deps: {
      ...TIME,
      newId: (col: PlanCollection) => doc(collection(db, col)).id,
    },
  });
  warnings.push(...plan.warnings);

  // 쓰기 먼저, 삭제는 나중 — 배치가 중간에 실패해도 데이터가 사라지지 않게.
  const ops: WriteOp[] = [
    ...plan.writes.map(
      (w): WriteOp => ({ kind: "set", ref: doc(db, w.col, w.id), data: w.data })
    ),
    ...plan.deletes.map(
      (d): WriteOp => ({ kind: "delete", ref: doc(db, d.col, d.id) })
    ),
  ];

  const c = plan.counts;
  return {
    ops,
    counts: {
      categoriesCreated: c.categoriesCreated,
      categoriesUpdated: c.categoriesUpdated,
      subcategoriesWritten: c.subcategoriesCreated + c.subcategoriesUpdated,
      slotsWritten: c.slotsCreated + c.slotsUpdated,
      slotsDeleted: c.slotsDeleted,
      subcategoriesDeleted: c.subcategoriesDeleted,
      slotsKeptReferenced: c.slotsKeptReferenced,
      slotsSoldKept: c.slotsSoldKept,
    },
  };
}

// ----- MERGE -----

async function handleMerge(input: HandlerInput): Promise<HandlerOutput> {
  const { parseResult, state, knownTags, importHistoryId, eventId, sponsorSlotIds, onProgress, warnings } =
    input;
  const db = getDb();
  const writeOps: WriteOp[] = [];

  let categoriesCreated = 0;
  let subcategoriesWritten = 0;
  let slotsWritten = 0;
  let slotsSoldKept = 0;
  const unknownTags = new Set<string>();

  // 1) 카테고리 — 없는 것만 생성. 있는 것은 손대지 않음.
  const codeToCatId = new Map<string, string>(); // catCode → categoryId
  const codeToCatName = new Map<string, { ko: string; en: string }>();
  let nextOrder = state.maxOrder + 1;
  const newlyCreatedCodes = new Set<string>();

  let preserveDone = 0;
  const preserveTotal = parseResult.categories.length;

  for (const parsed of parseResult.categories) {
    preserveDone++;
    const existing = state.categoriesByCode.get(parsed.code);
    if (existing) {
      codeToCatId.set(parsed.code, existing.id);
      codeToCatName.set(parsed.code, existing.name);
    } else {
      // 신규 — overwrite 모드와 동일한 빌드 경로
      const newRef = doc(collection(db, COL_CATEGORIES));
      const slug = pickUniqueSlug(parsed.nameEn, state.slugsInUse);
      const ctx: BuildContext = {
        newCategoryId: newRef.id,
        slug,
        order: nextOrder++,
        isPublished: false,
        createdAt: nowTs(),
        eventId,
      };
      const cat = buildCategory(parsed, ctx, importHistoryId, false, TIME);
      writeOps.push({
        kind: "set",
        ref: newRef,
        data: cat as unknown as Record<string, unknown>,
      });
      codeToCatId.set(parsed.code, newRef.id);
      codeToCatName.set(parsed.code, cat.name);
      newlyCreatedCodes.add(parsed.code);
      categoriesCreated++;

      for (const t of parsed.tags) {
        if (!knownTags.has(t)) unknownTags.add(t);
      }
    }
    onProgress("preserve", preserveDone, preserveTotal);
  }

  // 2) 소분류 — (cat_id, name.ko)로 lookup. 있으면 가격·단위·사이즈 update, 없으면 create.
  //    신규 카테고리에 대한 소분류는 모두 신규 생성.
  const subKeyToSubId = new Map<string, string>(); // `${catCode}|${nameKo}` → subId
  for (const parsed of parseResult.subcategories) {
    const catId = codeToCatId.get(parsed.categoryCode);
    if (!catId) continue;

    if (newlyCreatedCodes.has(parsed.categoryCode)) {
      // 신규 카테고리의 소분류 — 무조건 새로 생성
      const subRef = doc(collection(db, COL_SUBCATEGORIES));
      const sub = buildSubcategory(
        parsed,
        subRef.id,
        catId,
        eventId,
        codeToCatName.get(parsed.categoryCode) ?? { ko: parsed.nameKo, en: parsed.nameEn },
        // order는 카테고리 내 순서 — 별도 카운트
        countSubsForCat(parseResult.subcategories, parsed.categoryCode, parsed.nameKo)
      );
      writeOps.push({
        kind: "set",
        ref: subRef,
        data: sub as unknown as Record<string, unknown>,
      });
      subKeyToSubId.set(`${parsed.categoryCode}|${parsed.nameKo}`, subRef.id);
      subcategoriesWritten++;
    } else {
      // 기존 카테고리 — 같은 소분류 lookup
      const existing = await findExistingSubcategory(catId, parsed.nameKo);
      if (existing) {
        // 가격/단위/사이즈만 갱신
        const updates: Record<string, unknown> = {
          priceKRW: parsed.priceKRW,
          priceUSD: parsed.priceUSD ?? undefined,
          unit: { ko: parsed.unitKo, en: parsed.unitEn },
          size: nz(parsed.size),
          // name.en도 비어있으면 갱신 (편의)
          "name.en": parsed.nameEn || existing.name.en,
        };
        writeOps.push({
          kind: "update",
          ref: doc(db, COL_SUBCATEGORIES, existing.id),
          data: updates,
        });
        subKeyToSubId.set(`${parsed.categoryCode}|${parsed.nameKo}`, existing.id);
        subcategoriesWritten++;
      } else {
        // 새 소분류 추가 (기존 카테고리에)
        const existingSubs = await fetchSubcategoriesByCategoryId(catId);
        const order = existingSubs.length;
        const subRef = doc(collection(db, COL_SUBCATEGORIES));
        const sub = buildSubcategory(
          parsed,
          subRef.id,
          catId,
          eventId,
          codeToCatName.get(parsed.categoryCode) ?? {
            ko: parsed.nameKo,
            en: parsed.nameEn,
          },
          order
        );
        writeOps.push({
          kind: "set",
          ref: subRef,
          data: sub as unknown as Record<string, unknown>,
        });
        subKeyToSubId.set(`${parsed.categoryCode}|${parsed.nameKo}`, subRef.id);
        subcategoriesWritten++;
      }
    }
  }

  // 3) 슬롯 — 이 행사에서 code로 lookup. 있으면 status·note 갱신, 없으면 신규.
  for (const parsed of parseResult.slots) {
    const catId = codeToCatId.get(parsed.categoryCode);
    if (!catId) continue;
    const subId = subKeyToSubId.get(`${parsed.categoryCode}|${parsed.subcategoryNameKo}`);
    if (!subId) continue;

    const existingSlot = await fetchSlotByCode(parsed.code, eventId);
    if (existingSlot) {
      // status, note 갱신. categoryId/subcategoryId는 변경하지 않음 (상위 컨테이너 이동 방지)
      // 스폰서가 확보한 구좌는 엑셀이 '판매 가능' 이어도 매진 유지 (이중판매 방지).
      const resolved = resolveSlotStatus(
        existingSlot,
        parsed.isSold,
        sponsorSlotIds.has(existingSlot.id)
      );
      if (resolved.kept === "sponsor") {
        slotsSoldKept++;
        warnings.push(
          `구좌 ${parsed.code}: 엑셀은 '판매 가능'이지만 스폰서가 확보한 구좌라 매진 유지`
        );
      } else if (resolved.kept === "reserved") {
        warnings.push(`구좌 ${parsed.code}: 엑셀로 표현할 수 없는 '예약' 상태라 그대로 유지`);
      }
      const updates: Record<string, unknown> = {
        status: resolved.status,
        note: nz(parsed.note),
      };
      writeOps.push({
        kind: "update",
        ref: doc(db, COL_SLOTS, existingSlot.id),
        data: updates,
      });
      slotsWritten++;
    } else {
      // 신규 — 카테고리 내 max order + 1
      const slotRef = doc(collection(db, COL_SLOTS));
      const slot = buildSlot(parsed, slotRef.id, catId, subId, eventId, 0); // order는 임시 0
      writeOps.push({
        kind: "set",
        ref: slotRef,
        data: slot as unknown as Record<string, unknown>,
      });
      slotsWritten++;
    }
  }

  const tagWarning = unknownTagsWarning(unknownTags);
  if (tagWarning) warnings.push(tagWarning);

  return {
    ops: writeOps,
    counts: {
      categoriesCreated,
      categoriesUpdated: 0,
      subcategoriesWritten,
      slotsWritten,
      slotsDeleted: 0,
      slotsSoldKept,
    },
  };
}

function countSubsForCat(
  subs: ParseResult["subcategories"],
  catCode: string,
  upToNameKo: string
): number {
  let i = 0;
  for (const s of subs) {
    if (s.categoryCode !== catCode) continue;
    if (s.nameKo === upToNameKo) return i;
    i++;
  }
  return i;
}

async function findExistingSubcategory(
  categoryId: string,
  nameKo: string
): Promise<ExistingSubcategory | null> {
  const subs = await fetchSubcategoriesByCategoryId(categoryId);
  return subs.find((s) => s.name.ko === nameKo) ?? null;
}

// ----- ADD_ONLY -----

async function handleAddOnly(input: HandlerInput): Promise<HandlerOutput> {
  const { parseResult, state, knownTags, importHistoryId, eventId, onProgress, warnings } = input;
  const db = getDb();
  const writeOps: WriteOp[] = [];

  let categoriesCreated = 0;
  let subcategoriesWritten = 0;
  let slotsWritten = 0;
  const unknownTags = new Set<string>();

  // 1) 카테고리 — 없는 것만 생성
  const codeToCatId = new Map<string, string>();
  const codeToCatName = new Map<string, { ko: string; en: string }>();
  let nextOrder = state.maxOrder + 1;
  const newlyCreatedCodes = new Set<string>();

  for (let i = 0; i < parseResult.categories.length; i++) {
    const parsed = parseResult.categories[i];
    const existing = state.categoriesByCode.get(parsed.code);
    if (existing) {
      codeToCatId.set(parsed.code, existing.id);
      codeToCatName.set(parsed.code, existing.name);
    } else {
      const newRef = doc(collection(db, COL_CATEGORIES));
      const slug = pickUniqueSlug(parsed.nameEn, state.slugsInUse);
      const ctx: BuildContext = {
        newCategoryId: newRef.id,
        slug,
        order: nextOrder++,
        isPublished: false,
        createdAt: nowTs(),
        eventId,
      };
      const cat = buildCategory(parsed, ctx, importHistoryId, false, TIME);
      writeOps.push({
        kind: "set",
        ref: newRef,
        data: cat as unknown as Record<string, unknown>,
      });
      codeToCatId.set(parsed.code, newRef.id);
      codeToCatName.set(parsed.code, cat.name);
      newlyCreatedCodes.add(parsed.code);
      categoriesCreated++;

      for (const t of parsed.tags) {
        if (!knownTags.has(t)) unknownTags.add(t);
      }
    }
    onProgress("preserve", i + 1, parseResult.categories.length);
  }

  // 2) 슬롯 — 이 행사에 같은 code 가 있으면 스킵, 없으면 새로 생성 (소분류도 필요시 생성)
  const subKeyToSubId = new Map<string, string>();
  for (const parsed of parseResult.slots) {
    const existing = await fetchSlotByCode(parsed.code, eventId);
    if (existing) continue; // 스킵

    const catId = codeToCatId.get(parsed.categoryCode);
    if (!catId) continue;

    // 소분류 lookup or create
    const subKey = `${parsed.categoryCode}|${parsed.subcategoryNameKo}`;
    let subId = subKeyToSubId.get(subKey);
    if (!subId) {
      if (newlyCreatedCodes.has(parsed.categoryCode)) {
        // 신규 카테고리 — 새 소분류
        const parsedSub = parseResult.subcategories.find(
          (s) =>
            s.categoryCode === parsed.categoryCode &&
            s.nameKo === parsed.subcategoryNameKo
        );
        if (!parsedSub) continue;
        const subRef = doc(collection(db, COL_SUBCATEGORIES));
        const sub = buildSubcategory(
          parsedSub,
          subRef.id,
          catId,
          eventId,
          codeToCatName.get(parsed.categoryCode) ?? {
            ko: parsedSub.nameKo,
            en: parsedSub.nameEn,
          },
          countSubsForCat(
            parseResult.subcategories,
            parsed.categoryCode,
            parsed.subcategoryNameKo
          )
        );
        writeOps.push({
          kind: "set",
          ref: subRef,
          data: sub as unknown as Record<string, unknown>,
        });
        subId = subRef.id;
        subKeyToSubId.set(subKey, subId);
        subcategoriesWritten++;
      } else {
        // 기존 카테고리 — 소분류 lookup
        const existingSub = await findExistingSubcategory(
          catId,
          parsed.subcategoryNameKo
        );
        if (existingSub) {
          subId = existingSub.id;
          subKeyToSubId.set(subKey, subId);
        } else {
          // 기존 카테고리에 소분류 추가
          const parsedSub = parseResult.subcategories.find(
            (s) =>
              s.categoryCode === parsed.categoryCode &&
              s.nameKo === parsed.subcategoryNameKo
          );
          if (!parsedSub) continue;
          const existingSubs = await fetchSubcategoriesByCategoryId(catId);
          const subRef = doc(collection(db, COL_SUBCATEGORIES));
          const sub = buildSubcategory(
            parsedSub,
            subRef.id,
            catId,
            eventId,
            codeToCatName.get(parsed.categoryCode) ?? {
              ko: parsedSub.nameKo,
              en: parsedSub.nameEn,
            },
            existingSubs.length
          );
          writeOps.push({
            kind: "set",
            ref: subRef,
            data: sub as unknown as Record<string, unknown>,
          });
          subId = subRef.id;
          subKeyToSubId.set(subKey, subId);
          subcategoriesWritten++;
        }
      }
    }

    // 슬롯 생성
    const slotRef = doc(collection(db, COL_SLOTS));
    const slot = buildSlot(parsed, slotRef.id, catId, subId, eventId, 0);
    writeOps.push({
      kind: "set",
      ref: slotRef,
      data: slot as unknown as Record<string, unknown>,
    });
    slotsWritten++;
  }

  const tagWarning = unknownTagsWarning(unknownTags);
  if (tagWarning) warnings.push(tagWarning);

  return {
    ops: writeOps,
    counts: {
      categoriesCreated,
      categoriesUpdated: 0,
      subcategoriesWritten,
      slotsWritten,
      slotsDeleted: 0,
    },
  };
}

// ============================================================================
// History recording
// ============================================================================

async function writeImportHistory(
  importHistoryId: string,
  fileName: string,
  fileSize: number,
  uploadedBy: string,
  mode: ImportMode,
  eventId: string,
  counts: ImportCounts,
  parseErrors: ParseResult["errors"],
  parseWarnings: ParseResult["warnings"],
  importerWarnings: string[]
): Promise<void> {
  const db = getDb();
  const ref = doc(db, COL_IMPORT_HISTORY, importHistoryId);

  // ImportHistory.errors 형식에 parseError와 importerWarning을 모두 매핑
  const errors: ImportHistory["errors"] = [];
  for (const e of parseErrors) {
    errors.push({
      row: e.rowIndex ?? 0,
      reason: `[parse${e.column ? `:${e.column}` : ""}] ${e.reason}`,
    });
  }
  for (const w of parseWarnings) {
    errors.push({
      row: w.rowIndex ?? 0,
      reason: `[warn${w.column ? `:${w.column}` : ""}] ${w.reason}`,
    });
  }
  for (const w of importerWarnings) {
    errors.push({
      row: 0,
      reason: `[import] ${w}`,
    });
  }

  const history: ImportHistory & { eventId: string } = {
    id: importHistoryId,
    eventId,
    fileName,
    fileSize,
    uploadedBy,
    mode,
    counts: {
      categories: counts.categoriesCreated + counts.categoriesUpdated,
      subcategories: counts.subcategoriesWritten,
      slots: counts.slotsWritten,
      errors: parseErrors.length,
    },
    errors: errors.length ? errors : undefined,
    createdAt: nowTs(),
  };

  await commitOps([
    {
      kind: "set",
      ref,
      data: history as unknown as Record<string, unknown>,
    },
  ]);
}

// ============================================================================
// Public entry: importParsedData
// ============================================================================

export async function importParsedData(
  parseResult: ParseResult,
  mode: ImportMode,
  uploadedBy: string,
  fileName: string,
  fileSize: number,
  eventId: string, // 행사 분리 — 모든 신규 도큐먼트에 태깅
  onProgress?: ImportProgress
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  const importerWarnings: string[] = [];
  const progress: ImportProgress = onProgress ?? (() => {});

  if (!parseResult.ok) {
    errors.push({
      phase: "init",
      reason: `엑셀 파싱 단계에서 ${parseResult.errors.length}건의 에러가 있습니다. 먼저 수정하세요.`,
    });
    return { importHistoryId: "", counts: { ...EMPTY_COUNTS }, errors, warnings: [] };
  }
  if (!eventId) {
    errors.push({ phase: "init", reason: "행사가 선택되지 않았습니다." });
    return { importHistoryId: "", counts: { ...EMPTY_COUNTS }, errors, warnings: [] };
  }

  const db = getDb();
  const importHistoryId = doc(collection(db, COL_IMPORT_HISTORY)).id;

  let state: ExistingState;
  let knownTags: Set<string>;
  let sponsorSlotIds: Set<string>;
  try {
    [state, knownTags, sponsorSlotIds] = await Promise.all([
      fetchExistingCategories(eventId),
      fetchKnownTagIds(eventId),
      // 스폰서 확보 구좌를 못 읽으면 매진 보호가 불가능 — 아래 catch 로 중단
      fetchSponsorSlotIds(eventId),
    ]);
  } catch (e) {
    errors.push({
      phase: "preserve",
      reason: `기존 데이터 조회 실패 (스폰서 확보 구좌 보호를 위해 임포트를 중단했습니다): ${
        e instanceof Error ? e.message : String(e)
      }`,
    });
    return { importHistoryId, counts: { ...EMPTY_COUNTS }, errors, warnings: [] };
  }

  // 모드 분기
  let output: HandlerOutput;
  try {
    const handlerInput: HandlerInput = {
      parseResult,
      state,
      knownTags,
      importHistoryId,
      eventId,
      sponsorSlotIds,
      onProgress: progress,
      warnings: importerWarnings,
    };
    if (mode === "overwrite") output = await handleOverwrite(handlerInput);
    else if (mode === "merge") output = await handleMerge(handlerInput);
    else output = await handleAddOnly(handlerInput);
  } catch (e) {
    errors.push({
      phase: "write",
      reason: `처리 중 예외: ${e instanceof Error ? e.message : String(e)}`,
    });
    return {
      importHistoryId,
      counts: { ...EMPTY_COUNTS },
      errors,
      warnings: importerWarnings,
    };
  }

  // 일괄 commit
  try {
    await commitOps(output.ops, (current, total) =>
      progress("write", current, total)
    );
  } catch (e) {
    errors.push({
      phase: "write",
      reason: `Firestore 쓰기 실패: ${e instanceof Error ? e.message : String(e)}`,
    });
    return {
      importHistoryId,
      counts: output.counts,
      errors,
      warnings: importerWarnings,
    };
  }

  // history 기록
  try {
    progress("history", 0, 1);
    await writeImportHistory(
      importHistoryId,
      fileName,
      fileSize,
      uploadedBy,
      mode,
      eventId,
      output.counts,
      parseResult.errors,
      parseResult.warnings,
      importerWarnings
    );
    progress("history", 1, 1);
  } catch (e) {
    errors.push({
      phase: "history",
      reason: `importHistory 기록 실패: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return {
    importHistoryId,
    counts: output.counts,
    errors,
    warnings: importerWarnings,
  };
}
