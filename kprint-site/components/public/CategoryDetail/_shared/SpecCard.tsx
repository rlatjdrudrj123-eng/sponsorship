"use client";

import { Download } from "lucide-react";
import type { Category } from "@/lib/types";
import { localizedField, useLocale } from "@/lib/i18n/locale";

export function SpecCard({ category }: { category: Category }) {
  const locale = useLocale((s) => s.locale);
  const isEn = locale === "en";
  const items: Array<{ label: string; value: React.ReactNode }> = [];

  if (category.size)
    items.push({ label: isEn ? "Size" : "규격", value: category.size });
  if (category.fileFormat)
    items.push({
      label: isEn ? "File format" : "파일 형식",
      value: category.fileFormat,
    });
  if (category.deadline)
    items.push({
      label: isEn ? "Material due" : "입고 마감",
      value: category.deadline
        .toDate()
        .toLocaleDateString(isEn ? "en-US" : "ko-KR"),
    });

  if (category.videoSpec) {
    if (category.videoSpec.duration)
      items.push({
        label: isEn ? "Video length" : "영상 길이",
        value: `${category.videoSpec.duration}${isEn ? "s" : "초"}`,
      });
    if (category.videoSpec.resolution)
      items.push({
        label: isEn ? "Resolution" : "해상도",
        value: category.videoSpec.resolution,
      });
    if (category.videoSpec.plays)
      items.push({
        label: isEn ? "Plays" : "송출 횟수",
        value: isEn
          ? `${category.videoSpec.plays.toLocaleString()} times`
          : `${category.videoSpec.plays.toLocaleString()}회`,
      });
  }

  if (category.mailingSpec) {
    if (category.mailingSpec.audience)
      items.push({
        label: isEn ? "Audience" : "발송 대상",
        value: isEn
          ? `${category.mailingSpec.audience.toLocaleString()}${
              category.mailingSpec.audienceLabel
                ? ` (${category.mailingSpec.audienceLabel})`
                : ""
            }`
          : `${category.mailingSpec.audience.toLocaleString()}명${
              category.mailingSpec.audienceLabel
                ? ` (${category.mailingSpec.audienceLabel})`
                : ""
            }`,
      });
    if (category.mailingSpec.sendDates?.length)
      items.push({
        label: isEn ? "Send dates" : "발송 예정일",
        value: category.mailingSpec.sendDates.join(", "),
      });
  }

  if (category.contentSpec) {
    items.push({
      label: isEn ? "Channel" : "채널",
      value: category.contentSpec.channel,
    });
    items.push({
      label: isEn ? "Format" : "포맷",
      value: category.contentSpec.format,
    });
  }

  if (items.length === 0 && !category.designGuideText && !category.designGuideFileUrl) {
    return null;
  }

  return (
    <section className="bg-surface border border-ink-100 rounded-card p-6 md:p-8 shadow-card">
      <h3 className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-5 flex items-center gap-2">
        <span className="w-4 h-px bg-brand-500" />
        {isEn ? "Specs" : "스펙"}
      </h3>
      {items.length > 0 && (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 mb-4">
          {items.map((it, i) => (
            <div key={i} className="flex border-b border-ink-100 pb-3">
              <dt className="text-[12px] text-ink-500 w-24 shrink-0 font-num uppercase tracking-wider">
                {it.label}
              </dt>
              <dd className="text-[14px] text-ink-900 font-num flex-1 font-bold">
                {it.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {(() => {
        const dg = localizedField(category.designGuideText, category.designGuideTextEn, locale);
        return dg ? (
          <div className="text-[13px] text-ink-700 mt-4 leading-relaxed bg-canvas border border-ink-100 rounded-btn p-4 whitespace-pre-wrap">
            {dg}
          </div>
        ) : null;
      })()}
      {category.designGuideFileUrl && (
        <a
          href={category.designGuideFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-pill border-2 border-brand-500 text-brand-500 font-bold text-[13px] hover:bg-brand-500 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          {isEn ? "Download design guide PDF" : "디자인 가이드 PDF 다운로드"}
        </a>
      )}
    </section>
  );
}
