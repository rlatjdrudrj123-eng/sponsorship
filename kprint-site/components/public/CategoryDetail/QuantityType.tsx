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

export function QuantityType({
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
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <ImageCarousel
          slot={
            category.heroImages?.images?.length ? category.heroImages : undefined
          }
        />
        <div>
          <SlotPicker
            categoryId={category.id}
              eventId={category.eventId}
            subcategories={subcategories}
            slots={slots}
          />
        </div>
      </div>

      {category.detailImages && category.detailImages.images.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-brand-700 font-bold mb-3">
            디테일
          </h3>
          <ImageCarousel slot={category.detailImages} aspectRatio="aspect-[16/9]" />
        </div>
      )}
    </Scaffold>
  );
}
