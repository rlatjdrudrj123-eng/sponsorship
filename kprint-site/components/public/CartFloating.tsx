"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/lib/cart/cartStore";

export function CartFloating() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const hydrated = useCartStore((s) => s.hasHydrated);

  if (!hydrated || items.length === 0) return null;

  return (
    <Link
      href="/cart"
      className="fixed bottom-6 right-6 z-40 bg-mint-500 text-ink-900 hover:bg-mint-700 hover:text-white px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-3 font-semibold transition-colors"
    >
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 w-5 h-5 bg-ink-900 text-white text-[10px] rounded-full grid place-items-center font-bold">
          {items.length}
        </span>
      </div>
      <span className="text-[14px] font-mono">{subtotal.toLocaleString()}원</span>
    </Link>
  );
}
