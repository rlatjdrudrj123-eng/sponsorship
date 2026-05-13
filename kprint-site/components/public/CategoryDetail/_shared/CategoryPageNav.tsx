"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/types";

type Props = {
  current: Category;
  all: Category[];
};

export function CategoryPageNav({ current, all }: Props) {
  const router = useRouter();
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";

  const sorted = [...all]
    .filter((c) => c.isPublished)
    .sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((c) => c.id === current.id);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  const base = eventId ? `/${eventId}` : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft" && prev) {
        router.push(`${base}/sponsorships/${prev.slug}`);
      }
      if (e.key === "ArrowRight" && next) {
        router.push(`${base}/sponsorships/${next.slug}`);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prev, next, router, base]);

  return (
    <div className="border-t border-ink-100 bg-surface">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8 flex items-center justify-between gap-3">
        {prev ? (
          <Link
            href={`${base}/sponsorships/${prev.slug}`}
            className="flex items-center gap-3 text-[13px] text-ink-700 hover:text-brand-500 group"
          >
            <ChevronLeft className="w-5 h-5 text-ink-300 group-hover:text-brand-500 group-hover:-translate-x-0.5 transition-all" />
            <div>
              <div className="text-[10px] text-ink-500 uppercase tracking-[0.2em] font-num font-bold">
                이전
              </div>
              <div className="font-bold mt-0.5">{prev.name.ko}</div>
            </div>
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={`${base}/sponsorships`}
          className="text-[12px] text-ink-500 hover:text-brand-500 font-num font-semibold"
        >
          전체 보기
        </Link>
        {next ? (
          <Link
            href={`${base}/sponsorships/${next.slug}`}
            className="flex items-center gap-3 text-[13px] text-ink-700 hover:text-brand-500 group text-right"
          >
            <div>
              <div className="text-[10px] text-ink-500 uppercase tracking-[0.2em] font-num font-bold">
                다음
              </div>
              <div className="font-bold mt-0.5">{next.name.ko}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
