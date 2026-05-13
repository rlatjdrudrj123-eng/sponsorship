"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import type { Category, Subcategory } from "@/lib/types";

type Props = {
  category: Category;
  subcategories: Subcategory[];
  totalSlots: number;
  availableSlots: number;
};

const TYPE_LABELS: Record<Category["type"], string> = {
  floor_plan: "도면형",
  quantity: "수량형",
  media: "미디어",
  digital_banner: "디지털 배너",
  mailing: "발송형",
  print_page: "지면형",
  content: "콘텐츠형",
  xpace: "XPACE",
  package: "패키지",
};

export function CategoryHero({
  category,
  subcategories,
  totalSlots,
  availableSlots,
}: Props) {
  const minPrice = Math.min(
    ...subcategories.map((s) => s.priceKRW).filter((p) => p > 0),
    Infinity
  );
  const maxPrice = Math.max(...subcategories.map((s) => s.priceKRW), 0);
  const samePrice = minPrice === maxPrice;

  return (
    <div className="border-b border-ink-100 bg-white">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8">
        <Link
          href="/sponsorships"
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          전체 스폰서십
        </Link>

        <div className="flex items-baseline gap-3 mb-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest font-mono text-ink-500">
            {category.code}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-brand-700 font-bold">
            {TYPE_LABELS[category.type]}
          </span>
        </div>
        <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
          {category.name.ko}
        </h1>
        {category.shortDesc && (
          <p className="text-[14px] text-ink-700 mt-3 max-w-3xl leading-relaxed">
            {category.shortDesc}
          </p>
        )}

        <div className="mt-6 flex items-center gap-6 flex-wrap text-[12px]">
          <Meta label="구좌">
            <span className="font-mono">
              <span className="text-brand-700 font-bold">{availableSlots}</span>
              <span className="text-ink-500"> / {totalSlots} 가능</span>
            </span>
          </Meta>
          {Number.isFinite(minPrice) && minPrice > 0 && (
            <Meta label="단가">
              <span className="font-mono">
                {samePrice
                  ? `${minPrice.toLocaleString()}원`
                  : `${minPrice.toLocaleString()} ~ ${maxPrice.toLocaleString()}원`}
              </span>
            </Meta>
          )}
          {category.deadline && (
            <Meta label="입고 마감">
              <span className="font-mono">
                {category.deadline.toDate().toLocaleDateString("ko-KR")}
              </span>
            </Meta>
          )}
          {category.fileFormat && (
            <Meta label="파일 형식">
              <span>{category.fileFormat}</span>
            </Meta>
          )}
          {category.designGuideFileUrl && (
            <a
              href={category.designGuideFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-700 font-semibold hover:underline ml-auto"
            >
              <Download className="w-3.5 h-3.5" />
              디자인 가이드 PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-ink-500 mr-1.5">{label}</span>
      {children}
    </div>
  );
}
