"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ImageSlot } from "@/lib/types";

type Props = {
  slot: ImageSlot | undefined;
  className?: string;
  aspectRatio?: string;
};

export function ImageCarousel({ slot, className = "", aspectRatio = "aspect-[4/3]" }: Props) {
  const images = slot?.images ?? [];
  const mode = slot?.mode ?? "carousel";
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className={`${aspectRatio} bg-ink-100 rounded-card grid place-items-center text-ink-300 text-sm ${className}`}
      >
        이미지 준비 중
      </div>
    );
  }

  if (mode === "single" || images.length === 1) {
    const img = images[0];
    return (
      <figure className={className}>
        <div className={`${aspectRatio} bg-ink-100 rounded-card overflow-hidden`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption ?? ""}
            className="w-full h-full object-cover"
          />
        </div>
        {img.caption && (
          <figcaption className="mt-2 text-[11px] text-ink-500">{img.caption}</figcaption>
        )}
      </figure>
    );
  }

  if (mode === "gallery") {
    return (
      <div className={className}>
        <div className={`${aspectRatio} bg-ink-100 rounded-card overflow-hidden mb-2`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[idx].url}
            alt={images[idx].caption ?? ""}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.storagePath}
              type="button"
              onClick={() => setIdx(i)}
              className={
                "aspect-square rounded overflow-hidden border-2 " +
                (idx === i
                  ? "border-brand-500"
                  : "border-transparent opacity-60 hover:opacity-100")
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {images[idx].caption && (
          <p className="mt-2 text-[11px] text-ink-500">{images[idx].caption}</p>
        )}
      </div>
    );
  }

  // carousel
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  return (
    <div className={`relative ${className}`}>
      <div className={`${aspectRatio} bg-ink-100 rounded-card overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[idx].url}
          alt={images[idx].caption ?? ""}
          className="w-full h-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow grid place-items-center"
            aria-label="이전"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow grid place-items-center"
            aria-label="다음"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={
                  "w-1.5 h-1.5 rounded-full transition-colors " +
                  (idx === i ? "bg-white" : "bg-white/40 hover:bg-white/70")
                }
                aria-label={`${i + 1}번 이미지`}
              />
            ))}
          </div>
        </>
      )}
      {images[idx].caption && (
        <p className="mt-2 text-[11px] text-ink-500">{images[idx].caption}</p>
      )}
    </div>
  );
}
