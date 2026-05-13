"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ShoppingBag } from "lucide-react";
import type { Category, Package, Persona, Slot, Subcategory } from "@/lib/types";
import { useCartStore } from "@/lib/cart/cartStore";

/**
 * 페르소나 선택 시 결과 영역 상단에 노출되는 추천 배너.
 *
 * 페르소나의 recommendedCombo (어드민 큐레이션) 가 있으면 그걸,
 * 없으면 자동 생성 (가장 매칭되는 카테고리 1~3개 + 패키지 1개).
 *
 * "한 번에 카트 담기" — 추천 콤보의 모든 슬롯/패키지를 카트에 일괄 추가.
 */
export function PersonaRecommendation({
  persona,
  categories,
  subcategories,
  slots,
  packages,
  eventId,
}: {
  persona: Persona;
  categories: Category[];
  subcategories: Subcategory[];
  slots: Slot[];
  packages: Package[];
  eventId: string;
}) {
  const addSlot = useCartStore((s) => s.addSlot);
  const addPackage = useCartStore((s) => s.addPackage);
  const hasSlot = useCartStore((s) => s.hasSlot);
  const hasPackage = useCartStore((s) => s.hasPackage);

  const [added, setAdded] = useState<string[]>([]);

  // 콤보 산출 — 어드민 큐레이션 우선
  const combo = useMemo(() => {
    const auto = !persona.recommendedCombo;
    const cfg = persona.recommendedCombo ?? {};

    // 카테고리 결정
    let comboCategories: Category[] = [];
    if (cfg.categorySlugs && cfg.categorySlugs.length > 0) {
      comboCategories = cfg.categorySlugs
        .map((slug) => categories.find((c) => c.slug === slug))
        .filter((c): c is Category => !!c);
    } else if (auto) {
      // 자동 — 페르소나 매칭 + 가격 낮은 순 상위 3
      const matched = categories.filter((c) => matchesByPersonaIds(c, persona));
      comboCategories = matched.slice(0, 3);
    }

    // 패키지 결정
    let comboPackages: Package[] = [];
    if (cfg.packageIds && cfg.packageIds.length > 0) {
      comboPackages = cfg.packageIds
        .map((id) => packages.find((p) => p.id === id))
        .filter((p): p is Package => !!p);
    } else if (auto && persona.packageTier) {
      const p = packages.find((pk) => pk.tier === persona.packageTier);
      if (p) comboPackages = [p];
    }

    // 각 카테고리에서 가용 슬롯 1개씩 (최저가 소분류 기준)
    type Pick = {
      kind: "slot" | "package";
      key: string; // 카트 store에 추가될 때 식별자
      categoryId?: string;
      subcategoryId?: string;
      slotId?: string;
      packageId?: string;
      code: string;
      label: string;
      sublabel?: string;
      price: number;
      eventId: string;
    };
    const picks: Pick[] = [];

    for (const c of comboCategories) {
      const subs = subcategories
        .filter((s) => s.categoryId === c.id)
        .sort((a, b) => a.priceKRW - b.priceKRW);
      if (subs.length === 0) continue;
      const sub = subs[0];
      const slot = slots.find(
        (s) => s.subcategoryId === sub.id && s.status === "available"
      );
      if (!slot) continue;
      picks.push({
        kind: "slot",
        key: `slot:${slot.id}`,
        categoryId: c.id,
        subcategoryId: sub.id,
        slotId: slot.id,
        code: slot.code,
        label: c.name.ko,
        sublabel: sub.name.ko,
        price: sub.priceKRW,
        eventId: c.eventId,
      });
    }

    for (const p of comboPackages) {
      picks.push({
        kind: "package",
        key: `pkg:${p.id}`,
        packageId: p.id,
        code: p.code,
        label: p.name.ko,
        sublabel: p.tier === "signature" ? "Signature" : "Standard",
        price: p.discountPrice || p.originalPrice,
        eventId,
      });
    }

    const total = picks.reduce((sum, p) => sum + p.price, 0);

    return {
      auto,
      headline: cfg.headline ?? "당신 같은 회사가 보통 이렇게 합니다",
      rationale: cfg.rationale,
      picks,
      total,
      expectedKRW: cfg.expectedKRW,
    };
  }, [
    persona,
    categories,
    subcategories,
    slots,
    packages,
    eventId,
  ]);

  const addAll = () => {
    const newlyAdded: string[] = [];
    for (const p of combo.picks) {
      if (p.kind === "slot" && p.slotId && p.categoryId && p.subcategoryId) {
        if (hasSlot(p.slotId)) continue;
        addSlot({
          type: "slot",
          eventId: p.eventId,
          slotId: p.slotId,
          categoryId: p.categoryId,
          subcategoryId: p.subcategoryId,
          code: p.code,
          price: p.price,
        });
        newlyAdded.push(p.key);
      } else if (p.kind === "package" && p.packageId) {
        if (hasPackage(p.packageId)) continue;
        addPackage({
          type: "package",
          eventId: p.eventId,
          packageId: p.packageId,
          code: p.code,
          price: p.price,
        });
        newlyAdded.push(p.key);
      }
    }
    setAdded((prev) => {
      const merged = prev.concat(newlyAdded);
      return merged.filter((v, i) => merged.indexOf(v) === i);
    });
    setTimeout(() => setAdded([]), 2500);
  };

  if (combo.picks.length === 0) return null;

  const allInCart = combo.picks.every((p) => {
    if (p.kind === "slot" && p.slotId) return hasSlot(p.slotId);
    if (p.kind === "package" && p.packageId) return hasPackage(p.packageId);
    return false;
  });

  return (
    <div className="mb-6 bg-surface border-2 border-brand-500 rounded-card overflow-hidden shadow-glow-sm">
      {/* 헤더 */}
      <div className="bg-brand-grad text-white px-5 md:px-7 py-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-num text-[10.5px] uppercase tracking-[0.3em] text-white/80 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            {persona.title} · 추천 코스
            {combo.auto && (
              <span className="ml-1.5 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                자동 생성
              </span>
            )}
          </div>
          <h3 className="text-[18px] md:text-[22px] font-bold mt-1 leading-tight">
            {combo.headline}
          </h3>
          {combo.rationale && (
            <p className="text-[12px] text-white/85 mt-1 max-w-xl">
              {combo.rationale}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="font-num text-[10px] uppercase tracking-widest text-white/70 font-bold">
            예상 합계
          </div>
          <div className="font-num text-[20px] md:text-[24px] font-bold leading-none mt-1">
            {(combo.expectedKRW ?? combo.total).toLocaleString()}
            <span className="text-[12px] ml-1 font-semibold">원</span>
          </div>
          <div className="text-[10px] text-white/70 mt-0.5">부가세 별도</div>
        </div>
      </div>

      {/* 콤보 항목들 */}
      <div className="px-5 md:px-7 py-4">
        <ul className="space-y-2.5">
          {combo.picks.map((p) => {
            const inCart =
              p.kind === "slot" && p.slotId
                ? hasSlot(p.slotId)
                : p.kind === "package" && p.packageId
                  ? hasPackage(p.packageId)
                  : false;
            const justAdded = added.includes(p.key);
            return (
              <li
                key={p.key}
                className="flex items-center gap-3 text-[13px] border-b border-ink-100 pb-2.5 last:border-b-0"
              >
                <span
                  className={
                    "w-5 h-5 grid place-items-center rounded-full shrink-0 transition-colors " +
                    (inCart
                      ? "bg-brand-500 text-white"
                      : "border border-ink-300 text-ink-300")
                  }
                >
                  {inCart ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-ink-900">{p.label}</span>
                  {p.sublabel && (
                    <span className="text-ink-500 ml-1.5">· {p.sublabel}</span>
                  )}
                  <span className="font-num text-[10.5px] text-ink-300 ml-2">
                    {p.code}
                  </span>
                </div>
                <span className="font-num text-[12.5px] font-bold text-ink-900 shrink-0">
                  {p.price.toLocaleString()}원
                </span>
                {justAdded && (
                  <span className="text-[10px] text-brand-500 font-num font-bold animate-pulse">
                    +담음
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <Link
            href={`/${eventId}/compare?ids=${encodeURIComponent(
              combo.picks.map((p) => p.key).join(",")
            )}`}
            className="text-[12px] text-ink-500 hover:text-ink-900 font-semibold underline-offset-2 hover:underline"
          >
            나란히 비교해서 보기 →
          </Link>
          <button
            type="button"
            onClick={addAll}
            disabled={allInCart}
            className={
              "px-5 py-2.5 rounded-pill font-bold text-[13px] flex items-center gap-2 transition-all " +
              (allInCart
                ? "bg-ink-100 text-ink-500 cursor-not-allowed"
                : "bg-brand-500 text-white hover:bg-brand-700 hover:shadow-glow-sm")
            }
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {allInCart
              ? "모두 카트에 담겨있어요"
              : `이 ${combo.picks.length}개 한 번에 카트 담기`}
          </button>
        </div>
      </div>
    </div>
  );
}

function matchesByPersonaIds(c: Category, p: Persona): boolean {
  if (c.personas && c.personas.length > 0) {
    return c.personas.includes(p.id);
  }
  if (p.targetTags && p.targetTags.length > 0) {
    return p.targetTags.some((t) => (c.tags ?? []).includes(t));
  }
  return false;
}
