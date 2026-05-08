/**
 * 엑셀 양식 동적 생성.
 *
 * - generateTemplateBuffer(): Uint8Array — 메모리에서 바로 xlsx 바이너리 반환
 * - downloadTemplate(): 브라우저에서 다운로드 트리거
 *
 * 시트 구성:
 *   - "data": 헤더 + 예시 5행 (CBA-1/2/3, LNY-1, XPC-1)
 *   - "안내": 사용법 + 컬럼 설명표 + 카테고리 유형 표
 *
 * 주의: sheetjs CE는 cell style(굵게/배경색)을 .xlsx 출력 시 보존하지 않습니다.
 *      (스타일 보존이 필요하면 xlsx-js-style 패키지 추가가 필요)
 *      → 여기서는 컬럼 너비와 row 높이까지만 설정하고, 헤더 강조는 Excel에서
 *        직접 적용하거나 5-4 페이지의 안내 텍스트로 대체.
 */

import * as XLSX from "xlsx";
import { ALL_HEADERS, REQUIRED_HEADERS, type ExcelHeader } from "./parser";

const TEMPLATE_FILENAME_DEFAULT = "kprint_template.xlsx";
const DATA_SHEET_NAME = "data";
const GUIDE_SHEET_NAME = "안내";

// ----------------------------------------------------------------------------
// 예시 5행
// ----------------------------------------------------------------------------

type RowDict = Record<ExcelHeader, string | number | Date | boolean>;

const EXAMPLE_ROWS: RowDict[] = [
  // 천장 배너 Hall A — 3구좌
  {
    channel: "offline",
    category_code: "CBA",
    category_name_ko: "천장 배너",
    category_name_en: "Ceiling Banner",
    category_type: "floor_plan",
    slot_code: "CBA-A-1",
    price_krw: 3000000,
    subcategory_name_ko: "Hall A",
    subcategory_name_en: "Hall A",
    size: "1800mm × 3500mm",
    file_format: "AI, EPS, PDF",
    deadline: new Date("2026-07-15"),
    price_usd: 2400,
    unit_ko: "구좌당",
    unit_en: "per slot",
    is_sold: "FALSE",
    note: "A1 출입구 좌측",
    tags: "브랜드_확산형, 온사이트",
  },
  {
    channel: "offline",
    category_code: "CBA",
    category_name_ko: "천장 배너",
    category_name_en: "Ceiling Banner",
    category_type: "floor_plan",
    slot_code: "CBA-A-2",
    price_krw: 3000000,
    subcategory_name_ko: "Hall A",
    subcategory_name_en: "Hall A",
    size: "1800mm × 3500mm",
    file_format: "AI, EPS, PDF",
    deadline: new Date("2026-07-15"),
    price_usd: 2400,
    unit_ko: "구좌당",
    unit_en: "per slot",
    is_sold: "TRUE",
    note: "Hall A 중앙 동선",
    tags: "브랜드_확산형, 온사이트",
  },
  {
    channel: "offline",
    category_code: "CBA",
    category_name_ko: "천장 배너",
    category_name_en: "Ceiling Banner",
    category_type: "floor_plan",
    slot_code: "CBA-A-3",
    price_krw: 3000000,
    subcategory_name_ko: "Hall A",
    subcategory_name_en: "Hall A",
    size: "1800mm × 3500mm",
    file_format: "AI, EPS, PDF",
    deadline: new Date("2026-07-15"),
    price_usd: 2400,
    unit_ko: "구좌당",
    unit_en: "per slot",
    is_sold: "FALSE",
    note: "A1 출입구 우측",
    tags: "브랜드_확산형, 온사이트",
  },
  // 참관객 목걸이 — 단일 기본 소분류 (subcategory 비움)
  {
    channel: "offline",
    category_code: "LNY",
    category_name_ko: "참관객 목걸이",
    category_name_en: "Visitor Lanyard",
    category_type: "quantity",
    slot_code: "LNY-1",
    price_krw: 15000000,
    subcategory_name_ko: "",
    subcategory_name_en: "",
    size: "20mm × 900mm",
    file_format: "AI, EPS",
    deadline: new Date("2026-06-15"),
    price_usd: 12000,
    unit_ko: "5,000개당",
    unit_en: "per 5,000 ea",
    is_sold: "FALSE",
    note: "행사 4일간 전 방문객 착용",
    tags: "브랜드_확산형, 온사이트, 등록경로",
  },
  // XPACE 옥외 LED — 브릿지 1구좌
  {
    channel: "offline",
    category_code: "XPC",
    category_name_ko: "XPACE 옥외 LED",
    category_name_en: "XPACE Outdoor LED",
    category_type: "xpace",
    slot_code: "XPC-BR-1",
    price_krw: 15000000,
    subcategory_name_ko: "브릿지",
    subcategory_name_en: "Bridge",
    size: "12m × 4m",
    file_format: "MP4 (H.264)",
    deadline: new Date("2026-07-01"),
    price_usd: 12000,
    unit_ko: "구좌당",
    unit_en: "per slot",
    is_sold: "FALSE",
    note: "동측 브릿지 정면",
    tags: "브랜드_확산형, 옥외, 글로벌",
  },
];

// ----------------------------------------------------------------------------
// 안내 시트 — 컬럼별 한글 설명
// ----------------------------------------------------------------------------

type ColumnGuide = {
  key: ExcelHeader;
  required: boolean;
  desc: string;
  example: string;
  note: string;
};

const COLUMN_GUIDES: ColumnGuide[] = [
  { key: "channel", required: true, desc: "채널 구분", example: "offline", note: "offline / online / package 중 하나" },
  { key: "category_code", required: true, desc: "카테고리 영문 코드 (3자리 권장)", example: "CBA", note: "같은 카테고리 슬롯들은 동일한 코드 사용" },
  { key: "category_name_ko", required: true, desc: "카테고리 한글명", example: "천장 배너", note: "같은 카테고리 안에서 일관" },
  { key: "category_name_en", required: true, desc: "카테고리 영문명", example: "Ceiling Banner", note: "같은 카테고리 안에서 일관" },
  { key: "category_type", required: true, desc: "카테고리 유형 영문 키", example: "floor_plan", note: "9가지 중 하나 (하단 표 참조)" },
  { key: "slot_code", required: true, desc: "슬롯 고유 코드", example: "CBA-A-1", note: "전체에서 유일해야 함 — 중복 불가" },
  { key: "price_krw", required: true, desc: "원화 가격 (숫자)", example: "3000000", note: "콤마 OK — \"3,000,000\"" },
  { key: "subcategory_name_ko", required: false, desc: "소분류 한글명", example: "Hall A", note: "비우면 단일 기본 소분류 자동 생성" },
  { key: "subcategory_name_en", required: false, desc: "소분류 영문명", example: "Hall A", note: "" },
  { key: "size", required: false, desc: "사이즈", example: "1800mm × 3500mm", note: "카테고리 공통이면 모든 행 동일하게" },
  { key: "file_format", required: false, desc: "입고 파일 형식", example: "AI, EPS, PDF", note: "" },
  { key: "deadline", required: false, desc: "입고 마감일", example: "2026-07-15", note: "yyyy-mm-dd 권장 (점·슬래시도 가능)" },
  { key: "price_usd", required: false, desc: "달러 가격", example: "2400", note: "해외 바이어용 — 빈 셀이면 미표시" },
  { key: "unit_ko", required: false, desc: "단가 단위 한글", example: "구좌당", note: "빈 값이면 \"구좌당\" 자동" },
  { key: "unit_en", required: false, desc: "단가 단위 영문", example: "per slot", note: "빈 값이면 \"per slot\" 자동" },
  { key: "is_sold", required: false, desc: "마감 여부", example: "FALSE", note: "TRUE / FALSE / 마감 / 가능 / Y / N" },
  { key: "note", required: false, desc: "위치 메모 / 비고", example: "A1 출입구 좌측", note: "도면형은 핀의 위치 메모로 사용" },
  { key: "tags", required: false, desc: "태그 (콤마 구분)", example: "브랜드_확산형, 온사이트", note: "분류·태그 관리에서 정의된 태그 ID" },
];

const CATEGORY_TYPE_GUIDES: Array<[string, string, string]> = [
  ["floor_plan", "도면형", "천장 배너, 등록대, 라이팅월, 기둥광고 — 도면 위 위치 지정"],
  ["quantity", "수량형", "참관객 목걸이, 초대장 삽지 — 수량 단위 (5천/10만 개 등)"],
  ["media", "미디어형", "경품 이벤트 LED — 영상 송출 횟수 단위"],
  ["digital_banner", "디지털 배너", "통합 검색 / 세미나 검색 페이지 배너"],
  ["mailing", "발송형", "뉴스레터, APP 푸시 — 발송일 기반"],
  ["print_page", "지면형", "쇼가이드 표4 / 표2 / 표3 등 인쇄 면"],
  ["content", "콘텐츠형", "SNS 인터뷰, 카드뉴스 — 콘텐츠 제작 채널"],
  ["xpace", "XPACE", "옥외 LED (브릿지 / 엣지칼럼 / 와이드 / 스퀘어) — 도면 + 영상"],
  ["package", "패키지", "시그니처 / 스탠다드 패키지 — 묶음 상품"],
];

// ----------------------------------------------------------------------------
// 시트 빌더
// ----------------------------------------------------------------------------

function buildDataSheet(): XLSX.WorkSheet {
  // 헤더 + 데이터 행 (2D 배열)
  const headerRow: string[] = ALL_HEADERS.slice();
  const aoa: Array<Array<string | number | Date | boolean>> = [headerRow];
  for (const row of EXAMPLE_ROWS) {
    aoa.push(ALL_HEADERS.map((h) => row[h]));
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  // 컬럼 너비 — 한글/숫자/날짜 등에 맞춰
  const widths: Partial<Record<ExcelHeader, number>> = {
    channel: 10,
    category_code: 14,
    category_name_ko: 16,
    category_name_en: 18,
    category_type: 14,
    slot_code: 14,
    price_krw: 12,
    subcategory_name_ko: 16,
    subcategory_name_en: 16,
    size: 22,
    file_format: 16,
    deadline: 12,
    price_usd: 10,
    unit_ko: 12,
    unit_en: 12,
    is_sold: 10,
    note: 24,
    tags: 28,
  };
  sheet["!cols"] = ALL_HEADERS.map((h) => ({ wch: widths[h] ?? 14 }));

  // deadline 컬럼 셀에 yyyy-mm-dd 포맷 지정
  const deadlineColIdx = ALL_HEADERS.indexOf("deadline");
  if (deadlineColIdx >= 0) {
    for (let r = 1; r <= EXAMPLE_ROWS.length; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: deadlineColIdx });
      const cell = sheet[addr];
      if (cell) cell.z = "yyyy-mm-dd";
    }
  }

  return sheet;
}

function buildGuideSheet(): XLSX.WorkSheet {
  const aoa: Array<Array<string | number>> = [];

  // 1. 타이틀
  aoa.push(["K-PRINT 스폰서십 엑셀 양식 안내"]);
  aoa.push([""]);

  // 2. 사용법
  aoa.push(["■ 이 양식 사용법"]);
  aoa.push(["1. \"data\" 시트의 행을 한 줄씩 채우세요. 한 행 = 한 슬롯입니다."]);
  aoa.push(["2. 같은 카테고리의 여러 슬롯은 카테고리·소분류 정보를 매 행에 반복 입력하세요."]);
  aoa.push(["3. 별표(*) 표시된 컬럼은 필수입니다."]);
  aoa.push(["4. 비워둘 수 있는 컬럼은 빈 셀로 두면 됩니다."]);
  aoa.push(["5. 업로드 시 동기화 모드를 선택할 수 있습니다 (덮어쓰기 / 병합 / 신규만)."]);
  aoa.push(["6. 도면형/XPACE의 핀 좌표는 이 양식에 없습니다. 어드민 화면에서 직접 찍습니다."]);
  aoa.push([""]);

  // 3. 컬럼 설명표
  aoa.push(["■ 컬럼별 설명"]);
  aoa.push(["컬럼명", "필수/선택", "설명", "입력 예시", "비고"]);
  for (const g of COLUMN_GUIDES) {
    aoa.push([
      g.required ? `* ${g.key}` : g.key,
      g.required ? "필수" : "선택",
      g.desc,
      g.example,
      g.note,
    ]);
  }
  aoa.push([""]);

  // 4. 카테고리 유형 표
  aoa.push(["■ 카테고리 유형 (category_type) 영문 키"]);
  aoa.push(["영문 키", "한글 명칭", "설명"]);
  for (const [en, ko, desc] of CATEGORY_TYPE_GUIDES) {
    aoa.push([en, ko, desc]);
  }
  aoa.push([""]);

  // 5. 입력 형식 안내
  aoa.push(["■ 특수 컬럼 입력 형식"]);
  aoa.push(["• is_sold:", "TRUE / FALSE / 마감 / 가능 / Y / N (대소문자 무관, 빈 칸 = 가능)"]);
  aoa.push(["• tags:", "콤마(,)로 구분  예) 브랜드_확산형, 온사이트, 등록경로"]);
  aoa.push(["• deadline:", "yyyy-mm-dd 권장  예) 2026-07-15  (yyyy.mm.dd / yyyy/mm/dd 도 허용)"]);
  aoa.push(["• price_krw / price_usd:", "콤마 무방  예) \"3,000,000\" — 숫자만으로도 OK"]);
  aoa.push([""]);

  // 6. 동기화 모드 안내
  aoa.push(["■ 동기화 모드"]);
  aoa.push(["덮어쓰기:", "엑셀에 있는 카테고리들을 전부 교체. 이미지·도면 핀·잠금 해제 필드는 보존."]);
  aoa.push(["병합:", "기존 데이터 유지하면서 가격·마감·사이즈만 갱신. 이미지·텍스트 안 건드림."]);
  aoa.push(["신규만:", "기존 코드는 무시, 새 코드만 추가. 가장 안전."]);

  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // 컬럼 너비
  sheet["!cols"] = [
    { wch: 26 }, // 컬럼명 / 키
    { wch: 12 }, // 필수
    { wch: 50 }, // 설명
    { wch: 28 }, // 예시
    { wch: 50 }, // 비고
  ];

  return sheet;
}

// ----------------------------------------------------------------------------
// 공개 API
// ----------------------------------------------------------------------------

/** xlsx 바이너리(Uint8Array) 생성. 브라우저·Node 양쪽에서 동작. */
export function generateTemplateBuffer(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const dataSheet = buildDataSheet();
  XLSX.utils.book_append_sheet(wb, dataSheet, DATA_SHEET_NAME);

  const guideSheet = buildGuideSheet();
  XLSX.utils.book_append_sheet(wb, guideSheet, GUIDE_SHEET_NAME);

  // type: 'array' → ArrayBuffer 반환 (sheetjs CE). Uint8Array로 감싸서 length/byteLength 모두 보장.
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}

/** 브라우저 환경에서 xlsx 파일 다운로드 트리거. */
export function downloadTemplate(filename: string = TEMPLATE_FILENAME_DEFAULT): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("downloadTemplate은 브라우저에서만 호출할 수 있습니다.");
  }

  const buffer = generateTemplateBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

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

// 헤더 검증용 — REQUIRED_HEADERS의 외부 노출 (사용처에서 import 불필요)
export { REQUIRED_HEADERS };
