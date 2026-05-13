"use client";

import { useState } from "react";
import type { Category, SiteSettings, Slot, Subcategory } from "@/lib/types";
import { Scaffold } from "./_shared/Scaffold";
import { SlotPicker } from "./_shared/SlotPicker";
import { PinOverlay } from "./_shared/PinOverlay";
import { ImageCarousel } from "./_shared/ImageCarousel";

type Props = {
  category: Category;
  subcategories: Subcategory[];
  slots: Slot[];
  allCategories: Category[];
  settings: SiteSettings | null;
};

export function XpaceType({
  category,
  subcategories,
  slots,
  allCategories,
  settings,
}: Props) {
  const sortedSubs = [...subcategories].sort((a, b) => a.order - b.order);
  const [tabId, setTabId] = useState<string>(sortedSubs[0]?.id ?? "");
  const tabSub = sortedSubs.find((s) => s.id === tabId);
  const tabSlots = slots.filter((s) => s.subcategoryId === tabId);
  const floorImage = (category.floorImages ?? []).find(
    (fi) => fi.subcategoryId === tabId
  );

  return (
    <Scaffold
      category={category}
      subcategories={subcategories}
      slots={slots}
      allCategories={allCategories}
      settings={settings}
    >
      {category.videoUrl && (
        <div>
          <video
            src={category.videoUrl}
            controls
            className="w-full aspect-video bg-ink-900 rounded-card"
          />
          <p className="mt-2 text-[11px] text-ink-500">
            행사장 진입 동선의 LED 송출 미리보기
          </p>
        </div>
      )}

      {sortedSubs.length > 1 && (
        <div className="flex gap-1 border-b border-ink-100 -mb-2">
          {sortedSubs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setTabId(s.id)}
              className={
                "px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors " +
                (tabId === s.id
                  ? "border-brand-500 text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-900")
              }
            >
              {s.name.ko || "기본"}
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
        <div>
          {floorImage && tabSub ? (
            <PinOverlay
              floorImage={floorImage}
              categoryId={category.id}
              eventId={category.eventId}
              subcategory={tabSub}
              slots={tabSlots}
            />
          ) : (
            <ImageCarousel slot={category.heroImages} />
          )}
        </div>
        <div>
          {tabSub ? (
            <SlotPicker
              categoryId={category.id}
              eventId={category.eventId}
              subcategories={[tabSub]}
              slots={tabSlots}
            />
          ) : (
            <SlotPicker
              categoryId={category.id}
              eventId={category.eventId}
              subcategories={subcategories}
              slots={slots}
            />
          )}
        </div>
      </div>
    </Scaffold>
  );
}
