"use client";

import type {
  AdGoals4Block,
  Benefits4Block,
  BigStatBlock,
  CanvasComponentNode,
  CoverBlock,
  CtaBlock,
  RichTextBlock,
  SiteSettings,
  SlotsTeaserBlock,
  Stats3YearBlock,
  Steps4Block,
  TextHeroBlock,
} from "@/lib/types";
import {
  AdGoals4Section,
  Benefits4Section,
  BigStatSection,
  CoverSection,
  CtaSection,
  RichTextSection,
  SlotsTeaserSection,
  Stats3YearSection,
  Steps4Section,
  TextHeroSection,
} from "@/components/public/landing/blocks";

/**
 * 캔버스 컴포넌트 노드 렌더러.
 *
 * 데스크톱: 노드 rect 안에 컴포넌트를 가둠 (overflow hidden + relative).
 * 컴포넌트는 자체 풀스크린 디자인이라 노드 크기에 맞춰 시각적으로 자르기.
 * 어드민이 노드 크기를 1920×1080 으로 두면 풀 슬라이드처럼 보이고,
 * 작게 두면 미니 카드처럼 보임.
 *
 * 모바일: 컴포넌트 자체 레이아웃으로 풀폭 렌더 (mobile=true 일 때).
 */
export function ComponentNodeRenderer({
  node,
  eventId,
  settings,
  mobile = false,
}: {
  node: CanvasComponentNode;
  eventId: string;
  settings: SiteSettings | null;
  mobile?: boolean;
}) {
  // 기존 블록 컴포넌트는 모두 h-screen / SlideShell 안에 갇혀있어서
  // 캔버스 노드 안에 넣으려면 컨테이너 크기에 맞게 보이도록 wrap.
  // SlideShell.minHeight 가 "screen" 이면 100vh — 노드 크기 기준이 아니라 뷰포트라 문제.
  // → minHeight 를 "auto" 로 override 하는 style.minHeight: "auto" 강제.

  const wrappedStyle = {
    ...node.data,
    style: {
      ...((node.data as { style?: Record<string, unknown> }).style ?? {}),
      minHeight: "auto" as const,
    },
  };

  const inner = (() => {
    switch (node.componentKind) {
      case "cover":
        return (
          <CoverSection
            block={
              {
                id: node.id,
                type: "cover",
                style: { minHeight: "auto" },
                data: node.data as CoverBlock["data"],
              } as CoverBlock
            }
            eventId={eventId}
          />
        );
      case "stats3year":
        return (
          <Stats3YearSection
            block={
              {
                id: node.id,
                type: "stats3year",
                style: { minHeight: "auto" },
                data: node.data as Stats3YearBlock["data"],
              } as Stats3YearBlock
            }
          />
        );
      case "adGoals4":
        return (
          <AdGoals4Section
            block={
              {
                id: node.id,
                type: "adGoals4",
                style: { minHeight: "auto" },
                data: node.data as AdGoals4Block["data"],
              } as AdGoals4Block
            }
          />
        );
      case "benefits4":
        return (
          <Benefits4Section
            block={
              {
                id: node.id,
                type: "benefits4",
                style: { minHeight: "auto" },
                data: node.data as Benefits4Block["data"],
              } as Benefits4Block
            }
          />
        );
      case "steps4":
        return (
          <Steps4Section
            block={
              {
                id: node.id,
                type: "steps4",
                style: { minHeight: "auto" },
                data: node.data as Steps4Block["data"],
              } as Steps4Block
            }
          />
        );
      case "textHero":
        return (
          <TextHeroSection
            block={
              {
                id: node.id,
                type: "textHero",
                style: { minHeight: "auto" },
                data: node.data as TextHeroBlock["data"],
              } as TextHeroBlock
            }
          />
        );
      case "bigStat":
        return (
          <BigStatSection
            block={
              {
                id: node.id,
                type: "bigStat",
                style: { minHeight: "auto" },
                data: node.data as BigStatBlock["data"],
              } as BigStatBlock
            }
          />
        );
      case "cta":
        return (
          <CtaSection
            block={
              {
                id: node.id,
                type: "cta",
                style: { minHeight: "auto" },
                data: node.data as CtaBlock["data"],
              } as CtaBlock
            }
            eventId={eventId}
            settings={settings}
          />
        );
      case "slotsTeaser":
        return (
          <SlotsTeaserSection
            block={
              {
                id: node.id,
                type: "slotsTeaser",
                style: { minHeight: "auto" },
                data: node.data as SlotsTeaserBlock["data"],
              } as SlotsTeaserBlock
            }
            eventId={eventId}
          />
        );
      case "richText":
        return (
          <RichTextSection
            block={
              {
                id: node.id,
                type: "richText",
                style: { minHeight: "auto" },
                data: node.data as RichTextBlock["data"],
              } as RichTextBlock
            }
          />
        );
    }
  })();

  if (mobile) {
    return <div className="w-full">{inner}</div>;
  }

  void wrappedStyle;
  // 데스크톱: 노드 크기 안에 가둠
  return (
    <div className="w-full h-full overflow-hidden relative">
      <div className="absolute inset-0 [&_section]:!h-full [&_section]:!min-h-0 [&_section]:!py-6 [&_section]:!px-6">
        {inner}
      </div>
    </div>
  );
}
