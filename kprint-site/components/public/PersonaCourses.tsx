"use client";

import { useMemo } from "react";
import { ArrowRight, Users } from "lucide-react";
import type { Category, Package, Persona } from "@/lib/types";

/**
 * 페르소나 추천 코스 — sponsorships 페이지 상단.
 *
 * 단순 필터가 아니라:
 *  - 사회적 증거 (작년 N곳이 선택)
 *  - 예산 anchor (평균 ○○만원)
 *  - 추천 콤보 (선택 시 결과 배너에 narration + 한 번에 카트 담기)
 *
 * Firestore 의 personas 컬렉션에서 로드.
 * 카테고리 매칭: Category.personas 명시 우선, 없으면 targetTags 휴리스틱.
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

  const active = personas.find((p) => p.id === selectedPersonaId) ?? null;

  return (
    <section className="bg-canvas border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-6 md:px-16 py-10 md:py-12">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
          <div>
            <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold flex items-center gap-2">
              <span className="w-6 h-px bg-brand-500" />
              어떤 회사세요?
            </div>
            <h2 className="text-[24px] md:text-[32px] font-bold text-ink-900 mt-2 tracking-tight">
              상황에 맞는 스폰서십을 추려드릴게요
            </h2>
            <p className="text-[13px] md:text-[14px] text-ink-500 mt-1.5 max-w-xl">
              가장 가까운 카드를 고르면 사이드바 필터가 자동 적용되고, 그 페르소나가
              작년 어떤 조합을 선택했는지 보여드려요. 그대로 카트에 담을 수도 있어요.
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
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
          }}
        >
          {personas
            .filter((p) => p.isActive)
            .sort((a, b) => a.order - b.order)
            .map((p) => {
              const isActive = selectedPersonaId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick({ id: p.id, persona: p })}
                  className={
                    "group text-left p-5 rounded-card border-2 transition-all flex flex-col h-full " +
                    (isActive
                      ? "bg-brand-500 border-brand-500 text-white shadow-glow-sm"
                      : "bg-surface border-ink-100 text-ink-900 hover:border-brand-500 hover:shadow-card")
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[28px]">{p.emoji}</div>
                    <span
                      className={
                        "font-num text-[10.5px] font-bold " +
                        (isActive ? "text-white/85" : "text-ink-300")
                      }
                    >
                      {counts[p.id] ?? 0}개 매칭
                    </span>
                  </div>
                  <div className="text-[15px] font-bold leading-tight tracking-tight mt-2">
                    {p.title}
                  </div>
                  <p
                    className={
                      "text-[12px] mt-2 leading-snug flex-1 " +
                      (isActive ? "text-white/85" : "text-ink-500")
                    }
                  >
                    {p.description}
                  </p>

                  {(p.socialProofNote || p.budgetNote) && (
                    <div
                      className={
                        "mt-3 pt-3 border-t space-y-1 " +
                        (isActive ? "border-white/25" : "border-ink-100")
                      }
                    >
                      {p.socialProofNote && (
                        <div
                          className={
                            "flex items-start gap-1.5 text-[11px] leading-snug " +
                            (isActive ? "text-white" : "text-ink-700")
                          }
                        >
                          <Users
                            className="w-3 h-3 mt-0.5 shrink-0"
                            strokeWidth={2.5}
                          />
                          <span>{p.socialProofNote}</span>
                        </div>
                      )}
                      {p.budgetNote && (
                        <div
                          className={
                            "text-[10.5px] font-num " +
                            (isActive ? "text-white/85" : "text-ink-500")
                          }
                        >
                          💰 {p.budgetNote}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={
                      "mt-3 flex items-center justify-end text-[11px] font-num font-bold " +
                      (isActive
                        ? "text-white"
                        : "text-ink-300 group-hover:text-brand-500")
                    }
                  >
                    {isActive ? (
                      <span>선택됨 ✓</span>
                    ) : (
                      <>
                        이 페르소나로 보기
                        <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </div>
                </button>
              );
            })}
        </div>

        {/* 선택된 페르소나의 추천 콤보 — 결과 배너 (페이지 본체에서 별도 컴포넌트로 노출) */}
        {active && active.recommendedCombo && (
          <p className="mt-4 text-[11.5px] text-ink-500">
            ↓ 결과 영역에서 이 페르소나의 추천 콤보를 확인하세요.
          </p>
        )}
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
