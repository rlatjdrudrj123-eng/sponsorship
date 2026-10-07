"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { useCartToast } from "@/lib/cart/cartToast";
import { localeHref, useLocale } from "@/lib/i18n/locale";

/**
 * 카트 담기 완료 토스트 — "카트에 담았습니다 · 카트 보기".
 *
 * 화면 하단 중앙, 2.5초 뒤 자동으로 사라짐 (상태·타이머는 lib/cart/cartToast).
 * 모달 안에서 렌더돼도 가려지지 않도록 document.body 로 포털.
 * 여러 곳에서 렌더돼도 먼저 마운트된 하나만 그린다.
 */
export function CartToast() {
  const hostId = useId();
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const locale = useLocale((s) => s.locale);

  const toast = useCartToast((s) => s.toast);
  const isPrimary = useCartToast((s) => s.hosts[0] === hostId);
  const registerHost = useCartToast((s) => s.registerHost);
  const unregisterHost = useCartToast((s) => s.unregisterHost);
  const hide = useCartToast((s) => s.hide);
  const pause = useCartToast((s) => s.pause);
  const resume = useCartToast((s) => s.resume);

  // document.body 는 마운트 이후에만 접근 (SSR·하이드레이션 불일치 방지)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    registerHost(hostId);
    return () => {
      unregisterHost(hostId);
      // 마우스를 올려 둔 채(타이머 멈춤) 호스트가 사라지는 경우 — 타이머를 다시 건다
      resume();
    };
  }, [hostId, registerHost, unregisterHost, resume]);

  if (!mounted || !isPrimary) return null;

  const isEn = locale === "en";

  // 라이브 영역은 비어 있어도 늘 DOM 에 둔다 — 내용이 들어오는 순간을 스크린리더가 읽는다.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-5 md:bottom-8 z-[100] flex justify-center px-4 pointer-events-none"
    >
      {toast && (
        <div
          key={toast.id}
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
          className="pointer-events-auto max-w-full bg-ink-900 text-white rounded-pill pl-3 pr-1.5 py-1.5 shadow-2xl flex items-center gap-2.5 text-[13px]"
        >
          <span
            aria-hidden="true"
            className="w-5 h-5 rounded-full bg-brand-500 grid place-items-center shrink-0"
          >
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
          <span className="font-semibold whitespace-nowrap">
            {isEn ? "Added to cart" : "카트에 담았습니다"}
          </span>
          <span aria-hidden="true" className="text-white/40">
            ·
          </span>
          <Link
            href={localeHref(eventId, "/cart", locale)}
            onClick={hide}
            className="px-3 py-1.5 rounded-pill font-bold whitespace-nowrap underline underline-offset-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {isEn ? "View cart" : "카트 보기"}
          </Link>
        </div>
      )}
    </div>,
    document.body
  );
}
