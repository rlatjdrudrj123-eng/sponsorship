"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/types";

type Props = {
  current: Category;
  all: Category[];
};

export function CategoryPageNav({ current, all }: Props) {
  const router = useRouter();
  const sorted = [...all]
    .filter((c) => c.isPublished)
    .sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((c) => c.id === current.id);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft" && prev) {
        router.push(`/sponsorships/${prev.slug}`);
      }
      if (e.key === "ArrowRight" && next) {
        router.push(`/sponsorships/${next.slug}`);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  return (
    <div className="border-t border-ink-100 bg-white">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between gap-3">
        {prev ? (
          <Link
            href={`/sponsorships/${prev.slug}`}
            className="flex items-center gap-2 text-[13px] text-ink-700 hover:text-brand-700 group"
          >
            <ChevronLeft className="w-4 h-4 text-ink-300 group-hover:text-brand-700" />
            <div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider">이전</div>
              <div className="font-bold">{prev.name.ko}</div>
            </div>
          </Link>
        ) : (
          <span />
        )}
        <Link
          href="/sponsorships"
          className="text-[12px] text-ink-500 hover:text-ink-900"
        >
          전체 보기
        </Link>
        {next ? (
          <Link
            href={`/sponsorships/${next.slug}`}
            className="flex items-center gap-2 text-[13px] text-ink-700 hover:text-brand-700 group text-right"
          >
            <div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider">다음</div>
              <div className="font-bold">{next.name.ko}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-brand-700" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
