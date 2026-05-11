/**
 * 엑셀 임포트 → Firestore 동기화.
 *
 * 모드 3종:
 *   - overwrite: 엑셀에 들어온 카테고리만 삭제·재생성. 이미지·도면·텍스트는 보존.
 *   - merge: 같은 (cat_code, slot_code) 슬롯의 가격·마감·사이즈만 갱신. 신규는 추가.
 *   - add_only: 기존 코드 무시, 새 코드만 추가.
 *
 * 외부 API:
 *   importParsedData(parseResult, mode, uploadedBy, fileName, fileSize, onProgress)
 *
 * 정책 — STEP 5-3 사양 §"정책" 참고:
 *   1) slug = name_en kebab-case + 충돌 시 -2/-3
 *   2) order = 등장 순서. 기존은 보존, 신규는 max+1...
 *   3) isPublished 신규는 false. 기존은 보존.
 *   4) deadline 없으면 null.
 *   5) taxonomy에 없는 태그는 warning만 남기고 그대로 저장.
 *   6) overwrite는 엑셀에 있는 code만 손댐. 다른 카테고리는 안 건드림.
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
import type {
  Category,
  ImageSlot,
  ImportHistory,
  Slot,
  Subcategory,
  Taxonomy,
} from "../types";
import type {
  ParsedCategory,
  ParsedSlot,
  ParsedSubcategory,
  ParseResult,
} from "./parser";

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

export type ImportResult = {
  importHistoryId: string;
  counts: {
    categoriesCreated: number;
    categoriesUpdated: number;
    subcategoriesWritten: number;
    slotsWritten: number;
    slotsDeleted: number;
  };
  errors: ImportError[];
};

// ============================================================================
// Constants
// ============================================================================

const COL_CATEGORIES = "categories";
const COL_SUBCATEGORIES = "subcategories";
const COL_SLOTS = "slots";
const COL_TAXONOMY = "taxonomy";
const COL_IMPORT_HISTORY = "importHistory";
const TAXONOMY_DOC_ID = "main";

const FIRESTORE_BATCH_LIMIT = 500;

/** overwrite 시 신규 카테고리에 자동 부여될 lockedFields (잠금 가능한 화이트리스트). */
const LOCKABLE_CATEGORY_FIELDS: string[] = [
  "code",
  "channel",
  "type",
  "name.ko",
  "name.en",
  "size",
  "fileFormat",
  "deadline",
];

// ============================================================================
// Helpers
// ============================================================================

function nowTs(): Timestamp {
  return Timestamp.fromDate(new Date());
}

function toTimestamp(d: Date | null | undefined): Timestamp | undefined {
  if (!d) return undefined;
  return Timestamp.fromDate(d);
}

function nz(s: string): string | undefined {
  return s ? s : undefined;
}

function toKebabSlug(input: string): string {
  return (
    (input || "category")
      .toLowerCase()
      .replace(/&/g, "-and-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  );
}

function pickUniqueSlug(base: string, existing: Set<string>): string {
  const baseSlug = toKebabSlug(base);
  if (!existing.has(baseSlug)) {
    existing.add(baseSlug);
    return baseSlug;
  }
  let i = 2;
  while (existing.has(`${baseSlug}-${i}`)) i++;
  const final = `${baseSlug}-${i}`;
  existing.add(final);
  return final;
}

// ============================================================================
// Existing-state fetch
// ============================================================================

type ExistingCategory = Category & { id: string };
type ExistingSubcategory = Subcategory & { id: string };
type ExistingSlot = Slot & { id: string };

type ExistingState = {
  categoriesByCode: Map<string, ExistingCategory>;
  slugsInUse: Set<string>;
  maxOrder: number;
};

async function fetchExistingCategories(): Promise<ExistingState> {
  const snap = await getDocs(collection(getDb(), COL_CATEGORIES));
  const byCode = new Map<string, ExistingCategory>();
  const slugs = new Set<string>();
  let maxOrder = -1;
  snap.forEach((d) => {
    const data = d.data() as Category;
    const cat: ExistingCategory = { ...data, id: d.id };
    byCode.set(cat.code, cat);
    if (cat.slug) slugs.add(cat.slug);
    if (typeof cat.order === "number" && cat.order > maxOrder) {
      maxOrder = cat.order;
    }
  });
  return { categoriesByCode: byCode, slugsInUse: slugs, maxOrder };
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
  return snap.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id }));
}

async function fetchSlotsByCategoryId(
  categoryId: string
): Promise<ExistingSlot[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), COL_SLOTS),
      where("categoryId", "==", categoryId)
    )
  );
  return snap.docs.map((d) => ({ ...(d.data() as Slot), id: d.id }));
}

async function fetchSlotByCode(
  code: string
): Promise<ExistingSlot | null> {
  const snap = await getDocs(
    query(
      collection(getDb(), COL_SLOTS),
      where("code", "==", code),
      fsLimit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...(d.data() as Slot), id: d.id };
}

async function fetchKnownTagIds(): Promise<Set<string>> {
  try {
    const ref = doc(getDb(), COL_TAXONOMY, TAXONOMY_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) return new Set();
    const data = snap.data() as Taxonomy;
    return new Set((data.tags ?? []).map((t) => t.id));
  } catch {
    return new Set();
  }
}

// ============================================================================
// Builders — ParsedX → Firestore doc
// ============================================================================

type BuildContext = {
  newCategoryId: string; // auto-generated 또는 preserved
  slug: string;
  order: number;
  isPublished: boolean;
  createdAt: Timestamp;
  eventId: string;       // 행사 분리
  preserved?: ExistingCategory;
};

function buildCategory(
  parsed: ParsedCategory,
  ctx: BuildContext,
  importHistoryId: string,
  isOverwriteMode: boolean
): Category {
  const preserved = ctx.preserved;
  const lockedFields = preserved
    ? // 기존 카테고리 — lockedFields 그대로 유지 (잠금 해제 상태 보존)
      preserved.lockedFields ?? []
    : // 신규 — 잠금 가능한 모든 필드 자동 잠금
      [...LOCKABLE_CATEGORY_FIELDS];

  // overwrite 모드는 카테고리 레벨 텍스트 필드까지 보존. merge는 여기 안 옴 (별도 경로).
  const cat: Category = {
    id: ctx.newCategoryId,
    eventId: preserved?.eventId ?? ctx.eventId,
    code: parsed.code,
    channel: parsed.channel,
    type: parsed.type,
    slug: ctx.slug,
    name: { ko: parsed.nameKo, en: parsed.nameEn },
    shortDesc: undefined, // 엑셀에 없음 — 어드민이 별도 입력
    longDesc: isOverwriteMode ? preserved?.longDesc : undefined,

    size: nz(parsed.size),
    fileFormat: nz(parsed.fileFormat),
    deadline: toTimestamp(parsed.deadline),
    designGuideText: isOverwriteMode ? preserved?.designGuideText : undefined,
    designGuideFileUrl: isOverwriteMode
      ? preserved?.designGuideFileUrl
      : undefined,
    designGuideFilePath: isOverwriteMode
      ? preserved?.designGuideFilePath
      : undefined,

    // 이미지·도면 보존
    heroImages:
      preserved?.heroImages ?? { mode: "carousel", images: [] as ImageSlot["images"] },
    detailImages: preserved?.detailImages,
    floorImages: preserved?.floorImages,

    videoUrl: isOverwriteMode ? preserved?.videoUrl : undefined,
    videoSpec: isOverwriteMode ? preserved?.videoSpec : undefined,
    mailingSpec: isOverwriteMode ? preserved?.mailingSpec : undefined,
    contentSpec: isOverwriteMode ? preserved?.contentSpec : undefined,

    tags: parsed.tags,
    isPublished: ctx.isPublished,
    order: ctx.order,
    lockedFields,
    createdAt: ctx.createdAt,
    updatedAt: nowTs(),
    lastImportId: importHistoryId,
  };

  return cat;
}

function buildSubcategory(
  parsed: ParsedSubcategory,
  id: string,
  categoryId: string,
  eventId: string,
  fallbackName: { ko: string; en: string },
  order: number
): Subcategory {
  const sub: Subcategory = {
    id,
    eventId,
    categoryId,
    name: {
      ko: parsed.nameKo || fallbackName.ko,
      en: parsed.nameEn || fallbackName.en,
    },
    priceKRW: parsed.priceKRW,
    priceUSD: parsed.priceUSD ?? undefined,
    unit: { ko: parsed.unitKo, en: parsed.unitEn },
    priceNote: undefined, // 어드민이 별도 입력
    size: nz(parsed.size),
    order,
  };
  return sub;
}

function buildSlot(
  parsed: ParsedSlot,
  id: string,
  categoryId: string,
  subcategoryId: string,
  eventId: string,
  order: number
): Slot {
  const slot: Slot = {
    id,
    eventId,
    subcategoryId,
    categoryId,
    code: parsed.code,
    status: parsed.isSold ? "sold" : "available",
    note: nz(parsed.note),
    order,
  };
  return slot;
}

// ============================================================================
// Batch commit helper
// ============================================================================

type WriteOp =
  | { kind: "set"; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: "update"; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: "delete"; ref: DocumentReference };

async function commitOps(
  ops: WriteOp[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (ops.length === 0) return;
  const total = ops.length;
  let done = 0;
  for (let i = 0; i < ops.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = ops.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch: WriteBatch = writeBatch(getDb());
    for (const op of chunk) {
      if (op.kind === "set") batch.set(op.ref, op.data);
      else if (op.kind === "update") batch.update(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
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
  eventId: string;        // 행사 분리 (필수 — 모든 신규 도큐먼트에 태깅)
  onProgress: ImportProgress;
  warnings: string[]; // taxonomy mismatch 등
};

type HandlerOutput = {
  ops: WriteOp[];
  counts: {
    categoriesCreated: number;
    categoriesUpdated: number;
    subcategoriesWritten: number;
    slotsWritten: number;
    slotsDeleted: number;
  };
  preserveCount: number;
  deleteOpsCount: number;
};

// ----- OVERWRITE -----

async function handleOverwrite(input: HandlerInput): Promise<HandlerOutput> {
  const { parseResult, state, knownTags, importHistoryId, eventId, onProgress, warnings } = input;
  const db = getDb();
  const writeOps: WriteOp[] = [];
  const deleteOps: WriteOp[] = [];

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let subcategoriesWritten = 0;
  let slotsWritten = 0;
  let slotsDeleted = 0;

  // ----- preserve -----
  const codes = parseResult.categories.map((c) => c.code);
  const preservedByCode = new Map<string, ExistingCategory>();
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const existing = state.categoriesByCode.get(code);
    if (existing) preservedByCode.set(code, existing);
    onProgress("preserve", i + 1, codes.length);
  }

  // ----- delete (해당 code만) -----
  let deleteIdx = 0;
  const totalToDelete = preservedByCode.size;
  for (const [code, existingCat] of Array.from(preservedByCode.entries())) {
    deleteIdx++;
    const subs = await fetchSubcategoriesByCategoryId(existingCat.id);
    const slots = await fetchSlotsByCategoryId(existingCat.id);
    deleteOps.push({
      kind: "delete",
      ref: doc(db, COL_CATEGORIES, existingCat.id),
    });
    for (const s of subs) {
      deleteOps.push({
        kind: "delete",
        ref: doc(db, COL_SUBCATEGORIES, s.id),
      });
    }
    for (const s of slots) {
      deleteOps.push({
        kind: "delete",
        ref: doc(db, COL_SLOTS, s.id),
      });
      slotsDeleted++;
    }
    // 슬러그도 슬러그 풀에서 제거 — 같은 카테고리에서 그대로 사용 가능하게
    if (existingCat.slug) state.slugsInUse.delete(existingCat.slug);
    onProgress("delete", deleteIdx, totalToDelete);
    void code;
  }

  // ----- build (write) -----
  let nextOrder = state.maxOrder + 1;
  const newCategoriesByCode = new Map<string, Category>();

  for (const parsed of parseResult.categories) {
    const preserved = preservedByCode.get(parsed.code);
    const newRef = preserved
      ? doc(db, COL_CATEGORIES, preserved.id) // 기존 ID 재사용
      : doc(collection(db, COL_CATEGORIES));

    const slug = preserved?.slug ?? pickUniqueSlug(parsed.nameEn, state.slugsInUse);
    if (preserved?.slug) state.slugsInUse.add(preserved.slug); // 재추가

    const order = preserved?.order ?? nextOrder++;
    const ctx: BuildContext = {
      newCategoryId: newRef.id,
      slug,
      order,
      isPublished: preserved?.isPublished ?? false,
      createdAt: preserved?.createdAt ?? nowTs(),
      eventId,
      preserved,
    };

    const cat = buildCategory(parsed, ctx, importHistoryId, true);
    newCategoriesByCode.set(parsed.code, cat);
    writeOps.push({
      kind: "set",
      ref: newRef,
      data: cat as unknown as Record<string, unknown>,
    });

    if (preserved) categoriesUpdated++;
    else categoriesCreated++;

    // 태그 검증 (warning)
    for (const t of parsed.tags) {
      if (!knownTags.has(t)) {
        warnings.push(
          `카테고리 ${parsed.code} (${parsed.nameKo}): 태그 "${t}" 가 taxonomy에 없습니다 — 그대로 저장`
        );
      }
    }
  }

  // 소분류 — 카테고리당 등장 순서로 order 부여
  const subcatIdByKey = new Map<string, string>(); // catCode|subKo → subId
  const subsByCategory = new Map<string, ParsedSubcategory[]>();
  for (const ps of parseResult.subcategories) {
    const arr = subsByCategory.get(ps.categoryCode) ?? [];
    arr.push(ps);
    subsByCategory.set(ps.categoryCode, arr);
  }
  for (const [catCode, subs] of Array.from(subsByCategory.entries())) {
    const cat = newCategoriesByCode.get(catCode);
    if (!cat) continue;
    subs.forEach((ps, i) => {
      const subRef = doc(collection(db, COL_SUBCATEGORIES));
      const sub = buildSubcategory(ps, subRef.id, cat.id, eventId, cat.name, i);
      subcatIdByKey.set(`${catCode}|${ps.nameKo}`, subRef.id);
      writeOps.push({
        kind: "set",
        ref: subRef,
        data: sub as unknown as Record<string, unknown>,
      });
      subcategoriesWritten++;
    });
  }

  // 슬롯 — 카테고리당 등장 순서로 order 부여
  const slotsByCategory = new Map<string, ParsedSlot[]>();
  for (const ps of parseResult.slots) {
    const arr = slotsByCategory.get(ps.categoryCode) ?? [];
    arr.push(ps);
    slotsByCategory.set(ps.categoryCode, arr);
  }
  for (const [catCode, slots] of Array.from(slotsByCategory.entries())) {
    const cat = newCategoriesByCode.get(catCode);
    if (!cat) continue;
    slots.forEach((ps, i) => {
      const subId = subcatIdByKey.get(`${catCode}|${ps.subcategoryNameKo}`);
      if (!subId) return; // 그룹핑 누락 — 정상 흐름이면 발생 안 함
      const slotRef = doc(collection(db, COL_SLOTS));
      const slot = buildSlot(ps, slotRef.id, cat.id, subId, eventId, i);
      writeOps.push({
        kind: "set",
        ref: slotRef,
        data: slot as unknown as Record<string, unknown>,
      });
      slotsWritten++;
    });
  }

  return {
    ops: [...deleteOps, ...writeOps],
    counts: {
      categoriesCreated,
      categoriesUpdated,
      subcategoriesWritten,
      slotsWritten,
      slotsDeleted,
    },
    preserveCount: codes.length,
    deleteOpsCount: deleteOps.length,
  };
}

// ----- MERGE -----

async function handleMerge(input: HandlerInput): Promise<HandlerOutput> {
  const { parseResult, state, knownTags, importHistoryId, eventId, onProgress, warnings } = input;
  const db = getDb();
  const writeOps: WriteOp[] = [];

  let categoriesCreated = 0;
  let subcategoriesWritten = 0;
  let slotsWritten = 0;

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
      const cat = buildCategory(parsed, ctx, importHistoryId, false);
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
        if (!knownTags.has(t)) {
          warnings.push(
            `카테고리 ${parsed.code}: 태그 "${t}" 가 taxonomy에 없습니다 — 그대로 저장`
          );
        }
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

  // 3) 슬롯 — code로 lookup. 있으면 status·note 갱신, 없으면 신규.
  for (const parsed of parseResult.slots) {
    const catId = codeToCatId.get(parsed.categoryCode);
    if (!catId) continue;
    const subId = subKeyToSubId.get(`${parsed.categoryCode}|${parsed.subcategoryNameKo}`);
    if (!subId) continue;

    const existingSlot = await fetchSlotByCode(parsed.code);
    if (existingSlot) {
      // status, note 갱신. categoryId/subcategoryId는 변경하지 않음 (상위 컨테이너 이동 방지)
      const updates: Record<string, unknown> = {
        status: parsed.isSold ? "sold" : "available",
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

  return {
    ops: writeOps,
    counts: {
      categoriesCreated,
      categoriesUpdated: 0,
      subcategoriesWritten,
      slotsWritten,
      slotsDeleted: 0,
    },
    preserveCount: preserveTotal,
    deleteOpsCount: 0,
  };
}

function countSubsForCat(
  subs: ParsedSubcategory[],
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
      const cat = buildCategory(parsed, ctx, importHistoryId, false);
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
        if (!knownTags.has(t)) {
          warnings.push(
            `카테고리 ${parsed.code}: 태그 "${t}" 가 taxonomy에 없습니다 — 그대로 저장`
          );
        }
      }
    }
    onProgress("preserve", i + 1, parseResult.categories.length);
  }

  // 2) 슬롯 — code 존재 확인. 존재하면 스킵, 없으면 새로 생성 (소분류도 필요시 생성)
  const subKeyToSubId = new Map<string, string>();
  for (const parsed of parseResult.slots) {
    const existing = await fetchSlotByCode(parsed.code);
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

  return {
    ops: writeOps,
    counts: {
      categoriesCreated,
      categoriesUpdated: 0,
      subcategoriesWritten,
      slotsWritten,
      slotsDeleted: 0,
    },
    preserveCount: parseResult.categories.length,
    deleteOpsCount: 0,
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
  counts: ImportResult["counts"],
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

  const history: ImportHistory = {
    id: importHistoryId,
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
  eventId: string,         // 행사 분리 — 모든 신규 도큐먼트에 태깅
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
    return {
      importHistoryId: "",
      counts: {
        categoriesCreated: 0,
        categoriesUpdated: 0,
        subcategoriesWritten: 0,
        slotsWritten: 0,
        slotsDeleted: 0,
      },
      errors,
    };
  }

  const db = getDb();
  const importHistoryId = doc(collection(db, COL_IMPORT_HISTORY)).id;

  let state: ExistingState;
  let knownTags: Set<string>;
  try {
    [state, knownTags] = await Promise.all([
      fetchExistingCategories(),
      fetchKnownTagIds(),
    ]);
  } catch (e) {
    errors.push({
      phase: "preserve",
      reason: `기존 데이터 조회 실패: ${e instanceof Error ? e.message : String(e)}`,
    });
    return {
      importHistoryId,
      counts: {
        categoriesCreated: 0,
        categoriesUpdated: 0,
        subcategoriesWritten: 0,
        slotsWritten: 0,
        slotsDeleted: 0,
      },
      errors,
    };
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
      counts: {
        categoriesCreated: 0,
        categoriesUpdated: 0,
        subcategoriesWritten: 0,
        slotsWritten: 0,
        slotsDeleted: 0,
      },
      errors,
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
  };
}
