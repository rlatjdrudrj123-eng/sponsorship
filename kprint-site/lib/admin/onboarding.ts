"use client";

/**
 * 처음 쓰는 사람용 안내 — 화면 투어(말풍선) · 업무 따라하기 · 시작하기 체크리스트.
 *
 * - 대상은 화면 요소의 data-tour="…" 속성으로 찾는다 (없으면 말풍선만 가운데).
 * - 따라하기 단계는 실제 화면에서 진행된다: 강조된 곳을 직접 누르거나 입력하고,
 *   클릭·화면 이동·새 요소 등장(advance)으로 다음 단계로 넘어간다.
 * - 진행 상황은 이 브라우저에 계정별로 저장 (다른 PC 에서는 처음부터).
 *   진행 중인 따라하기는 이 탭에 기록 — 새로고침·전체 페이지 이동 뒤에도 이어서.
 * - 접은 체크리스트는 자동으로 다시 펴지 않는다 (사용자가 고른 상태 유지).
 */
import { create } from "zustand";

export type TourAdvance =
  /** 강조된 요소를 누르면 */
  | { on: "click" }
  /** 이 주소로 이동하면 */
  | { on: "route"; path: RegExp }
  /** 이 data-tour 요소가 화면에 나타나면 (창이 열리는 등) */
  | { on: "appear"; target: string };

export type TourStep = {
  /** data-tour 값. 없으면 화면 가운데 말풍선 */
  target?: string;
  title: string;
  body: string;
  /** 이 단계를 하는 화면 — 다른 화면이면 [이 화면으로 이동] 안내 */
  path?: RegExp;
  /** path 가 아닐 때 이동할 주소 */
  goto?: string;
  /** 다음 단계로 넘어가는 조건. 없으면 [다음] 버튼 */
  advance?: TourAdvance;
  /** 강조된 곳을 직접 누르고 입력할 수 있게 (따라하기) */
  interactive?: boolean;
};

export type TourDef = {
  id: string;
  label: string;
  kind?: "tour" | "guide";
  /** 따라하기 목록에 보이는 한 줄 설명 */
  summary?: string;
  steps: TourStep[];
};

const CAT_DETAIL = /^\/admin\/categories\/(?!new$)[^/]+$/;
const PKG_DETAIL = /^\/admin\/packages\/(?!new$)[^/]+$/;
const SPONSOR_DETAIL = /^\/admin\/sponsors\/(?!new$)[^/]+$/;
const INQ_DETAIL = /^\/admin\/inquiries\/[^/]+$/;
const CLASSIFICATION = /^\/admin\/classification$/;

// 연습이면 실제 전시회 대신 '연습용 전시회'에서 — 따라하기 첫 단계 공통 안내
const PRACTICE_NOTE =
  "실제 데이터로 저장됩니다. 연습이라면 행사 관리에서 '연습용 전시회'를 하나 만들어 상단에서 고른 뒤 따라 하세요.";

export const MAIN_TOUR: TourDef = {
  id: "main",
  label: "처음 화면 투어",
  kind: "tour",
  steps: [
    {
      title: "스폰서십 관리에 오신 걸 환영합니다",
      body: "주요 메뉴를 1분 안에 짚어 드립니다. 언제든 [건너뛰기] 할 수 있고, 상단 도움말(?)에서 다시 볼 수 있습니다.",
    },
    {
      target: "event-selector",
      title: "작업할 전시회",
      body: "여기서 고른 전시회 기준으로 모든 화면이 바뀝니다. 배정된 전시회만 보입니다.",
    },
    {
      target: "nav-inquiries",
      title: "문의",
      body: "공개 사이트에서 문의가 오면 숫자가 뜨고 메일로도 알려 줍니다.",
    },
    {
      target: "nav-sponsors",
      title: "스폰서 관리",
      body: "문의를 스폰서로 전환하고 구좌를 확보합니다. 진행 상태·디자인물 수령도 여기서 관리합니다.",
    },
    {
      target: "nav-slots",
      title: "판매 현황",
      body: "매체별로 팔린 구좌·예약·남은 구좌를 한눈에 봅니다.",
    },
    {
      target: "nav-categories",
      title: "스폰서십 매체",
      body: "판매할 매체와 구좌를 등록합니다. 엑셀로 한 번에 올릴 수도 있습니다.",
    },
    {
      target: "nav-classification",
      title: "매체 분류",
      body: "매체를 참가 상황(추천 코스)·매체 유형·위치별로 묶습니다. 공개 사이트 '스폰서십 한눈에 보기'·전체 PDF·필터가 이대로 나뉩니다.",
    },
    {
      target: "nav-site",
      title: "사이트 설정",
      body: "공개 사이트의 행사 정보·추가 혜택 등을 고칩니다. 메인 페이지 디자인은 바로 아래 메뉴입니다.",
    },
    {
      target: "nav-events",
      title: "행사 관리",
      body: "새 전시회를 만들고(기존 전시회 복사 가능) 함께 일할 담당자를 지정합니다.",
    },
    {
      target: "nav-history",
      title: "변경 이력",
      body: "누가 언제 무엇을 바꿨는지 자동으로 남습니다. 실수로 바꾼 값도 여기서 확인합니다.",
    },
    {
      target: "help",
      title: "도움말 — 업무 따라하기",
      body: "매체·패키지 만들기, 스폰서 등록 같은 업무를 실제 화면에서 한 단계씩 따라 할 수 있습니다. 이 투어 다시 보기도 여기 있습니다.",
    },
    {
      target: "checklist",
      title: "시작하기",
      body: "아래 항목을 직접 해 보면 하나씩 체크됩니다. [바로 가기]·[따라하기]를 누르면 해당 화면으로 안내합니다.",
    },
  ],
};

/** 업무 따라하기 — 실제 화면에서 한 단계씩 */
export const GUIDES: TourDef[] = [
  {
    id: "guide-category",
    label: "매체(상품) 만들기",
    kind: "guide",
    summary: "새 매체 등록 → 가격·구좌 → 이미지 → 공개",
    steps: [
      { title: "매체 만들기를 시작합니다", body: `판매할 매체(예: 등록대 배너)를 하나 만들어 공개까지 해 봅니다. ${PRACTICE_NOTE}` },
      {
        target: "cat-new",
        path: /^\/admin\/categories$/,
        goto: "/admin/categories",
        title: "[새 매체] 누르기",
        body: "스폰서십 매체 목록 오른쪽 위의 [새 매체]를 누르세요.",
        interactive: true,
        advance: { on: "appear", target: "cat-new-form" },
      },
      {
        target: "cat-new-form",
        title: "기본 정보 채우기",
        body: "코드(영문 대문자 2~12자, 예: RGA)·채널·한글/영문 이름·유형을 채우세요. 유형은 공개 화면 모양을 정합니다(예: '전시장 내부 설치'는 도면에서 위치 선택, '참관객 배포물'은 수량 선택). 비슷한 기존 매체와 같은 유형을 고르면 됩니다. 다 채웠으면 [다음].",
        interactive: true,
      },
      {
        target: "cat-new-save",
        title: "[생성 후 상세 편집]으로 저장",
        body: "[생성 후 상세 편집]을 누르면 저장되고 상세 화면으로 넘어갑니다. 새 매체는 비공개로 시작합니다.",
        interactive: true,
        advance: { on: "route", path: CAT_DETAIL },
      },
      {
        target: "cat-basic",
        path: CAT_DETAIL,
        title: "기본 정보 다듬기",
        body: "이름·설명·마감일 등을 고칩니다. 고치면 자동 저장됩니다(오른쪽 위 '저장됨' 표시). 엑셀로 관리하는 칸은 자물쇠로 잠글 수 있습니다.",
        interactive: true,
      },
      {
        target: "cat-subs",
        path: CAT_DETAIL,
        title: "가격과 구좌 만들기",
        body: "가격은 '소분류'에 넣습니다. [소분류 추가] → 이름(예: A홀)·가격·구좌 수를 넣고 [추가]하면 구좌가 함께 만들어집니다. 가격이 다른 종류가 있으면 소분류를 더 만드세요.",
        interactive: true,
      },
      {
        target: "cat-images",
        path: CAT_DETAIL,
        title: "대표 이미지 올리기",
        body: "히어로 이미지를 올리세요. 공개 사이트의 카드·슬라이드·PDF에 쓰입니다. '전시장 내부 설치'·'LED 영상 광고'는 아래에 소분류별 도면 이미지를 올린 뒤 구좌 위치(핀)를 찍습니다.",
        interactive: true,
      },
      {
        target: "cat-publish",
        path: CAT_DETAIL,
        title: "공개하기",
        body: "다 채웠으면 오른쪽 위 [공개하기]를 누르세요. 그때부터 공개 사이트에 보입니다. 다시 누르면 비공개로 돌아갑니다.",
        interactive: true,
        advance: { on: "click" },
      },
      {
        title: "매체 만들기 끝",
        body: "스폰서가 이 매체를 사면, 스폰서 등록 때 고른 구좌가 자동으로 '판매'로 바뀌고 공개 사이트에 매진이 표시됩니다.",
      },
    ],
  },
  {
    id: "guide-package",
    label: "패키지 만들기",
    kind: "guide",
    summary: "새 패키지 → 포함 매체 고르기 → 가격 → 공개",
    steps: [
      { title: "패키지 만들기를 시작합니다", body: `여러 매체를 묶은 패키지를 만들어 봅니다. 포함할 매체가 먼저 등록돼 있어야 합니다. ${PRACTICE_NOTE}` },
      {
        target: "pkg-new",
        // [신규 패키지] → /new 에서 빈 패키지를 만든 뒤 상세로 넘어간다
        path: /^\/admin\/packages(\/new)?$/,
        goto: "/admin/packages",
        title: "[신규 패키지] 누르기",
        body: "패키지 목록 오른쪽 위의 [신규 패키지]를 누르세요. 바로 빈 패키지가 만들어지고 편집 화면이 열립니다.",
        interactive: true,
        advance: { on: "route", path: PKG_DETAIL },
      },
      {
        target: "pkg-basic",
        path: PKG_DETAIL,
        title: "이름과 소개",
        body: "이름(한글·영문), 티어(시그니처/스탠다드), 태그라인(한 줄 소개)을 넣으세요. 코드는 자동으로 붙습니다. 고치면 자동 저장됩니다(오른쪽 위 표시).",
        interactive: true,
      },
      {
        target: "pkg-items",
        path: PKG_DETAIL,
        title: "포함 매체 고르기",
        body: "[단품 추가] → 카테고리(매체)·소분류·수량을 고르세요. 포함 품목 문구와 원가(단품 합계)가 자동으로 계산됩니다.",
        interactive: true,
      },
      {
        target: "pkg-price",
        path: PKG_DETAIL,
        title: "할인가 정하기",
        body: "원가는 포함 항목 합계로 자동 계산되고, 실제 판매가인 할인가는 직접 넣습니다. 영문 사이트용 달러 가격은 '해외 원가·할인가'에 따로 넣습니다.",
        interactive: true,
      },
      {
        target: "pkg-image",
        path: PKG_DETAIL,
        title: "대표 이미지",
        body: "패키지 카드에 보일 이미지를 올리세요.",
        interactive: true,
      },
      {
        target: "pkg-publish",
        path: PKG_DETAIL,
        title: "공개·매진",
        body: "'공개 사이트에 게시'를 체크하면 공개 사이트에 보입니다. '매진 처리'는 노출은 두고 카트 담기만 막습니다. 한 업체만 살 수 있는 단독 패키지는 스폰서 저장 때 매진할지 자동으로 물어봅니다.",
        interactive: true,
      },
      { title: "패키지 만들기 끝", body: "모든 내용은 자동 저장됐습니다. 공개 사이트의 패키지 목록에서 확인해 보세요." },
    ],
  },
  {
    id: "guide-classification",
    label: "매체 분류하기",
    kind: "guide",
    summary: "참가 상황(추천 코스)·매체 유형·위치별로 매체 묶기",
    steps: [
      {
        title: "매체 분류를 시작합니다",
        body: "등록한 매체를 참가 상황(추천 코스)·매체 유형·위치별로 묶습니다. 공개 사이트 '스폰서십 한눈에 보기'·전체 PDF·스폰서십 리스트 필터가 이대로 나뉩니다. 매체를 먼저 등록해 두세요.",
      },
      {
        target: "cls-tabs",
        path: CLASSIFICATION,
        goto: "/admin/classification",
        title: "무엇으로 묶을지",
        body: "참가 상황 = 공개 사이트 '추천 코스'(예: 처음 참가하는 회사), 매체 유형·위치 = 스폰서십 리스트 필터입니다. 노출 시점은 지금 공개 필터에 없어 비워 둬도 됩니다. 먼저 '참가 상황' 탭에서 시작하세요.",
        interactive: true,
      },
      {
        target: "cls-groups",
        path: CLASSIFICATION,
        title: "추천 코스 만들기·고르기",
        body: "왼쪽이 그룹 목록입니다. 참가 상황 탭에서는 [새 페르소나]로 추천 코스를 만들고(제목·이모지·한 줄 설명·예산 안내), 연필 버튼으로 고칩니다. 작업할 그룹을 하나 누르세요.",
        interactive: true,
      },
      {
        target: "cls-board",
        path: CLASSIFICATION,
        title: "매체 끌어다 놓기",
        body: "오른쪽 '아직 이 그룹에 없는 카테고리'에서 매체를 가운데로 끌어다 놓으면 바로 저장됩니다. 빼려면 가운데 매체의 X. 한 매체를 여러 그룹에 넣어도 됩니다.",
        interactive: true,
      },
      {
        target: "cls-tabs",
        path: CLASSIFICATION,
        title: "위치·매체 유형",
        body: "위치 탭도 같은 방법으로 Hall·옥외·온라인에 넣습니다(지정 안 하면 매체 이름·코드로 자동 추정). 홀 이름이 다르면 [위치 항목 편집]에서 바꿉니다. 매체 유형 탭에서 옮기면 그 매체의 유형 자체가 바뀌어 공개 상세 화면 모양이 달라지니 주의하세요.",
        interactive: true,
      },
      {
        target: "cls-copy",
        path: CLASSIFICATION,
        title: "다른 전시회 분류 가져오기",
        body: "다른 전시회에서 쓰던 추천 코스 연결·1분 진단 점수·함께 보면 좋은 연결을 매체 코드 기준으로 한 번에 가져옵니다. 기존 전시회를 복사해 만든 행사라면 이미 들어 있습니다.",
      },
      {
        title: "매체 분류 끝",
        body: "공개 사이트에 바로 반영됩니다. 어느 참가 상황에도 넣지 않은 매체는 전체 PDF '한눈에 보기'에서 '기타'로 묶입니다.",
      },
    ],
  },
  {
    id: "guide-inquiry",
    label: "문의 → 스폰서 전환",
    kind: "guide",
    summary: "문의 열기 → 상태 → 스폰서로 전환 → 구좌 확보 → 저장",
    steps: [
      { title: "문의 처리를 시작합니다", body: "공개 사이트에서 들어온 문의를 스폰서로 전환하고 구좌를 확보합니다. 처리할 문의가 하나 있어야 합니다." },
      {
        target: "inq-list",
        path: /^\/admin\/inquiries$/,
        goto: "/admin/inquiries",
        title: "문의 열기",
        body: "처리할 문의를 하나 누르세요. 접수번호로 검색할 수도 있습니다.",
        interactive: true,
        advance: { on: "route", path: INQ_DETAIL },
      },
      {
        target: "inq-status",
        path: INQ_DETAIL,
        title: "상태 바꾸기",
        body: "연락을 시작했으면 '진행 중'으로 바꾸세요. 사이드바 숫자는 '신규'만 셉니다.",
        interactive: true,
      },
      {
        target: "inq-convert",
        path: INQ_DETAIL,
        title: "[스폰서로 전환]",
        body: "계약이 진행되면 누르세요. 회사·담당자·담은 품목이 채워진 스폰서 등록 화면이 열립니다.",
        interactive: true,
        advance: { on: "route", path: /^\/admin\/sponsors\/new$/ },
      },
      {
        target: "sponsor-basic",
        path: /^\/admin\/sponsors\/new$/,
        title: "기업명·비용",
        body: "기업명을 확인하고 '비용'에 협상한 금액(VAT 별도 공급가)을 넣으세요.",
        interactive: true,
      },
      {
        target: "sponsor-items",
        path: /^\/admin\/sponsors\/new$/,
        title: "품목과 구좌 확보",
        body: "품목 칸을 누르면 등록된 매체·패키지·구좌에서 고를 수 있습니다. 패키지는 아래에 포함 매체별로 구좌를 직접 골라 '확보'하세요. 확보한 구좌는 저장할 때 판매로 바뀝니다.",
        interactive: true,
      },
      {
        target: "sponsor-status",
        path: /^\/admin\/sponsors\/new$/,
        title: "상태·행사",
        body: "진행 상태(진행중·검토중·진행X·협찬)와 행사를 확인하세요. '진행X'·'협찬'은 합계에서 빠집니다.",
        interactive: true,
      },
      {
        target: "sponsor-save",
        path: /^\/admin\/sponsors\/new$/,
        title: "저장",
        body: "저장을 누르세요. 단독 패키지가 들어 있으면 매진 처리할지 물어봅니다.",
        interactive: true,
        advance: { on: "route", path: SPONSOR_DETAIL },
      },
      {
        title: "문의 처리 끝",
        body: "상세 화면에서 담당자·디자인물 수령 체크리스트를 이어서 채웁니다. 판매 현황에서 구좌가 판매로 바뀐 것을 확인할 수 있고, 문의 상태도 '진행 중'·'종료'로 정리해 두세요.",
      },
    ],
  },
  {
    id: "guide-sponsor",
    label: "스폰서 직접 등록하기",
    kind: "guide",
    summary: "새 스폰서 → 기업명·비용 → 품목·구좌 확보 → 저장",
    steps: [
      { title: "스폰서 등록을 시작합니다", body: `문의 없이 들어온 계약을 직접 등록합니다. ${PRACTICE_NOTE}` },
      {
        target: "sponsor-new",
        path: /^\/admin\/sponsors$/,
        goto: "/admin/sponsors",
        title: "[새 스폰서] 누르기",
        body: "스폰서 관리 오른쪽 위의 [새 스폰서]를 누르세요.",
        interactive: true,
        advance: { on: "route", path: /^\/admin\/sponsors\/new$/ },
      },
      {
        target: "sponsor-basic",
        path: /^\/admin\/sponsors\/new$/,
        title: "기업명·비용",
        body: "기업명과 협상한 비용(VAT 별도 공급가)을 넣으세요. 품목 단가를 넣은 뒤 [합계를 비용에 적용]으로 채워도 됩니다.",
        interactive: true,
      },
      {
        target: "sponsor-items",
        path: /^\/admin\/sponsors\/new$/,
        title: "품목과 구좌 확보",
        body: "오른쪽 위 [+ 추가]로 줄을 만들고, 품목 칸을 눌러 목록에서 매체·패키지·구좌를 고르세요(단가가 자동으로 채워짐). 패키지는 아래 '구좌 확보'에서 포함 매체별 구좌를 골라 확보합니다.",
        interactive: true,
      },
      {
        target: "sponsor-status",
        path: /^\/admin\/sponsors\/new$/,
        title: "상태·행사",
        body: "진행 상태(진행중·검토중·진행X·협찬)와 행사를 확인하세요. '진행X'·'협찬'은 합계에서 빠집니다.",
        interactive: true,
      },
      {
        target: "sponsor-save",
        path: /^\/admin\/sponsors\/new$/,
        title: "저장",
        body: "저장을 누르세요. 확보한 구좌는 판매로 바뀌고, 단독 패키지면 매진 여부를 물어봅니다.",
        interactive: true,
        advance: { on: "route", path: SPONSOR_DETAIL },
      },
      {
        title: "스폰서 등록 끝",
        body: "상세 화면에서 담당자·디자인물 수령 체크리스트를 이어서 채웁니다. 판매 현황에서 구좌가 판매로 바뀐 것을 확인할 수 있습니다.",
      },
    ],
  },
  {
    id: "guide-import",
    label: "엑셀로 매체 한꺼번에 등록",
    kind: "guide",
    summary: "양식 받기 → 파일 올리기 → 미리보기 확인 → 업로드",
    steps: [
      {
        target: "import-template",
        path: /^\/admin\/import$/,
        goto: "/admin/import",
        title: "양식 받기",
        body: "처음이면 [엑셀 양식 다운로드]로 양식을 받아 작성하세요. 이미 있는 매체를 고칠 땐 기존 내용을 내려받은 파일을 고쳐 올려도 됩니다.",
        interactive: true,
      },
      {
        target: "import-drop",
        path: /^\/admin\/import$/,
        title: "파일 올리기",
        body: "작성한 엑셀 파일을 여기에 끌어다 놓거나 눌러서 고르세요. 바로 저장되지 않고 미리보기부터 보여 줍니다.",
        interactive: true,
        advance: { on: "appear", target: "import-run" },
      },
      {
        target: "import-summary",
        path: /^\/admin\/import$/,
        title: "미리보기·동기화 모드 확인",
        body: "인식된 대분류·소분류·구좌 수와 오류·경고를 확인하세요. 오류가 있으면 엑셀을 고쳐 다시 올립니다. 동기화 모드 — 가격·마감만 고칠 땐 '병합', 새 매체만 더할 땐 '신규만 추가'(가장 안전), 전체를 바꿀 땐 '덮어쓰기'(이미지·도면은 보존).",
        interactive: true,
      },
      {
        target: "import-run",
        path: /^\/admin\/import$/,
        title: "업로드",
        body: "버튼을 누르면 저장됩니다. 다시 올려도 스폰서가 확보한 구좌·매진·도면 핀·추천 연결은 그대로 지켜집니다.",
        interactive: true,
        advance: { on: "click" },
      },
      { title: "업로드 끝", body: "확인할 사항이 있으면 화면에 목록으로 보여 주고, 없으면 매체 목록으로 넘어갑니다." },
    ],
  },
  {
    id: "guide-event",
    label: "새 전시회 만들고 담당자 지정",
    kind: "guide",
    summary: "새 행사 → 복사해서 시작 → 담당자 지정",
    steps: [
      {
        target: "events-add",
        path: /^\/admin\/events$/,
        goto: "/admin/events",
        title: "[새 행사] 누르기",
        body: "행사 관리 오른쪽 위의 [새 행사]를 누르세요. 만든 사람은 그 전시회 담당자로 자동 배정됩니다.",
        interactive: true,
        advance: { on: "appear", target: "event-form" },
      },
      {
        target: "event-form",
        title: "이름·주소·시작 방법",
        body: "행사명·단축명·연도를 넣으면 주소가 자동으로 채워집니다. '시작 방법'에서 기존 전시회를 고르면 매체·패키지·설정을 복사합니다(구좌는 모두 판매 중으로, 스폰서·문의는 제외).",
        interactive: true,
      },
      {
        target: "event-submit",
        title: "추가",
        body: "[추가](또는 [복사해서 추가])를 누르세요. 복사했다면 '공개 전에 확인할 것' 목록이 나옵니다.",
        interactive: true,
        advance: { on: "click" },
      },
      {
        target: "events-assign",
        path: /^\/admin\/events$/,
        title: "담당자 지정",
        body: "내가 만든 전시회 줄의 [담당자]를 눌러 함께 일할 사람을 체크하세요. 목록에 없는 사람은 먼저 사용 신청·승인이 필요합니다.",
        interactive: true,
      },
      { title: "전시회 준비 끝", body: "상단에서 새 전시회를 고르면 그 전시회 기준으로 매체·사이트 설정을 이어서 작업할 수 있습니다." },
    ],
  },
  {
    id: "guide-site",
    label: "공개 사이트 정보 고치기",
    kind: "guide",
    summary: "행사 일정·장소·연락처 → 저장 → 메인 페이지 디자인",
    steps: [
      {
        target: "settings-event",
        path: /^\/admin\/settings$/,
        goto: "/admin/settings",
        title: "행사 정보",
        body: "행사명·일정·장소를 고치세요. 공개 사이트 첫 화면과 PDF에 쓰입니다.",
        interactive: true,
      },
      {
        target: "settings-closing",
        path: /^\/admin\/settings$/,
        title: "신청 바로가기·마지막 문구",
        body: "공개 사이트 마지막 화면의 '온라인 신청' 주소와 문구입니다. 다른 전시회 주소가 남아 있지 않은지 꼭 확인하세요.",
        interactive: true,
      },
      {
        target: "settings-save",
        path: /^\/admin\/settings$/,
        title: "저장",
        body: "[저장]을 눌러야 공개 사이트에 반영됩니다.",
        interactive: true,
        advance: { on: "click" },
      },
      {
        target: "nav-landing",
        title: "메인 페이지 디자인",
        body: "첫 화면 디자인은 이 메뉴에서 합니다. 다른 전시회 메인을 복사한 뒤 문구·이미지만 바꾸면 빠릅니다.",
      },
    ],
  },
];

/** 화면별 둘러보기 — 경로가 맞을 때 도움말 메뉴에 나온다 */
export const PAGE_TOURS: Array<{ match: (path: string) => boolean; tour: TourDef }> = [
  {
    match: (p) => INQ_DETAIL.test(p),
    tour: {
      id: "inquiry-detail",
      label: "문의 상세 둘러보기",
      steps: [
        { target: "inq-status", title: "상태 바꾸기", body: "연락을 시작하면 '진행 중', 마무리되면 '종료'로 바꿔 두세요. 사이드바 숫자는 '신규'만 셉니다." },
        { target: "inq-convert", title: "스폰서로 전환", body: "계약이 진행되면 누르세요. 회사·담당자·담은 품목이 채워진 스폰서 등록 화면이 열립니다." },
        { target: "doc-history", title: "변경 이력", body: "이 문의를 누가 언제 바꿨는지 볼 수 있습니다." },
      ],
    },
  },
  {
    match: (p) => CLASSIFICATION.test(p),
    tour: {
      id: "classification",
      label: "매체 분류 둘러보기",
      steps: [
        {
          target: "cls-tabs",
          title: "분류 기준",
          body: "참가 상황 = 공개 사이트 '추천 코스'·'한눈에 보기', 매체 유형·위치 = 스폰서십 리스트 필터입니다. 노출 시점은 지금 공개 필터에 없습니다.",
        },
        {
          target: "cls-board",
          title: "끌어다 놓기",
          body: "왼쪽에서 그룹을 고르고, 오른쪽 매체를 가운데로 끌어다 놓으면 바로 저장됩니다. 빼려면 가운데 매체의 X.",
        },
        {
          target: "cls-copy",
          title: "다른 전시회에서 가져오기",
          body: "다른 전시회의 추천 코스 연결·1분 진단 점수·함께 보면 좋은 연결을 매체 코드 기준으로 복사합니다.",
        },
      ],
    },
  },
  {
    match: (p) => p === "/admin/sponsors",
    tour: {
      id: "sponsors",
      label: "스폰서 관리 둘러보기",
      steps: [
        { target: "sponsor-totals", title: "합계", body: "상태별 협상 금액 합계입니다(VAT 별도 공급가). 진행X·협찬은 합계에서 빠집니다." },
        { target: "sponsor-new", title: "새 스폰서", body: "직접 등록할 때 씁니다. 문의에서 온 건은 문의 상세의 [스폰서로 전환]이 편합니다." },
        { target: "sponsor-export", title: "엑셀 다운로드", body: "지금 보이는 목록을 엑셀로 받습니다. 보고용으로 쓰세요." },
      ],
    },
  },
  {
    match: (p) => p === "/admin/import",
    tour: {
      id: "import",
      label: "엑셀 일괄 등록 둘러보기",
      steps: [
        { target: "import-template", title: "1. 양식 받기", body: "처음이면 양식을 받아 작성하세요. 이미 있는 매체는 내려받은 파일을 고쳐 올려도 됩니다." },
        { target: "import-drop", title: "2. 파일 올리기", body: "파일을 끌어다 놓으면 먼저 미리보기·오류를 보여 주고, 확인 후 반영합니다." },
        { title: "다시 올려도 안전합니다", body: "같은 코드의 매체·구좌는 그대로 이어지고, 스폰서가 확보한 구좌·매진 표시·도면 핀은 지켜집니다." },
      ],
    },
  },
  {
    match: (p) => p === "/admin/events",
    tour: {
      id: "events",
      label: "행사 관리 둘러보기",
      steps: [
        { target: "events-add", title: "새 전시회 만들기", body: "빈 행사로 시작하거나 기존 전시회를 복사해서 시작합니다. 만든 사람은 자동으로 담당자가 됩니다." },
        { target: "events-assign", title: "담당자 지정", body: "내가 만든 전시회 줄의 [담당자]에서 함께 일할 사람을 체크합니다." },
      ],
    },
  },
];

export function pageTourFor(path: string): TourDef | null {
  return PAGE_TOURS.find((t) => t.match(path))?.tour ?? null;
}

export type ChecklistTask = {
  id: string;
  label: string;
  /** 바로 가기 경로 */
  href?: string;
  /** 이 경로를 열면 완료 */
  match?: (path: string) => boolean;
  /** 바로 가기 후 이어서 시작할 화면 둘러보기 */
  tourId?: string;
  /** 이 따라하기를 끝까지 하면 완료 (버튼 = 따라하기 시작) */
  guideId?: string;
  /** 이 따라하기들로 끝내도 완료 (예: 문의→스폰서 전환으로 스폰서 등록) */
  alsoDoneBy?: string[];
};

export const TASKS: ChecklistTask[] = [
  { id: "tour", label: "화면 둘러보기" },
  {
    id: "inquiries",
    label: "문의 목록 보기",
    href: "/admin/inquiries",
    match: (p) => p.startsWith("/admin/inquiries"),
  },
  { id: "slots", label: "판매 현황 보기", href: "/admin/slots", match: (p) => p === "/admin/slots" },
  { id: "history", label: "변경 이력 보기", href: "/admin/history", match: (p) => p === "/admin/history" },
  { id: "g-category", label: "매체 만들어 보기", guideId: "guide-category" },
  { id: "g-package", label: "패키지 만들어 보기", guideId: "guide-package" },
  { id: "g-classification", label: "매체 분류해 보기", guideId: "guide-classification" },
  { id: "g-sponsor", label: "스폰서 등록해 보기", guideId: "guide-sponsor", alsoDoneBy: ["guide-inquiry"] },
];

type Saved = {
  seenMain: boolean;
  done: string[];
  /** 끝까지 마친 따라하기 */
  doneGuides: string[];
  /** 체크리스트를 접었는지 — 사용자가 접으면 자동으로 다시 펴지 않음 */
  collapsed: boolean;
  /** 체크리스트를 닫았는지 (도움말에서 다시 열기) */
  hidden: boolean;
  /** 따라하기 말풍선을 접었는지 — 접으면 다음 단계·다른 따라하기에서도 접힌 채로 */
  bubbleMini: boolean;
};

const EMPTY: Saved = {
  seenMain: false,
  done: [],
  doneGuides: [],
  collapsed: false,
  hidden: false,
  bubbleMini: false,
};
const keyOf = (uid: string) => `sponsorship:onboarding:v1:${uid}`;
// 진행 중인 안내 — 새로고침·전체 페이지 이동 뒤에도 이어서 (탭을 닫으면 끝)
const activeKeyOf = (uid: string) => `sponsorship:onboarding:active:v1:${uid}`;

function readActive(uid: string): { tour: TourDef; step: number } | null {
  try {
    const raw = sessionStorage.getItem(activeKeyOf(uid));
    if (!raw) return null;
    const { id, step } = JSON.parse(raw) as { id?: string; step?: number };
    const tour = id ? tourById(id) : null;
    if (!tour || typeof step !== "number") return null;
    return { tour, step: Math.min(Math.max(0, step), tour.steps.length - 1) };
  } catch {
    return null;
  }
}

function writeActive(uid: string, tour: TourDef | null, step: number) {
  try {
    if (tour) sessionStorage.setItem(activeKeyOf(uid), JSON.stringify({ id: tour.id, step }));
    else sessionStorage.removeItem(activeKeyOf(uid));
  } catch {
    // 저장 불가 — 새로고침하면 안내가 끝남
  }
}

/** step 부터 처음으로 '사용자 동작을 기다리는' 단계 — 사용자가 안내보다 먼저 해 버린 경우 따라잡기용 */
export function firstAdvanceFrom(tour: TourDef, step: number): number {
  for (let i = step; i < tour.steps.length; i++) if (tour.steps[i].advance) return i;
  return -1;
}

function readSaved(uid: string): Saved {
  try {
    const raw = localStorage.getItem(keyOf(uid));
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) };
  } catch {
    return { ...EMPTY };
  }
}

function writeSaved(uid: string, s: Saved) {
  try {
    localStorage.setItem(keyOf(uid), JSON.stringify(s));
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 이번 방문 동안만 유지
  }
}

type OnboardingState = {
  uid: string | null;
  saved: Saved;
  loaded: boolean;
  activeTour: TourDef | null;
  step: number;
  /** 바로 가기로 이동한 뒤 시작할 화면 둘러보기 */
  pendingTourId: string | null;
  /** 업무 따라하기 고르는 창 */
  pickerOpen: boolean;
  load: (uid: string) => void;
  markDone: (taskId: string) => void;
  setCollapsed: (v: boolean) => void;
  setHidden: (v: boolean) => void;
  startTour: (t: TourDef) => void;
  next: () => void;
  prev: () => void;
  /** 해당 단계로 이동 (마지막 다음이면 완료 처리) */
  goTo: (step: number) => void;
  endTour: (completed: boolean) => void;
  setPendingTour: (id: string | null) => void;
  setPickerOpen: (v: boolean) => void;
  setBubbleMini: (v: boolean) => void;
};

export const useOnboarding = create<OnboardingState>((set, get) => {
  const update = (patch: Partial<Saved>) => {
    const { uid, saved } = get();
    const nextSaved = { ...saved, ...patch };
    set({ saved: nextSaved });
    if (uid) writeSaved(uid, nextSaved);
  };
  // 진행 단계가 바뀔 때마다 이 탭에 기록 → 새로고침해도 이어서
  const setActive = (activeTour: TourDef | null, step: number) => {
    set({ activeTour, step });
    const { uid } = get();
    if (uid) writeActive(uid, activeTour, step);
  };
  return {
    uid: null,
    saved: { ...EMPTY },
    loaded: false,
    activeTour: null,
    step: 0,
    pendingTourId: null,
    pickerOpen: false,
    load: (uid) => {
      if (get().uid === uid && get().loaded) return;
      const resume = get().activeTour ? null : readActive(uid);
      set({
        uid,
        saved: readSaved(uid),
        loaded: true,
        ...(resume ? { activeTour: resume.tour, step: resume.step } : {}),
      });
    },
    markDone: (taskId) => {
      const { saved } = get();
      if (saved.done.includes(taskId)) return;
      update({ done: [...saved.done, taskId] });
    },
    setCollapsed: (v) => update({ collapsed: v }),
    setHidden: (v) => update({ hidden: v }),
    startTour: (t) => {
      set({ pickerOpen: false });
      setActive(t, 0);
    },
    next: () => get().goTo(get().step + 1),
    prev: () => {
      const { activeTour, step } = get();
      if (activeTour) setActive(activeTour, Math.max(0, step - 1));
    },
    goTo: (i) => {
      const { activeTour } = get();
      if (!activeTour) return;
      if (i >= activeTour.steps.length) get().endTour(true);
      else setActive(activeTour, Math.max(0, i));
    },
    endTour: (completed) => {
      const { activeTour, saved } = get();
      setActive(null, 0);
      if (!activeTour) return;
      if (activeTour.id === "main") {
        const done = completed && !saved.done.includes("tour") ? [...saved.done, "tour"] : saved.done;
        update({ seenMain: true, done });
        return;
      }
      if (activeTour.kind === "guide" && completed) {
        const doneGuides = saved.doneGuides.includes(activeTour.id)
          ? saved.doneGuides
          : [...saved.doneGuides, activeTour.id];
        // 이 따라하기에 걸린 체크리스트 항목도 완료
        const taskIds = TASKS.filter(
          (t) => t.guideId === activeTour.id || t.alsoDoneBy?.includes(activeTour.id)
        ).map((t) => t.id);
        const done = Array.from(new Set([...saved.done, ...taskIds]));
        update({ doneGuides, done });
      }
    },
    setPendingTour: (id) => set({ pendingTourId: id }),
    setPickerOpen: (v) => set({ pickerOpen: v }),
    setBubbleMini: (v) => update({ bubbleMini: v }),
  };
});

export function tourById(id: string): TourDef | null {
  if (id === MAIN_TOUR.id) return MAIN_TOUR;
  return (
    GUIDES.find((g) => g.id === id) ??
    PAGE_TOURS.find((t) => t.tour.id === id)?.tour ??
    null
  );
}
