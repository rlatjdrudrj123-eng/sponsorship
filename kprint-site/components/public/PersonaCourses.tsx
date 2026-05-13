"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { Category, Package, Persona } from "@/lib/types";

/**
 * 페르소나 추천 코스 — sponsorships 페이지 상단.
 *
 * Firestore의 personas 콜렉션에서 로드.
 * 카테고리는 두 가지 방식으로 페르소나에 매칭:
 *  (1) Category.personas 배열에 페르소나 ID가 있으면 (명시적·우선)
 *  (2) 그렇지 않으면 페르소나의 targetTags 와 Category.tags 교집합 (휴리스틱)
 */

export type PersonaPick = { id: string; persona: Persona };

export function PersonaCourses({
  personas,
  categories,
  packages,
  selectedPersonaId,
  onPick,
  onClear,
}: {
  personas: Persona[];
  categories: Category[];
  packages: Package[];
  selectedPersonaId: string | null;
  onPick: (pick: PersonaPick) => void;
  onClear: () => void;
}) {
  // 페르소나별로 매칭되는 카테고리·패키지 개수 카운트
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    personas.forEach((p) => {
      const cats = categories.filter((c) => matchesPersona(c, p));
      const pkgs = packages.filter((pkg) =>
        p.packageTier ? pkg.tier === p.packageTier : false
      );
      result[p.id] = cats.length + pkgs.length;
    });
    return result;
  }, [personas, categories, packages]);

  if (personas.length === 0) return null;

  return (
    <section className="bg-canvas border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-6 md:px-16 py-10 md:py-12">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
          <div>
            <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold flex items-center gap-2">
              <span className="w-6 h-px bg-brand-500" />
              persona course
            </div>
            <h2 className="text-[22px] md:text-[28px] font-bold text-ink-900 mt-2 tracking-tight">
              어떤 회사세요?
            </h2>
            <p className="text-[13px] md:text-[14px] text-ink-500 mt-1.5">
              본인 상황과 가장 가까운 카드를 선택하시면 그에 맞는 스폰서십을 추려드려요.
            </p>
          </div>
          {selectedPersonaId && (
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] text-ink-500 hover:text-ink-900 font-semibold underline-offset-2 hover:underline"
            >
              전체 다시 보기
            </button>
          )}
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
          }}
        >
          {personas
            .filter((p) => p.isActive)
            .sort((a, b) => a.order - b.order)
            .map((p) => {
              const active = selectedPersonaId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick({ id: p.id, persona: p })}
                  className={
                    "group text-left p-5 rounded-card border-2 transition-all flex flex-col h-full " +
                    (active
                      ? "bg-brand-500 border-brand-500 text-white shadow-glow-sm"
                      : "bg-surface border-ink-100 text-ink-900 hover:border-brand-500 hover:shadow-card")
                  }
                >
                  <div className="text-[26px] mb-2">{p.emoji}</div>
                  <div className="text-[14px] font-bold leading-tight tracking-tight">
                    {p.title}
                  </div>
                  <p
                    className={
                      "text-[11.5px] mt-2 leading-snug flex-1 " +
                      (active ? "text-white/85" : "text-ink-500")
                    }
                  >
                    {p.description}
                  </p>
                  <div
                    className={
                      "mt-4 flex items-center justify-between text-[10.5px] font-num font-bold " +
                      (active ? "text-white" : "text-ink-300 group-hover:text-brand-500")
                    }
                  >
                    <span>{counts[p.id] ?? 0}개 매칭</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </section>
  );
}

// 카테고리가 페르소나에 매칭되는지 — 명시적 personas 우선, 없으면 targetTags 휴리스틱
export function matchesPersona(c: Category, p: Persona): boolean {
  if (c.personas && c.personas.length > 0) {
    if (!c.personas.includes(p.id)) return false;
  } else {
    if (!p.targetTags || p.targetTags.length === 0) return false;
    const hasTag = p.targetTags.some((t) => (c.tags ?? []).includes(t));
    if (!hasTag) return false;
  }
  if (p.budgetMax !== undefined) {
    // minPrice는 enriched 단계에서 계산되므로 여기서는 체크 X (호출부에서 추가 필터)
  }
  return true;
}
