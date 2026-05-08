/**
 * 엑셀 임포트 파서.
 *
 * 입력: xlsx 파일 (ArrayBuffer/Uint8Array)
 * 출력: ParseResult — 행별 데이터 + 그룹핑된 카테고리/소분류/슬롯 + 에러/경고 + 요약
 *
 * 사용 예:
 *   const buf = await file.arrayBuffer();
 *   const result = parseExcelBuffer(buf);
 *   if (!result.ok) showErrors(result.errors);
 *   else proceedToImport(result);
 */

import * as XLSX from "xlsx";
import { z } from "zod";
import type { CategoryType, Channel } from "../types";

// ============================================================================
// Constants
// ============================================================================

export const CATEGORY_TYPES = [
  "floor_plan",
  "quantity",
  "media",
  "digital_banner",
  "mailing",
  "print_page",
  "content",
  "xpace",
  "package",
] as const satisfies readonly CategoryType[];

export const CHANNELS = ["offline", "online", "package"] as const satisfies readonly Channel[];

export const REQUIRED_HEADERS = [
  "channel",
  "category_code",
  "category_name_ko",
  "category_name_en",
  "category_type",
  "slot_code",
  "price_krw",
] as const;

export const OPTIONAL_HEADERS = [
  "subcategory_name_ko",
  "subcategory_name_en",
  "size",
  "file_format",
  "deadline",
  "price_usd",
  "unit_ko",
  "unit_en",
  "is_sold",
  "note",
  "tags",
] as const;

export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;

export type ExcelHeader = (typeof ALL_HEADERS)[number];

const DATA_SHEET_NAME = "data";

// ============================================================================
// Types
// ============================================================================

export type ParseError = {
  rowIndex: number | null; // null = 파일/헤더 레벨
  column?: ExcelHeader;
  reason: string;
};

export type ParseWarning = {
  rowIndex?: number | null;
  column?: ExcelHeader;
  reason: string;
};

export type ParsedRow = {
  rowIndex: number; // 엑셀 1-based, 헤더가 row 1, 첫 데이터 행 = row 2
  channel: Channel;
  categoryCode: string;
  categoryNameKo: string;
  categoryNameEn: string;
  categoryType: CategoryType;
  subcategoryNameKo: string; // 비어있으면 "단일 기본 소분류"
  subcategoryNameEn: string;
  slotCode: string;
  size: string;
  fileFormat: string;
  deadline: Date | null;
  priceKRW: number;
  priceUSD: number | null;
  unitKo: string;
  unitEn: string;
  isSold: boolean;
  note: string;
  tags: string[];
};

export type ParsedCategory = {
  code: string;
  channel: Channel;
  type: CategoryType;
  nameKo: string;
  nameEn: string;
  size: string;
  fileFormat: string;
  deadline: Date | null;
  tags: string[];
};

export type ParsedSubcategory = {
  categoryCode: string;
  nameKo: string; // "" = 단일 기본 소분류
  nameEn: string;
  priceKRW: number;
  priceUSD: number | null;
  unitKo: string;
  unitEn: string;
  size: string;
};

export type ParsedSlot = {
  code: string;
  categoryCode: string;
  subcategoryNameKo: string;
  isSold: boolean;
  note: string;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
  summary: {
    rows: number;
    categories: number;
    subcategories: number;
    slots: number;
    errors: number;
    warnings: number;
  };
  categories: ParsedCategory[];
  subcategories: ParsedSubcategory[];
  slots: ParsedSlot[];
  ok: boolean; // errors === 0
};

// ============================================================================
// Coercion helpers
// ============================================================================

function s(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** "3,000,000원" / 3000000 / "3000000" → 3000000. 변환 불가 시 null. */
function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null) return null;
  const cleaned = String(v).replace(/[,\s원\\]/g, "").replace(/krw/gi, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** TRUE/FALSE/마감/가능/Y/N → boolean. 빈 값/미인식은 false. */
function parseIsSold(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v == null) return false;
  const t = String(v).trim().toUpperCase();
  if (!t) return false;
  return [
    "TRUE",
    "T",
    "Y",
    "YES",
    "1",
    "SOLD",
    "마감",
    "판매완료",
  ].includes(t);
}

/** Date 객체 / "2026-06-30" / "2026.06.30" / "2026/06/30" / Excel serial → Date. 변환 불가 시 null. */
function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial (days since 1899-12-30, 1900 leap year bug 보정 25569)
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v !== "string") return null;
  const str = v.trim();
  if (!str) return null;
  const norm = str.replace(/[./]/g, "-");
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "브랜드_확산형, 온사이트" → ["브랜드_확산형", "온사이트"] */
function parseTags(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => s(x)).filter(Boolean);
  }
  if (v == null || v === "") return [];
  return String(v)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ============================================================================
// Zod schema (행별 검증)
// ============================================================================

const parsedRowSchema = z.object({
  rowIndex: z.number().int().positive(),
  channel: z.enum(CHANNELS, {
    message: `channel은 ${CHANNELS.join(" / ")} 중 하나여야 합니다`,
  }),
  categoryCode: z.string().min(1, "필수"),
  categoryNameKo: z.string().min(1, "필수"),
  categoryNameEn: z.string().min(1, "필수"),
  categoryType: z.enum(CATEGORY_TYPES, {
    message: `category_type은 ${CATEGORY_TYPES.join(" / ")} 중 하나여야 합니다`,
  }),
  subcategoryNameKo: z.string(),
  subcategoryNameEn: z.string(),
  slotCode: z.string().min(1, "필수"),
  size: z.string(),
  fileFormat: z.string(),
  deadline: z.date().nullable(),
  priceKRW: z.number().int().nonnegative("0 이상의 정수여야 합니다"),
  priceUSD: z.number().nonnegative().nullable(),
  unitKo: z.string(),
  unitEn: z.string(),
  isSold: z.boolean(),
  note: z.string(),
  tags: z.array(z.string()),
});

// ParsedRow 필드 → 엑셀 컬럼 매핑 (zod 에러 메시지 표시용)
const COLUMN_FROM_FIELD: Partial<Record<string, ExcelHeader>> = {
  channel: "channel",
  categoryCode: "category_code",
  categoryNameKo: "category_name_ko",
  categoryNameEn: "category_name_en",
  categoryType: "category_type",
  subcategoryNameKo: "subcategory_name_ko",
  subcategoryNameEn: "subcategory_name_en",
  slotCode: "slot_code",
  size: "size",
  fileFormat: "file_format",
  deadline: "deadline",
  priceKRW: "price_krw",
  priceUSD: "price_usd",
  unitKo: "unit_ko",
  unitEn: "unit_en",
  isSold: "is_sold",
  note: "note",
  tags: "tags",
};

// ============================================================================
// Main
// ============================================================================

export function parseExcelBuffer(
  buffer: ArrayBuffer | Uint8Array
): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  // 1) 워크북 열기
  let wb: XLSX.WorkBook;
  try {
    const data =
      buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer as ArrayBuffer);
    wb = XLSX.read(data, { type: "array", cellDates: true });
  } catch (e) {
    errors.push({
      rowIndex: null,
      reason: `엑셀 파일을 열 수 없습니다: ${
        e instanceof Error ? e.message : String(e)
      }`,
    });
    return makeEmptyResult(errors, warnings);
  }

  // 2) 시트 찾기 ("data" 우선, 없으면 첫 시트)
  const sheetName = wb.SheetNames.includes(DATA_SHEET_NAME)
    ? DATA_SHEET_NAME
    : wb.SheetNames[0];
  if (!sheetName) {
    errors.push({ rowIndex: null, reason: "시트가 없는 엑셀 파일입니다." });
    return makeEmptyResult(errors, warnings);
  }
  if (sheetName !== DATA_SHEET_NAME) {
    warnings.push({
      reason: `"${DATA_SHEET_NAME}" 시트가 없어서 "${sheetName}" 시트를 사용합니다.`,
    });
  }
  const sheet = wb.Sheets[sheetName];

  // 3) 셀 → 2D 배열로 읽기
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (aoa.length === 0) {
    errors.push({ rowIndex: null, reason: "시트가 비어있습니다." });
    return makeEmptyResult(errors, warnings);
  }

  // 4) 헤더 검증
  const headerRow = (aoa[0] ?? []).map((h) => s(h));
  const missingRequired = REQUIRED_HEADERS.filter(
    (h) => !headerRow.includes(h)
  );
  if (missingRequired.length > 0) {
    errors.push({
      rowIndex: 1,
      reason: `필수 컬럼 누락: ${missingRequired.join(", ")}`,
    });
    return makeEmptyResult(errors, warnings);
  }
  const unknownCols = headerRow.filter(
    (h) => h && !ALL_HEADERS.includes(h as ExcelHeader)
  );
  for (const h of unknownCols) {
    warnings.push({
      rowIndex: 1,
      reason: `알 수 없는 컬럼 "${h}" — 무시됩니다.`,
    });
  }

  // 5) 컬럼 → 인덱스 맵
  const colIdx: Partial<Record<ExcelHeader, number>> = {};
  headerRow.forEach((h, i) => {
    if (ALL_HEADERS.includes(h as ExcelHeader)) {
      colIdx[h as ExcelHeader] = i;
    }
  });

  // 6) 행별 파싱
  const rows: ParsedRow[] = [];
  const seenSlotCodes = new Map<string, number>(); // slot_code → 처음 등장한 rowIndex

  for (let i = 1; i < aoa.length; i++) {
    const rawRow = aoa[i] ?? [];
    const rowIndex = i + 1; // 엑셀 1-based

    // 완전히 빈 행은 건너뜀
    if (rawRow.every((v) => s(v) === "")) continue;

    const get = (h: ExcelHeader): unknown => {
      const idx = colIdx[h];
      return idx === undefined ? undefined : rawRow[idx];
    };

    const rowErrors: ParseError[] = [];

    // 가격: 빈 값이면 에러, 변환 불가도 에러
    const rawPriceKrw = get("price_krw");
    const priceKRW = parseNumber(rawPriceKrw);
    if (priceKRW === null) {
      rowErrors.push({
        rowIndex,
        column: "price_krw",
        reason:
          s(rawPriceKrw) === ""
            ? "price_krw는 필수입니다."
            : `price_krw 숫자 변환 불가: "${s(rawPriceKrw)}"`,
      });
    }

    const rawPriceUsd = get("price_usd");
    const rawPriceUsdStr = s(rawPriceUsd);
    let priceUSD: number | null = null;
    if (rawPriceUsdStr !== "") {
      priceUSD = parseNumber(rawPriceUsd);
      if (priceUSD === null) {
        rowErrors.push({
          rowIndex,
          column: "price_usd",
          reason: `price_usd 숫자 변환 불가: "${rawPriceUsdStr}"`,
        });
      }
    }

    // 마감일
    const rawDeadline = get("deadline");
    const rawDeadlineStr = s(rawDeadline);
    let deadline: Date | null = null;
    if (rawDeadlineStr !== "" || rawDeadline instanceof Date) {
      deadline = parseDate(rawDeadline);
      if (deadline === null) {
        rowErrors.push({
          rowIndex,
          column: "deadline",
          reason: `deadline 날짜 변환 불가: "${rawDeadlineStr}" (yyyy-mm-dd 권장)`,
        });
      }
    }

    // 후보 객체 (실패한 필드는 안전한 기본값 — zod도 통과시키되 rowErrors로 막힘)
    const candidate: ParsedRow = {
      rowIndex,
      channel: s(get("channel")) as Channel,
      categoryCode: s(get("category_code")),
      categoryNameKo: s(get("category_name_ko")),
      categoryNameEn: s(get("category_name_en")),
      categoryType: s(get("category_type")) as CategoryType,
      subcategoryNameKo: s(get("subcategory_name_ko")),
      subcategoryNameEn: s(get("subcategory_name_en")),
      slotCode: s(get("slot_code")),
      size: s(get("size")),
      fileFormat: s(get("file_format")),
      deadline,
      priceKRW: priceKRW ?? 0,
      priceUSD,
      unitKo: s(get("unit_ko")) || "구좌당",
      unitEn: s(get("unit_en")) || "per slot",
      isSold: parseIsSold(get("is_sold")),
      note: s(get("note")),
      tags: parseTags(get("tags")),
    };

    // zod로 enum/포맷 검증
    const result = parsedRowSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string | undefined;
        rowErrors.push({
          rowIndex,
          column: field ? COLUMN_FROM_FIELD[field] : undefined,
          reason: issue.message,
        });
      }
    }

    // slot_code 전역 유니크 체크
    if (candidate.slotCode) {
      const prevRow = seenSlotCodes.get(candidate.slotCode);
      if (prevRow !== undefined) {
        rowErrors.push({
          rowIndex,
          column: "slot_code",
          reason: `slot_code "${candidate.slotCode}" 중복 (행 ${prevRow}와 동일)`,
        });
      } else {
        seenSlotCodes.set(candidate.slotCode, rowIndex);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    rows.push(candidate);
  }

  // 7) 카테고리 그룹핑 (첫 행 값 채택, 충돌 시 warning)
  const categoryMap = new Map<string, ParsedCategory>();
  for (const row of rows) {
    const key = row.categoryCode;
    const existing = categoryMap.get(key);
    if (!existing) {
      categoryMap.set(key, {
        code: row.categoryCode,
        channel: row.channel,
        type: row.categoryType,
        nameKo: row.categoryNameKo,
        nameEn: row.categoryNameEn,
        size: row.size,
        fileFormat: row.fileFormat,
        deadline: row.deadline,
        tags: [...row.tags],
      });
      continue;
    }

    type Conflict = { col: ExcelHeader; first: string; current: string };
    const conflicts: Conflict[] = [];
    if (existing.channel !== row.channel) {
      conflicts.push({
        col: "channel",
        first: existing.channel,
        current: row.channel,
      });
    }
    if (existing.type !== row.categoryType) {
      conflicts.push({
        col: "category_type",
        first: existing.type,
        current: row.categoryType,
      });
    }
    if (existing.nameKo !== row.categoryNameKo) {
      conflicts.push({
        col: "category_name_ko",
        first: existing.nameKo,
        current: row.categoryNameKo,
      });
    }
    if (existing.nameEn !== row.categoryNameEn) {
      conflicts.push({
        col: "category_name_en",
        first: existing.nameEn,
        current: row.categoryNameEn,
      });
    }
    if (existing.size && row.size && existing.size !== row.size) {
      conflicts.push({
        col: "size",
        first: existing.size,
        current: row.size,
      });
    }
    if (
      existing.fileFormat &&
      row.fileFormat &&
      existing.fileFormat !== row.fileFormat
    ) {
      conflicts.push({
        col: "file_format",
        first: existing.fileFormat,
        current: row.fileFormat,
      });
    }
    if (
      existing.deadline &&
      row.deadline &&
      existing.deadline.getTime() !== row.deadline.getTime()
    ) {
      conflicts.push({
        col: "deadline",
        first: existing.deadline.toISOString().slice(0, 10),
        current: row.deadline.toISOString().slice(0, 10),
      });
    }

    for (const c of conflicts) {
      warnings.push({
        rowIndex: row.rowIndex,
        column: c.col,
        reason: `카테고리 ${key}: ${c.col} 충돌 — 첫 행 값 "${c.first}" 채택, 이 행 "${c.current}" 무시`,
      });
    }
  }

  // 8) 소분류 그룹핑 (category_code + subcategory_name_ko)
  const subcatMap = new Map<string, ParsedSubcategory>();
  for (const row of rows) {
    const key = `${row.categoryCode}|${row.subcategoryNameKo}`;
    const existing = subcatMap.get(key);
    if (!existing) {
      subcatMap.set(key, {
        categoryCode: row.categoryCode,
        nameKo: row.subcategoryNameKo,
        nameEn: row.subcategoryNameEn,
        priceKRW: row.priceKRW,
        priceUSD: row.priceUSD,
        unitKo: row.unitKo,
        unitEn: row.unitEn,
        size: row.size,
      });
      continue;
    }

    if (existing.priceKRW !== row.priceKRW) {
      warnings.push({
        rowIndex: row.rowIndex,
        column: "price_krw",
        reason: `소분류 ${row.categoryCode}/${row.subcategoryNameKo || "(기본)"}: price_krw 충돌 (${existing.priceKRW} vs ${row.priceKRW}) — 첫 값 채택`,
      });
    }
    if (existing.unitKo !== row.unitKo) {
      warnings.push({
        rowIndex: row.rowIndex,
        column: "unit_ko",
        reason: `소분류 ${row.categoryCode}/${row.subcategoryNameKo || "(기본)"}: unit_ko 충돌 ("${existing.unitKo}" vs "${row.unitKo}") — 첫 값 채택`,
      });
    }
    if (
      existing.priceUSD != null &&
      row.priceUSD != null &&
      existing.priceUSD !== row.priceUSD
    ) {
      warnings.push({
        rowIndex: row.rowIndex,
        column: "price_usd",
        reason: `소분류 ${row.categoryCode}/${row.subcategoryNameKo || "(기본)"}: price_usd 충돌 (${existing.priceUSD} vs ${row.priceUSD}) — 첫 값 채택`,
      });
    }
    if (existing.nameEn !== row.subcategoryNameEn) {
      warnings.push({
        rowIndex: row.rowIndex,
        column: "subcategory_name_en",
        reason: `소분류 ${row.categoryCode}/${row.subcategoryNameKo || "(기본)"}: subcategory_name_en 충돌 ("${existing.nameEn}" vs "${row.subcategoryNameEn}") — 첫 값 채택`,
      });
    }
  }

  // 9) 슬롯
  const slots: ParsedSlot[] = rows.map((row) => ({
    code: row.slotCode,
    categoryCode: row.categoryCode,
    subcategoryNameKo: row.subcategoryNameKo,
    isSold: row.isSold,
    note: row.note,
  }));

  return {
    rows,
    errors,
    warnings,
    summary: {
      rows: rows.length,
      categories: categoryMap.size,
      subcategories: subcatMap.size,
      slots: slots.length,
      errors: errors.length,
      warnings: warnings.length,
    },
    categories: Array.from(categoryMap.values()),
    subcategories: Array.from(subcatMap.values()),
    slots,
    ok: errors.length === 0,
  };
}

function makeEmptyResult(
  errors: ParseError[],
  warnings: ParseWarning[]
): ParseResult {
  return {
    rows: [],
    errors,
    warnings,
    summary: {
      rows: 0,
      categories: 0,
      subcategories: 0,
      slots: 0,
      errors: errors.length,
      warnings: warnings.length,
    },
    categories: [],
    subcategories: [],
    slots: [],
    ok: errors.length === 0,
  };
}
