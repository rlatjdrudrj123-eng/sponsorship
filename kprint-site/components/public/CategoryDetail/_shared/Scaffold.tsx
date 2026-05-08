"use client";

import type { ReactNode } from "react";
import type { Category, SiteSettings, Slot, Subcategory } from "@/lib/types";
import { CategoryHero } from "./CategoryHero";
import { SpecCard } from "./SpecCard";
import { CategoryPageNav } from "./CategoryPageNav";
import { Footer } from "@/components/public/Footer";

type Props = {
  category: Category;
  subcategories: Subcategory[];
  slots: Slot[];
  allCategories: Category[];
  settings: SiteSettings | null;
  children: ReactNode;
};

export function Scaffold({
  category,
  subcategories,
  slots,
  allCategories,
  settings,
  children,
}: Props) {
  const total = slots.length;
  const available = slots.filter((s) => s.status === "available").length;
  return (
    <>
      <main className="min-h-screen bg-white">
        <CategoryHero
          category={category}
          subcategories={subcategories}
          totalSlots={total}
          availableSlots={available}
        />
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10 space-y-10">
          {children}
          <SpecCard category={category} />
        </div>
        <CategoryPageNav current={category} all={allCategories} />
      </main>
      <Footer settings={settings} />
    </>
  );
}
