"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { Category } from "@/lib/types";

type Props = {
  category: Category | null;
};

export function LivePreview({ category }: Props) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-ink-100 bg-ink-50 flex items-center gap-2">
        <h3 className="text-[12px] font-bold text-ink-700 uppercase tracking-wide">미리보기</h3>
        <div className="ml-auto flex gap-1 bg-white rounded-btn p-0.5 border border-ink-100">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={
              "p-1 rounded " +
              (device === "desktop" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900")
            }
            aria-label="데스크톱"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={
              "p-1 rounded " +
              (device === "mobile" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900")
            }
            aria-label="모바일"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div
          className={
            "bg-ink-900 text-white rounded-btn overflow-hidden relative " +
            (device === "desktop" ? "aspect-[16/10]" : "aspect-[9/16] max-w-[160px] mx-auto")
          }
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 via-transparent to-transparent" />
          <div className="relative p-4">
            <div className="text-[10px] uppercase tracking-widest text-brand-500 mb-1.5">
              K-PRINT 2026
            </div>
            <div className="text-[16px] font-bold leading-tight">
              {category?.name.ko ?? "카테고리 이름"}
            </div>
            <div className="text-[10px] text-ink-300 mt-1 line-clamp-2">
              {category?.shortDesc ?? "한 줄 설명이 여기에 표시됩니다."}
            </div>
            <div className="mt-3 flex gap-1 flex-wrap">
              {(category?.tags ?? []).slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[8px] px-1.5 py-0.5 rounded-full border border-white/20 text-white/80"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-ink-300 text-center mt-2">
          축소 미리보기 — 정밀한 미리보기는 STEP 12 공개 사이트에서.
        </p>
      </div>
    </div>
  );
}
