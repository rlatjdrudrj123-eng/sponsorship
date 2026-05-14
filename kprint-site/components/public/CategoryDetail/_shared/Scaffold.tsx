"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { Category, SiteSettings, Slot, Subcategory } from "@/lib/types";
import { CategoryHero } from "./CategoryHero";
import { SpecCard } from "./SpecCard";
import { CategoryPageNav } from "./CategoryPageNav";
import { CaseStudies } from "./CaseStudies";
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
  // ?embed=1 (모달 iframe 안에서 렌더 시) — 카테고리 간 네비/푸터 숨김
  const sp = useSearchParams();
  const embed = sp?.get("embed") === "1";
  const total = slots.length;
  const available = slots.filter((s) => s.status === "available").length;
  return (
    <>
      <main className="min-h-screen bg-canvas">
        <CategoryHero
          category={category}
          subcategories={subcategories}
          totalSlots={total}
          availableSlots={available}
        />
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10 space-y-10">
          {children}
          <SpecCard category={category} />
          {category.caseStudies && category.caseStudies.length > 0 && (
            <CaseStudies items={category.caseStudies} />
          )}
        </div>
        {!embed && <CategoryPageNav current={category} all={allCategories} />}
      </main>
      {!embed && <Footer settings={settings} />}
    </>
  );
}
