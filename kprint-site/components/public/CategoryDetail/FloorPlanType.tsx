"use client";

import { useState } from "react";
import type { Category, SiteSettings, Slot, Subcategory } from "@/lib/types";
import { Scaffold } from "./_shared/Scaffold";
import { SlotPicker } from "./_shared/SlotPicker";
import { PinOverlay } from "./_shared/PinOverlay";

type Props = {
  category: Category;
  subcategories: Subcategory[];
  slots: Slot[];
  allCategories: Category[];
  settings: SiteSettings | null;
};

export function FloorPlanType({
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
                  ? "border-mint-500 text-ink-900"
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
            <div className="bg-ink-50 rounded-card aspect-[4/3] grid place-items-center text-ink-300 text-sm border border-ink-100">
              도면 준비 중
            </div>
          )}
          <p className="mt-3 text-[11px] text-ink-500">
            도면 위 핀을 클릭하면 해당 구좌가 카트에 담깁니다.
          </p>
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
            <p className="text-sm text-ink-500">소분류가 없습니다.</p>
          )}
        </div>
      </div>
    </Scaffold>
  );
}
