"use client";

import { Mail, Users } from "lucide-react";
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

export function MailingType({
  category,
  subcategories,
  slots,
  allCategories,
  settings,
}: Props) {
  const spec = category.mailingSpec;

  return (
    <Scaffold
      category={category}
      subcategories={subcategories}
      slots={slots}
      allCategories={allCategories}
      settings={settings}
    >
      <div className="grid lg:grid-cols-[1fr_1fr] gap-8 items-start">
        <ImageCarousel slot={category.heroImages} aspectRatio="aspect-[3/4]" />

        <div className="space-y-6">
          {spec && (
            <div className="bg-mint-50 border border-mint-100 rounded-card p-5">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold mb-3">
                발송 정보
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {spec.audience > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] text-mint-700">
                      <Users className="w-3 h-3" /> 발송 대상
                    </div>
                    <div className="text-[20px] font-bold text-ink-900 mt-1 font-mono">
                      {spec.audience.toLocaleString()}
                      <span className="text-[12px] font-normal ml-1">명</span>
                    </div>
                    {spec.audienceLabel && (
                      <div className="text-[11px] text-ink-500 mt-0.5">
                        {spec.audienceLabel}
                      </div>
                    )}
                  </div>
                )}
                {spec.sendDates?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] text-mint-700">
                      <Mail className="w-3 h-3" /> 발송일
                    </div>
                    <ul className="text-[12px] font-mono text-ink-900 mt-1 space-y-0.5">
                      {spec.sendDates.slice(0, 6).map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <SlotPicker
            categoryId={category.id}
            subcategories={subcategories}
            slots={slots}
          />
        </div>
      </div>
    </Scaffold>
  );
}
