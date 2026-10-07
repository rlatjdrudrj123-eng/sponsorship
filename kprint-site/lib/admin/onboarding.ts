"use client";

/**
 * 처음 쓰는 사람용 안내 — 화면 투어(말풍선) + 시작하기 체크리스트.
 *
 * - 투어 대상은 화면 요소의 data-tour="…" 속성으로 찾는다 (없으면 말풍선만 가운데).
 * - 진행 상황은 이 브라우저에 계정별로 저장 (다른 PC 에서는 처음부터).
 * - 접은 체크리스트는 자동으로 다시 펴지 않는다 (사용자가 고른 상태 유지).
 */
import { create } from "zustand";

export type TourStep = {
  /** data-tour 값. 없으면 화면 가운데 말풍선 */
  target?: string;
  title: string;
  body: string;
};

export type TourDef = { id: string; label: string; steps: TourStep[] };

export const MAIN_TOUR: TourDef = {
  id: "main",
  label: "처음 화면 투어",
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
      body: "문의를 스폰서로 전환하고 구좌 확보·견적서까지 이어서 처리합니다.",
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
      target: "nav-site",
      title: "사이트 설정",
      body: "공개 사이트의 행사 정보·추가 혜택 등을 고칩니다. 메인 페이지 디자인·견적서 설정은 바로 아래 메뉴입니다.",
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
      title: "도움말",
      body: "이 투어 다시 보기, 지금 화면 둘러보기, 사용 안내가 여기 있습니다.",
    },
    {
      target: "checklist",
      title: "시작하기",
      body: "아래 항목을 직접 해 보면 하나씩 체크됩니다. [바로 가기]를 누르면 해당 화면으로 안내합니다.",
    },
  ],
};

/** 화면별 둘러보기 — 경로가 맞을 때 도움말 메뉴에 나온다 */
export const PAGE_TOURS: Array<{ match: (path: string) => boolean; tour: TourDef }> = [
  {
    match: (p) => /^\/admin\/inquiries\/[^/]+$/.test(p),
    tour: {
      id: "inquiry-detail",
      label: "문의 상세 둘러보기",
      steps: [
        {
          target: "inq-status",
          title: "상태 바꾸기",
          body: "연락을 시작하면 '진행 중', 마무리되면 '종료'로 바꿔 두세요. 사이드바 숫자는 '신규'만 셉니다.",
        },
        {
          target: "inq-convert",
          title: "스폰서로 전환",
          body: "계약이 진행되면 누르세요. 회사·담당자·담은 품목이 채워진 스폰서 등록 화면이 열립니다.",
        },
        {
          target: "inq-quote",
          title: "견적서 추출",
          body: "담은 품목으로 견적서를 만듭니다. 사무국 정보·문구는 견적서 설정 화면 값이 들어갑니다.",
        },
        {
          target: "doc-history",
          title: "변경 이력",
          body: "이 문의를 누가 언제 바꿨는지 볼 수 있습니다.",
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
        {
          target: "sponsor-totals",
          title: "합계",
          body: "상태별 협상 금액 합계입니다(VAT 별도 공급가). 진행 안 함·협찬은 합계에서 빠집니다.",
        },
        {
          target: "sponsor-new",
          title: "새 스폰서",
          body: "직접 등록할 때 씁니다. 문의에서 온 건은 문의 상세의 [스폰서로 전환]이 편합니다.",
        },
        {
          target: "sponsor-export",
          title: "엑셀 다운로드",
          body: "지금 보이는 목록을 엑셀로 받습니다. 보고용으로 쓰세요.",
        },
      ],
    },
  },
  {
    match: (p) => p === "/admin/import",
    tour: {
      id: "import",
      label: "엑셀 일괄 등록 둘러보기",
      steps: [
        {
          target: "import-template",
          title: "1. 양식 받기",
          body: "처음이면 양식을 받아 작성하세요. 이미 있는 매체는 '엑셀 내보내기'로 받은 파일을 고쳐 올려도 됩니다.",
        },
        {
          target: "import-drop",
          title: "2. 파일 올리기",
          body: "파일을 끌어다 놓으면 먼저 미리보기·오류를 보여 주고, 확인 후 반영합니다.",
        },
        {
          title: "다시 올려도 안전합니다",
          body: "같은 코드의 매체·구좌는 그대로 이어지고, 스폰서가 확보한 구좌·매진 표시·도면 핀은 지켜집니다.",
        },
      ],
    },
  },
  {
    match: (p) => p === "/admin/events",
    tour: {
      id: "events",
      label: "행사 관리 둘러보기",
      steps: [
        {
          target: "events-add",
          title: "새 전시회 만들기",
          body: "빈 행사로 시작하거나 기존 전시회를 복사해서 시작합니다. 만든 사람은 자동으로 담당자가 됩니다.",
        },
        {
          target: "events-assign",
          title: "담당자 지정",
          body: "내가 만든 전시회 줄의 [담당자]에서 함께 일할 사람을 체크합니다.",
        },
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
  /** 바로 가기 경로 (없으면 투어 시작) */
  href?: string;
  /** 이 경로를 열면 완료 */
  match?: (path: string) => boolean;
  /** 바로 가기 후 이어서 시작할 화면 둘러보기 */
  tourId?: string;
};

export const TASKS: ChecklistTask[] = [
  { id: "tour", label: "화면 둘러보기" },
  {
    id: "inquiries",
    label: "문의 목록 보기",
    href: "/admin/inquiries",
    match: (p) => p.startsWith("/admin/inquiries"),
  },
  {
    id: "category",
    label: "매체 하나 열어 보기",
    href: "/admin/categories",
    match: (p) => /^\/admin\/categories\/[^/]+$/.test(p),
  },
  { id: "slots", label: "판매 현황 보기", href: "/admin/slots", match: (p) => p === "/admin/slots" },
  {
    id: "sponsors",
    label: "스폰서 관리 둘러보기",
    href: "/admin/sponsors",
    match: (p) => p === "/admin/sponsors",
    tourId: "sponsors",
  },
  { id: "history", label: "변경 이력 보기", href: "/admin/history", match: (p) => p === "/admin/history" },
];

type Saved = {
  seenMain: boolean;
  done: string[];
  /** 체크리스트를 접었는지 — 사용자가 접으면 자동으로 다시 펴지 않음 */
  collapsed: boolean;
  /** 체크리스트를 닫았는지 (도움말에서 다시 열기) */
  hidden: boolean;
};

const EMPTY: Saved = { seenMain: false, done: [], collapsed: false, hidden: false };
const keyOf = (uid: string) => `sponsorship:onboarding:v1:${uid}`;

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
  load: (uid: string) => void;
  markDone: (taskId: string) => void;
  setCollapsed: (v: boolean) => void;
  setHidden: (v: boolean) => void;
  startTour: (t: TourDef) => void;
  next: () => void;
  prev: () => void;
  endTour: (completed: boolean) => void;
  setPendingTour: (id: string | null) => void;
};

export const useOnboarding = create<OnboardingState>((set, get) => {
  const update = (patch: Partial<Saved>) => {
    const { uid, saved } = get();
    const nextSaved = { ...saved, ...patch };
    set({ saved: nextSaved });
    if (uid) writeSaved(uid, nextSaved);
  };
  return {
    uid: null,
    saved: { ...EMPTY },
    loaded: false,
    activeTour: null,
    step: 0,
    pendingTourId: null,
    load: (uid) => {
      if (get().uid === uid && get().loaded) return;
      set({ uid, saved: readSaved(uid), loaded: true });
    },
    markDone: (taskId) => {
      const { saved } = get();
      if (saved.done.includes(taskId)) return;
      update({ done: [...saved.done, taskId] });
    },
    setCollapsed: (v) => update({ collapsed: v }),
    setHidden: (v) => update({ hidden: v }),
    startTour: (t) => set({ activeTour: t, step: 0 }),
    next: () => {
      const { activeTour, step } = get();
      if (!activeTour) return;
      if (step >= activeTour.steps.length - 1) get().endTour(true);
      else set({ step: step + 1 });
    },
    prev: () => set({ step: Math.max(0, get().step - 1) }),
    endTour: (completed) => {
      const { activeTour, saved } = get();
      set({ activeTour: null, step: 0 });
      if (activeTour?.id === "main") {
        const done = completed && !saved.done.includes("tour") ? [...saved.done, "tour"] : saved.done;
        update({ seenMain: true, done });
      }
    },
    setPendingTour: (id) => set({ pendingTourId: id }),
  };
});

export function tourById(id: string): TourDef | null {
  if (id === MAIN_TOUR.id) return MAIN_TOUR;
  return PAGE_TOURS.find((t) => t.tour.id === id)?.tour ?? null;
}
