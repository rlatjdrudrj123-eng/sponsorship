"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem } from "../types";
import * as clarity from "@/lib/clarity";

type SlotItem = Extract<CartItem, { type: "slot" }>;
type PackageItem = Extract<CartItem, { type: "package" }>;

type CartState = {
  items: CartItem[];
  hasHydrated: boolean;
  setHasHydrated: (h: boolean) => void;
  addSlot: (slot: SlotItem) => void;
  removeSlot: (slotId: string) => void;
  toggleSlot: (slot: SlotItem) => void;
  addPackage: (pkg: PackageItem) => void;
  removePackage: (packageId: string) => void;
  togglePackage: (pkg: PackageItem) => void;
  hasSlot: (slotId: string) => boolean;
  hasPackage: (packageId: string) => boolean;
  /**
   * 특정 행사의 카트 항목만 비웁니다. 다중 행사 격리를 위해 eventId 필수.
   * eventId 미지정 시(레거시 안전망)에는 store 전체를 비우지 않고 아무 동작도 하지 않습니다.
   */
  clear: (eventId: string) => void;
  subtotal: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      setHasHydrated: (h) => set({ hasHydrated: h }),

      addSlot: (slot) => {
        set((s) => ({
          items: [
            ...s.items.filter(
              (i) => !(i.type === "slot" && i.slotId === slot.slotId)
            ),
            slot,
          ],
        }));
        clarity.event("cart_slot_added");
        clarity.tag("last_added_slot_code", slot.code);
      },

      removeSlot: (slotId) => {
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.type === "slot" && i.slotId === slotId)
          ),
        }));
        clarity.event("cart_slot_removed");
      },

      toggleSlot: (slot) => {
        if (get().hasSlot(slot.slotId)) get().removeSlot(slot.slotId);
        else get().addSlot(slot);
      },

      addPackage: (pkg) => {
        set((s) => ({
          items: [
            ...s.items.filter(
              (i) => !(i.type === "package" && i.packageId === pkg.packageId)
            ),
            pkg,
          ],
        }));
        clarity.event("cart_package_added");
        clarity.tag("last_added_package_code", pkg.code);
      },

      removePackage: (packageId) => {
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.type === "package" && i.packageId === packageId)
          ),
        }));
        clarity.event("cart_package_removed");
      },

      togglePackage: (pkg) => {
        if (get().hasPackage(pkg.packageId)) get().removePackage(pkg.packageId);
        else get().addPackage(pkg);
      },

      hasSlot: (slotId) =>
        get().items.some((i) => i.type === "slot" && i.slotId === slotId),

      hasPackage: (packageId) =>
        get().items.some(
          (i) => i.type === "package" && i.packageId === packageId
        ),

      clear: (eventId) =>
        set((s) => ({
          items: eventId
            ? s.items.filter((i) => i.eventId !== eventId)
            : s.items,
        })),

      subtotal: () => get().items.reduce((sum, i) => sum + i.price, 0),
    }),
    {
      name: "kprint:cart:v1",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
