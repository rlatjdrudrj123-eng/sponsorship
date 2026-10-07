/**
 * 엑셀 임포트 — 순수 계산 모듈 (Firestore 호출 없음).
 *
 * 왜 분리했나:
 *   예전 overwrite 는 "엑셀에 있는 카테고리의 소분류·슬롯을 전부 지우고 새 ID 로
 *   재생성" 했다. 그래서 재업로드할 때마다
 *     - 스폰서 확보 구좌(allocatedSlotIds)·도면 핀·패키지 구성(referencedSlotIds)이
 *       사라진 ID 를 가리키게 되고,
 *     - 매진 상태가 엑셀 값으로 풀려 이중판매 위험이 생기고,
 *     - 진단 점수·페르소나·시너지처럼 엑셀에 없는 필드가 통째로 지워졌다.
 *   이 모듈은 "기존 상태 + 파싱 결과 → 쓸 문서/지울 문서" 를 계산만 한다.
 *   기존 항목은 코드·이름으로 찾아 ID 를 그대로 쓰고, 엑셀에 없는 필드는 보존한다.
 *
 * 런타임 import 가 하나도 없다 (type import 만). 그래서 scripts/ 의 검증 스크립트가
 * Node 로 바로 실행해 실데이터로 검증할 수 있다. Timestamp 생성·ID 발급은 deps 로 주입.
 */
import type { Timestamp } from "firebase/firestore";
import type { Category, ImageSlot, Slot, Subcategory } from "../types";
import type { ParsedCategory, ParsedSlot, ParsedSubcategory } from "./parser";

// ============================================================================
// Types
// ============================================================================

export type ExistingCategory = Category & { id: string };
export type ExistingSubcategory = Subcategory & { id: string };
export type ExistingSlot = Slot & { id: string };

export type PlanCollection = "categories" | "subcategories" | "slots";

export type TimeDeps = {
  now: () => Timestamp;
  fromDate: (d: Date) => Timestamp;
};

export type PlanDeps = TimeDeps & {
  newId: (col: PlanCollection) => string;
};

export type PlanWrite = {
  col: PlanCollection;
  id: string;
  data: Record<string, unknown>;
};

export type PlanDelete = {
  col: "subcategories" | "slots";
  id: string;
};

export type OverwriteCounts = {
  categoriesCreated: number;
  categoriesUpdated: number;
  subcategoriesCreated: number;
  subcategoriesUpdated: number;
  subcategoriesDeleted: number;
  slotsCreated: number;
  slotsUpdated: number;
  slotsDeleted: number;
  /** 엑셀에서 빠졌지만 스폰서·패키지·도면 핀에 연결돼 있어 남겨둔 구좌 */
  slotsKeptReferenced: number;
  /** 엑셀은 '판매 가능' 이지만 스폰서 확보 구좌라 매진을 유지한 구좌 */
  slotsSoldKept: number;
};

export type OverwritePlanInput = {
  parsed: {
    categories: ParsedCategory[];
    subcategories: ParsedSubcategory[];
    slots: ParsedSlot[];
  };
  eventId: string;
  importHistoryId: string;
  /** 반드시 이 행사(eventId) 의 문서만. 섞여 들어와도 아래에서 한 번 더 거른다. */
  existingCategories: ExistingCategory[];
  existingSubcategories: ExistingSubcategory[];
  existingSlots: ExistingSlot[];
  /** 이 행사 스폰서가 참조하는 슬롯 (slotId + allocatedSlotIds) */
  sponsorSlotIds: Set<string>;
  /** 이 행사 패키지 includedItems.referencedSlotIds */
  packageSlotIds: Set<string>;
  knownTags: Set<string>;
  deps: PlanDeps;
};

export type OverwritePlan = {
  writes: PlanWrite[];
  deletes: PlanDelete[];
  warnings: string[];
  counts: OverwriteCounts;
};

// ============================================================================
// Small helpers
// ============================================================================

/** overwrite 시 신규 카테고리에 자동 부여될 lockedFields (잠금 가능한 화이트리스트). */
export const LOCKABLE_CATEGORY_FIELDS: string[] = [
  "code",
  "channel",
  "type",
  "name.ko",
  "name.en",
  "size",
  "fileFormat",
  "deadline",
];

export function nz(s: string): string | undefined {
  return s ? s : undefined;
}

export function toKebabSlug(input: string): string {
  return (
    (input || "category")
      .toLowerCase()
      .replace(/&/g, "-and-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  );
}

export function pickUniqueSlug(base: string, existing: Set<string>): string {
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

/**
 * 기존 문서의 필드 중 새로 만든 문서(built)에 키 자체가 없는 것만 그대로 옮긴다.
 *
 * built 가 명시한 키(값이 undefined 여도)는 엑셀이 관리하는 필드라 엑셀 값을 따르고,
 * 그 외 — 진단 점수(goalAffinity)·페르소나·시너지·작년 실적·영문 메모 등 어드민에서
 * 입력하는 필드 — 는 지금 있는 것뿐 아니라 앞으로 추가될 필드까지 자동 보존된다.
 */
export function carryOver<T extends object>(
  built: T,
  preserved: object | undefined
): T {
  if (!preserved) return built;
  const out: Record<string, unknown> = { ...(built as Record<string, unknown>) };
  for (const [k, v] of Object.entries(preserved)) {
    if (k === "id") continue;
    if (!(k in out)) out[k] = v;
  }
  return out as T;
}

const STATUS_LABEL: Record<Slot["status"], string> = {
  available: "판매 가능",
  sold: "판매됨",
  reserved: "예약",
};

/**
 * 엑셀의 is_sold 와 현재 상태를 합쳐 최종 구좌 상태를 정한다.
 *
 * - 엑셀이 매진 → 매진
 * - 엑셀이 판매 가능인데 스폰서가 확보한 구좌(판매됨/예약) → 현재 상태 유지 (이중판매 방지)
 * - 엑셀이 판매 가능인데 현재 '예약' → 유지 (엑셀은 예약을 표현하지 못함)
 * - 그 외 → 엑셀을 따름 (어드민이 엑셀로 매진 해제하는 경우)
 */
export function resolveSlotStatus(
  existing: { status: Slot["status"] } | undefined,
  excelSold: boolean,
  sponsorReferenced: boolean
): { status: Slot["status"]; kept?: "sponsor" | "reserved" } {
  if (excelSold) return { status: "sold" };
  if (!existing) return { status: "available" };
  if (existing.status !== "available" && sponsorReferenced) {
    return { status: existing.status, kept: "sponsor" };
  }
  if (existing.status === "reserved") {
    return { status: "reserved", kept: "reserved" };
  }
  return { status: "available" };
}

/**
 * taxonomy 에 없는 태그를 경고 1줄로 묶는다. 태그마다 1줄씩 쌓으면 수십 건이 되어
 * 정작 중요한 경고(보호한 구좌·삭제되는 소분류)가 화면에서 묻힌다.
 */
export function unknownTagsWarning(tags: Set<string>): string | null {
  if (tags.size === 0) return null;
  const list = Array.from(tags);
  const shown = list.slice(0, 15).join(", ");
  return `taxonomy 에 없는 태그 ${list.length}개는 그대로 저장했습니다 (필터에 쓰려면 분류 관리에서 등록): ${shown}${list.length > 15 ? " …" : ""}`;
}

/** 스폰서 문서들에서 참조 슬롯 ID 수집 (직접 연결 slotId + 패키지 확보 allocatedSlotIds). */
export function collectSponsorSlotIds(
  sponsors: Array<{
    items?: Array<{ slotId?: string; allocatedSlotIds?: string[] }>;
  }>
): Set<string> {
  const out = new Set<string>();
  for (const sp of sponsors) {
    for (const it of sp.items ?? []) {
      if (it.slotId) out.add(it.slotId);
      for (const sid of it.allocatedSlotIds ?? []) if (sid) out.add(sid);
    }
  }
  return out;
}

/** 패키지 문서들에서 구성 슬롯 ID 수집. */
export function collectPackageSlotIds(
  packages: Array<{ includedItems?: Array<{ referencedSlotIds?: string[] }> }>
): Set<string> {
  const out = new Set<string>();
  for (const p of packages) {
    for (const it of p.includedItems ?? []) {
      for (const sid of it.referencedSlotIds ?? []) if (sid) out.add(sid);
    }
  }
  return out;
}

// ============================================================================
// Builders — ParsedX → Firestore doc
// ============================================================================

export type BuildContext = {
  newCategoryId: string; // auto-generated 또는 preserved
  slug: string;
  order: number;
  isPublished: boolean;
  createdAt: Timestamp;
  eventId: string; // 행사 분리
  preserved?: ExistingCategory;
};

export function buildCategory(
  parsed: ParsedCategory,
  ctx: BuildContext,
  importHistoryId: string,
  isOverwriteMode: boolean,
  time: TimeDeps
): Category {
  const preserved = ctx.preserved;
  const lockedFields = preserved
    ? // 기존 카테고리 — lockedFields 그대로 유지 (잠금 해제 상태 보존)
      preserved.lockedFields ?? []
    : // 신규 — 잠금 가능한 모든 필드 자동 잠금
      [...LOCKABLE_CATEGORY_FIELDS];

  // overwrite 모드는 카테고리 레벨 텍스트 필드까지 보존.
  // shortDesc / selectorId / timingOverride / locationOverride 는 엑셀 우선,
  // 비어있으면 기존(preserved) 값 유지.
  // ⚠️ 여기에 키를 추가하면 그 필드는 "엑셀이 관리하는 필드" 가 된다 (carryOver 가
  //    기존 값을 옮기지 않음). 어드민 전용 필드는 여기 넣지 말 것.
  const cat: Category = {
    id: ctx.newCategoryId,
    // ⚠️ 항상 ctx.eventId 사용 — preserved 는 같은 eventId 의 카테고리만 매칭되도록
    // 호출부에서 보장. fallback 패턴은 데이터 손실 버그의 원인이라 제거.
    eventId: ctx.eventId,
    code: parsed.code,
    channel: parsed.channel,
    // 엑셀 유형이 구형 값(mailing_content)이면 이미 저장된 유형 유지 — SNS 콘텐츠를 발송형으로 되돌리지 않게
    type: parsed.legacyType && preserved?.type ? preserved.type : parsed.type,
    slug: ctx.slug,
    name: { ko: parsed.nameKo, en: parsed.nameEn },
    shortDesc: nz(parsed.shortDesc) ?? preserved?.shortDesc,
    longDesc: isOverwriteMode ? preserved?.longDesc : undefined,
    selectorId: nz(parsed.selectorId) ?? preserved?.selectorId,
    timingOverride:
      parsed.timing.length > 0
        ? (parsed.timing as Category["timingOverride"])
        : preserved?.timingOverride,
    locationOverride:
      parsed.location.length > 0
        ? (parsed.location as Category["locationOverride"])
        : preserved?.locationOverride,

    size: nz(parsed.size),
    fileFormat: nz(parsed.fileFormat),
    deadline: parsed.deadline ? time.fromDate(parsed.deadline) : undefined,
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
    updatedAt: time.now(),
    lastImportId: importHistoryId,
  };

  return cat;
}

export function buildSubcategory(
  parsed: ParsedSubcategory,
  id: string,
  categoryId: string,
  eventId: string,
  fallbackName: { ko: string; en: string },
  order: number
): Subcategory {
  // priceNote / priceNoteEn 은 어드민이 입력하는 필드 — 키를 두지 않아야
  // 재업로드 때 carryOver 가 기존 값을 보존한다.
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
    size: nz(parsed.size),
    order,
  };
  return sub;
}

export function buildSlot(
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
// Overwrite planner
// ============================================================================

function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) {
    const k = key(t);
    const list = m.get(k);
    if (list) list.push(t);
    else m.set(k, [t]);
  }
  return m;
}

/**
 * 엑셀 소분류 ↔ 기존 소분류 짝짓기.
 *   1) 이름(name.ko) 일치
 *   2) 양쪽 모두 소분류가 딱 1개면 이름이 달라도 같은 것으로 본다 (이름만 바꾼 경우 —
 *      도면·구좌 연결을 지키기 위해). 여러 개일 때는 잘못 짝지을 위험이 있어 하지 않음.
 */
function matchSubcategories(
  pSubs: ParsedSubcategory[],
  eSubs: ExistingSubcategory[],
  catNameKo: string
): { byIndex: Map<number, ExistingSubcategory>; renamedIndex: number | null } {
  const byIndex = new Map<number, ExistingSubcategory>();
  const used = new Set<string>();
  pSubs.forEach((ps, i) => {
    const effective = ps.nameKo || catNameKo;
    const ex = eSubs.find((e) => !used.has(e.id) && e.name?.ko === effective);
    if (ex) {
      byIndex.set(i, ex);
      used.add(ex.id);
    }
  });
  let renamedIndex: number | null = null;
  if (pSubs.length === 1 && eSubs.length === 1 && !byIndex.has(0)) {
    byIndex.set(0, eSubs[0]);
    renamedIndex = 0;
  }
  return { byIndex, renamedIndex };
}

export function planOverwrite(input: OverwritePlanInput): OverwritePlan {
  const { parsed, eventId, importHistoryId, deps } = input;
  const writes: PlanWrite[] = [];
  const deletes: PlanDelete[] = [];
  const warnings: string[] = [];
  const counts: OverwriteCounts = {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    subcategoriesCreated: 0,
    subcategoriesUpdated: 0,
    subcategoriesDeleted: 0,
    slotsCreated: 0,
    slotsUpdated: 0,
    slotsDeleted: 0,
    slotsKeptReferenced: 0,
    slotsSoldKept: 0,
  };

  // 이 행사 문서만 (호출부 조회가 eventId 로 걸러도 한 번 더 — 다른 행사 덮어쓰기 사고 방지)
  const exCats = input.existingCategories.filter((c) => c.eventId === eventId);
  const exSubs = input.existingSubcategories.filter((s) => s.eventId === eventId);
  const exSlots = input.existingSlots.filter((s) => s.eventId === eventId);

  const catByCode = new Map(exCats.map((c) => [c.code, c]));
  const slugsInUse = new Set(exCats.map((c) => c.slug).filter(Boolean) as string[]);
  let nextOrder =
    exCats.reduce(
      (m, c) => (typeof c.order === "number" && c.order > m ? c.order : m),
      -1
    ) + 1;

  // 도면 핀이 가리키는 슬롯
  const pinSlotIds = new Set<string>();
  for (const c of exCats) {
    for (const fi of c.floorImages ?? []) {
      for (const p of fi.pins ?? []) if (p.slotId) pinSlotIds.add(p.slotId);
    }
  }

  // 기존 슬롯 — 코드로 찾음 (행사 안에서 코드는 유일한 게 정상. 중복이면 같은 카테고리 우선)
  const exSlotsByCode = groupBy(exSlots, (s) => s.code);
  const usedSlotIds = new Set<string>();
  const reusedSubIds = new Set<string>();
  const touchedCategoryIds = new Set<string>();
  const unknownTags = new Set<string>();

  const parsedSubsByCat = groupBy(parsed.subcategories, (s) => s.categoryCode);
  const parsedSlotsByCat = groupBy(parsed.slots, (s) => s.categoryCode);

  for (const pc of parsed.categories) {
    const preserved = catByCode.get(pc.code);
    const catId = preserved?.id ?? deps.newId("categories");
    touchedCategoryIds.add(catId);

    const slug = preserved?.slug || pickUniqueSlug(pc.nameEn, slugsInUse);
    const order = typeof preserved?.order === "number" ? preserved.order : nextOrder++;
    const builtCat = buildCategory(
      pc,
      {
        newCategoryId: catId,
        slug,
        order,
        isPublished: preserved?.isPublished ?? false,
        createdAt: preserved?.createdAt ?? deps.now(),
        eventId,
        preserved,
      },
      importHistoryId,
      true,
      deps
    );
    writes.push({
      col: "categories",
      id: catId,
      data: carryOver(builtCat, preserved) as unknown as Record<string, unknown>,
    });
    if (preserved) counts.categoriesUpdated++;
    else counts.categoriesCreated++;

    for (const t of pc.tags) {
      if (!input.knownTags.has(t)) unknownTags.add(t);
    }

    // ----- 소분류 -----
    const pSubs = parsedSubsByCat.get(pc.code) ?? [];
    const eSubs = preserved ? exSubs.filter((s) => s.categoryId === preserved.id) : [];
    const { byIndex, renamedIndex } = matchSubcategories(pSubs, eSubs, pc.nameKo);
    const subIdByRawName = new Map<string, string>(); // 엑셀 소분류명(원본) → 소분류 ID
    const catName = { ko: pc.nameKo, en: pc.nameEn };

    pSubs.forEach((ps, i) => {
      const ex = byIndex.get(i);
      const id = ex?.id ?? deps.newId("subcategories");
      const builtSub = buildSubcategory(ps, id, catId, eventId, catName, i);
      writes.push({
        col: "subcategories",
        id,
        data: carryOver(builtSub, ex) as unknown as Record<string, unknown>,
      });
      if (ex) {
        counts.subcategoriesUpdated++;
        reusedSubIds.add(ex.id);
        if (renamedIndex === i) {
          warnings.push(
            `${pc.code}: 소분류 이름 변경 "${ex.name?.ko ?? ""}" → "${builtSub.name.ko}" (도면·구좌 연결은 그대로 유지)`
          );
        }
      } else {
        counts.subcategoriesCreated++;
      }
      subIdByRawName.set(ps.nameKo, id);
    });

    // ----- 슬롯 -----
    const pSlots = parsedSlotsByCat.get(pc.code) ?? [];
    pSlots.forEach((ps, i) => {
      const subId = subIdByRawName.get(ps.subcategoryNameKo);
      if (!subId) {
        warnings.push(
          `구좌 ${ps.code}: 소분류 "${ps.subcategoryNameKo}" 를 찾지 못해 건너뜀`
        );
        return;
      }
      const candidates = (exSlotsByCode.get(ps.code) ?? []).filter(
        (s) => !usedSlotIds.has(s.id)
      );
      const ex = candidates.find((s) => s.categoryId === catId) ?? candidates[0];
      const id = ex?.id ?? deps.newId("slots");
      if (ex) {
        usedSlotIds.add(ex.id);
        if (ex.categoryId !== catId) {
          warnings.push(
            `구좌 ${ps.code}: 다른 카테고리에서 ${pc.code} 로 옮겨짐 (구좌 ID·연결 유지)`
          );
        }
      }

      const builtSlot = buildSlot(ps, id, catId, subId, eventId, i);
      const resolved = resolveSlotStatus(ex, ps.isSold, input.sponsorSlotIds.has(id));
      builtSlot.status = resolved.status;
      if (resolved.kept === "sponsor") {
        counts.slotsSoldKept++;
        warnings.push(
          `구좌 ${ps.code}: 엑셀은 '판매 가능'이지만 스폰서가 확보한 구좌라 '${STATUS_LABEL[resolved.status]}' 유지`
        );
      } else if (resolved.kept === "reserved") {
        warnings.push(
          `구좌 ${ps.code}: 엑셀로 표현할 수 없는 '예약' 상태라 그대로 유지`
        );
      }

      writes.push({
        col: "slots",
        id,
        data: carryOver(builtSlot, ex) as unknown as Record<string, unknown>,
      });
      if (ex) counts.slotsUpdated++;
      else counts.slotsCreated++;
    });
  }

  // ----- 삭제 판정 — 엑셀에 포함된 카테고리 범위 안에서만 -----
  const subIdsHoldingKeptSlots = new Set<string>();
  for (const s of exSlots) {
    if (!touchedCategoryIds.has(s.categoryId)) continue; // 엑셀 밖 카테고리는 손대지 않음
    if (usedSlotIds.has(s.id)) continue; // 엑셀 행과 짝지어져 재사용됨
    const reasons: string[] = [];
    if (input.sponsorSlotIds.has(s.id)) reasons.push("스폰서 확보");
    if (input.packageSlotIds.has(s.id)) reasons.push("패키지 구성");
    if (pinSlotIds.has(s.id)) reasons.push("도면 핀");
    if (reasons.length > 0) {
      counts.slotsKeptReferenced++;
      subIdsHoldingKeptSlots.add(s.subcategoryId);
      warnings.push(
        `구좌 ${s.code}: 엑셀에 없지만 ${reasons.join("·")}에 연결돼 있어 삭제하지 않음 — 정리하려면 구좌 관리에서 직접 삭제`
      );
      continue;
    }
    deletes.push({ col: "slots", id: s.id });
    counts.slotsDeleted++;
  }

  const catById = new Map(exCats.map((c) => [c.id, c]));
  for (const s of exSubs) {
    if (!touchedCategoryIds.has(s.categoryId)) continue;
    if (reusedSubIds.has(s.id)) continue;
    const cat = catById.get(s.categoryId);
    if (subIdsHoldingKeptSlots.has(s.id)) {
      warnings.push(
        `${cat?.code ?? ""}: 소분류 "${s.name?.ko ?? s.id}" 는 남겨둔 구좌가 있어 삭제하지 않음`
      );
      continue;
    }
    if (cat?.floorImages?.some((fi) => fi.subcategoryId === s.id)) {
      warnings.push(
        `${cat.code}: 소분류 "${s.name?.ko ?? s.id}" 가 엑셀에 없어 삭제 — 연결된 도면은 카테고리 편집의 '연결 끊긴 도면'에서 정리하세요`
      );
    }
    deletes.push({ col: "subcategories", id: s.id });
    counts.subcategoriesDeleted++;
  }

  const tagWarning = unknownTagsWarning(unknownTags);
  if (tagWarning) warnings.push(tagWarning);

  return { writes, deletes, warnings, counts };
}
