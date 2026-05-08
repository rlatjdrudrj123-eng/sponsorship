"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
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

type Device = "all" | "pc" | "tablet" | "mobile";

export function DigitalBannerType({
  category,
  subcategories,
  slots,
  allCategories,
  settings,
}: Props) {
  const [device, setDevice] = useState<Device>("all");

  // 캡션에 'pc' / 'tablet' / 'mobile' / 'PC' 등이 들어 있는 이미지로 분기
  const all =
    category.detailImages?.images ?? category.heroImages?.images ?? [];
  const filtered =
    device === "all"
      ? all
      : all.filter((img) =>
          (img.caption ?? "").toLowerCase().includes(device)
        );

  return (
    <Scaffold
      category={category}
      subcategories={subcategories}
      slots={slots}
      allCategories={allCategories}
      settings={settings}
    >
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <div className="flex gap-1 bg-ink-50 rounded-btn p-0.5 mb-3 w-fit">
            <DeviceTab
              active={device === "all"}
              onClick={() => setDevice("all")}
            >
              전체
            </DeviceTab>
            <DeviceTab
              active={device === "pc"}
              onClick={() => setDevice("pc")}
            >
              <Monitor className="w-3.5 h-3.5" /> PC
            </DeviceTab>
            <DeviceTab
              active={device === "tablet"}
              onClick={() => setDevice("tablet")}
            >
              <Tablet className="w-3.5 h-3.5" /> 태블릿
            </DeviceTab>
            <DeviceTab
              active={device === "mobile"}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="w-3.5 h-3.5" /> 모바일
            </DeviceTab>
          </div>
          <ImageCarousel
            slot={
              filtered.length > 0
                ? { mode: "carousel", images: filtered }
                : { mode: "carousel", images: all }
            }
            aspectRatio="aspect-[16/10]"
          />
        </div>
        <div>
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

function DeviceTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2.5 py-1.5 rounded text-[12px] font-semibold flex items-center gap-1 " +
        (active ? "bg-white shadow-sm text-ink-900" : "text-ink-500 hover:text-ink-900")
      }
    >
      {children}
    </button>
  );
}
