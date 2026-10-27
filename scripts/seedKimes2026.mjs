/**
 * KIMES 2026 (서울) 스폰서십 데이터 시드 — 'KIMES 2026 - 스폰서십' PDF 기준.
 *
 * 핵심 원칙 (cloneEventData.mjs 와 동일):
 *  - 새 행사 kimes-2026 에만 쓴다. 다른 행사 도큐먼트는 읽기만 (KIMES BUSAN 의 분류 체계·레이아웃·페르소나 틀).
 *  - 타겟이 비어있는지 pre-flight 검사 (이미 있으면 abort)
 *  - 이미지(PDF 추출본)를 먼저 Storage 에 올리고, Firestore 는 한 번의 batch 로 커밋
 *  - --dry 모드: 업로드·쓰기 없이 계획만 출력
 *
 * 사용:
 *   node scripts/seedKimes2026.mjs <assetsDir> --dry
 *   node scripts/seedKimes2026.mjs <assetsDir> --confirm
 *
 * assetsDir = PDF 에서 추출한 이미지 폴더 (hero/, floor/, landing/, manifest.json)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const PROJECT_ID = "kprint-845c3";
const BUCKET = "kprint-845c3.firebasestorage.app";
const EID = "kimes-2026";
const TEMPLATE_EID = "kimesbusan-2026"; // 분류 체계·레이아웃·페르소나 틀

const args = process.argv.slice(2);
const ASSETS = args.find((a) => !a.startsWith("--"));
const DRY = args.includes("--dry");
const CONFIRM = args.includes("--confirm");
if (!ASSETS || (!DRY && !CONFIRM)) {
  console.error("사용: node scripts/seedKimes2026.mjs <assetsDir> --dry | --confirm");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(path.join(ASSETS, "manifest.json"), "utf8"));

function loadCredentials() {
  if (existsSync("./.gcp-key.json"))
    return cert(JSON.parse(readFileSync("./.gcp-key.json", "utf8")));
  const found = readdirSync(".").find((f) => /-firebase-adminsdk-.+\.json$/.test(f));
  if (found) return cert(JSON.parse(readFileSync(`./${found}`, "utf8")));
  throw new Error("no key");
}

const app = initializeApp({ projectId: PROJECT_ID, credential: loadCredentials() });
const fs = getFirestore(app);
fs.settings({ ignoreUndefinedProperties: true });
const bucket = getStorage(app).bucket(BUCKET);

console.log(`\n${DRY ? "[DRY-RUN]" : "[LIVE]"} KIMES 2026 시드 → ${EID}`);
console.log("=".repeat(60));

// ============================================================================
// 원본 데이터 (PDF 51쪽 기준)
// ============================================================================

const day = (s) => Timestamp.fromDate(new Date(`${s}T00:00:00Z`));
const range = (prefix, n, from = 1) =>
  Array.from({ length: n }, (_, i) => ({ code: `${prefix}-${from + i}` }));

const drive = (id, share = "drive_link") =>
  `https://drive.google.com/file/d/${id}/view?usp=${share}`;
const GUIDE = {
  xpace: drive("1WREmlaKcQs-S8-Cwh00JftBBcU0Vh_7D"),
  ceiling: drive("1nSnF2byUTwsYONdzDQiURV5XKxNue2g7"),
  regdesk: drive("1DNKp11fd2LWsG5_l2_1NIeYMtMMYU5rm"),
  dm: drive("1kRpHEZKwoJEyx_0mxC1QUkhxPC0CGlGS"),
  guideC4: drive("1k3ia7HUDE0-I7vw9oBg_QUAIs_IRd78M"),
  led: drive("1PxyNkgaH95NyN9J6J27jiOvnAZl2ZvFD", "sharing"),
  floorSticker: drive("11sGvHqwNtZoHtKk7XKW1dzFiHc7nCsED"),
  lightingWall: drive("1o5Oy_CBav2HaueiDKn5jINcGFb6j3OWO"),
  webBanner: drive("1-boh8eDJAMYp0wj2d38f17EJR5uStj2e"),
  fps: drive("1tqU79_PONvnm4rOL7393xVIIw-xOuzCD"),
  newsletter: drive("1xR_fzV4b7jhBv0G2LDbLCyl04R9DYyn7"),
  appPopup: drive("1aw9__eIuvpXwfp1rtlSResJJfslbvfj-"),
  appBottom: drive("1yGejxbJBg6kAg2PAv5gPvQ3E3w8NAgyZ"),
};

const U = {
  slot: { ko: "구좌", en: "slot" },
  exclusive: { ko: "단독구좌", en: "exclusive" },
  page: { ko: "면", en: "page" },
  send: { ko: "회", en: "send" },
  push: { ko: "회", en: "push" },
  post: { ko: "건", en: "post" },
};

const PRINT_FMT = "eps, ai, pdf 등의 인쇄용 파일형태(고해상도)";
const PRINT_FMT_EN = "High-resolution print files (EPS, AI, PDF)";
const WEB_SIZE = "(PC)2,400px x 200px / (TAB)2,000px x 200px / (MO)720px x 200px";

// purposes = PDF 8~10쪽 '한눈에 보기' 탭 (브랜드 확산형 / 현장 방문객 유도형 / 신제품 홍보형)
const B = "brand_awareness";
const T = "traffic_driver";
const N = "new_product";
const PURPOSE_TAG = { [B]: "브랜드_확산형", [T]: "현장_방문객_유도형", [N]: "신제품_홍보형" };

const CATS = [
  // ── 오프라인 ──
  {
    key: "XPA", code: "XPA", type: "xpace", channel: "offline",
    ko: "전광판 광고(XPACE)", en: "XPACE Digital Signage",
    selectorId: "xpace", slug: "xpace",
    shortDesc: "월평균 120만명 유동인구 대상 디지털 사이니지, 3월 16일(월)부터 22일(일)까지 7일간 노출, 영상은 참가업체 직접 제작",
    shortDescEn: "Digital signage reaching 1.2M visitors per month, displayed for 7 days (Mar 16 to 22), video provided by exhibitor",
    size: "디자인 가이드 참고", sizeEn: "See design guide",
    fileFormat: "H.264(AVC), MP4 / JPG, PNG", fileFormatEn: "H.264(AVC), MP4 / JPG, PNG",
    deadline: "2026-02-28", guide: GUIDE.xpace,
    timing: ["onsite"], location: ["outdoor"], purposes: [B, T, N],
    tags: ["옥외광고_패키지"],
    hero: [["xpace_bridge", "브릿지+빅브릿지"], ["xpace_wide", "와이드+스퀘어브릿지"], ["xpace_edge", "엣지컬럼"]],
    subs: [
      { key: "bridge", ko: "브릿지+빅브릿지", en: "Bridge + Big Bridge", price: 11000000, unit: U.slot, slots: range("XPA", 4), floor: { asset: "xpace_bridge" } },
      { key: "wide", ko: "와이드+스퀘어브릿지", en: "Wide Bridge + Square Bridge", price: 5000000, unit: U.slot, slots: range("XPB", 4), floor: { asset: "xpace_wide" } },
      { key: "edge", ko: "엣지컬럼", en: "Edge Column", price: 8000000, unit: U.slot, slots: range("XPE", 4), floor: { asset: "xpace_edge" } },
    ],
  },
  {
    key: "CBA", code: "CBA", type: "floor_plan", channel: "offline",
    ko: "천장배너", en: "Ceiling Banner",
    selectorId: "ceiling_banner", slug: "ceiling-banner",
    shortDesc: "전시장 상단에 대형 배너를 설치하여 어느 위치에서나 눈에 띄는 확실한 홍보 효과 제공",
    shortDescEn: "A large overhead banner, visible from anywhere in the hall",
    size: "W 1,800mm x H 3,500mm (디자인 가이드 참고)", sizeEn: "W 1,800mm x H 3,500mm (see design guide)",
    fileFormat: PRINT_FMT, fileFormatEn: PRINT_FMT_EN,
    deadline: "2026-02-28", guide: GUIDE.ceiling,
    timing: ["onsite"], location: ["hall"], purposes: [B, T],
    tags: ["프라임_스팟_패키지", "온사이트_패키지"],
    hero: [["ceiling", ""]],
    subs: [
      { key: "A", ko: "Hall A", en: "Hall A", price: 3000000, unit: U.slot, slots: range("CBA", 7).map((s, i) => ({ ...s, note: `A${i + 1}`, pinLabel: `A${i + 1}` })), floor: { asset: "ceiling", pins: "label" } },
      { key: "B", ko: "Hall B", en: "Hall B", price: 3000000, unit: U.slot, slots: range("CBB", 6).map((s, i) => ({ ...s, note: `B${i + 1}`, pinLabel: `B${i + 1}` })), floor: { asset: "ceiling", pins: "label" } },
      { key: "C", ko: "Hall C", en: "Hall C", price: 3000000, unit: U.slot, slots: range("CBC", 7).map((s, i) => ({ ...s, note: `C${i + 1}`, pinLabel: `C${i + 1}` })), floor: { asset: "ceiling", pins: "label" } },
    ],
  },
  {
    key: "RGA", code: "RGA", type: "floor_plan", channel: "offline",
    ko: "등록대(출입증 발급대)", en: "Registration Area",
    selectorId: "registration_logo", slug: "registration-desk",
    shortDesc: "전시장 진입 시 가장 먼저 브랜드를 노출하여 참관객에게 첫인상 각인",
    shortDescEn: "Make the strongest first impression as your brand greets every visitor at the entrance",
    size: "W 2,000mm x H 1,000mm", sizeEn: "W 2,000mm x H 1,000mm",
    fileFormat: PRINT_FMT, fileFormatEn: PRINT_FMT_EN,
    deadline: "2026-02-28", guide: GUIDE.regdesk,
    timing: ["onsite"], location: ["lobby"], purposes: [B, T],
    tags: ["참관객_atoz_패키지"],
    hero: [["regdesk", ""]],
    subs: [
      { key: "A1", ko: "A1 출입구", en: "A1 Entrance", price: 1500000, unit: U.slot, slots: range("RGA", 5), floor: { asset: "regdesk", pins: "cluster", label: "A1" } },
      { key: "A2", ko: "A2 출입구", en: "A2 Entrance", price: 1500000, unit: U.slot, slots: range("RGA", 4, 6), floor: { asset: "regdesk", pins: "cluster", label: "A2" } },
      { key: "B", ko: "B홀", en: "Hall B", price: 1500000, unit: U.slot, slots: range("RGB", 2), floor: { asset: "regdesk", pins: "cluster", label: "B" } },
      { key: "C", ko: "C홀", en: "Hall C", price: 1500000, unit: U.slot, slots: range("RGC", 3), floor: { asset: "regdesk", pins: "cluster", label: "C" } },
      { key: "D", ko: "D홀", en: "Hall D", price: 1500000, unit: U.slot, slots: range("RGD", 1), floor: { asset: "regdesk", pins: "cluster", label: "D" } },
    ],
  },
  {
    key: "BGE", code: "BGE", type: "quantity", channel: "offline",
    ko: "참관객 목걸이", en: "Visitor Lanyard",
    selectorId: "visitor_lanyard", slug: "visitor-lanyard",
    shortDesc: "참관객이 착용하는 출입증 목걸이에 브랜드를 노출하여 지속적인 홍보 효과 창출, 구좌당 5,000개 제작(전시회 총 50,000개)",
    shortDescEn: "Continuous brand exposure on the visitor badge lanyard, 5,000 units per slot (50,000 in total)",
    fileFormat: `${PRINT_FMT} / 로고 파일 컬러 1도 권장`, fileFormatEn: `${PRINT_FMT_EN} / single-color logo recommended`,
    deadline: "2026-02-28",
    timing: ["onsite"], location: ["hall", "lobby"], purposes: [B, T],
    tags: ["참관객_atoz_패키지"],
    hero: [["lanyard", ""]],
    subs: [
      { key: "lanyard", ko: "참관객 목걸이", en: "Visitor Lanyard", price: 7000000, unit: { ko: "구좌 (5,000개)", en: "slot (5,000 units)" }, slots: range("BGE", 10) },
    ],
  },
  {
    key: "IVL", code: "IVL", type: "quantity", channel: "offline",
    ko: "참관객 초청 DM", en: "Visitor Invitation DM",
    selectorId: "invitation_insert", slug: "invitation-dm",
    shortDesc: "국내 바이어 10만명 이상에게 발송되는 초대장에 참가업체 홍보물 동봉, 2개 업체 한정",
    shortDescEn: "Your promotional insert in invitations mailed to 100,000+ domestic buyers, limited to 2 companies",
    size: "W 176mm x H 80mm", sizeEn: "W 176mm x H 80mm",
    fileFormat: PRINT_FMT, fileFormatEn: PRINT_FMT_EN,
    deadline: "2026-02-06", guide: GUIDE.dm,
    timing: ["pre"], location: [], purposes: [N],
    tags: ["얼리브랜딩_패키지"],
    hero: [["dm", ""]],
    subs: [
      {
        key: "dm", ko: "100,000매", en: "100,000 copies", price: 10000000, unit: U.slot, slots: range("IVL", 2),
        priceNote: "10,000매당 1,000,000원, 최소 100,000매", priceNoteEn: "USD 1,000 per 10,000 copies, minimum 100,000 copies",
      },
    ],
  },
  {
    key: "GDB", code: "GDB", type: "print_page", channel: "offline",
    ko: "현장 쇼가이드", en: "Show Guide",
    selectorId: "guidebook_back", slug: "show-guide",
    shortDesc: "현장에서 배포되는 공식 쇼가이드 광고, 표4(뒤표지), 표2(표지 뒷면)와 대면, 표3(뒤표지의 앞면)과 내지, 지면별 1개 업체 한정",
    shortDescEn: "Ad in the official show guide distributed on site: back cover, inside front cover with facing page, or inside back cover with inside pages, 1 company per position",
    size: "A4", sizeEn: "A4",
    fileFormat: PRINT_FMT, fileFormatEn: PRINT_FMT_EN,
    deadline: "2026-02-28", guide: GUIDE.guideC4,
    timing: ["onsite"], location: ["hall", "lobby"], purposes: [B, N],
    tags: [],
    hero: [["guide_c4", "표4"], ["guide_c2", "표2, 대면"], ["guide_c3", "표3, 내지"]],
    subs: [
      { key: "c4ke", ko: "표4 국문+영문", en: "Back Cover KOR+ENG", price: 4000000, unit: U.page, slots: [{ code: "GDB-C4-KE" }] },
      { key: "c4k", ko: "표4 국문", en: "Back Cover KOR", price: 3000000, unit: U.page, slots: [{ code: "GDB-C4-K" }] },
      { key: "c4e", ko: "표4 영문", en: "Back Cover ENG", price: 2000000, unit: U.page, slots: [{ code: "GDB-C4-E" }] },
      { key: "c2ke", ko: "표2, 대면 국/영문", en: "IFC + Facing Page KOR/ENG", price: 3000000, unit: U.page, slots: [{ code: "GDB-C2-KE" }] },
      { key: "c2k", ko: "표2, 대면 국문", en: "IFC + Facing Page KOR", price: 2000000, unit: U.page, slots: [{ code: "GDB-C2-K" }] },
      { key: "c2e", ko: "표2, 대면 영문", en: "IFC + Facing Page ENG", price: 1500000, unit: U.page, slots: [{ code: "GDB-C2-E" }] },
      { key: "c3ke", ko: "표3, 내지 국/영문", en: "IBC + Inside Pages KOR/ENG", price: 1500000, unit: U.page, slots: [{ code: "GDB-C3-KE" }] },
      { key: "c3k", ko: "표3, 내지 국문", en: "IBC + Inside Pages KOR", price: 1000000, unit: U.page, slots: [{ code: "GDB-C3-K" }] },
      { key: "c3e", ko: "표3, 내지 영문", en: "IBC + Inside Pages ENG", price: 500000, unit: U.page, slots: [{ code: "GDB-C3-E" }] },
    ],
  },
  {
    key: "LDL", code: "LDL", type: "media", channel: "offline",
    ko: "경품이벤트 LED 광고", en: "Prize Event LED Video",
    selectorId: "prize_event_led", slug: "prize-event-led",
    shortDesc: "D홀, E홀 경품존 LED에 15초 이내 영상 송출, 총 5개 구좌, 영상은 참가업체 직접 제작",
    shortDescEn: "Up to 15 sec video on the prize zone LED in Halls D and E, 5 slots in total, video provided by exhibitor",
    size: "디자인 가이드 참고", sizeEn: "See design guide",
    fileFormat: "H.264(AVC), MP4 / JPG, PNG", fileFormatEn: "H.264(AVC), MP4 / JPG, PNG",
    deadline: "2026-01-31", guide: GUIDE.led,
    videoSpec: { duration: 15 },
    timing: ["onsite"], location: ["hall"], purposes: [B, T],
    tags: [],
    hero: [["led", ""]],
    detail: [["floor:led", "경품존 LED 위치"]],
    subs: [
      {
        key: "led", ko: "경품이벤트 LED", en: "Prize Event LED", price: 1500000, unit: U.slot, slots: range("LDL", 5),
        priceNote: "경품 협찬으로 대체 가능(사무국 문의)", priceNoteEn: "Can be replaced with prize sponsorship (contact Secretariat)",
      },
    ],
  },
  {
    key: "FST", code: "FST", type: "floor_plan", channel: "offline",
    ko: "전시장 내부 바닥 스티커", en: "Floor Direction Sticker",
    selectorId: "floor_sticker", slug: "floor-sticker",
    shortDesc: "전시장 내부 바닥에 브랜드 스티커 부착, 위치는 사무국 협의, 세로 사이즈 협의 가능",
    shortDescEn: "Brand sticker on the hall floor, placement agreed with the Secretariat, vertical size adjustable",
    size: "W 2,020mm x H 1,100mm", sizeEn: "W 2,020mm x H 1,100mm",
    fileFormat: PRINT_FMT, fileFormatEn: PRINT_FMT_EN,
    deadline: "2026-02-28", guide: GUIDE.floorSticker,
    timing: ["onsite"], location: ["hall"], purposes: [T],
    tags: ["온사이트_패키지"],
    hero: [["floor_sticker", ""]],
    subs: [
      { key: "sticker", ko: "바닥 스티커", en: "Floor Sticker", price: 1500000, unit: U.slot, slots: range("FST", 8) },
    ],
  },
  {
    key: "LTW", code: "LTW", type: "floor_plan", channel: "offline",
    ko: "라이팅월", en: "Lighting Wall",
    selectorId: "lighting_wall", slug: "lighting-wall",
    shortDesc: "전시장 주요 동선에 라이팅월 배너를 설치하여 브랜드를 선명하게 노출, 총 4구좌",
    shortDescEn: "Lighting wall banner along the main traffic flow for sharp brand visibility, 4 slots in total",
    size: "디자인 가이드 참고", sizeEn: "See design guide",
    fileFormat: PRINT_FMT, fileFormatEn: PRINT_FMT_EN,
    deadline: "2026-02-28", guide: GUIDE.lightingWall,
    timing: ["onsite"], location: ["lobby"], purposes: [N],
    tags: ["프라임_스팟_패키지"],
    hero: [["lighting_wall", ""]],
    subs: [
      { key: "wall", ko: "라이팅월", en: "Lighting Wall", price: 2000000, unit: U.slot, slots: range("LTW", 4), floor: { asset: "lighting_wall" } },
    ],
  },
  {
    key: "FPL", code: "FPL", type: "digital_banner", channel: "online",
    ko: "도면 내 참가기업 로고 표기", en: "Floor Map Logo Highlight",
    selectorId: "floor_map_logo", slug: "floor-map-logo",
    shortDesc: "홈페이지, 홍보리플렛, 가이드북, 현황판 등의 전시장 도면에 참가기업 로고 표기, 4부스 이상 기업 한정",
    shortDescEn: "Your logo on the floor map across the website, promo leaflet, guidebook and status boards, for exhibitors with 4+ booths",
    size: "사무국 문의(4부스 이상 기업 한정)", sizeEn: "Contact Secretariat (exhibitors with 4+ booths only)",
    fileFormat: PRINT_FMT, fileFormatEn: PRINT_FMT_EN,
    deadline: "2026-02-28",
    timing: [], location: ["online", "hall"], purposes: [B, T],
    tags: [],
    hero: [["fpl", ""]],
    subs: [
      { key: "logo", ko: "로고 표기", en: "Logo Highlight", price: 4000000, unit: U.slot, slots: range("FPL", 20) },
    ],
  },
  // ── 온라인 ──
  {
    key: "RGS", code: "RGS", type: "digital_banner", channel: "online",
    ko: "참관등록 페이지 배너", en: "Pre-registration Banner",
    selectorId: "pre_registration_banner", slug: "preregister-banner",
    shortDesc: "사전등록 페이지 상단에 브랜드를 노출하여 행사 전부터 지속적인 광고효과 선점, 1개 업체 한정",
    shortDescEn: "Banner at the top of the pre-registration page to secure brand exposure before the show, limited to 1 company",
    size: WEB_SIZE, sizeEn: WEB_SIZE, fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.webBanner,
    timing: ["pre"], location: ["online"], purposes: [B, N],
    tags: ["참관객_atoz_패키지"],
    hero: [["rgs", ""]],
    subs: [{ key: "rgs", ko: "참관등록 페이지", en: "Pre-registration Page", price: 5000000, unit: U.exclusive, slots: range("RGS", 1) }],
  },
  {
    key: "RGM", code: "RGM", type: "mailing", channel: "online",
    ko: "참관등록 완료 이메일", en: "Registration Confirmation Email",
    selectorId: "pre_registration_email", slug: "confirm-mail",
    shortDesc: "참관객 사전등록 후 발송되는 확인 메일 상단에 배너를 삽입하여 고객에게 메시지 직접 전달, 1개 업체 한정",
    shortDescEn: "Top banner in the confirmation email sent after pre-registration, limited to 1 company",
    size: WEB_SIZE, sizeEn: WEB_SIZE, fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.webBanner,
    timing: ["pre"], location: ["online"], purposes: [],
    tags: [],
    hero: [["rgm", ""]],
    subs: [{ key: "rgm", ko: "완료 이메일 배너", en: "Confirmation Email Banner", price: 4000000, unit: U.exclusive, slots: range("RGM", 1) }],
  },
  {
    key: "TTS", code: "TTS", type: "digital_banner", channel: "online",
    ko: "통합검색 페이지 배너", en: "‘Ask-Anything’ Page Banner",
    selectorId: "integrated_search_banner", slug: "integrated-search-banner",
    shortDesc: "통합검색 페이지 결과 화면에 배너를 노출하여 광범위한 참관객 대상 브랜딩, 총 5구좌",
    shortDescEn: "Banner on the ‘Ask-Anything’ results page for broad brand reach, 5 slots in total",
    size: WEB_SIZE, sizeEn: WEB_SIZE, fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.webBanner,
    timing: [], location: ["online"], purposes: [N],
    tags: [],
    hero: [["tts", ""]],
    subs: [{ key: "tts", ko: "통합검색 배너", en: "Search Banner", price: 2000000, unit: U.slot, slots: range("TTS", 5) }],
  },
  {
    key: "PRS", code: "PRS", type: "digital_banner", channel: "online",
    ko: "전시품 검색 페이지 배너", en: "Product Search Page Banner",
    selectorId: "product_search_banner", slug: "product-search-banner",
    shortDesc: "특정 품목을 찾는 바이어의 검색 화면 상단에 배너 노출하여 자사 제품에 대한 관심 유도, 총 5구좌",
    shortDescEn: "Top banner on the product search page to capture buyers looking for specific items, 5 slots in total",
    size: WEB_SIZE, sizeEn: WEB_SIZE, fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.webBanner,
    timing: [], location: ["online"], purposes: [N],
    tags: ["프라임_스팟_패키지"],
    hero: [["prs", ""]],
    subs: [{ key: "prs", ko: "전시품 검색 배너", en: "Product Search Banner", price: 2000000, unit: U.slot, slots: range("PRS", 5) }],
  },
  {
    key: "EXS", code: "EXS", type: "digital_banner", channel: "online",
    ko: "참가업체 검색 페이지 배너", en: "Exhibitor Search Page Banner",
    selectorId: "company_search_banner", slug: "company-search-banner",
    shortDesc: "참가업체를 검색하는 바이어의 화면 상단에 배너를 노출하여 비즈니스 미팅 기회 창출, 총 5구좌",
    shortDescEn: "Top banner on the exhibitor search page to create business meeting opportunities, 5 slots in total",
    size: WEB_SIZE, sizeEn: WEB_SIZE, fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.webBanner,
    timing: [], location: ["online"], purposes: [B],
    tags: ["프라임_스팟_패키지"],
    hero: [["exs", ""]],
    subs: [{ key: "exs", ko: "참가업체 검색 배너", en: "Exhibitor Search Banner", price: 2000000, unit: U.slot, slots: range("EXS", 5) }],
  },
  {
    key: "SMR", code: "SMR", type: "digital_banner", channel: "online",
    ko: "세미나 페이지 배너", en: "Seminar Page Top Banner",
    selectorId: "seminar_banner", slug: "seminar-banner",
    shortDesc: "세미나 정보 확인 페이지 상단에 브랜드를 노출하여 타깃 고객 집중 공략, 총 5구좌",
    shortDescEn: "Banner at the top of the seminar page for focused targeting of attendees, 5 slots in total",
    size: WEB_SIZE, sizeEn: WEB_SIZE, fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.webBanner,
    timing: [], location: ["online"], purposes: [T],
    tags: ["세미나_컨퍼런스_패키지"],
    hero: [["smr", ""]],
    subs: [{ key: "smr", ko: "세미나 페이지 배너", en: "Seminar Page Banner", price: 1500000, unit: U.slot, slots: range("SMR", 5) }],
  },
  {
    key: "FPS", code: "FPS", type: "digital_banner", channel: "online",
    ko: "전시장 도면 페이지 하단 배너", en: "Floor Plan Page Bottom Banner",
    selectorId: "floor_map_banner", slug: "floor-plan-banner",
    shortDesc: "참관객이 필수적으로 확인하는 도면 페이지 하단에 배너 노출, KIMES 공식 홈페이지와 어플리케이션 동시 게재, 1개 업체 한정",
    shortDescEn: "Banner at the bottom of the floor plan page every visitor checks, on both the KIMES website and app, limited to 1 company",
    size: "(PC)1,920px x 160px / (TAB)768px x 160px / (MO)360px x 160px",
    sizeEn: "(PC)1,920px x 160px / (TAB)768px x 160px / (MO)360px x 160px",
    fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.fps,
    timing: [], location: ["online"], purposes: [T],
    tags: [],
    hero: [["fps", ""]],
    subs: [{ key: "fps", ko: "도면 페이지 하단 배너", en: "Floor Plan Bottom Banner", price: 12000000, unit: U.exclusive, slots: range("FPS", 1) }],
  },
  {
    key: "DNL", code: "DNL", type: "mailing", channel: "online",
    ko: "국내 뉴스레터 배너", en: "Korean Newsletter Banner",
    selectorId: "newsletter_domestic", slug: "korean-newsletter",
    shortDesc: "국내 참관객 약 150,000명에게 발송되는 뉴스레터 상단에 배너 게재, 발송 일정은 선착순 협의, 파일은 발송 희망일 2주 전까지 제출",
    shortDescEn: "Top banner in the newsletter sent to about 150,000 domestic visitors, send date on a first-come basis, files due 2 weeks before sending",
    size: "W 630px x H 160px", sizeEn: "W 630px x H 160px", fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    guide: GUIDE.newsletter,
    mailingSpec: { sendDates: [], audience: 150000, audienceLabel: "국내 참관객", audienceLabelEn: "Domestic visitors" },
    timing: ["pre"], location: ["online"], purposes: [B, N],
    tags: ["세미나_컨퍼런스_패키지", "얼리브랜딩_패키지"],
    hero: [["dnl", ""]],
    subs: [
      { key: "feb", ko: "2월 발송", en: "Sent in February", price: 1500000, unit: U.send, slots: range("DNL", 1) },
      { key: "mar", ko: "3월 발송", en: "Sent in March", price: 3000000, unit: U.send, slots: range("DNL", 1, 2) },
    ],
  },
  {
    key: "INL", code: "INL", type: "mailing", channel: "online",
    ko: "해외 뉴스레터 배너", en: "Global Newsletter Banner",
    selectorId: "newsletter_overseas", slug: "global-newsletter",
    shortDesc: "해외 참관객 약 30,000명에게 발송되는 뉴스레터 상단에 배너 게재, 발송 일정은 선착순 협의, 파일은 발송 희망일 2주 전까지 제출",
    shortDescEn: "Top banner in the newsletter sent to about 30,000 overseas visitors, send date on a first-come basis, files due 2 weeks before sending",
    size: "W 630px x H 160px", sizeEn: "W 630px x H 160px", fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    guide: GUIDE.newsletter,
    mailingSpec: { sendDates: [], audience: 30000, audienceLabel: "해외 참관객", audienceLabelEn: "Overseas visitors" },
    timing: ["pre"], location: ["online"], purposes: [B, N],
    tags: ["얼리브랜딩_패키지"],
    hero: [["inl", ""]],
    subs: [
      { key: "feb", ko: "2월 발송", en: "Sent in February", price: 1500000, unit: U.send, slots: range("INL", 1) },
      { key: "mar", ko: "3월 발송", en: "Sent in March", price: 3000000, unit: U.send, slots: range("INL", 1, 2) },
    ],
  },
  {
    key: "APM", code: "APM", type: "digital_banner", channel: "online",
    ko: "APP 메인페이지 팝업", en: "App Main Page Popup",
    selectorId: "app_popup", slug: "app-main-popup",
    shortDesc: "KIMES 공식 어플리케이션 메인페이지 팝업 배너, 총 5구좌",
    shortDescEn: "Popup banner on the KIMES official app main page, 5 slots in total",
    size: "W 1,080px x H 1,080px", sizeEn: "W 1,080px x H 1,080px", fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.appPopup,
    timing: ["onsite"], location: ["online"], purposes: [B, N],
    tags: ["app_광고_패키지"],
    hero: [["app_popup", ""]],
    subs: [{ key: "popup", ko: "메인페이지 팝업", en: "Main Page Popup", price: 2000000, unit: U.slot, slots: range("APM", 5) }],
  },
  {
    key: "APB", code: "APB", type: "digital_banner", channel: "online",
    ko: "APP 메인페이지 하단 배너", en: "App Main Page Bottom Banner",
    selectorId: "app_bottom_banner", slug: "app-bottom-banner",
    shortDesc: "KIMES 공식 어플리케이션 메인페이지 하단 배너, 1개 업체 한정",
    shortDescEn: "Bottom banner on the KIMES official app main page, limited to 1 company",
    size: "W 640px x H 144px", sizeEn: "W 640px x H 144px", fileFormat: "PNG, JPG", fileFormatEn: "PNG, JPG",
    deadline: "2026-02-28", guide: GUIDE.appBottom,
    timing: ["onsite"], location: ["online"], purposes: [T],
    tags: ["app_광고_패키지"],
    hero: [["app_bottom", ""]],
    subs: [{ key: "bottom", ko: "메인페이지 하단", en: "Main Page Bottom", price: 4000000, unit: U.exclusive, slots: range("APB", 1) }],
  },
  {
    key: "APP", code: "APP", type: "mailing", channel: "online",
    ko: "APP 푸시 알림", en: "App Push Notification",
    selectorId: "app_push", slug: "app-push",
    shortDesc: "KIMES 공식 어플리케이션 푸시 알림(발송 일정 협의), KIMES 2026에서 진행되는 세미나, 이벤트 등 프로그램 홍보에 한정",
    shortDescEn: "Push notification via the KIMES official app (schedule coordinated), limited to promoting KIMES 2026 seminars, events and programs",
    size: "제목 30자 이내, 내용 100자 이내", sizeEn: "Title up to 30 characters, text up to 100 characters",
    fileFormat: "TXT, XLS", fileFormatEn: "TXT, XLS",
    deadline: "2026-02-28",
    timing: ["onsite"], location: ["online"], purposes: [T],
    tags: ["app_광고_패키지", "세미나_컨퍼런스_패키지"],
    hero: [["app_push", ""]],
    subs: [{ key: "push", ko: "푸시 알림", en: "Push Notification", price: 500000, unit: U.push, slots: range("APP", 10) }],
  },
  {
    key: "PIC", code: "PIC", type: "content", channel: "online",
    ko: "참가업체 인터뷰 및 SNS 채널 홍보", en: "Exhibitor Interviews & SNS Promotion",
    selectorId: "interview_sns", slug: "exhibitor-interview-sns",
    shortDesc: "참가업체 인터뷰를 KIMES 공식 인스타그램, 페이스북, 링크드인, 블로그, 뉴스레터, 카카오 친구톡에 배포, 사전은 참가업체 방문 촬영, 현장은 전시회 현장 촬영",
    shortDescEn: "Exhibitor interview shared on KIMES official Instagram, Facebook, LinkedIn, blog, newsletter and Kakao Friend Talk, filmed at your site (pre-show) or at the show (on-site)",
    fileFormat: "인터뷰 형태(사전, 현장), 사전 인터뷰 담당자 정보(성함, 연락처, 이메일, 인터뷰 희망일자)",
    fileFormatEn: "Interview format (pre-show, on-site), contact info (name, phone, email, preferred date)",
    deadline: "2026-01-31",
    contentSpec: { channel: "인스타그램, 페이스북, 링크드인, 블로그, 뉴스레터, 카카오 친구톡", format: "인터뷰 (사전 방문 촬영, 현장 촬영)" },
    timing: ["pre", "onsite"], location: ["online"], purposes: [N],
    tags: ["sns_패키지"],
    hero: [["interview", ""]],
    subs: [
      { key: "pre", ko: "사전 인터뷰", en: "Pre-show Interview", price: 3000000, unit: U.post, slots: range("PIC", 5), priceNote: "제출마감 2026년 1월 31일", priceNoteEn: "Deadline Jan 31, 2026" },
      { key: "onsite", ko: "현장 인터뷰", en: "On-site Interview", price: 3000000, unit: U.post, slots: range("OIC", 5), priceNote: "제출마감 2026년 2월 28일", priceNoteEn: "Deadline Feb 28, 2026" },
    ],
  },
  {
    key: "OCD", code: "OCD", type: "content", channel: "online",
    ko: "인스타그램 카드뉴스 업로드", en: "Instagram Carousel Post",
    selectorId: "instagram_card", slug: "insta-carouselpost",
    shortDesc: "KIMES 공식 인스타그램에 카드뉴스 콘텐츠를 업로드하여 자사 제품 또는 콘텐츠 노출, 제품과 콘텐츠 품질에 따라 업로드 제한 가능",
    shortDescEn: "Carousel post on KIMES official Instagram showcasing your products or content, upload may be restricted depending on quality",
    deadline: "2026-02-28",
    contentSpec: { channel: "Instagram", format: "카드뉴스 1건" },
    timing: [], location: ["online"], purposes: [T, N],
    tags: ["sns_패키지"],
    hero: [["cardnews", ""]],
    subs: [{ key: "card", ko: "카드뉴스 1건", en: "1 Carousel Post", price: 500000, unit: U.post, slots: range("OCD", 10) }],
  },
];

// 패키지 — PDF 12쪽(Signature), 13쪽(Standard). 가격은 PDF 표기 그대로.
//  item: [catKey, subKey|null, count, labelKo, labelEn]  catKey=null 이면 수기 라벨
const PKGS = [
  {
    code: "PSG1", tier: "signature", selectorId: "visitor_atoz_package",
    ko: "참관객 A to Z 패키지", en: "A to Z Visitor Package",
    tagline: "참관객의 모든 방문 경로에서 기업의 영향력을 알리는", taglineEn: "Boosting visibility across all visitor touchpoints",
    original: 19500000, discount: 17000000,
    items: [
      ["RGA", null, 5, "등록대(출입증 발급대) 5구좌", "Registration Area, 5 slots"],
      ["RGS", "rgs", 1, "참관등록 페이지 배너 (단독구좌)", "Pre-registration Banner (exclusive)"],
      ["BGE", "lanyard", 1, "참관객 목걸이 1구좌", "Visitor Lanyard, 1 slot"],
    ],
  },
  {
    code: "PSG2", tier: "signature", selectorId: "outdoor_package",
    ko: "옥외광고 패키지", en: "Digital Signage Package",
    tagline: "월평균 120만명 유동인구 대상 디지털 사이니지", taglineEn: "Digital signage exposure to 1.2M visitors per month",
    original: 24000000, discount: 20000000,
    priceNote: "XPACE 2종만 선택 시 10% 할인", priceNoteEn: "10% off when choosing only 2 XPACE types",
    items: [
      ["XPA", "bridge", 1, "XPACE 브릿지+빅브릿지 1구좌", "XPACE Bridge + Big Bridge, 1 slot"],
      ["XPA", "wide", 1, "XPACE 와이드+스퀘어브릿지 1구좌", "XPACE Wide Bridge + Square Bridge, 1 slot"],
      ["XPA", "edge", 1, "XPACE 엣지컬럼 1구좌", "XPACE Edge Column, 1 slot"],
    ],
  },
  {
    code: "PSG3", tier: "signature", selectorId: "prime_spot_package",
    ko: "프라임 스팟 패키지", en: "Prime Spot Package",
    tagline: "노출에 가장 효과적인 온오프라인 플랫폼", taglineEn: "The most effective on and offline exposure platform",
    original: 9000000, discount: 8000000,
    items: [
      ["CBA", null, 1, "천장배너 1구좌", "Ceiling Banner, 1 slot"],
      ["LTW", "wall", 1, "라이팅월 1구좌", "Lighting Wall, 1 slot"],
      [null, null, 1, "참가업체/전시품 검색 페이지 배너", "Exhibitor / Product Search Page Banner"],
    ],
    composition: ["ceiling_banner", "lighting_wall", "company_search_banner", "product_search_banner"],
    alsoIn: ["EXS", "PRS"],
  },
  {
    code: "PSG4", tier: "signature", selectorId: "early_branding_package",
    ko: "얼리브랜딩 패키지", en: "Early Branding Package",
    tagline: "국내외 핵심 타깃에게 브랜드를 가장 먼저 각인시키는", taglineEn: "Reaching key domestic and global targets first",
    original: 19000000, discount: 15000000,
    items: [
      ["IVL", "dm", 1, "참관객 초청 DM", "Visitor Invitation DM"],
      ["DNL", "feb", 1, "국내 뉴스레터 배너 (2월 발송) 1회", "Korean Newsletter Banner (February), 1 send"],
      ["DNL", "mar", 1, "국내 뉴스레터 배너 (3월 발송) 1회", "Korean Newsletter Banner (March), 1 send"],
      ["INL", "feb", 1, "해외 뉴스레터 배너 (2월 발송) 1회", "Global Newsletter Banner (February), 1 send"],
      ["INL", "mar", 1, "해외 뉴스레터 배너 (3월 발송) 1회", "Global Newsletter Banner (March), 1 send"],
    ],
  },
  {
    code: "PST1", tier: "standard", selectorId: "onsite_package",
    ko: "온사이트 패키지", en: "On-site Package",
    tagline: "전시장 주요 동선을 활용해 기본 노출을 확보하는", taglineEn: "Gaining visibility along key pathways",
    original: 6000000, discount: 5000000,
    items: [
      ["CBA", null, 1, "천장배너 1구좌", "Ceiling Banner, 1 slot"],
      ["FST", "sticker", 2, "전시장 내부 바닥 스티커 2구좌", "Floor Direction Sticker, 2 slots"],
    ],
  },
  {
    code: "PST2", tier: "standard", selectorId: "seminar_package",
    ko: "세미나/컨퍼런스 패키지", en: "Seminar & Conference Package",
    tagline: "의료산업 지식 교류의 장, KIMES 세미나", taglineEn: "Medical industry knowledge exchange at KIMES seminars",
    original: 5000000, discount: 4000000,
    items: [
      ["SMR", "smr", 1, "세미나 페이지 상단 배너 1구좌", "Seminar Page Top Banner, 1 slot"],
      ["APP", "push", 1, "APP 푸시 알림 1회", "App Push Notification, once"],
      ["DNL", "mar", 1, "국내 뉴스레터 배너 (3월 발송) 1회", "Korean Newsletter Banner (March), 1 send"],
    ],
  },
  {
    code: "PST3", tier: "standard", selectorId: "app_package",
    ko: "APP 광고 패키지", en: "Application AD Package",
    tagline: "KIMES 공식 어플리케이션을 활용한", taglineEn: "Using the official KIMES application",
    original: 7500000, discount: 6000000,
    items: [
      ["APM", "popup", 1, "APP 메인페이지 팝업 1구좌", "App Main Page Popup, 1 slot"],
      ["APB", "bottom", 1, "APP 메인페이지 하단 배너", "App Main Page Bottom Banner"],
      ["APP", "push", 2, "APP 푸시 알림 2회", "App Push Notification, twice"],
    ],
  },
  {
    code: "PST4", tier: "standard", selectorId: "sns_package",
    ko: "SNS 패키지", en: "SNS Package",
    tagline: "콘텐츠를 활용해 온라인 확산을 유도하는", taglineEn: "Driving online reach through content",
    original: 6500000, discount: 5000000,
    priceNote: "전시 성격과 맞지 않는 콘텐츠는 제한될 수 있습니다.", priceNoteEn: "Content not aligned with the exhibition may be restricted.",
    items: [
      ["PIC", "pre", 1, "참가업체 인터뷰 및 배포 (사전)", "Exhibitor Interview (pre-show)"],
      ["PIC", "onsite", 1, "참가업체 인터뷰 및 배포 (현장)", "Exhibitor Interview (on-site)"],
      ["OCD", "card", 1, "인스타그램 카드뉴스 1건", "Instagram Carousel Post, 1 post"],
    ],
  },
];

// 페르소나 — KIMES BUSAN 3종 틀. 수치 문구(재참가사 60% 등)는 K-PRINT 기준이라 비움.
const PERSONAS = [
  {
    purpose: N, title: "신제품 홍보형", titleEn: "New Product Launch", packageTier: "signature", order: 1,
    description: "이미지나 텍스트를 통해 참관객에게 새로운 제품, 콘텐츠를 알리기 좋은 항목",
    descriptionEn: "Items suited to introducing new products or content to visitors through images and text",
  },
  {
    purpose: T, title: "현장 방문객 유도형", titleEn: "Drive On-floor Traffic", packageTier: "signature", order: 2,
    description: "참관객의 동선을 부스로 이끌거나 온라인 페이지에 접속한 참관객의 부스 방문 유도",
    descriptionEn: "Guide visitors on the floor and online toward your booth",
  },
  {
    purpose: B, title: "브랜드 확산형", titleEn: "Brand Awareness", packageTier: "standard", order: 3,
    description: "전시장 내/외부, 온/오프라인 전반에 걸쳐 지속적이고 반복적인 노출을 통한 브랜드 인지도 극대화",
    descriptionEn: "Maximize brand recognition through persistent, repeated exposure across on-site and digital channels",
  },
];

// ============================================================================
// [1] Pre-flight
// ============================================================================

const COLS_BY_EID = ["categories", "subcategories", "slots", "packages", "personas"];
const COLS_BY_DOCID = ["siteSettings", "taxonomy", "quoteSettings"];

console.log("\n[1] Pre-flight: 타겟 비어있는지 검사");
let dirty = false;
const evSnap = await fs.collection("events").doc(EID).get();
console.log(`    events/${EID}: ${evSnap.exists ? "EXISTS" : "—"}`);
if (evSnap.exists) dirty = true;
for (const col of COLS_BY_EID) {
  const snap = await fs.collection(col).where("eventId", "==", EID).get();
  console.log(`    ${col} (eventId=${EID}): ${snap.size}`);
  if (snap.size > 0) dirty = true;
}
for (const col of COLS_BY_DOCID) {
  const d = await fs.collection(col).doc(EID).get();
  console.log(`    ${col}/${EID}: ${d.exists ? "EXISTS" : "—"}`);
  if (d.exists) dirty = true;
}
if (dirty && !DRY) {
  console.error("\n✗ 타겟에 이미 데이터가 있습니다. 데이터 섞임 방지를 위해 abort.");
  process.exit(1);
}

const [tplSettings, tplTaxonomy, mainQuote] = await Promise.all([
  fs.collection("siteSettings").doc(TEMPLATE_EID).get(),
  fs.collection("taxonomy").doc(TEMPLATE_EID).get(),
  fs.collection("quoteSettings").doc("main").get(), // KIMES 2026 견적서 원본 (KMS26-)
]);
if (!tplSettings.exists || !tplTaxonomy.exists || !mainQuote.exists) {
  console.error("✗ 템플릿 도큐먼트 누락");
  process.exit(1);
}

// ============================================================================
// [2] ID 발급 + 도큐먼트 조립
// ============================================================================

console.log("\n[2] 도큐먼트 조립");
const now = Timestamp.now();
const genId = (col) => fs.collection(col).doc().id;

const uploads = []; // { local, dest, assign(result) }
function queueUpload(localRel, destDir, assign) {
  const local = path.join(ASSETS, localRel);
  if (!existsSync(local)) throw new Error(`이미지 없음: ${local}`);
  const dest = `${destDir}/${randomUUID()}_${path.basename(localRel)}`;
  uploads.push({ local, dest, assign });
}

const personaDocs = PERSONAS.map((p) => ({
  id: genId("personas"),
  eventId: EID,
  emoji: "",
  title: p.title,
  titleEn: p.titleEn,
  description: p.description,
  descriptionEn: p.descriptionEn,
  purposes: [p.purpose],
  packageTier: p.packageTier,
  targetTags: [],
  order: p.order,
  isActive: true,
}));
const personaByPurpose = Object.fromEntries(PERSONAS.map((p, i) => [p.purpose, personaDocs[i].id]));

const catDocs = [];
const subDocs = [];
const slotDocs = [];
const catByKey = {};
const subByKey = {}; // `${catKey}/${subKey}`

CATS.forEach((c, order) => {
  const catId = genId("categories");
  const cat = {
    id: catId,
    eventId: EID,
    code: c.code,
    selectorId: c.selectorId,
    channel: c.channel,
    type: c.type,
    slug: c.slug,
    name: { ko: c.ko, en: c.en },
    shortDesc: c.shortDesc,
    shortDescEn: c.shortDescEn,
    size: c.size,
    sizeEn: c.sizeEn,
    fileFormat: c.fileFormat,
    fileFormatEn: c.fileFormatEn,
    deadline: c.deadline ? day(c.deadline) : undefined,
    designGuideFileUrl: c.guide,
    heroImages: { mode: c.hero.length > 1 ? "carousel" : "single", images: [] },
    detailImages: { mode: "single", images: [] },
    floorImages: c.subs.some((s) => s.floor) ? [] : undefined,
    videoSpec: c.videoSpec,
    mailingSpec: c.mailingSpec,
    contentSpec: c.contentSpec,
    tags: [...c.tags, ...c.purposes.map((p) => PURPOSE_TAG[p])],
    isPublished: true,
    personas: c.purposes.map((p) => personaByPurpose[p]),
    timingOverride: c.timing.length ? c.timing : undefined,
    locationOverride: c.location.length ? c.location : undefined,
    purposeOverride: c.purposes.length ? c.purposes : undefined,
    goalAffinity: Object.fromEntries([B, T, N].map((p) => [p, c.purposes.includes(p) ? 3 : 1])),
    inPackages: [],
    order,
    lockedFields: [],
    createdAt: now,
    updatedAt: now,
  };
  catDocs.push(cat);
  catByKey[c.key] = cat;

  c.hero.forEach(([asset, caption], i) => {
    queueUpload(manifest.hero[asset].file, `categories/${catId}/hero`, (r) => {
      cat.heroImages.images.push({ ...r, caption, order: i });
    });
  });
  (c.detail ?? []).forEach(([ref, caption], i) => {
    const [kind, asset] = ref.split(":");
    queueUpload(manifest[kind][asset].file, `categories/${catId}/detail`, (r) => {
      cat.detailImages.images.push({ ...r, caption, order: i });
    });
  });

  c.subs.forEach((s, subOrder) => {
    const subId = genId("subcategories");
    const sub = {
      id: subId,
      eventId: EID,
      categoryId: catId,
      name: { ko: s.ko, en: s.en },
      priceKRW: s.price,
      priceUSD: s.price / 1000,
      unit: s.unit,
      priceNote: s.priceNote,
      priceNoteEn: s.priceNoteEn,
      order: subOrder,
    };
    subDocs.push(sub);
    subByKey[`${c.key}/${s.key}`] = sub;

    const slots = s.slots.map((sl, i) => {
      const slot = {
        id: genId("slots"),
        eventId: EID,
        subcategoryId: subId,
        categoryId: catId,
        code: sl.code,
        status: "available",
        note: sl.note,
        order: i,
      };
      slotDocs.push(slot);
      return { slot, pinLabel: sl.pinLabel };
    });

    if (s.floor) {
      const fm = manifest.floor[s.floor.asset];
      let pins = [];
      if (s.floor.pins === "label") {
        pins = slots.map(({ slot, pinLabel }) => {
          const [x, y] = fm.labels[pinLabel];
          return { slotId: slot.id, x, y, note: pinLabel };
        });
      } else if (s.floor.pins === "cluster") {
        // 같은 출입구에 여러 구좌 — 라벨 바로 위에 가로로 나란히
        const [lx, ly] = fm.labels[s.floor.label];
        const gap = 2.4;
        pins = slots.map(({ slot }, i) => ({
          slotId: slot.id,
          x: Math.round((lx + (i - (slots.length - 1) / 2) * gap) * 100) / 100,
          y: Math.round((ly - 4) * 100) / 100,
          note: s.ko,
        }));
      }
      // 소분류마다 파일을 따로 올림 — 어드민에서 한 도면을 지워도 다른 소분류 도면이 같이 지워지지 않게
      queueUpload(fm.file, `categories/${catId}/floor`, (r) => {
        cat.floorImages.push({ subcategoryId: subId, ...r, pins });
      });
    }
  });
});

const pkgDocs = PKGS.map((p, i) => {
  const id = genId("packages");
  const includedItems = p.items.map(([catKey, subKey, count, label, labelEn]) => {
    const cat = catKey ? catByKey[catKey] : null;
    const sub = catKey && subKey ? subByKey[`${catKey}/${subKey}`] : null;
    return { label, labelEn, categoryId: cat?.id, subcategoryId: sub?.id, count };
  });
  const catKeys = new Set([...p.items.map((it) => it[0]).filter(Boolean), ...(p.alsoIn ?? [])]);
  for (const k of catKeys) catByKey[k].inPackages.push(id);
  return {
    id,
    eventId: EID,
    code: p.code,
    selectorId: p.selectorId,
    composition: p.composition ?? p.items.filter((it) => it[0]).map((it) => catByKey[it[0]].selectorId),
    name: { ko: p.ko, en: p.en },
    tier: p.tier,
    tagline: p.tagline,
    taglineEn: p.taglineEn,
    includedItems,
    originalPrice: p.original,
    discountPrice: p.discount,
    originalPriceUSD: p.original / 1000,
    discountPriceUSD: p.discount / 1000,
    unit: "패키지",
    priceNote: p.priceNote,
    priceNoteEn: p.priceNoteEn,
    heroImages: { mode: "carousel", images: [] },
    isPublished: true,
    soldOut: false,
    order: i + 1,
    createdAt: now,
    updatedAt: now,
  };
});

// 랜딩 — PDF 소개 슬라이드(1, 3~7쪽)를 캔버스 배경으로. 국문/영문 PDF 각각.
const landing = { ko: [], en: [] };
for (const lang of ["ko", "en"]) {
  manifest.landing[lang].forEach((file, i) => {
    const block = {
      id: randomUUID().slice(0, 8),
      type: "canvasPage",
      data: { page: { id: randomUUID().slice(0, 8), name: path.basename(file, ".webp"), bg: "#F6F6F6", nodes: [] } },
    };
    landing[lang][i] = block;
    queueUpload(file, "landing/canvas-page-bg", (r) => {
      block.data.page.bgImageUrl = r.url;
    });
  });
}

const tpl = tplSettings.data();
const siteSettings = {
  eventId: EID,
  theme: { primary: "#DB0711" },
  event: {
    nameKo: "KIMES 2026",
    nameEn: "KIMES 2026",
    dateRange: "2026년 3월 19일(목) ~ 22일(일)",
    dateRangeEn: "Mar 19 (Thu) ~ 22 (Sun), 2026",
    venue: "코엑스(COEX)",
    venueEn: "COEX, Seoul",
    applicationDeadline: day("2026-02-28"),
  },
  kv: { desktopUrl: "" },
  why: { headline: "", stats: [], chartData: [] },
  applicationSteps: [],
  contact: {
    phone: "02-551-0102",
    email: "kimes@kimes.kr",
    address: "서울특별시 강남구 영동대로 511 트레이드타워 2001호",
    addressEn: "Room 2001, Trade Tower, 511 Yeongdong-daero, Gangnam-gu, Seoul, Korea",
  },
  typeLayouts: tpl.typeLayouts ?? {},
  bundledPerks: [
    { label: "참가업체 검색 페이지 상위 고정", labelEn: "Top Placement in Exhibitor Search Results" },
    { label: "스폰서 참가업체 뱃지 표기", labelEn: "Sponsor Exhibitor Badge" },
    {
      label: "도면 내 로고 표기 또는 홈페이지 배너",
      labelEn: "Logo on Floor Map or Homepage Banner",
      description: "홈페이지 배너는 참가업체 검색 또는 전시품 검색 페이지, 선착순 5개사",
      descriptionEn: "Homepage banner on the exhibitor or product search page, first 5 companies",
    },
  ],
  landing: landing.ko,
  landingEn: landing.en,
  applyUrl: "https://apply.kimes.kr/ko/mypage/exhibitor/advertise",
  applyUrlEn: "",
  closingHeadline: "의료 전문인이 모이는 플랫폼에서\n지금 바로 브랜드를 알리세요!",
  closingHeadlineEn: "Showcase your brand today\non the platform trusted by medical professionals!",
  pdfFullUrl: null,
  pdfFullStoragePath: null,
  pdfFullUploadedAt: null,
  pdfFullUrlEn: null,
  pdfFullStoragePathEn: null,
  pdfFullUploadedAtEn: null,
  updatedAt: now,
};

const taxonomy = {
  ...tplTaxonomy.data(),
  eventId: EID,
  locationBuckets: [
    { id: "hall", label: "홀 내부", labelEn: "Inside Halls" },
    { id: "lobby", label: "로비, 출입구", labelEn: "Lobby & Entrances" },
    { id: "outdoor", label: "옥외 사이니지", labelEn: "Outdoor Signage" },
    { id: "online", label: "온라인", labelEn: "Online" },
  ],
  updatedAt: now,
};

const quoteSettings = { ...mainQuote.data(), eventId: EID, serialNextNumber: 1, updatedAt: now };

const eventDoc = {
  id: EID,
  name: "KIMES 2026",
  shortName: "KIMES",
  year: 2026,
  isActive: true,
  order: 2,
  createdAt: now,
  updatedAt: now,
};

console.log(`    categories ${catDocs.length}, subcategories ${subDocs.length}, slots ${slotDocs.length}, packages ${pkgDocs.length}, personas ${personaDocs.length}`);
console.log(`    이미지 업로드 ${uploads.length}건`);
for (const c of catDocs) {
  const subs = subDocs.filter((s) => s.categoryId === c.id);
  const n = slotDocs.filter((s) => s.categoryId === c.id).length;
  console.log(`      [${c.code}] ${c.name.ko} — 소분류 ${subs.length}, 구좌 ${n}, ${subs.map((s) => `${s.name.ko} ${s.priceKRW.toLocaleString()}`).join(" / ")}`);
}
for (const p of pkgDocs) {
  console.log(`      [${p.code}] ${p.name.ko} ${p.originalPrice.toLocaleString()} → ${p.discountPrice.toLocaleString()} (${p.includedItems.length}항목)`);
}

if (DRY) {
  console.log("\n✓ Dry-run 완료. 실제 실행하려면 --confirm 으로 재실행.");
  process.exit(0);
}

// ============================================================================
// [3] 이미지 업로드 → [4] Firestore batch
// ============================================================================

console.log("\n[3] 이미지 업로드");
for (const u of uploads) {
  const token = randomUUID();
  await bucket.upload(u.local, {
    destination: u.dest,
    metadata: {
      contentType: "image/webp",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  u.assign({
    url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(u.dest)}?alt=media&token=${token}`,
    storagePath: u.dest,
  });
}
console.log(`    ${uploads.length}건 완료`);

console.log("\n[4] Firestore 쓰기 (단일 batch)");
const batch = fs.batch();
batch.set(fs.collection("events").doc(EID), eventDoc);
for (const d of catDocs) batch.set(fs.collection("categories").doc(d.id), d);
for (const d of subDocs) batch.set(fs.collection("subcategories").doc(d.id), d);
for (const d of slotDocs) batch.set(fs.collection("slots").doc(d.id), d);
for (const d of pkgDocs) batch.set(fs.collection("packages").doc(d.id), d);
for (const d of personaDocs) batch.set(fs.collection("personas").doc(d.id), d);
batch.set(fs.collection("siteSettings").doc(EID), siteSettings);
batch.set(fs.collection("taxonomy").doc(EID), taxonomy);
batch.set(fs.collection("quoteSettings").doc(EID), quoteSettings);
await batch.commit();

console.log("\n" + "=".repeat(60));
console.log(`✓ 완료. 공개 페이지: /${EID}  /${EID}/sponsorships  /${EID}/en`);
process.exit(0);
