"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Persona } from "@/lib/types";

// 페르소나 이모지 — 산업·마케팅 컨텍스트
const EMOJI_OPTIONS = [
  "🌱", "🌏", "💰", "🚀", "🎯",
  "🏆", "💎", "🔍", "📊", "🤝",
  "🎓", "🏥", "🧬", "💼", "🌐",
  "📱", "🎬", "📰", "📧", "🔔",
  "⭐", "🔥", "💡", "🎁", "🛍️",
  "🏗️", "🧪", "⚙️", "🪄", "✨",
];

type Mode =
  | { kind: "new"; eventId: string; order: number }
  | { kind: "edit"; persona: Persona };

export function PersonaEditModal({
  mode,
  onClose,
}: {
  mode: Mode;
  onClose: () => void;
}) {
  const initial =
    mode.kind === "edit"
      ? mode.persona
      : ({
          emoji: "🎯",
          title: "",
          description: "",
        } as Partial<Persona>);

  const [emoji, setEmoji] = useState(initial.emoji ?? "🎯");
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  // targetTags — 카테고리.personas 매핑 안 된 카테고리에 대한 fallback 매칭 키워드.
  // 콤마 구분 입력. matchesPersona() 가 c.tags 와 교집합 확인.
  const [targetTags, setTargetTags] = useState(
    (initial.targetTags ?? []).join(", ")
  );
  const [socialProofNote, setSocialProofNote] = useState(
    initial.socialProofNote ?? ""
  );
  const [budgetNote, setBudgetNote] = useState(initial.budgetNote ?? "");
  const [budgetMin, setBudgetMin] = useState<string>(
    initial.budgetMin ? String(initial.budgetMin) : ""
  );
  const [budgetMax, setBudgetMax] = useState<string>(
    initial.budgetMax ? String(initial.budgetMax) : ""
  );
  const [packageTier, setPackageTier] = useState<
    "signature" | "standard" | ""
  >(initial.packageTier ?? "");
  const [comboHeadline, setComboHeadline] = useState(
    initial.recommendedCombo?.headline ?? ""
  );
  const [comboRationale, setComboRationale] = useState(
    initial.recommendedCombo?.rationale ?? ""
  );
  const [comboSlugs, setComboSlugs] = useState(
    (initial.recommendedCombo?.categorySlugs ?? []).join(", ")
  );
  const [comboPackageIds, setComboPackageIds] = useState(
    (initial.recommendedCombo?.packageIds ?? []).join(", ")
  );
  const [comboExpected, setComboExpected] = useState<string>(
    initial.recommendedCombo?.expectedKRW
      ? String(initial.recommendedCombo.expectedKRW)
      : ""
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      alert("제목을 입력해주세요.");
      return;
    }
    setSaving(true);

    const slugs = comboSlugs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const pkgIds = comboPackageIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const recommendedCombo =
      comboHeadline || comboRationale || slugs.length > 0 || pkgIds.length > 0 || comboExpected
        ? {
            headline: comboHeadline.trim() || undefined,
            rationale: comboRationale.trim() || undefined,
            categorySlugs: slugs.length > 0 ? slugs : undefined,
            packageIds: pkgIds.length > 0 ? pkgIds : undefined,
            expectedKRW: comboExpected ? parseInt(comboExpected, 10) : undefined,
          }
        : undefined;

    const minN = budgetMin ? parseInt(budgetMin, 10) : undefined;
    const maxN = budgetMax ? parseInt(budgetMax, 10) : undefined;
    const tags = targetTags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Partial<Persona> = {
      emoji,
      title: t,
      description: description.trim(),
      targetTags: tags,
      socialProofNote: socialProofNote.trim() || undefined,
      budgetNote: budgetNote.trim() || undefined,
      budgetMin: minN,
      budgetMax: maxN,
      packageTier: packageTier ? packageTier : undefined,
      recommendedCombo,
    };

    try {
      if (mode.kind === "new") {
        const id = `${mode.eventId}-${slugify(t)}-${Date.now().toString(36).slice(-4)}`;
        await setDoc(doc(getDb(), "personas", id), {
          ...payload,
          id,
          eventId: mode.eventId,
          order: mode.order,
          isActive: true,
        });
      } else {
        await setDoc(
          doc(getDb(), "personas", mode.persona.id),
          {
            ...mode.persona,
            ...payload,
            updatedAt: Timestamp.fromDate(new Date()),
          },
          { merge: true }
        );
      }
      onClose();
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl max-h-[92vh] rounded-card shadow-2xl overflow-hidden flex flex-col"
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <h2 className="text-[16px] font-bold text-ink-900">
            {mode.kind === "new" ? "새 페르소나" : "페르소나 편집"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-btn hover:bg-ink-50 text-ink-500"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
          {/* 미리보기 */}
          <div className="bg-canvas border border-ink-100 rounded-card p-4">
            <div className="text-[26px] mb-2">{emoji}</div>
            <div className="text-[14px] font-bold text-ink-900 leading-tight">
              {title || "(제목 미정)"}
            </div>
            {description && (
              <p className="text-[11.5px] text-ink-500 mt-2 leading-snug">
                {description}
              </p>
            )}
            {(socialProofNote || budgetNote) && (
              <div className="mt-3 pt-3 border-t border-ink-100 space-y-1">
                {socialProofNote && (
                  <div className="text-[11px] text-ink-700">
                    👥 {socialProofNote}
                  </div>
                )}
                {budgetNote && (
                  <div className="text-[10.5px] text-ink-500 font-num">
                    💰 {budgetNote}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 기본 ── */}
          <SectionHeader>기본 정보</SectionHeader>

          {/* 아이콘 */}
          <div>
            <span className="text-[12px] text-ink-700 font-semibold mb-2 block">
              아이콘
            </span>
            <div className="grid grid-cols-10 gap-1">
              {EMOJI_OPTIONS.map((e) => {
                const active = emoji === e;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={
                      "h-9 grid place-items-center rounded-btn text-[20px] transition-colors " +
                      (active
                        ? "bg-brand-500 ring-2 ring-brand-700"
                        : "bg-white border border-ink-100 hover:bg-brand-50")
                    }
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="제목 *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 처음 참가하는 회사"
              autoFocus
              className={inputCls()}
            />
          </Field>

          <Field label="서브 카피">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 예산 부담 적게 진입 채널 확보. 500만~1500만원 사이 단품·스탠다드 패키지 위주."
              rows={2}
              className={inputCls() + " resize-y"}
            />
          </Field>

          {/* ── 페르소나가 강력해지는 메타 ── */}
          <SectionHeader hint="비워두면 결과 화면 narration이 빈약해집니다">
            확신을 주는 메타 (강화)
          </SectionHeader>

          <Field
            label="사회적 증거 한 줄"
            hint='예: "작년 18곳이 이 코스로 시작했어요"'
          >
            <input
              type="text"
              value={socialProofNote}
              onChange={(e) => setSocialProofNote(e.target.value)}
              placeholder="작년 N개 회사가 이 코스 선택"
              className={inputCls()}
            />
          </Field>

          <Field
            label="예산 anchor"
            hint='예: "평균 1,200만원 (시그니처 + 단품 2개)"'
          >
            <input
              type="text"
              value={budgetNote}
              onChange={(e) => setBudgetNote(e.target.value)}
              placeholder="평균 ○○만원"
              className={inputCls()}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="예산 하한 (KRW)">
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="0"
                className={inputCls() + " font-mono"}
              />
            </Field>
            <Field label="예산 상한 (KRW)">
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="15000000"
                className={inputCls() + " font-mono"}
              />
            </Field>
          </div>

          <Field
            label="패키지 티어 선호"
            hint="선택하면 카드 카운트·추천에 해당 티어 패키지 포함"
          >
            <select
              value={packageTier}
              onChange={(e) =>
                setPackageTier(e.target.value as "signature" | "standard" | "")
              }
              className={inputCls()}
            >
              <option value="">선호 없음</option>
              <option value="signature">시그니처</option>
              <option value="standard">스탠다드</option>
            </select>
          </Field>

          {/* 매칭 키워드 (fallback) — 카테고리에 personas 매핑이 없을 때 c.tags 와 교집합 매칭 */}
          <Field
            label="매칭 키워드 (콤마 구분)"
            hint='카테고리 편집에서 페르소나 매핑을 못 했을 때의 fallback — 카테고리.tags 와 겹치는 것이 있으면 매칭. 예: "옥외, 동선, 인지도"'
          >
            <input
              type="text"
              value={targetTags}
              onChange={(e) => setTargetTags(e.target.value)}
              placeholder="옥외, 동선, 인지도"
              className={inputCls() + " font-mono text-[11.5px]"}
            />
          </Field>

          {/* ── 추천 콤보 ── */}
          <SectionHeader hint="비우면 자동 생성 (매칭 카테고리 상위 3 + 선호 티어 패키지). 직접 큐레이션 권장.">
            추천 콤보 (결과 화면 배너 + 한 번에 카트 담기)
          </SectionHeader>

          <Field
            label="콤보 헤드라인"
            hint='기본: "당신 같은 회사가 보통 이렇게 합니다"'
          >
            <input
              type="text"
              value={comboHeadline}
              onChange={(e) => setComboHeadline(e.target.value)}
              placeholder="예: 첫 참가, 이 3개로 시작하세요"
              className={inputCls()}
            />
          </Field>

          <Field
            label="콤보 이유 한 줄"
            hint='예: "동선 + 인지 + 자산 3박자"'
          >
            <input
              type="text"
              value={comboRationale}
              onChange={(e) => setComboRationale(e.target.value)}
              placeholder="왜 이 콤보인지 한 줄로"
              className={inputCls()}
            />
          </Field>

          <Field
            label="카테고리 slug (콤마 구분)"
            hint='어드민 [카테고리]에서 카테고리 별 slug 확인. 예: "ceiling-banner-hall-a, xpace-bridge"'
          >
            <input
              type="text"
              value={comboSlugs}
              onChange={(e) => setComboSlugs(e.target.value)}
              placeholder="ceiling-banner-hall-a, ..."
              className={inputCls() + " font-mono text-[11.5px]"}
            />
          </Field>

          <Field
            label="패키지 ID (콤마 구분)"
            hint="어드민 [패키지]에서 ID 확인. 보통 1개."
          >
            <input
              type="text"
              value={comboPackageIds}
              onChange={(e) => setComboPackageIds(e.target.value)}
              placeholder="signature-bundle-2026"
              className={inputCls() + " font-mono text-[11.5px]"}
            />
          </Field>

          <Field
            label="예상 합계 (선택, KRW)"
            hint="비우면 자동 계산"
          >
            <input
              type="number"
              value={comboExpected}
              onChange={(e) => setComboExpected(e.target.value)}
              placeholder="12000000"
              className={inputCls() + " font-mono"}
            />
          </Field>
        </div>

        <footer className="px-5 py-3 border-t border-ink-100 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim()}
            className="px-4 py-2.5 rounded-btn bg-brand-500 text-white text-[13px] font-bold hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "저장 중…" : mode.kind === "new" ? "추가" : "저장"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function SectionHeader({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="pt-2 border-t border-ink-100 first:border-t-0 first:pt-0">
      <div className="text-[11px] uppercase tracking-widest text-brand-500 font-bold mt-3">
        {children}
      </div>
      {hint && (
        <div className="text-[11px] text-ink-500 mt-0.5 leading-snug">
          {hint}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-ink-700 font-semibold mb-1 block">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[10.5px] text-ink-500 mt-1 block leading-snug">
          {hint}
        </span>
      )}
    </label>
  );
}

function inputCls(): string {
  return "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}
