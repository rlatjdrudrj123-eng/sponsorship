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

export function PrintPageType({
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
      <div className="grid lg:grid-cols-[1fr_1fr] gap-8 items-start">
        <ImageCarousel
          slot={
            category.heroImages?.images?.length
              ? { ...category.heroImages, mode: "gallery" }
              : undefined
          }
        />
        <SlotPicker
          categoryId={category.id}
          subcategories={subcategories}
          slots={slots}
        />
      </div>
    </Scaffold>
  );
}
