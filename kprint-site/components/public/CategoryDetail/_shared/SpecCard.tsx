"use client";

import { Download } from "lucide-react";
import type { Category } from "@/lib/types";

export function SpecCard({ category }: { category: Category }) {
  const items: Array<{ label: string; value: React.ReactNode }> = [];

  if (category.size) items.push({ label: "사이즈", value: category.size });
  if (category.fileFormat)
    items.push({ label: "파일 형식", value: category.fileFormat });
  if (category.deadline)
    items.push({
      label: "입고 마감",
      value: category.deadline.toDate().toLocaleDateString("ko-KR"),
    });

  if (category.videoSpec) {
    if (category.videoSpec.duration)
      items.push({ label: "영상 길이", value: `${category.videoSpec.duration}초` });
    if (category.videoSpec.resolution)
      items.push({ label: "해상도", value: category.videoSpec.resolution });
    if (category.videoSpec.plays)
      items.push({
        label: "송출 횟수",
        value: `${category.videoSpec.plays.toLocaleString()}회`,
      });
  }

  if (category.mailingSpec) {
    if (category.mailingSpec.audience)
      items.push({
        label: "발송 대상",
        value: `${category.mailingSpec.audience.toLocaleString()}명${
          category.mailingSpec.audienceLabel
            ? ` (${category.mailingSpec.audienceLabel})`
            : ""
        }`,
      });
    if (category.mailingSpec.sendDates?.length)
      items.push({
        label: "발송 예정일",
        value: category.mailingSpec.sendDates.join(", "),
      });
  }

  if (category.contentSpec) {
    items.push({ label: "채널", value: category.contentSpec.channel });
    items.push({ label: "포맷", value: category.contentSpec.format });
  }

  if (items.length === 0 && !category.designGuideText && !category.designGuideFileUrl) {
    return null;
  }

  return (
    <section className="bg-[#fafaf7] border border-ink-100 rounded-card p-6 md:p-8">
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-brand-700 font-bold mb-4">
        스펙
      </h3>
      {items.length > 0 && (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-4">
          {items.map((it, i) => (
            <div key={i} className="flex border-b border-ink-100/70 pb-2.5">
              <dt className="text-[12px] text-ink-500 w-24 shrink-0">{it.label}</dt>
              <dd className="text-[13px] text-ink-900 font-mono flex-1">{it.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {category.designGuideText && (
        <div className="text-[13px] text-ink-700 mt-4 leading-relaxed bg-white border border-ink-100 rounded-btn p-4 whitespace-pre-wrap">
          {category.designGuideText}
        </div>
      )}
      {category.designGuideFileUrl && (
        <a
          href={category.designGuideFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-btn border border-brand-500 text-brand-700 font-semibold text-[13px] hover:bg-brand-50"
        >
          <Download className="w-4 h-4" />
          디자인 가이드 PDF 다운로드
        </a>
      )}
    </section>
  );
}
