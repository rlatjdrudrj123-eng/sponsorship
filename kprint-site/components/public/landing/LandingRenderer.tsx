"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { LandingBlock, SiteSettings } from "@/lib/types";
import { BlockSection } from "./blocks";

/**
 * 랜딩 블록 시퀀스를 스냅 슬라이드로 렌더.
 *
 * 어드민이 settings.landing 에 블록을 추가하면 그 순서대로 풀스크린 슬라이드가
 * 쌓인다. 비어있으면 기본 자동 생성 콘텐츠(buildDefaultBlocks) 사용.
 */
export function LandingRenderer({
  blocks,
  eventId,
  settings,
}: {
  blocks: LandingBlock[];
  eventId: string;
  settings: SiteSettings | null;
}) {
  return (
    <>
      <Link
        href={`/${eventId}/sponsorships`}
        className="fixed top-6 right-6 md:top-8 md:right-8 z-50 px-5 py-2.5 rounded-pill bg-brand-500 text-white hover:bg-brand-700 text-[12px] md:text-[13px] font-bold transition-colors flex items-center gap-1.5 shadow-glow-sm hover:shadow-glow"
      >
        스폰서십 바로 보기
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
      <main className="h-screen overflow-y-scroll snap-y snap-mandatory bg-canvas text-ink-900">
        {blocks.map((b) => (
          <BlockSection
            key={b.id}
            block={b}
            eventId={eventId}
            settings={settings}
          />
        ))}
      </main>
    </>
  );
}
