"use client";

import type { Category, SiteSettings, Slot, Subcategory } from "@/lib/types";
import { Scaffold } from "./_shared/Scaffold";
import { SlotPicker } from "./_shared/SlotPicker";
import { ImageCarousel } from "./_shared/ImageCarousel";

type Props = {
  category: Category;
  subcategories: Subcategory[];
  slots: Slot[];
  allCategories: Category[];
  settings: SiteSettings | null;
};

export function MediaType({
  category,
  subcategories,
  slots,
  allCategories,
  settings,
}: Props) {
  return (
    <Scaffold
      category={category}
      subcategories={subcategories}
      slots={slots}
      allCategories={allCategories}
      settings={settings}
    >
      {category.videoUrl ? (
        <div>
          <video
            src={category.videoUrl}
            controls
            className="w-full aspect-video bg-ink-900 rounded-card"
            aria-label="Video preview"
          />
          {/* 영상 재생 실패 시 브라우저 기본 fallback (텍스트 노드는 SSR/i18n 충돌 위험 — 제거) */}
        </div>
      ) : (
        <ImageCarousel slot={category.heroImages} aspectRatio="aspect-video" />
      )}

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <SlotPicker
            categoryId={category.id}
              eventId={category.eventId}
            subcategories={subcategories}
            slots={slots}
          />
        </div>
        {category.detailImages && category.detailImages.images.length > 0 && (
          <ImageCarousel slot={category.detailImages} />
        )}
      </div>
    </Scaffold>
  );
}
