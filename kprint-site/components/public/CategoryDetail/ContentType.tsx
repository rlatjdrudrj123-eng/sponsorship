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

export function ContentType({
  category,
  subcategories,
  slots,
  allCategories,
  settings,
}: Props) {
  const spec = category.contentSpec;

  return (
    <Scaffold
      category={category}
      subcategories={subcategories}
      slots={slots}
      allCategories={allCategories}
      settings={settings}
    >
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <ImageCarousel slot={category.heroImages} />

        <div className="space-y-6">
          {spec && (
            <div className="bg-mint-50 border border-mint-100 rounded-card p-5">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold mb-3">
                채널 / 포맷
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-mint-700 mb-1">채널</div>
                  <div className="text-[16px] font-bold text-ink-900">
                    {spec.channel}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-mint-700 mb-1">포맷</div>
                  <div className="text-[16px] font-bold text-ink-900">
                    {spec.format}
                  </div>
                </div>
              </div>
            </div>
          )}

          {category.videoUrl && (
            <video
              src={category.videoUrl}
              controls
              className="w-full aspect-video bg-ink-900 rounded-card"
            />
          )}

          <SlotPicker
            categoryId={category.id}
              eventId={category.eventId}
            subcategories={subcategories}
            slots={slots}
          />
        </div>
      </div>
    </Scaffold>
  );
}
