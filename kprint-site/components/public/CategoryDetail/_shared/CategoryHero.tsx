"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";

  const minPrice = Math.min(
    ...subcategories.map((s) => s.priceKRW).filter((p) => p > 0),
    Infinity
  );
  const maxPrice = Math.max(...subcategories.map((s) => s.priceKRW), 0);
  const samePrice = minPrice === maxPrice;

  return (
    <div className="border-b border-ink-100 bg-surface">
      <div className="max-w-6xl mx-auto px-6 md:px-12 pt-12 md:pt-16 pb-10">
        <Link
          href={eventId ? `/${eventId}/sponsorships` : "/"}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-6 font-num font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          전체 스폰서십
        </Link>

        <div className="font-num text-[11px] uppercase tracking-[0.3em] font-bold mb-3 flex items-center gap-3 text-brand-500">
          <span className="w-6 h-px bg-brand-500" />
          <span>{TYPE_LABELS[category.type]}</span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-500">{category.code}</span>
        </div>
        <h1 className="text-[36px] md:text-[64px] font-bold tracking-tight leading-[1.05] text-ink-900">
          {category.name.ko}
        </h1>
        {category.shortDesc && (
          <p className="text-[14px] md:text-[16px] text-ink-500 mt-4 max-w-3xl leading-relaxed">
            {category.shortDesc}
          </p>
        )}

        <div className="mt-8 flex items-center gap-x-8 gap-y-3 flex-wrap text-[13px]">
          <Meta label="구좌">
            <span className="font-num">
              <span className="text-brand-500 font-bold">{availableSlots}</span>
              <span className="text-ink-500"> / {totalSlots} 가능</span>
            </span>
          </Meta>
          {Number.isFinite(minPrice) && minPrice > 0 && (
            <Meta label="단가">
              <span className="font-num">
                {samePrice
                  ? `${minPrice.toLocaleString()}원`
                  : `${minPrice.toLocaleString()} ~ ${maxPrice.toLocaleString()}원`}
              </span>
            </Meta>
          )}
          {category.deadline && (
            <Meta label="입고 마감">
              <span className="font-num">
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
              className="inline-flex items-center gap-1.5 text-brand-500 font-bold hover:underline ml-auto"
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
    <div className="flex items-baseline gap-2">
      <span className="text-ink-500 text-[11px] uppercase tracking-wider font-num font-semibold">
        {label}
      </span>
      <span className="font-bold text-ink-900">{children}</span>
    </div>
  );
}
