"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import type { Category, Subcategory } from "@/lib/types";
import { localized, useLocale } from "@/lib/i18n/locale";
import { krwToUsd } from "@/lib/price";
import { CATEGORY_TYPE_LABELS } from "@/lib/categoryTypeLabels";

type Props = {
  category: Category;
  subcategories: Subcategory[];
  totalSlots: number;
  availableSlots: number;
};

// 단일 진실원 — lib/categoryTypeLabels.ts 에서 import.
// 어드민 매체분류 그룹과 동일한 이름 사용 (영업담당/사용자 일관성).
const TYPE_LABELS = CATEGORY_TYPE_LABELS;

export function CategoryHero({
  category,
  subcategories,
  totalSlots,
  availableSlots,
}: Props) {
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const locale = useLocale((s) => s.locale);

  const minPrice = Math.min(
    ...subcategories.map((s) => s.priceKRW).filter((p) => p > 0),
    Infinity
  );
  const maxPrice = Math.max(...subcategories.map((s) => s.priceKRW), 0);
  const samePrice = minPrice === maxPrice;
  const isEn = locale === "en";

  // USD price — 다양 케이스는 subcategory 별로 직접 표시하므로 min 만 필요
  const minPriceUsd = Math.min(
    ...subcategories
      .map((s) => s.priceUSD ?? (s.priceKRW > 0 ? krwToUsd(s.priceKRW) : 0))
      .filter((p) => p > 0),
    Infinity
  );
  void maxPrice; // 사용처는 인라인 리스트로 대체됨 — 변수 보존만 (호환)

  return (
    <div className="border-b border-ink-100 bg-surface">
      <div className="max-w-6xl mx-auto px-6 md:px-12 pt-12 md:pt-16 pb-10">
        <Link
          href={eventId ? `/${eventId}/sponsorships` : "/"}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-6 font-num font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isEn ? "All sponsorships" : "전체 스폰서십"}
        </Link>

        <div className="font-num text-[11px] uppercase tracking-[0.3em] font-bold mb-3 flex items-center gap-3 text-brand-500">
          <span className="w-6 h-px bg-brand-500" />
          <span>{TYPE_LABELS[category.type][locale]}</span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-500">{category.code}</span>
        </div>
        <h1 className="text-[32px] md:text-[56px] font-bold tracking-tight leading-[1.15] text-ink-900 break-keep">
          {localized(category.name, locale)}
        </h1>
        {category.shortDesc && (
          <p className="text-[14px] md:text-[16px] text-ink-500 mt-4 max-w-3xl leading-relaxed">
            {category.shortDesc}
          </p>
        )}

        <div className="mt-8 flex items-center gap-x-8 gap-y-3 flex-wrap text-[13px]">
          <Meta label={isEn ? "Slots" : "구좌"}>
            <span className="font-num">
              <span className="text-brand-500 font-bold">{availableSlots}</span>
              <span className="text-ink-500">
                {" "}
                / {totalSlots} {isEn ? "available" : "가능"}
              </span>
            </span>
          </Meta>
          {Number.isFinite(minPrice) && minPrice > 0 && (
            <Meta
              label={
                samePrice
                  ? isEn ? "Unit price" : "단가"
                  : isEn ? "Pricing" : "구좌별 가격"
              }
            >
              {samePrice ? (
                <span className="font-num">
                  {isEn
                    ? `$${minPriceUsd.toLocaleString()}`
                    : `${minPrice.toLocaleString()}원`}
                </span>
              ) : (
                // 가격이 subcategory 별로 다양 — 모든 가격을 인라인 리스트로
                <span className="font-num flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {subcategories
                    .filter((s) => s.priceKRW > 0)
                    .map((s, i, arr) => {
                      const priceUsd = s.priceUSD ?? krwToUsd(s.priceKRW);
                      return (
                        <span key={s.id} className="inline-flex items-baseline gap-1.5">
                          <span className="text-ink-500 text-[12px]">
                            {localized(s.name, locale)}
                          </span>
                          <span className="text-ink-900 font-bold">
                            {isEn
                              ? `$${priceUsd.toLocaleString()}`
                              : `${s.priceKRW.toLocaleString()}원`}
                          </span>
                          {i < arr.length - 1 && (
                            <span className="text-ink-300 ml-1">·</span>
                          )}
                        </span>
                      );
                    })}
                </span>
              )}
            </Meta>
          )}
          {category.deadline && (
            <Meta label={isEn ? "Material due" : "입고 마감"}>
              <span className="font-num">
                {category.deadline
                  .toDate()
                  .toLocaleDateString(isEn ? "en-US" : "ko-KR")}
              </span>
            </Meta>
          )}
          {category.fileFormat && (
            <Meta label={isEn ? "File format" : "파일 형식"}>
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
              {isEn ? "Design guide PDF" : "디자인 가이드 PDF"}
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
