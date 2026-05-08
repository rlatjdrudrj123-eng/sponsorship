/**
 * 샘플 엑셀 파일 직접 생성 — kprint-site/lib/excel/template.ts 와 동일 데이터.
 *
 * 사용:
 *   node scripts/generate-sample-xlsx.mjs
 *
 * 결과:
 *   sponsorship/kprint_sample_data.xlsx
 */

import * as XLSX from "../kprint-site/node_modules/xlsx/xlsx.mjs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALL_HEADERS = [
  "channel",
  "category_code",
  "category_name_ko",
  "category_name_en",
  "category_type",
  "slot_code",
  "price_krw",
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
];

const KIMES_DEADLINE = "2026-02-15";

const CAT_DEFS = [
  // ============ XPACE ============
  {
    channel: "offline", code: "XPA", nameKo: "XPACE 브릿지+빅브릿지", nameEn: "XPACE Bridge + Big Bridge",
    type: "xpace", size: "다양 (브릿지/빅브릿지)", fileFormat: "MP4 (H.264, 30fps)",
    deadline: "2026-02-01", tags: "옥외, 브랜드_확산형, 글로벌",
    subs: [{
      ko: "브릿지+빅브릿지", en: "Bridge + Big Bridge", priceKRW: 11_000_000, priceUSD: 8500,
      slots: [
        { code: "XPA-1", note: "동측 브릿지 1구역" },
        { code: "XPA-2", note: "동측 브릿지 2구역" },
        { code: "XPA-3", note: "옥외 LED 통합" },
      ],
    }],
  },
  {
    channel: "offline", code: "XPB", nameKo: "XPACE 와이드+스퀘어", nameEn: "XPACE Wide + Square",
    type: "xpace", size: "다양", fileFormat: "MP4 (H.264, 30fps)",
    deadline: "2026-02-01", tags: "옥외, 브랜드_확산형",
    subs: [{
      ko: "와이드+스퀘어", en: "Wide + Square", priceKRW: 5_000_000, priceUSD: 3900,
      slots: [
        { code: "XPB-1", note: "와이드 1면" },
        { code: "XPB-2", note: "와이드 2면" },
        { code: "XPB-3", note: "스퀘어 1면" },
        { code: "XPB-4", note: "스퀘어 2면" },
      ],
    }],
  },
  {
    channel: "offline", code: "XPE", nameKo: "XPACE 엣지컬럼", nameEn: "XPACE Edge Column",
    type: "xpace", size: "8m × 1m (4면)", fileFormat: "MP4 (H.264, 30fps)",
    deadline: "2026-02-01", tags: "옥외, 브랜드_확산형",
    subs: [{
      ko: "엣지컬럼", en: "Edge Column", priceKRW: 4_000_000, priceUSD: 3100,
      slots: [
        { code: "XPE-1", note: "정면 컬럼 1" },
        { code: "XPE-2", note: "측면 컬럼 1" },
      ],
    }],
  },

  // ============ 천장 배너 ============
  {
    channel: "offline", code: "CBA", nameKo: "천장 배너 Hall A", nameEn: "Ceiling Banner Hall A",
    type: "floor_plan", size: "1800mm × 3500mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 브랜드_확산형",
    subs: [{
      ko: "Hall A", en: "Hall A", priceKRW: 3_000_000, priceUSD: 2400,
      slots: [
        { code: "CBA-1", note: "A1 입구 좌측" },
        { code: "CBA-2", note: "A1 입구 우측" },
        { code: "CBA-3", note: "Hall A 중앙" },
        { code: "CBA-4", note: "Hall A 동측", sold: true },
        { code: "CBA-5", note: "Hall A 서측" },
        { code: "CBA-6", note: "Hall A 후면" },
        { code: "CBA-7", note: "A2 출구" },
      ],
    }],
  },
  {
    channel: "offline", code: "CBB", nameKo: "천장 배너 Hall B", nameEn: "Ceiling Banner Hall B",
    type: "floor_plan", size: "1800mm × 3500mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 브랜드_확산형",
    subs: [{
      ko: "Hall B", en: "Hall B", priceKRW: 3_000_000, priceUSD: 2400,
      slots: [
        { code: "CBB-1", note: "B 입구" },
        { code: "CBB-2", note: "Hall B 중앙" },
        { code: "CBB-3", note: "Hall B 후면" },
        { code: "CBB-4", note: "B 출구" },
        { code: "CBB-5" },
        { code: "CBB-6" },
      ],
    }],
  },
  {
    channel: "offline", code: "CBC", nameKo: "천장 배너 Hall C", nameEn: "Ceiling Banner Hall C",
    type: "floor_plan", size: "1800mm × 3500mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 브랜드_확산형",
    subs: [{
      ko: "Hall C", en: "Hall C", priceKRW: 3_000_000, priceUSD: 2400,
      slots: [
        { code: "CBC-1", note: "C 입구" },
        { code: "CBC-2" },
        { code: "CBC-3", note: "Hall C 중앙" },
        { code: "CBC-4" },
        { code: "CBC-5" },
        { code: "CBC-6" },
        { code: "CBC-7", note: "C 출구" },
      ],
    }],
  },

  // ============ 등록대 ============
  {
    channel: "offline", code: "RGA", nameKo: "등록대(출입증 발급대) Hall A", nameEn: "Registration Desk Hall A",
    type: "floor_plan", size: "W900 × D600 × H1100mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 등록경로, 브랜드_확산형",
    subs: [
      {
        ko: "A1 등록대", en: "A1 Desk", priceKRW: 2_500_000, priceUSD: 2000,
        slots: [
          { code: "RGA-1", note: "A1 입구 1번" },
          { code: "RGA-2", note: "A1 입구 2번" },
          { code: "RGA-3" },
          { code: "RGA-4" },
          { code: "RGA-5", sold: true },
        ],
      },
      {
        ko: "A2 등록대", en: "A2 Desk", priceKRW: 2_500_000, priceUSD: 2000,
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
    channel: "offline", code: "RGB", nameKo: "등록대(출입증 발급대) Hall B", nameEn: "Registration Desk Hall B",
    type: "floor_plan", size: "W900 × D600 × H1100mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 등록경로",
    subs: [{
      ko: "Hall B", en: "Hall B", priceKRW: 2_500_000, priceUSD: 2000,
      slots: [{ code: "RGB-1", note: "B 입구 1번" }, { code: "RGB-2" }],
    }],
  },
  {
    channel: "offline", code: "RGC", nameKo: "등록대(출입증 발급대) Hall C", nameEn: "Registration Desk Hall C",
    type: "floor_plan", size: "W900 × D600 × H1100mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 등록경로",
    subs: [{
      ko: "Hall C", en: "Hall C", priceKRW: 2_500_000, priceUSD: 2000,
      slots: [{ code: "RGC-1", note: "C 입구 1번" }, { code: "RGC-2" }, { code: "RGC-3" }],
    }],
  },
  {
    channel: "offline", code: "RGD", nameKo: "등록대(출입증 발급대) Hall D", nameEn: "Registration Desk Hall D",
    type: "floor_plan", size: "W900 × D600 × H1100mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 등록경로, 단독",
    subs: [{
      ko: "Hall D (단독)", en: "Hall D (Solo)", priceKRW: 1_500_000, priceUSD: 1200,
      slots: [{ code: "RGD-1", note: "D 입구 단독" }],
    }],
  },

  // ============ 도면형 기타 ============
  {
    channel: "offline", code: "LTW", nameKo: "라이팅월", nameEn: "Lighting Wall",
    type: "floor_plan", size: "2400mm × 3000mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 브랜드_확산형",
    subs: [{
      ko: "라이팅월", en: "Lighting Wall", priceKRW: 2_000_000, priceUSD: 1600,
      slots: [
        { code: "LTW-1", note: "Hall A 입구" },
        { code: "LTW-2", note: "Hall B 입구", sold: true },
        { code: "LTW-3", note: "Hall C 입구" },
        { code: "LTW-4", note: "Hall D 입구" },
      ],
    }],
  },
  {
    channel: "offline", code: "FST", nameKo: "전시장 내부 바닥 스티커", nameEn: "Floor Sticker",
    type: "floor_plan", size: "1500mm × 1500mm", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 동선",
    subs: [{
      ko: "바닥 스티커", en: "Floor Sticker", priceKRW: 1_500_000, priceUSD: 1200,
      slots: [{ code: "FST-1" }, { code: "FST-2" }, { code: "FST-3" }, { code: "FST-4" }],
    }],
  },
  {
    channel: "offline", code: "PLA", nameKo: "1층 기둥광고", nameEn: "Pillar Ad (1F)",
    type: "floor_plan", size: "기둥 4면", fileFormat: "AI, EPS, PDF",
    deadline: KIMES_DEADLINE, tags: "온사이트, 브랜드_확산형",
    subs: [{
      ko: "1층 기둥", en: "1F Pillar", priceKRW: 1_500_000, priceUSD: 1200,
      slots: [{ code: "PLA-1" }, { code: "PLA-2" }, { code: "PLA-3" }, { code: "PLA-4" }],
    }],
  },

  // ============ 수량형 ============
  {
    channel: "offline", code: "BGE", nameKo: "참관객 목걸이", nameEn: "Visitor Lanyard",
    type: "quantity", size: "20mm × 900mm", fileFormat: "AI, EPS",
    deadline: "2026-01-15", tags: "온사이트, 등록경로, 브랜드_확산형",
    subs: [
      {
        ko: "기본 5,000매", en: "Base 5,000ea", priceKRW: 15_000_000, priceUSD: 12000,
        unitKo: "5,000매당", unitEn: "per 5,000",
        slots: [{ code: "BGE-1", note: "기본 구좌" }],
      },
      {
        ko: "추가 5,000매", en: "Additional 5,000ea", priceKRW: 5_000_000, priceUSD: 4000,
        unitKo: "1구좌당 5,000매", unitEn: "per 5,000 (slot)",
        slots: [{ code: "BGE-2" }, { code: "BGE-3" }, { code: "BGE-4" }, { code: "BGE-5" }],
      },
    ],
  },
  {
    channel: "offline", code: "IVL", nameKo: "초대장 삽지", nameEn: "Invitation Insert",
    type: "quantity", size: "150mm × 100mm", fileFormat: "AI, EPS, PDF",
    deadline: "2026-01-20", tags: "프린트, 등록경로, 단독",
    subs: [{
      ko: "초대장 삽지", en: "Insert", priceKRW: 8_000_000, priceUSD: 6300,
      unitKo: "10만매당", unitEn: "per 100k",
      slots: [{ code: "IVL-1" }, { code: "IVL-2" }],
    }],
  },

  // ============ 미디어형 ============
  {
    channel: "offline", code: "LDL", nameKo: "경품 이벤트 LED", nameEn: "Prize Event LED",
    type: "media", size: "—", fileFormat: "MP4 (15초 이내)",
    deadline: "2026-02-10", tags: "온사이트, 영상",
    subs: [{
      ko: "경품 LED", en: "Prize LED", priceKRW: 3_000_000, priceUSD: 2400,
      unitKo: "구좌당", unitEn: "per slot",
      slots: [
        { code: "LDL-1" }, { code: "LDL-2" }, { code: "LDL-3" }, { code: "LDL-4" }, { code: "LDL-5" },
      ],
    }],
  },

  // ============ 지면형 ============
  {
    channel: "offline", code: "GDB", nameKo: "현장 쇼가이드 광고", nameEn: "Show Guide Ad",
    type: "print_page", size: "210mm × 297mm", fileFormat: "AI, PDF (CMYK)",
    deadline: "2026-01-30", tags: "프린트, 정보탐색",
    subs: [
      { ko: "표4 (국문)", en: "Cover 4 (KR)", priceKRW: 4_000_000, priceUSD: 3100, unitKo: "면당", unitEn: "per page", slots: [{ code: "GDB-1" }] },
      { ko: "표2 (국문)", en: "Cover 2 (KR)", priceKRW: 3_000_000, priceUSD: 2400, unitKo: "면당", unitEn: "per page", slots: [{ code: "GDB-2" }] },
      { ko: "표3 (국문)", en: "Cover 3 (KR)", priceKRW: 2_500_000, priceUSD: 2000, unitKo: "면당", unitEn: "per page", slots: [{ code: "GDB-3" }] },
      { ko: "내지 (국문)", en: "Inside (KR)", priceKRW: 1_500_000, priceUSD: 1200, unitKo: "면당", unitEn: "per page", slots: [{ code: "GDB-4" }, { code: "GDB-5" }] },
      { ko: "표4/내지 (영문)", en: "Cover/Inside (EN)", priceKRW: 1_000_000, priceUSD: 800, unitKo: "면당", unitEn: "per page", slots: [{ code: "GDB-6" }] },
    ],
  },

  // ============ 디지털 배너 ============
  {
    channel: "online", code: "RGS", nameKo: "참관등록 페이지 배너", nameEn: "Registration Page Banner",
    type: "digital_banner", size: "1200px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 등록경로, 단독",
    subs: [{ ko: "단독", en: "Solo", priceKRW: 5_000_000, priceUSD: 4000, slots: [{ code: "RGS-1" }] }],
  },
  {
    channel: "online", code: "RGM", nameKo: "참관등록 완료 이메일", nameEn: "Registration Email Banner",
    type: "digital_banner", size: "600px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 등록경로, 단독",
    subs: [{ ko: "단독", en: "Solo", priceKRW: 3_000_000, priceUSD: 2400, slots: [{ code: "RGM-1" }] }],
  },
  {
    channel: "online", code: "TTS", nameKo: "통합검색 페이지 배너", nameEn: "Total Search Banner",
    type: "digital_banner", size: "1200px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 정보탐색",
    subs: [{ ko: "5구좌", en: "5 slots", priceKRW: 1_500_000, priceUSD: 1200, slots: [{ code: "TTS-1" }, { code: "TTS-2" }, { code: "TTS-3" }, { code: "TTS-4" }, { code: "TTS-5" }] }],
  },
  {
    channel: "online", code: "PRS", nameKo: "전시품 검색 페이지 배너", nameEn: "Product Search Banner",
    type: "digital_banner", size: "1200px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 정보탐색",
    subs: [{ ko: "5구좌", en: "5 slots", priceKRW: 1_500_000, priceUSD: 1200, slots: [{ code: "PRS-1" }, { code: "PRS-2" }, { code: "PRS-3" }, { code: "PRS-4" }, { code: "PRS-5" }] }],
  },
  {
    channel: "online", code: "EXS", nameKo: "참가업체 검색 페이지 배너", nameEn: "Exhibitor Search Banner",
    type: "digital_banner", size: "1200px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 정보탐색, 브랜드_확산형",
    subs: [{ ko: "5구좌", en: "5 slots", priceKRW: 1_500_000, priceUSD: 1200, slots: [{ code: "EXS-1" }, { code: "EXS-2" }, { code: "EXS-3" }, { code: "EXS-4" }, { code: "EXS-5" }] }],
  },
  {
    channel: "online", code: "SMR", nameKo: "세미나 페이지 배너", nameEn: "Seminar Page Banner",
    type: "digital_banner", size: "1200px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 산업종사자",
    subs: [{ ko: "5구좌", en: "5 slots", priceKRW: 1_000_000, priceUSD: 800, slots: [{ code: "SMR-1" }, { code: "SMR-2" }, { code: "SMR-3" }, { code: "SMR-4" }, { code: "SMR-5" }] }],
  },
  {
    channel: "online", code: "FPS", nameKo: "전시장 도면 페이지 하단 배너", nameEn: "Floor Plan Bottom Banner",
    type: "digital_banner", size: "1200px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 단독",
    subs: [{ ko: "단독", en: "Solo", priceKRW: 5_000_000, priceUSD: 4000, slots: [{ code: "FPS-1" }] }],
  },
  {
    channel: "online", code: "FPL", nameKo: "도면 내 참가기업 로고", nameEn: "Floor Plan Logo",
    type: "digital_banner", size: "—", fileFormat: "AI, EPS",
    deadline: "2026-02-15", tags: "온라인, 브랜드_확산형, 4부스+",
    subs: [{ ko: "로고 표기", en: "Logo on Plan", priceKRW: 3_000_000, priceUSD: 2400, slots: [{ code: "FPL-1" }, { code: "FPL-2" }, { code: "FPL-3" }] }],
  },

  // ============ APP ============
  {
    channel: "online", code: "APM", nameKo: "APP 메인페이지 팝업", nameEn: "APP Main Popup",
    type: "digital_banner", size: "750px × 1000px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 모바일",
    subs: [{ ko: "5구좌", en: "5 slots", priceKRW: 1_500_000, priceUSD: 1200, slots: [{ code: "APM-1" }, { code: "APM-2" }, { code: "APM-3" }, { code: "APM-4" }, { code: "APM-5" }] }],
  },
  {
    channel: "online", code: "APB", nameKo: "APP 메인페이지 하단 배너", nameEn: "APP Main Bottom Banner",
    type: "digital_banner", size: "1080px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 모바일, 단독",
    subs: [{ ko: "단독", en: "Solo", priceKRW: 3_000_000, priceUSD: 2400, slots: [{ code: "APB-1" }] }],
  },

  // ============ 발송형 ============
  {
    channel: "online", code: "DNL", nameKo: "국내 뉴스레터 배너", nameEn: "Domestic Newsletter Banner",
    type: "mailing", size: "600px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-01-31", tags: "온라인, 산업종사자, 직접도달",
    subs: [
      { ko: "2월 발송", en: "Feb", priceKRW: 1_500_000, priceUSD: 1200, unitKo: "회당", unitEn: "per send", slots: [{ code: "DNL-1", note: "2월 첫주" }] },
      { ko: "3월 발송", en: "Mar", priceKRW: 3_000_000, priceUSD: 2400, unitKo: "회당", unitEn: "per send", slots: [{ code: "DNL-2", note: "3월 첫주" }] },
    ],
  },
  {
    channel: "online", code: "INL", nameKo: "해외 뉴스레터 배너", nameEn: "International Newsletter Banner",
    type: "mailing", size: "600px × 200px", fileFormat: "PNG, JPG",
    deadline: "2026-01-31", tags: "온라인, 글로벌, 직접도달",
    subs: [
      { ko: "2월 발송", en: "Feb", priceKRW: 1_500_000, priceUSD: 1200, unitKo: "회당", unitEn: "per send", slots: [{ code: "INL-1", note: "2월 첫주" }] },
      { ko: "3월 발송", en: "Mar", priceKRW: 3_000_000, priceUSD: 2400, unitKo: "회당", unitEn: "per send", slots: [{ code: "INL-2", note: "3월 첫주" }] },
    ],
  },
  {
    channel: "online", code: "APP", nameKo: "APP 푸시 알림", nameEn: "APP Push Notification",
    type: "mailing", size: "—", fileFormat: "텍스트",
    deadline: "2026-02-20", tags: "온라인, 모바일, 직접도달",
    subs: [{ ko: "푸시 1회", en: "Push (1)", priceKRW: 500_000, priceUSD: 400, unitKo: "회당", unitEn: "per push", slots: [{ code: "APP-1" }, { code: "APP-2" }, { code: "APP-3" }] }],
  },

  // ============ 콘텐츠형 ============
  {
    channel: "online", code: "PIC", nameKo: "참가업체 사전 인터뷰", nameEn: "Pre-event Interview",
    type: "content", fileFormat: "—", deadline: "2026-02-01", tags: "온라인, 콘텐츠, 사전홍보",
    subs: [{ ko: "사전 인터뷰", en: "Pre Interview", priceKRW: 2_000_000, priceUSD: 1600, unitKo: "건당", unitEn: "per piece", slots: [{ code: "PIC-1" }, { code: "PIC-2" }, { code: "PIC-3" }, { code: "PIC-4" }, { code: "PIC-5" }] }],
  },
  {
    channel: "online", code: "OIC", nameKo: "참가업체 현장 인터뷰", nameEn: "On-site Interview",
    type: "content", fileFormat: "—", deadline: "2026-03-01", tags: "온라인, 콘텐츠, 현장",
    subs: [{ ko: "현장 인터뷰", en: "On-site Interview", priceKRW: 3_000_000, priceUSD: 2400, unitKo: "건당", unitEn: "per piece", slots: [{ code: "OIC-1" }, { code: "OIC-2" }, { code: "OIC-3" }, { code: "OIC-4" }, { code: "OIC-5" }] }],
  },
  {
    channel: "online", code: "OCD", nameKo: "인스타그램 카드뉴스", nameEn: "Instagram Card News",
    type: "content", size: "1080px × 1080px", fileFormat: "PNG, JPG",
    deadline: "2026-02-20", tags: "온라인, 콘텐츠, SNS",
    subs: [{ ko: "카드뉴스", en: "Card News", priceKRW: 1_000_000, priceUSD: 800, unitKo: "건당", unitEn: "per piece", slots: [{ code: "OCD-1" }, { code: "OCD-2" }, { code: "OCD-3" }] }],
  },
];

// expand to rows
const rows = [];
for (const cat of CAT_DEFS) {
  for (const sub of cat.subs) {
    for (const slot of sub.slots) {
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
    }
  }
}

// data sheet
const dataAoa = [ALL_HEADERS];
for (const row of rows) {
  dataAoa.push(ALL_HEADERS.map((h) => row[h]));
}
const dataSheet = XLSX.utils.aoa_to_sheet(dataAoa, { cellDates: true });
dataSheet["!cols"] = [
  { wch: 10 }, { wch: 14 }, { wch: 26 }, { wch: 26 }, { wch: 14 },
  { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
  { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
  { wch: 10 }, { wch: 24 }, { wch: 32 },
];
const deadlineColIdx = ALL_HEADERS.indexOf("deadline");
for (let r = 1; r <= rows.length; r++) {
  const addr = XLSX.utils.encode_cell({ r, c: deadlineColIdx });
  const cell = dataSheet[addr];
  if (cell) cell.z = "yyyy-mm-dd";
}

// guide sheet (간단)
const COLUMN_GUIDES = [
  ["* channel", "필수", "채널 구분", "offline", "offline / online"],
  ["* category_code", "필수", "카테고리 영문 코드", "CBA", "같은 카테고리 슬롯은 동일"],
  ["* category_name_ko", "필수", "카테고리 한글명", "천장 배너 Hall A", ""],
  ["* category_name_en", "필수", "카테고리 영문명", "Ceiling Banner Hall A", ""],
  ["* category_type", "필수", "카테고리 유형 영문 키", "floor_plan", "8가지 중 하나"],
  ["* slot_code", "필수", "슬롯 고유 코드", "CBA-1", "전체에서 유일"],
  ["* price_krw", "필수", "원화 가격", "3000000", "콤마 OK"],
  ["subcategory_name_ko", "선택", "소분류 한글명", "Hall A", "비우면 단일 기본"],
  ["subcategory_name_en", "선택", "소분류 영문명", "Hall A", ""],
  ["size", "선택", "사이즈", "1800mm × 3500mm", ""],
  ["file_format", "선택", "입고 파일 형식", "AI, EPS, PDF", ""],
  ["deadline", "선택", "입고 마감일", "2026-02-15", "yyyy-mm-dd"],
  ["price_usd", "선택", "달러 가격", "2400", "해외 바이어용"],
  ["unit_ko", "선택", "단가 단위 한글", "구좌당", "기본 \"구좌당\""],
  ["unit_en", "선택", "단가 단위 영문", "per slot", ""],
  ["is_sold", "선택", "마감 여부", "FALSE", "TRUE/FALSE/마감/가능/Y/N"],
  ["note", "선택", "위치 메모", "A1 출입구 좌측", ""],
  ["tags", "선택", "태그", "온사이트, 브랜드_확산형", "콤마 구분"],
];
const TYPE_GUIDES = [
  ["floor_plan", "도면형", "천장 배너, 등록대, 라이팅월, 기둥광고"],
  ["quantity", "수량형", "참관객 목걸이, 초대장 삽지"],
  ["media", "미디어형", "경품 LED — 영상 송출"],
  ["digital_banner", "디지털 배너", "통합 검색 / 세미나 / APP 배너"],
  ["mailing", "발송형", "뉴스레터, APP 푸시"],
  ["print_page", "지면형", "쇼가이드 표4 / 표2 / 표3"],
  ["content", "콘텐츠형", "SNS 인터뷰, 카드뉴스"],
  ["xpace", "XPACE", "옥외 LED (브릿지/엣지컬럼/와이드/스퀘어)"],
];
const guideAoa = [
  ["K-PRINT 스폰서십 엑셀 양식 안내"],
  [""],
  ["■ 사용법"],
  ["1. data 시트의 행을 한 줄씩 채우세요. 한 행 = 한 슬롯."],
  ["2. 같은 카테고리의 여러 슬롯은 카테고리·소분류 정보를 매 행에 반복 입력."],
  ["3. 별표(*) 표시된 컬럼은 필수."],
  ["4. 패키지(시그니처/스탠다드)는 어드민 [패키지] 메뉴에서 별도 관리."],
  [""],
  ["■ 컬럼별 설명"],
  ["컬럼명", "필수/선택", "설명", "입력 예시", "비고"],
  ...COLUMN_GUIDES,
  [""],
  ["■ category_type 영문 키"],
  ["영문 키", "한글 명칭", "설명"],
  ...TYPE_GUIDES,
  [""],
  ["■ 동기화 모드"],
  ["덮어쓰기:", "엑셀 카테고리 전부 교체. 이미지·핀·잠금 보존."],
  ["병합:", "기존 유지하면서 가격·마감·사이즈만 갱신."],
  ["신규만:", "기존 코드는 무시, 새 코드만 추가. 가장 안전."],
];
const guideSheet = XLSX.utils.aoa_to_sheet(guideAoa);
guideSheet["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 50 }, { wch: 28 }, { wch: 50 }];

// Build workbook
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, dataSheet, "data");
XLSX.utils.book_append_sheet(wb, guideSheet, "안내");

const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
const outPath = join(__dirname, "..", "kprint_sample_data.xlsx");
writeFileSync(outPath, buf);

console.log(`✅ Saved: ${outPath}`);
console.log(`   ${CAT_DEFS.length} categories, ${rows.length} slots`);
