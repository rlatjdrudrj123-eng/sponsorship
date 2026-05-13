"use client";

import { Quote } from "lucide-react";

type CaseStudy = {
  company: string;
  year?: string;
  quote?: string;
  logoUrl?: string;
};

export function CaseStudies({ items }: { items: CaseStudy[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-surface border border-ink-100 rounded-card p-6 md:p-8 shadow-card">
      <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3 flex items-center gap-2">
        <span className="w-4 h-px bg-brand-500" />
        case study
      </div>
      <h3 className="text-[20px] md:text-[24px] font-bold text-ink-900 mb-6 tracking-tight">
        이 자리를 선택한 회사들
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((c, i) => (
          <div
            key={i}
            className="bg-canvas border border-ink-100 rounded-btn p-4 flex gap-3 hover:border-brand-500 transition-colors"
          >
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.logoUrl}
                alt={c.company}
                className="w-12 h-12 rounded object-contain border border-ink-100 shrink-0 bg-white"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-ink-50 border border-ink-100 grid place-items-center shrink-0">
                <span className="text-[10px] text-ink-300 font-mono">LOGO</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-[14px] text-ink-900 truncate">
                  {c.company}
                </span>
                {c.year && (
                  <span className="text-[10px] text-ink-500 font-mono shrink-0">
                    {c.year}
                  </span>
                )}
              </div>
              {c.quote && (
                <div className="mt-1.5 flex gap-1.5">
                  <Quote className="w-3 h-3 text-brand-500 shrink-0 mt-1" />
                  <p className="text-[12px] text-ink-700 leading-relaxed">
                    {c.quote}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
