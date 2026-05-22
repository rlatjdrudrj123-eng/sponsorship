/**
 * 엑셀 내보내기 — Firestore 의 현재 데이터를 import 양식과 동일한 컬럼으로 출력.
 *
 * 용도:
 *  - 어드민에서 다른 사람에게 데이터 공유 (엑셀로)
 *  - 내년 행사 준비 시 작년 데이터 → 엑셀 → 수정 → 재업로드
 *
 * Import 와 같은 헤더 (ALL_HEADERS) 사용 — 내려받은 그대로 다시 업로드 가능.
 * 패키지·이미지·도면 핀 등은 엑셀로 표현 안 됨 (어드민에서 별도 관리).
 */

import ExcelJS from "exceljs";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Category, Slot, Subcategory } from "@/lib/types";
import { ALL_HEADERS, REQUIRED_HEADERS, type ExcelHeader } from "./parser";

const DATA_SHEET_NAME = "data";

const COL_WIDTHS: Partial<Record<ExcelHeader, number>> = {
  channel: 10,
  category_code: 14,
  category_name_ko: 26,
  category_name_en: 26,
  category_type: 14,
  slot_code: 12,
  price_krw: 14,
  subcategory_name_ko: 18,
  subcategory_name_en: 18,
  size: 22,
  file_format: 18,
  deadline: 13,
  price_usd: 11,
  unit_ko: 12,
  unit_en: 14,
  is_sold: 10,
  note: 24,
  tags: 32,
  short_desc: 42,
  selector_id: 22,
  timing: 16,
  location: 24,
};

type RowDict = Record<ExcelHeader, string | number | Date | boolean | "">;

function rowsFromFirestore(
  categories: Category[],
  subcategories: Subcategory[],
  slots: Slot[]
): RowDict[] {
  // 보조 인덱스
  const subsByCat = new Map<string, Subcategory[]>();
  for (const sub of subcategories) {
    const arr = subsByCat.get(sub.categoryId) ?? [];
    arr.push(sub);
    subsByCat.set(sub.categoryId, arr);
  }
  const slotsBySub = new Map<string, Slot[]>();
  for (const slot of slots) {
    const arr = slotsBySub.get(slot.subcategoryId) ?? [];
    arr.push(slot);
    slotsBySub.set(slot.subcategoryId, arr);
  }

  const rows: RowDict[] = [];
  // 카테고리 → 소분류 (order asc) → 슬롯 (order asc) 순서
  const sortedCats = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const cat of sortedCats) {
    if (cat.type === "package") continue; // 패키지는 별도 어드민
    const subs = (subsByCat.get(cat.id) ?? []).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    if (subs.length === 0) continue;
    for (const sub of subs) {
      const subSlots = (slotsBySub.get(sub.id) ?? []).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      if (subSlots.length === 0) continue;
      for (const slot of subSlots) {
        rows.push({
          channel: cat.channel,
          category_code: cat.code,
          category_name_ko: cat.name?.ko ?? "",
          category_name_en: cat.name?.en ?? "",
          category_type: cat.type,
          slot_code: slot.code,
          price_krw: sub.priceKRW ?? 0,
          subcategory_name_ko: sub.name?.ko ?? "",
          subcategory_name_en: sub.name?.en ?? "",
          size: cat.size ?? "",
          file_format: cat.fileFormat ?? "",
          deadline: cat.deadline ? cat.deadline.toDate() : "",
          price_usd: sub.priceUSD ?? "",
          unit_ko: sub.unit?.ko ?? "",
          unit_en: sub.unit?.en ?? "",
          is_sold: slot.status === "sold" ? "TRUE" : "FALSE",
          note: slot.note ?? "",
          tags: (cat.tags ?? []).join(", "),
          short_desc: cat.shortDesc ?? "",
          selector_id: cat.selectorId ?? "",
          timing: (cat.timingOverride ?? []).join(", "),
          location: (cat.locationOverride ?? []).join(", "),
        });
      }
    }
  }
  return rows;
}

function buildExportDataSheet(
  wb: ExcelJS.Workbook,
  rows: RowDict[]
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(DATA_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = ALL_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: COL_WIDTHS[h] ?? 14,
  }));

  // 헤더 스타일 (import template 와 동일)
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  ALL_HEADERS.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    const required = (REQUIRED_HEADERS as readonly ExcelHeader[]).includes(h);
    cell.value = required ? `* ${h}` : h;
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
      name: "Pretendard",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: required ? "FF0A6F5A" : "FF1F2937" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  // 데이터 행
  rows.forEach((row) => {
    const r = ws.addRow(ALL_HEADERS.map((h) => row[h]));
    r.height = 20;
    r.font = { name: "Pretendard", size: 10 };
  });

  // 가격 콤마
  ["price_krw", "price_usd"].forEach((key) => {
    const colIdx = ALL_HEADERS.indexOf(key as ExcelHeader);
    if (colIdx >= 0) ws.getColumn(colIdx + 1).numFmt = "#,##0";
  });

  // 마감일 yyyy-mm-dd
  const deadlineIdx = ALL_HEADERS.indexOf("deadline");
  if (deadlineIdx >= 0) {
    ws.getColumn(deadlineIdx + 1).numFmt = "yyyy-mm-dd";
  }

  return ws;
}

function buildExportMetaSheet(
  wb: ExcelJS.Workbook,
  meta: { eventId: string; exportedAt: Date; rowCount: number }
): void {
  const ws = wb.addWorksheet("내보내기 정보");
  ws.columns = [{ width: 18 }, { width: 50 }];
  ws.addRow(["내보낸 행사", meta.eventId]);
  ws.addRow(["내보낸 시각", meta.exportedAt.toLocaleString("ko-KR")]);
  ws.addRow(["행 수", meta.rowCount]);
  ws.addRow([]);
  ws.addRow([
    "사용 방법",
    "이 파일을 그대로 어드민 '엑셀 일괄 등록' 에 업로드하면 동일한 데이터가 재현됩니다.",
  ]);
  ws.addRow([
    "주의",
    "패키지·이미지·도면 핀 등은 엑셀로 표현되지 않습니다. 어드민에서 별도 관리하세요.",
  ]);
  ws.getColumn(1).font = { bold: true, name: "Pretendard" };
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export async function generateExportBuffer(
  eventId: string
): Promise<Uint8Array> {
  if (!eventId) throw new Error("eventId 가 필요합니다.");
  const db = getDb();
  // 카테고리·소분류·슬롯 일괄 조회 (행사 단위)
  const [catSnap, subSnap, slotSnap] = await Promise.all([
    getDocs(query(collection(db, "categories"), where("eventId", "==", eventId))),
    getDocs(
      query(collection(db, "subcategories"), where("eventId", "==", eventId))
    ),
    getDocs(query(collection(db, "slots"), where("eventId", "==", eventId))),
  ]);
  const categories = catSnap.docs.map((d) => ({
    ...(d.data() as Category),
    id: d.id,
  }));
  const subcategories = subSnap.docs.map((d) => ({
    ...(d.data() as Subcategory),
    id: d.id,
  }));
  const slots = slotSnap.docs.map((d) => ({ ...(d.data() as Slot), id: d.id }));

  const rows = rowsFromFirestore(categories, subcategories, slots);

  const wb = new ExcelJS.Workbook();
  wb.creator = "K-PRINT Admin";
  wb.created = new Date();

  buildExportDataSheet(wb, rows);
  buildExportMetaSheet(wb, {
    eventId,
    exportedAt: new Date(),
    rowCount: rows.length,
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

export async function downloadExport(eventId: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("downloadExport 은 브라우저에서만 호출할 수 있습니다.");
  }
  const buffer = await generateExportBuffer(eventId);
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `kprint_${eventId}_${today}.xlsx`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
