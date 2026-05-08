/**
 * 엑셀 양식 동적 생성 — 40개 카테고리(패키지 제외) 샘플 행 포함.
 *
 * - generateTemplateBuffer(): Uint8Array
 * - downloadTemplate(): 브라우저 다운로드 트리거
 *
 * 시트 구성:
 *   - "data": 헤더 + 32개 카테고리의 슬롯 행 (패키지 type 제거 — 통합됨)
 *   - "안내": 사용법 + 컬럼 설명표 + 카테고리 유형 표
 */

import * as XLSX from "xlsx";
import { ALL_HEADERS, REQUIRED_HEADERS, type ExcelHeader } from "./parser";
import type { CategoryType } from "../types";

const TEMPLATE_FILENAME_DEFAULT = "kprint_template.xlsx";
const DATA_SHEET_NAME = "data";
const GUIDE_SHEET_NAME = "안내";

// ----------------------------------------------------------------------------
// 카테고리 정의 — 행 생성용
// ----------------------------------------------------------------------------

type SlotDef = { code: string; note?: string; sold?: boolean };
type SubDef = {
  ko: string;
  en: string;
  priceKRW: number;
  priceUSD?: number;
  unitKo?: string;
  unitEn?: string;
  slots: SlotDef[];
};
type CatDef = {
  channel: "offline" | "online";
  code: string;
  nameKo: string;
  nameEn: string;
  type: Exclude<CategoryType, "package">;
  size?: string;
  fileFormat?: string;
  deadline?: string;
  tags?: string;
  subs: SubDef[];
};

const KIMES_DEADLINE = "2026-02-15"; // 통합 마감 (도면형/등록대 기준)

const CAT_DEFS: CatDef[] = [
  // ============ XPACE 시리즈 ============
  {
    channel: "offline",
    code: "XPA",
    nameKo: "XPACE 브릿지+빅브릿지",
    nameEn: "XPACE Bridge + Big Bridge",
    type: "xpace",
    size: "다양 (브릿지/빅브릿지)",
    fileFormat: "MP4 (H.264, 30fps)",
    deadline: "2026-02-01",
    tags: "옥외, 브랜드_확산형, 글로벌",
    subs: [
      {
        ko: "브릿지+빅브릿지",
        en: "Bridge + Big Bridge",
        priceKRW: 11_000_000,
        priceUSD: 8500,
        slots: [
          { code: "XPA-1", note: "동측 브릿지 1구역" },
          { code: "XPA-2", note: "동측 브릿지 2구역" },
          { code: "XPA-3", note: "옥외 LED 통합" },
        ],
      },
    ],
  },
  {
    channel: "offline",
    code: "XPB",
    nameKo: "XPACE 와이드+스퀘어",
    nameEn: "XPACE Wide + Square",
    type: "xpace",
    size: "다양",
    fileFormat: "MP4 (H.264, 30fps)",
    deadline: "2026-02-01",
    tags: "옥외, 브랜드_확산형",
    subs: [
      {
        ko: "와이드+스퀘어",
        en: "Wide + Square",
        priceKRW: 5_000_000,
        priceUSD: 3900,
        slots: [
          { code: "XPB-1", note: "와이드 1면" },
          { code: "XPB-2", note: "와이드 2면" },
          { code: "XPB-3", note: "스퀘어 1면" },
          { code: "XPB-4", note: "스퀘어 2면" },
        ],
      },
    ],
  },
  {
    channel: "offline",
    code: "XPE",
    nameKo: "XPACE 엣지컬럼",
    nameEn: "XPACE Edge Column",
    type: "xpace",
    size: "8m × 1m (4면)",
    fileFormat: "MP4 (H.264, 30fps)",
    deadline: "2026-02-01",
    tags: "옥외, 브랜드_확산형",
    subs: [
      {
        ko: "엣지컬럼",
        en: "Edge Column",
        priceKRW: 4_000_000,
        priceUSD: 3100,
        slots: [
          { code: "XPE-1", note: "정면 컬럼 1" },
          { code: "XPE-2", note: "측면 컬럼 1" },
        ],
      },
    ],
  },

  // ============ 천장 배너 ============
  {
    channel: "offline",
    code: "CBA",
    nameKo: "천장 배너 Hall A",
    nameEn: "Ceiling Banner Hall A",
    type: "floor_plan",
    size: "1800mm × 3500mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 브랜드_확산형",
    subs: [
      {
        ko: "Hall A",
        en: "Hall A",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        slots: [
          { code: "CBA-1", note: "A1 입구 좌측" },
          { code: "CBA-2", note: "A1 입구 우측" },
          { code: "CBA-3", note: "Hall A 중앙" },
          { code: "CBA-4", note: "Hall A 동측", sold: true },
          { code: "CBA-5", note: "Hall A 서측" },
          { code: "CBA-6", note: "Hall A 후면" },
          { code: "CBA-7", note: "A2 출구" },
        ],
      },
    ],
  },
  {
    channel: "offline",
    code: "CBB",
    nameKo: "천장 배너 Hall B",
    nameEn: "Ceiling Banner Hall B",
    type: "floor_plan",
    size: "1800mm × 3500mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 브랜드_확산형",
    subs: [
      {
        ko: "Hall B",
        en: "Hall B",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        slots: [
          { code: "CBB-1", note: "B 입구" },
          { code: "CBB-2", note: "Hall B 중앙" },
          { code: "CBB-3", note: "Hall B 후면" },
          { code: "CBB-4", note: "B 출구" },
          { code: "CBB-5" },
          { code: "CBB-6" },
        ],
      },
    ],
  },
  {
    channel: "offline",
    code: "CBC",
    nameKo: "천장 배너 Hall C",
    nameEn: "Ceiling Banner Hall C",
    type: "floor_plan",
    size: "1800mm × 3500mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 브랜드_확산형",
    subs: [
      {
        ko: "Hall C",
        en: "Hall C",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        slots: [
          { code: "CBC-1", note: "C 입구" },
          { code: "CBC-2" },
          { code: "CBC-3", note: "Hall C 중앙" },
          { code: "CBC-4" },
          { code: "CBC-5" },
          { code: "CBC-6" },
          { code: "CBC-7", note: "C 출구" },
        ],
      },
    ],
  },

  // ============ 등록대 ============
  {
    channel: "offline",
    code: "RGA",
    nameKo: "등록대(출입증 발급대) Hall A",
    nameEn: "Registration Desk Hall A",
    type: "floor_plan",
    size: "W900 × D600 × H1100mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 등록경로, 브랜드_확산형",
    subs: [
      {
        ko: "A1 등록대",
        en: "A1 Desk",
        priceKRW: 2_500_000,
        priceUSD: 2000,
        slots: [
          { code: "RGA-1", note: "A1 입구 1번" },
          { code: "RGA-2", note: "A1 입구 2번" },
          { code: "RGA-3" },
          { code: "RGA-4" },
          { code: "RGA-5", sold: true },
        ],
      },
      {
        ko: "A2 등록대",
        en: "A2 Desk",
        priceKRW: 2_500_000,
        priceUSD: 2000,
        slots: [
          { code: "RGA-6", note: "A2 입구 1번" },
          { code: "RGA-7" },
          { code: "RGA-8" },
          { code: "RGA-9" },
        ],
      },
    ],
  },
  {
    channel: "offline",
    code: "RGB",
    nameKo: "등록대(출입증 발급대) Hall B",
    nameEn: "Registration Desk Hall B",
    type: "floor_plan",
    size: "W900 × D600 × H1100mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 등록경로",
    subs: [
      {
        ko: "Hall B",
        en: "Hall B",
        priceKRW: 2_500_000,
        priceUSD: 2000,
        slots: [{ code: "RGB-1", note: "B 입구 1번" }, { code: "RGB-2" }],
      },
    ],
  },
  {
    channel: "offline",
    code: "RGC",
    nameKo: "등록대(출입증 발급대) Hall C",
    nameEn: "Registration Desk Hall C",
    type: "floor_plan",
    size: "W900 × D600 × H1100mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 등록경로",
    subs: [
      {
        ko: "Hall C",
        en: "Hall C",
        priceKRW: 2_500_000,
        priceUSD: 2000,
        slots: [{ code: "RGC-1", note: "C 입구 1번" }, { code: "RGC-2" }, { code: "RGC-3" }],
      },
    ],
  },
  {
    channel: "offline",
    code: "RGD",
    nameKo: "등록대(출입증 발급대) Hall D",
    nameEn: "Registration Desk Hall D",
    type: "floor_plan",
    size: "W900 × D600 × H1100mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 등록경로, 단독",
    subs: [
      {
        ko: "Hall D (단독)",
        en: "Hall D (Solo)",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        slots: [{ code: "RGD-1", note: "D 입구 단독" }],
      },
    ],
  },

  // ============ 도면형 기타 ============
  {
    channel: "offline",
    code: "LTW",
    nameKo: "라이팅월",
    nameEn: "Lighting Wall",
    type: "floor_plan",
    size: "2400mm × 3000mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 브랜드_확산형",
    subs: [
      {
        ko: "라이팅월",
        en: "Lighting Wall",
        priceKRW: 2_000_000,
        priceUSD: 1600,
        slots: [
          { code: "LTW-1", note: "Hall A 입구" },
          { code: "LTW-2", note: "Hall B 입구", sold: true },
          { code: "LTW-3", note: "Hall C 입구" },
          { code: "LTW-4", note: "Hall D 입구" },
        ],
      },
    ],
  },
  {
    channel: "offline",
    code: "FST",
    nameKo: "전시장 내부 바닥 스티커",
    nameEn: "Floor Sticker",
    type: "floor_plan",
    size: "1500mm × 1500mm",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 동선",
    subs: [
      {
        ko: "바닥 스티커",
        en: "Floor Sticker",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        slots: [{ code: "FST-1" }, { code: "FST-2" }, { code: "FST-3" }, { code: "FST-4" }],
      },
    ],
  },
  {
    channel: "offline",
    code: "PLA",
    nameKo: "1층 기둥광고",
    nameEn: "Pillar Ad (1F)",
    type: "floor_plan",
    size: "기둥 4면",
    fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE,
    tags: "온사이트, 브랜드_확산형",
    subs: [
      {
        ko: "1층 기둥",
        en: "1F Pillar",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        slots: [{ code: "PLA-1" }, { code: "PLA-2" }, { code: "PLA-3" }, { code: "PLA-4" }],
      },
    ],
  },

  // ============ 수량형 ============
  {
    channel: "offline",
    code: "BGE",
    nameKo: "참관객 목걸이",
    nameEn: "Visitor Lanyard",
    type: "quantity",
    size: "20mm × 900mm",
    fileFormat: "AI, EPS",
    deadline: "2026-01-15",
    tags: "온사이트, 등록경로, 브랜드_확산형",
    subs: [
      {
        ko: "기본 5,000매",
        en: "Base 5,000ea",
        priceKRW: 15_000_000,
        priceUSD: 12000,
        unitKo: "5,000매당",
        unitEn: "per 5,000",
        slots: [{ code: "BGE-1", note: "기본 구좌" }],
      },
      {
        ko: "추가 5,000매",
        en: "Additional 5,000ea",
        priceKRW: 5_000_000,
        priceUSD: 4000,
        unitKo: "1구좌당 5,000매",
        unitEn: "per 5,000 (slot)",
        slots: [
          { code: "BGE-2" },
          { code: "BGE-3" },
          { code: "BGE-4" },
          { code: "BGE-5" },
        ],
      },
    ],
  },
  {
    channel: "offline",
    code: "IVL",
    nameKo: "초대장 삽지",
    nameEn: "Invitation Insert",
    type: "quantity",
    size: "150mm × 100mm",
    fileFormat: "AI, EPS, PDF",
    deadline: "2026-01-20",
    tags: "프린트, 등록경로, 단독",
    subs: [
      {
        ko: "초대장 삽지",
        en: "Insert",
        priceKRW: 8_000_000,
        priceUSD: 6300,
        unitKo: "10만매당",
        unitEn: "per 100k",
        slots: [{ code: "IVL-1" }, { code: "IVL-2" }],
      },
    ],
  },

  // ============ 미디어형 ============
  {
    channel: "offline",
    code: "LDL",
    nameKo: "경품 이벤트 LED",
    nameEn: "Prize Event LED",
    type: "media",
    size: "—",
    fileFormat: "MP4 (15초 이내)",
    deadline: "2026-02-10",
    tags: "온사이트, 영상",
    subs: [
      {
        ko: "경품 LED",
        en: "Prize LED",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        unitKo: "구좌당",
        unitEn: "per slot",
        slots: [
          { code: "LDL-1" },
          { code: "LDL-2" },
          { code: "LDL-3" },
          { code: "LDL-4" },
          { code: "LDL-5" },
        ],
      },
    ],
  },

  // ============ 지면형 (쇼가이드) ============
  {
    channel: "offline",
    code: "GDB",
    nameKo: "현장 쇼가이드 광고",
    nameEn: "Show Guide Ad",
    type: "print_page",
    size: "210mm × 297mm",
    fileFormat: "AI, PDF (CMYK)",
    deadline: "2026-01-30",
    tags: "프린트, 정보탐색",
    subs: [
      {
        ko: "표4 (국문)",
        en: "Cover 4 (KR)",
        priceKRW: 4_000_000,
        priceUSD: 3100,
        unitKo: "면당",
        unitEn: "per page",
        slots: [{ code: "GDB-1" }],
      },
      {
        ko: "표2 (국문)",
        en: "Cover 2 (KR)",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        unitKo: "면당",
        unitEn: "per page",
        slots: [{ code: "GDB-2" }],
      },
      {
        ko: "표3 (국문)",
        en: "Cover 3 (KR)",
        priceKRW: 2_500_000,
        priceUSD: 2000,
        unitKo: "면당",
        unitEn: "per page",
        slots: [{ code: "GDB-3" }],
      },
      {
        ko: "내지 (국문)",
        en: "Inside (KR)",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        unitKo: "면당",
        unitEn: "per page",
        slots: [{ code: "GDB-4" }, { code: "GDB-5" }],
      },
      {
        ko: "표4/내지 (영문)",
        en: "Cover/Inside (EN)",
        priceKRW: 1_000_000,
        priceUSD: 800,
        unitKo: "면당",
        unitEn: "per page",
        slots: [{ code: "GDB-6" }],
      },
    ],
  },

  // ============ 디지털 배너 ============
  {
    channel: "online",
    code: "RGS",
    nameKo: "참관등록 페이지 배너",
    nameEn: "Registration Page Banner",
    type: "digital_banner",
    size: "1200px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 등록경로, 단독",
    subs: [
      {
        ko: "단독",
        en: "Solo",
        priceKRW: 5_000_000,
        priceUSD: 4000,
        slots: [{ code: "RGS-1" }],
      },
    ],
  },
  {
    channel: "online",
    code: "RGM",
    nameKo: "참관등록 완료 이메일",
    nameEn: "Registration Email Banner",
    type: "digital_banner",
    size: "600px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 등록경로, 단독",
    subs: [
      {
        ko: "단독",
        en: "Solo",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        slots: [{ code: "RGM-1" }],
      },
    ],
  },
  {
    channel: "online",
    code: "TTS",
    nameKo: "통합검색 페이지 배너",
    nameEn: "Total Search Banner",
    type: "digital_banner",
    size: "1200px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 정보탐색",
    subs: [
      {
        ko: "5구좌",
        en: "5 slots",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        slots: [
          { code: "TTS-1" },
          { code: "TTS-2" },
          { code: "TTS-3" },
          { code: "TTS-4" },
          { code: "TTS-5" },
        ],
      },
    ],
  },
  {
    channel: "online",
    code: "PRS",
    nameKo: "전시품 검색 페이지 배너",
    nameEn: "Product Search Banner",
    type: "digital_banner",
    size: "1200px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 정보탐색",
    subs: [
      {
        ko: "5구좌",
        en: "5 slots",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        slots: [
          { code: "PRS-1" },
          { code: "PRS-2" },
          { code: "PRS-3" },
          { code: "PRS-4" },
          { code: "PRS-5" },
        ],
      },
    ],
  },
  {
    channel: "online",
    code: "EXS",
    nameKo: "참가업체 검색 페이지 배너",
    nameEn: "Exhibitor Search Banner",
    type: "digital_banner",
    size: "1200px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 정보탐색, 브랜드_확산형",
    subs: [
      {
        ko: "5구좌",
        en: "5 slots",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        slots: [
          { code: "EXS-1" },
          { code: "EXS-2" },
          { code: "EXS-3" },
          { code: "EXS-4" },
          { code: "EXS-5" },
        ],
      },
    ],
  },
  {
    channel: "online",
    code: "SMR",
    nameKo: "세미나 페이지 배너",
    nameEn: "Seminar Page Banner",
    type: "digital_banner",
    size: "1200px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 산업종사자",
    subs: [
      {
        ko: "5구좌",
        en: "5 slots",
        priceKRW: 1_000_000,
        priceUSD: 800,
        slots: [
          { code: "SMR-1" },
          { code: "SMR-2" },
          { code: "SMR-3" },
          { code: "SMR-4" },
          { code: "SMR-5" },
        ],
      },
    ],
  },
  {
    channel: "online",
    code: "FPS",
    nameKo: "전시장 도면 페이지 하단 배너",
    nameEn: "Floor Plan Bottom Banner",
    type: "digital_banner",
    size: "1200px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 단독",
    subs: [
      {
        ko: "단독",
        en: "Solo",
        priceKRW: 5_000_000,
        priceUSD: 4000,
        slots: [{ code: "FPS-1" }],
      },
    ],
  },
  {
    channel: "online",
    code: "FPL",
    nameKo: "도면 내 참가기업 로고",
    nameEn: "Floor Plan Logo",
    type: "digital_banner",
    size: "—",
    fileFormat: "AI, EPS",
    deadline: "2026-02-15",
    tags: "온라인, 브랜드_확산형, 4부스+",
    subs: [
      {
        ko: "로고 표기",
        en: "Logo on Plan",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        slots: [{ code: "FPL-1" }, { code: "FPL-2" }, { code: "FPL-3" }],
      },
    ],
  },

  // ============ APP 디지털 배너 ============
  {
    channel: "online",
    code: "APM",
    nameKo: "APP 메인페이지 팝업",
    nameEn: "APP Main Popup",
    type: "digital_banner",
    size: "750px × 1000px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 모바일",
    subs: [
      {
        ko: "5구좌",
        en: "5 slots",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        slots: [
          { code: "APM-1" },
          { code: "APM-2" },
          { code: "APM-3" },
          { code: "APM-4" },
          { code: "APM-5" },
        ],
      },
    ],
  },
  {
    channel: "online",
    code: "APB",
    nameKo: "APP 메인페이지 하단 배너",
    nameEn: "APP Main Bottom Banner",
    type: "digital_banner",
    size: "1080px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 모바일, 단독",
    subs: [
      {
        ko: "단독",
        en: "Solo",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        slots: [{ code: "APB-1" }],
      },
    ],
  },

  // ============ 발송형 ============
  {
    channel: "online",
    code: "DNL",
    nameKo: "국내 뉴스레터 배너",
    nameEn: "Domestic Newsletter Banner",
    type: "mailing",
    size: "600px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-01-31",
    tags: "온라인, 산업종사자, 직접도달",
    subs: [
      {
        ko: "2월 발송",
        en: "Feb",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        unitKo: "회당",
        unitEn: "per send",
        slots: [{ code: "DNL-1", note: "2월 첫주" }],
      },
      {
        ko: "3월 발송",
        en: "Mar",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        unitKo: "회당",
        unitEn: "per send",
        slots: [{ code: "DNL-2", note: "3월 첫주" }],
      },
    ],
  },
  {
    channel: "online",
    code: "INL",
    nameKo: "해외 뉴스레터 배너",
    nameEn: "International Newsletter Banner",
    type: "mailing",
    size: "600px × 200px",
    fileFormat: "PNG, JPG",
    deadline: "2026-01-31",
    tags: "온라인, 글로벌, 직접도달",
    subs: [
      {
        ko: "2월 발송",
        en: "Feb",
        priceKRW: 1_500_000,
        priceUSD: 1200,
        unitKo: "회당",
        unitEn: "per send",
        slots: [{ code: "INL-1", note: "2월 첫주" }],
      },
      {
        ko: "3월 발송",
        en: "Mar",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        unitKo: "회당",
        unitEn: "per send",
        slots: [{ code: "INL-2", note: "3월 첫주" }],
      },
    ],
  },
  {
    channel: "online",
    code: "APP",
    nameKo: "APP 푸시 알림",
    nameEn: "APP Push Notification",
    type: "mailing",
    size: "—",
    fileFormat: "텍스트",
    deadline: "2026-02-20",
    tags: "온라인, 모바일, 직접도달",
    subs: [
      {
        ko: "푸시 1회",
        en: "Push (1)",
        priceKRW: 500_000,
        priceUSD: 400,
        unitKo: "회당",
        unitEn: "per push",
        slots: [{ code: "APP-1" }, { code: "APP-2" }, { code: "APP-3" }],
      },
    ],
  },

  // ============ 콘텐츠형 ============
  {
    channel: "online",
    code: "PIC",
    nameKo: "참가업체 사전 인터뷰",
    nameEn: "Pre-event Interview",
    type: "content",
    fileFormat: "—",
    deadline: "2026-02-01",
    tags: "온라인, 콘텐츠, 사전홍보",
    subs: [
      {
        ko: "사전 인터뷰",
        en: "Pre Interview",
        priceKRW: 2_000_000,
        priceUSD: 1600,
        unitKo: "건당",
        unitEn: "per piece",
        slots: [
          { code: "PIC-1" },
          { code: "PIC-2" },
          { code: "PIC-3" },
          { code: "PIC-4" },
          { code: "PIC-5" },
        ],
      },
    ],
  },
  {
    channel: "online",
    code: "OIC",
    nameKo: "참가업체 현장 인터뷰",
    nameEn: "On-site Interview",
    type: "content",
    fileFormat: "—",
    deadline: "2026-03-01",
    tags: "온라인, 콘텐츠, 현장",
    subs: [
      {
        ko: "현장 인터뷰",
        en: "On-site Interview",
        priceKRW: 3_000_000,
        priceUSD: 2400,
        unitKo: "건당",
        unitEn: "per piece",
        slots: [
          { code: "OIC-1" },
          { code: "OIC-2" },
          { code: "OIC-3" },
          { code: "OIC-4" },
          { code: "OIC-5" },
        ],
      },
    ],
  },
  {
    channel: "online",
    code: "OCD",
    nameKo: "인스타그램 카드뉴스",
    nameEn: "Instagram Card News",
    type: "content",
    size: "1080px × 1080px",
    fileFormat: "PNG, JPG",
    deadline: "2026-02-20",
    tags: "온라인, 콘텐츠, SNS",
    subs: [
      {
        ko: "카드뉴스",
        en: "Card News",
        priceKRW: 1_000_000,
        priceUSD: 800,
        unitKo: "건당",
        unitEn: "per piece",
        slots: [{ code: "OCD-1" }, { code: "OCD-2" }, { code: "OCD-3" }],
      },
    ],
  },
];

// ----------------------------------------------------------------------------
// 행 생성기
// ----------------------------------------------------------------------------

type RowDict = Record<ExcelHeader, string | number | Date | boolean>;

function expandRows(defs: CatDef[]): RowDict[] {
  const rows: RowDict[] = [];
  defs.forEach((cat) => {
    cat.subs.forEach((sub) => {
      sub.slots.forEach((slot) => {
        rows.push({
          channel: cat.channel,
          category_code: cat.code,
          category_name_ko: cat.nameKo,
          category_name_en: cat.nameEn,
          category_type: cat.type,
          slot_code: slot.code,
          price_krw: sub.priceKRW,
          subcategory_name_ko: sub.ko,
          subcategory_name_en: sub.en,
          size: cat.size ?? "",
          file_format: cat.fileFormat ?? "",
          deadline: cat.deadline ? new Date(cat.deadline) : "",
          price_usd: sub.priceUSD ?? "",
          unit_ko: sub.unitKo ?? "구좌당",
          unit_en: sub.unitEn ?? "per slot",
          is_sold: slot.sold ? "TRUE" : "FALSE",
          note: slot.note ?? "",
          tags: cat.tags ?? "",
        });
      });
    });
  });
  return rows;
}

const EXAMPLE_ROWS: RowDict[] = expandRows(CAT_DEFS);

// ----------------------------------------------------------------------------
// 안내 시트
// ----------------------------------------------------------------------------

type ColumnGuide = {
  key: ExcelHeader;
  required: boolean;
  desc: string;
  example: string;
  note: string;
};

const COLUMN_GUIDES: ColumnGuide[] = [
  { key: "channel", required: true, desc: "채널 구분", example: "offline", note: "offline / online (패키지는 별도 어드민에서 관리)" },
  { key: "category_code", required: true, desc: "카테고리 영문 코드", example: "CBA", note: "같은 카테고리 슬롯은 동일 코드" },
  { key: "category_name_ko", required: true, desc: "카테고리 한글명", example: "천장 배너 Hall A", note: "같은 카테고리 안에서 일관" },
  { key: "category_name_en", required: true, desc: "카테고리 영문명", example: "Ceiling Banner Hall A", note: "" },
  { key: "category_type", required: true, desc: "카테고리 유형 영문 키", example: "floor_plan", note: "8가지 중 하나 (하단 표 참조)" },
  { key: "slot_code", required: true, desc: "슬롯 고유 코드", example: "CBA-1", note: "전체에서 유일해야 함" },
  { key: "price_krw", required: true, desc: "원화 가격 (숫자)", example: "3000000", note: "콤마 OK" },
  { key: "subcategory_name_ko", required: false, desc: "소분류 한글명", example: "Hall A", note: "비우면 단일 기본" },
  { key: "subcategory_name_en", required: false, desc: "소분류 영문명", example: "Hall A", note: "" },
  { key: "size", required: false, desc: "사이즈", example: "1800mm × 3500mm", note: "" },
  { key: "file_format", required: false, desc: "입고 파일 형식", example: "AI, EPS, PDF", note: "" },
  { key: "deadline", required: false, desc: "입고 마감일", example: "2026-02-15", note: "yyyy-mm-dd" },
  { key: "price_usd", required: false, desc: "달러 가격", example: "2400", note: "해외 바이어용 — 빈 셀이면 미표시" },
  { key: "unit_ko", required: false, desc: "단가 단위 한글", example: "구좌당", note: "빈 값이면 \"구좌당\" 자동" },
  { key: "unit_en", required: false, desc: "단가 단위 영문", example: "per slot", note: "" },
  { key: "is_sold", required: false, desc: "마감 여부", example: "FALSE", note: "TRUE / FALSE / 마감 / 가능 / Y / N" },
  { key: "note", required: false, desc: "위치 메모 / 비고", example: "A1 출입구 좌측", note: "도면형은 핀 위치 메모로 사용" },
  { key: "tags", required: false, desc: "태그 (콤마 구분)", example: "온사이트, 브랜드_확산형", note: "분류·태그에서 정의" },
];

const CATEGORY_TYPE_GUIDES: Array<[string, string, string]> = [
  ["floor_plan", "도면형", "천장 배너, 등록대, 라이팅월, 기둥광고 — 도면 위 위치 지정"],
  ["quantity", "수량형", "참관객 목걸이, 초대장 삽지 — 수량 단위 (5천/10만 개 등)"],
  ["media", "미디어형", "경품 이벤트 LED — 영상 송출 횟수 단위"],
  ["digital_banner", "디지털 배너", "통합 검색 / 세미나 / APP 배너"],
  ["mailing", "발송형", "뉴스레터, APP 푸시 — 발송일 기반"],
  ["print_page", "지면형", "쇼가이드 표4 / 표2 / 표3 등 인쇄 면"],
  ["content", "콘텐츠형", "SNS 인터뷰, 카드뉴스 — 콘텐츠 제작 채널"],
  ["xpace", "XPACE", "옥외 LED (브릿지/엣지컬럼/와이드/스퀘어)"],
];

// ----------------------------------------------------------------------------
// 시트 빌더
// ----------------------------------------------------------------------------

function buildDataSheet(): XLSX.WorkSheet {
  const headerRow: string[] = ALL_HEADERS.slice();
  const aoa: Array<Array<string | number | Date | boolean>> = [headerRow];
  for (const row of EXAMPLE_ROWS) {
    aoa.push(ALL_HEADERS.map((h) => row[h]));
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  const widths: Partial<Record<ExcelHeader, number>> = {
    channel: 10,
    category_code: 14,
    category_name_ko: 26,
    category_name_en: 26,
    category_type: 14,
    slot_code: 12,
    price_krw: 12,
    subcategory_name_ko: 18,
    subcategory_name_en: 18,
    size: 22,
    file_format: 18,
    deadline: 12,
    price_usd: 10,
    unit_ko: 12,
    unit_en: 14,
    is_sold: 10,
    note: 24,
    tags: 32,
  };
  sheet["!cols"] = ALL_HEADERS.map((h) => ({ wch: widths[h] ?? 14 }));

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

  aoa.push(["K-PRINT 스폰서십 엑셀 양식 안내"]);
  aoa.push([""]);

  aoa.push(["■ 이 양식 사용법"]);
  aoa.push(["1. \"data\" 시트의 행을 한 줄씩 채우세요. 한 행 = 한 슬롯입니다."]);
  aoa.push(["2. 같은 카테고리의 여러 슬롯은 카테고리·소분류 정보를 매 행에 반복 입력하세요."]);
  aoa.push(["3. 별표(*) 표시된 컬럼은 필수입니다."]);
  aoa.push(["4. 비워둘 수 있는 컬럼은 빈 셀로 두면 됩니다."]);
  aoa.push(["5. 업로드 시 동기화 모드를 선택할 수 있습니다 (덮어쓰기 / 병합 / 신규만)."]);
  aoa.push(["6. 도면형/XPACE의 핀 좌표는 이 양식에 없습니다. 어드민 화면에서 직접 찍습니다."]);
  aoa.push(["7. 패키지(시그니처/스탠다드)는 어드민 [패키지] 메뉴에서 별도 관리합니다."]);
  aoa.push([""]);

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

  aoa.push(["■ 카테고리 유형 (category_type) 영문 키"]);
  aoa.push(["영문 키", "한글 명칭", "설명"]);
  for (const [en, ko, desc] of CATEGORY_TYPE_GUIDES) {
    aoa.push([en, ko, desc]);
  }
  aoa.push([""]);

  aoa.push(["■ 특수 컬럼 입력 형식"]);
  aoa.push(["• is_sold:", "TRUE / FALSE / 마감 / 가능 / Y / N (대소문자 무관, 빈 칸 = 가능)"]);
  aoa.push(["• tags:", "콤마(,)로 구분  예) 온사이트, 브랜드_확산형, 등록경로"]);
  aoa.push(["• deadline:", "yyyy-mm-dd 권장  예) 2026-02-15"]);
  aoa.push(["• price_krw / price_usd:", "콤마 무방  예) \"3,000,000\" — 숫자만으로도 OK"]);
  aoa.push([""]);

  aoa.push(["■ 동기화 모드"]);
  aoa.push(["덮어쓰기:", "엑셀에 있는 카테고리들을 전부 교체. 이미지·도면 핀·잠금 해제 필드는 보존."]);
  aoa.push(["병합:", "기존 데이터 유지하면서 가격·마감·사이즈만 갱신. 이미지·텍스트 안 건드림."]);
  aoa.push(["신규만:", "기존 코드는 무시, 새 코드만 추가. 가장 안전."]);

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 50 }, { wch: 28 }, { wch: 50 }];
  return sheet;
}

// ----------------------------------------------------------------------------
// 공개 API
// ----------------------------------------------------------------------------

export function generateTemplateBuffer(): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildDataSheet(), DATA_SHEET_NAME);
  XLSX.utils.book_append_sheet(wb, buildGuideSheet(), GUIDE_SHEET_NAME);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}

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

export { REQUIRED_HEADERS };
