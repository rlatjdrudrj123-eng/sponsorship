import type { LandingBlock, LandingBlockType, SiteSettings } from "@/lib/types";

/**
 * 행사 settings 기반으로 합리적인 기본 랜딩 블록 시퀀스를 만들어준다.
 *
 * - 어드민이 [랜딩 빌더]에서 직접 블록을 만들지 않은 경우 fallback 으로 사용
 * - "기본값 채우기" 버튼이 이 함수를 호출해 settings.landing 을 시드
 */
export function buildDefaultBlocks(settings: SiteSettings | null): LandingBlock[] {
  const eventName = settings?.event.nameKo || "Sponsorship";
  const dateRange = settings?.event.dateRange || "";
  const venue = settings?.event.venue || "";
  const subtitleParts = [dateRange, venue].filter(Boolean);

  // chartData가 있으면 stats3year 채움
  const years = (settings?.why?.chartData ?? [])
    .filter((c) => c.year && c.visitors)
    .slice(-3)
    .map((c) => ({
      year: c.year,
      visitors: c.visitors,
      overseas: c.exhibitors > 0 ? c.exhibitors : undefined,
    }));

  // applicationSteps가 있으면 그걸로, 없으면 KIMES 기본
  const steps =
    (settings?.applicationSteps ?? []).length > 0
      ? settings!.applicationSteps.map((s) => ({
          title: s.title,
          description: s.desc,
        }))
      : [
          {
            title: "신청 상담",
            description: "사무국 문의 후 관심 슬롯 확인",
          },
          { title: "견적서 발송", description: "체크리스트 신청 후 견적 수령" },
          { title: "입금", description: "마감일까지 전액 현금 완납" },
          { title: "관련 서류", description: "계산서 발행 (개막 1개월 전)" },
        ];

  const blocks: LandingBlock[] = [
    {
      id: id(),
      type: "cover",
      data: {
        eyebrow: "Sponsorship",
        title: eventName,
        subtitle: subtitleParts.join("   ·   "),
        bgImageUrl: settings?.kv?.desktopUrl,
      },
    },
  ];

  if (years.length > 0) {
    blocks.push({
      id: id(),
      type: "stats3year",
      data: {
        eyebrow: "scale",
        headline: settings?.why?.headline || "참관 규모",
        years,
        footnote:
          "전체 방문객의 70% 이상이 B2B 참관객. 의료/병원·제조/무역/유통·언론/기관까지 핵심 결정권자가 한자리에.",
      },
    });
  }

  blocks.push({
    id: id(),
    type: "textHero",
    data: {
      eyebrow: "exposure",
      lines: ["모든 동선 위에", "*당신의 브랜드를."],
      description:
        "주차장 → 로비 → 전시홀 → 세미나실. 4일간 모든 참관객이 거치는 동선 위에서 자연스럽게 인지됩니다.",
    },
  });

  blocks.push({
    id: id(),
    type: "adGoals4",
    data: {
      eyebrow: "ad goals",
      headline: "어떤 목적으로 스폰서십을 진행하시나요?",
      cards: [
        {
          label: "브랜드 확산형",
          description:
            "전 동선 통합 노출. 옥외 LED, 천장 배너, 등록대 등 대형 채널 위주.",
          emoji: "🚀",
        },
        {
          label: "현장 방문객 유도형",
          description:
            "참관객 동선 위에서 부스로 유도. 등록대, 라이팅월, 도면 등.",
          emoji: "🧭",
        },
        {
          label: "신제품 홍보형",
          description:
            "쇼가이드 광고, SNS 인터뷰, 카드뉴스로 제품 인지 확보.",
          emoji: "📰",
        },
        {
          label: "맞춤형 타겟팅 광고",
          description:
            "참관등록·세미나·검색 페이지 배너로 결정권자 직접 도달.",
          emoji: "🎯",
        },
      ],
    },
  });

  blocks.push({
    id: id(),
    type: "benefits4",
    data: {
      eyebrow: "sponsors benefits",
      headline: "스폰서 참가사에게 드리는 4가지 혜택",
      cards: [
        {
          title: "참가업체 검색 페이지 상위 고정",
          description: "검색 결과 상단에 우선 노출됩니다.",
          emoji: "📌",
        },
        {
          title: "스폰서 참가사 뱃지 표기",
          description: "참가업체 카드에 별도 뱃지로 강조 표시.",
          emoji: "🏅",
        },
        {
          title: "홈페이지 배너 노출",
          description: "공식 사이트 배너 영역에 추가 노출.",
          emoji: "🌐",
        },
        {
          title: "도면 내 로고 표기",
          description: "전시장 도면 위에 참가사 로고가 함께 표시됩니다.",
          emoji: "🗺️",
        },
      ],
    },
  });

  blocks.push({
    id: id(),
    type: "steps4",
    data: {
      eyebrow: "application",
      headline: "신청 절차",
      steps: steps.slice(0, 4),
    },
  });

  blocks.push({
    id: id(),
    type: "cta",
    data: {
      eyebrow: "get in touch",
      lines: ["어떤 자리에", "들어갈지,", "먼저 둘러보세요."],
      primaryLabel: "스폰서십 둘러보기",
      secondaryLabel: "바로 문의하기",
      showContact: true,
    },
  });

  return blocks;
}

function id(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 빈 블록을 type별로 생성 (어드민 "블록 추가" 시 사용) */
export function emptyBlock(type: LandingBlockType): LandingBlock {
  switch (type) {
    case "cover":
      return {
        id: id(),
        type,
        data: { title: "Sponsorship", subtitle: "" },
      };
    case "stats3year":
      return {
        id: id(),
        type,
        data: { headline: "참관 규모", years: [] },
      };
    case "adGoals4":
      return {
        id: id(),
        type,
        data: { headline: "광고 목적", cards: [] },
      };
    case "benefits4":
      return {
        id: id(),
        type,
        data: { headline: "혜택", cards: [] },
      };
    case "steps4":
      return {
        id: id(),
        type,
        data: { headline: "신청 절차", steps: [] },
      };
    case "textHero":
      return {
        id: id(),
        type,
        data: { lines: ["큰 텍스트 한 줄", "*빨강 강조 줄은 앞에 *"] },
      };
    case "bigStat":
      return {
        id: id(),
        type,
        data: { value: "70,000", valueSuffix: "명", label: "다녀갑니다." },
      };
    case "cta":
      return {
        id: id(),
        type,
        data: { lines: ["행동을 유도하는", "마지막 한마디."] },
      };
    case "image":
      return { id: id(), type, data: { url: "" } };
    case "richText":
      return {
        id: id(),
        type,
        data: { body: "본문 텍스트를 자유롭게 입력하세요." },
      };
    case "twoColumn":
      return {
        id: id(),
        type,
        data: {
          left: { kind: "text", headline: "왼쪽 제목", body: "왼쪽 본문" },
          right: { kind: "image", imageUrl: "" },
          ratio: "1:1",
        },
      };
    case "imageGrid":
      return {
        id: id(),
        type,
        data: { columns: 3, images: [] },
      };
    case "divider":
      return { id: id(), type, data: {} };
    case "spacer":
      return { id: id(), type, data: { size: "md" } };
    case "buttonRow":
      return {
        id: id(),
        type,
        data: {
          buttons: [
            { label: "스폰서십 보기", href: "/sponsorships", variant: "primary" },
            { label: "문의하기", href: "/contact", variant: "outline" },
          ],
        },
      };
    case "videoEmbed":
      return { id: id(), type, data: { url: "", aspect: "16:9" } };
    case "customHtml":
      return {
        id: id(),
        type,
        data: { html: "<p>여기에 자유 HTML을 입력하세요.</p>" },
      };
    case "slotsTeaser":
      return {
        id: id(),
        type,
        data: { headline: "추천 슬롯", categorySlugs: [], layout: "grid" },
      };
  }
}

export const BLOCK_TYPE_META: Record<
  LandingBlockType,
  { label: string; desc: string; group: "main" | "media" | "layout" | "advanced" }
> = {
  cover: { label: "표지 (Cover)", desc: "행사명 + 일정 · 큰 히어로", group: "main" },
  stats3year: { label: "3년 통계", desc: "방문객·해외바이어 연도별 카드", group: "main" },
  adGoals4: { label: "4가지 광고 목적", desc: "타입 1~4 카드 그리드", group: "main" },
  benefits4: { label: "4가지 혜택", desc: "Sponsor Benefits 카드", group: "main" },
  steps4: { label: "신청 절차 4단계", desc: "01~04 번호 카드", group: "main" },
  textHero: { label: "큰 텍스트", desc: '"모든 동선 위에 / 당신의 브랜드를"', group: "main" },
  bigStat: { label: "큰 숫자 한 개", desc: '"70,000명이 / 4일간 다녀갑니다"', group: "main" },
  cta: { label: "CTA (빨강)", desc: "빨강 풀브리드 + 버튼 2개", group: "main" },
  buttonRow: { label: "버튼 행", desc: "여러 버튼 가로 배치", group: "main" },
  richText: { label: "긴 텍스트 본문", desc: "여러 줄 본문 텍스트", group: "main" },
  twoColumn: { label: "2-컬럼", desc: "좌우 분할 (텍스트+이미지 자유 조합)", group: "layout" },
  image: { label: "이미지", desc: "단일 이미지 슬라이드", group: "media" },
  imageGrid: { label: "이미지 그리드", desc: "2~6열 이미지 갤러리", group: "media" },
  videoEmbed: { label: "동영상", desc: "YouTube / Vimeo / mp4 임베드", group: "media" },
  divider: { label: "구분선", desc: "섹션 사이 헤어라인 또는 라벨", group: "layout" },
  spacer: { label: "여백", desc: "수직 빈 공간", group: "layout" },
  slotsTeaser: { label: "슬롯 미리보기", desc: "선택한 카테고리들을 카드로", group: "advanced" },
  customHtml: { label: "자유 HTML", desc: "직접 마크업 (위험 — 신뢰 전제)", group: "advanced" },
};
