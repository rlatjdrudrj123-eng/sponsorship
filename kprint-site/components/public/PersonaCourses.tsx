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
    <section className="bg-[#fafaf7] border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-6 md:px-16 py-8 md:py-10">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-mint-700 font-bold">
              persona course
            </div>
            <h2 className="text-[18px] md:text-[22px] font-bold text-ink-900 mt-1.5">
              어떤 회사세요?
            </h2>
            <p className="text-[12px] md:text-[13px] text-ink-500 mt-1">
              본인 상황과 가장 가까운 카드를 선택하시면 그에 맞는 스폰서십을 추려드려요.
            </p>
          </div>
          {selectedPersonaId && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11.5px] text-ink-500 hover:text-ink-900 font-semibold"
            >
              전체 다시 보기
            </button>
          )}
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
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
                    "group text-left p-4 rounded-card border-2 transition-all flex flex-col h-full " +
                    (active
                      ? "bg-mint-500 border-mint-500 text-ink-900 shadow-md"
                      : "bg-white border-ink-100 text-ink-900 hover:border-mint-500 hover:shadow-sm")
                  }
                >
                  <div className="text-[22px] mb-2">{p.emoji}</div>
                  <div className="text-[13.5px] font-bold leading-tight">
                    {p.title}
                  </div>
                  <p
                    className={
                      "text-[11px] mt-2 leading-snug flex-1 " +
                      (active ? "text-ink-900/80" : "text-ink-500")
                    }
                  >
                    {p.description}
                  </p>
                  <div
                    className={
                      "mt-3 flex items-center justify-between text-[10px] font-mono " +
                      (active ? "text-ink-900" : "text-ink-300 group-hover:text-mint-700")
                    }
                  >
                    <span>{counts[p.id] ?? 0}개 매칭</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
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
