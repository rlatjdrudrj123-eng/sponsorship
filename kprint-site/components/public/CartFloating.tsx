"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useCartStore } from "@/lib/cart/cartStore";

export function CartFloating() {
  const items = useCartStore((s) => s.items);
  const hydrated = useCartStore((s) => s.hasHydrated);

  if (!hydrated || items.length === 0) return null;

  return (
    <Link
      href="/cart"
      className="fixed bottom-6 right-6 z-40 bg-brand-500 text-ink-900 hover:bg-brand-700 hover:text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-2.5 font-semibold transition-colors"
    >
      <div className="relative">
        <Bookmark className="w-5 h-5" fill="currentColor" />
        <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 bg-ink-900 text-white text-[10px] rounded-full grid place-items-center font-bold">
          {items.length}
        </span>
      </div>
      <span className="text-[13px]">관심 항목 보기</span>
    </Link>
  );
}
