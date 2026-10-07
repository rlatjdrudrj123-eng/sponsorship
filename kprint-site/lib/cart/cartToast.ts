"use client";

import { create } from "zustand";

/**
 * 카트 담기 완료 토스트 — 전역 상태.
 *
 * - 담기 성공 지점(SlotPicker·PackageType)에서 showCartToast() 호출.
 * - 화면 표시는 components/public/CartToast.tsx 가 document.body 포털로 맡는다.
 *   공개 레이아웃에 전역 호스트를 둘 수 없어 담기 UI 가 각자 <CartToast /> 를 렌더하고,
 *   그중 먼저 마운트된 호스트 하나만 실제로 그린다(hosts[0]) — 중복 표시·중복 낭독 방지.
 * - 2.5초 뒤 자동으로 닫힘. 마우스를 올리거나 링크에 포커스가 있으면 멈췄다가,
 *   벗어나면 다시 2.5초.
 */

const DURATION_MS = 2500;

type CartToastState = {
  /** 표시 중인 토스트. id 는 연달아 담을 때 새 알림으로 읽히도록 key 로 쓴다. */
  toast: { id: number } | null;
  /** 마운트된 <CartToast /> 호스트 id 목록 — 첫 번째만 렌더 */
  hosts: string[];
  show: () => void;
  hide: () => void;
  pause: () => void;
  resume: () => void;
  registerHost: (id: string) => void;
  unregisterHost: (id: string) => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

export const useCartToast = create<CartToastState>()((set, get) => {
  const arm = () => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      set({ toast: null });
    }, DURATION_MS);
  };

  return {
    toast: null,
    hosts: [],
    show: () => {
      seq += 1;
      set({ toast: { id: seq } });
      arm();
    },
    hide: () => {
      clearTimer();
      set({ toast: null });
    },
    pause: () => clearTimer(),
    resume: () => {
      if (get().toast) arm();
    },
    registerHost: (id) =>
      set((s) => (s.hosts.includes(id) ? s : { hosts: [...s.hosts, id] })),
    unregisterHost: (id) =>
      set((s) => ({ hosts: s.hosts.filter((h) => h !== id) })),
  };
});

/** 담기 성공 직후 호출 — "카트에 담았습니다 · 카트 보기" */
export function showCartToast() {
  useCartToast.getState().show();
}
