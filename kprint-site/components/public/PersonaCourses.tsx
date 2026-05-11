"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { Category, Package } from "@/lib/types";

/**
 * 페르소나 추천 코스 — sponsorships 페이지 상단.
 *
 * 정해진 페르소나 별로 어떤 카테고리/패키지를 보이게 할지 미리 정의.
 * 사용자가 클릭하면 onPick(personaId) 호출 → 부모가 필터를 적용.
 *
 * 매칭 기준 (정성적):
 *  - 페르소나의 targetTags(태그 라벨 배열)와 카테고리.tags 교집합
 *  - 추가로 최대/최소 예산 힌트
 *  - 패키지는 tier로 필터
 *
 * 페르소나는 일단 하드코딩 — 추후 어드민에서 편집 가능하도록 확장 가능.
 */

export type PersonaId =
  | "first-time"
  | "global"
  | "budget-friendly"
  | "brand-leader"
  | "industry-target";

type Persona = {
  id: PersonaId;
  emoji: string;
  title: string;
  description: string;
  targetTags: string[];      // 카테고리.tags 와 매칭할 라벨
  budgetMin?: number;
  budgetMax?: number;
  packageTier?: "signature" | "standard";
};

const PERSONAS: Persona[] = [
  {
    id: "first-time",
    emoji: "🌱",
    title: "처음 참가하는 회사",
    description:
      "예산 부담 적게 진입 채널 확보. 500만~1500만원 사이 단품·스탠다드 패키지 위주.",
    targetTags: ["온사이트", "프린트", "정보탐색"],
    budgetMax: 15_000_000,
    packageTier: "standard",
  },
  {
    id: "global",
    emoji: "🌏",
    title: "글로벌 바이어가 주 타겟",
    description:
      "해외 뉴스레터, 영문 쇼가이드, 옥외 LED 등 외국인 동선·해외 채널 집중.",
    targetTags: ["글로벌", "옥외", "정보탐색"],
  },
  {
    id: "budget-friendly",
    emoji: "💰",
    title: "예산 효율 최우선",
    description:
      "단가 낮은 디지털 배너·SNS 콘텐츠 중심. 노출량 대비 비용이 가장 낮은 조합.",
    targetTags: ["온라인", "SNS", "콘텐츠"],
    budgetMax: 5_000_000,
  },
  {
    id: "brand-leader",
    emoji: "🚀",
    title: "브랜드 인지도 강화",
    description:
      "전 동선 통합 노출. 시그니처 패키지 + 옥외 + 천장배너 같은 대형 자리.",
    targetTags: ["브랜드_확산형", "온사이트", "옥외"],
    budgetMin: 15_000_000,
    packageTier: "signature",
  },
  {
    id: "industry-target",
    emoji: "🎯",
    title: "산업 종사자 직접 도달",
    description:
      "참관등록 페이지, 세미나 배너, 직접 메일 발송 등 결정권자 타겟 채널.",
    targetTags: ["산업종사자", "등록경로", "직접도달"],
  },
];

export function PersonaCourses({
  categories,
  packages,
  selectedPersona,
  onPick,
  onClear,
}: {
  categories: Category[];
  packages: Package[];
  selectedPersona: PersonaId | null;
  onPick: (id: PersonaId, persona: Persona) => void;
  onClear: () => void;
}) {
  // 페르소나별로 매칭되는 카테고리 수 카운트 (옆에 작게 표시)
  const counts = useMemo(() => {
    const result: Record<PersonaId, number> = {
      "first-time": 0,
      global: 0,
      "budget-friendly": 0,
      "brand-leader": 0,
      "industry-target": 0,
    };
    PERSONAS.forEach((p) => {
      const cats = categories.filter((c) => {
        if (p.targetTags.length === 0) return false;
        const hasTag = p.targetTags.some((t) => (c.tags ?? []).includes(t));
        return hasTag;
      });
      const pkgs = packages.filter((pkg) => {
        if (p.packageTier) return pkg.tier === p.packageTier;
        return false;
      });
      result[p.id] = cats.length + pkgs.length;
    });
    return result;
  }, [categories, packages]);

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
          {selectedPersona && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11.5px] text-ink-500 hover:text-ink-900 font-semibold"
            >
              전체 다시 보기
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {PERSONAS.map((p) => {
            const active = selectedPersona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id, p)}
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
                  <span>{counts[p.id]}개 매칭</span>
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

export { PERSONAS };
export type { Persona };
