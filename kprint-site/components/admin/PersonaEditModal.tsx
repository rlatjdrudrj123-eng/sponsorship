"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Persona } from "@/lib/types";

// 페르소나 이모지 선택지 — 산업·마케팅 컨텍스트에 어울리는 큐레이션
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
      : {
          emoji: "🎯",
          title: "",
          description: "",
        };

  const [emoji, setEmoji] = useState(initial.emoji ?? "🎯");
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
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
    try {
      if (mode.kind === "new") {
        const id = `${mode.eventId}-${slugify(t)}-${Date.now().toString(36).slice(-4)}`;
        await setDoc(doc(getDb(), "personas", id), {
          id,
          eventId: mode.eventId,
          emoji,
          title: t,
          description: description.trim(),
          targetTags: [],
          order: mode.order,
          isActive: true,
        });
      } else {
        await setDoc(
          doc(getDb(), "personas", mode.persona.id),
          {
            ...mode.persona,
            emoji,
            title: t,
            description: description.trim(),
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
        className="bg-white w-full max-w-lg rounded-card shadow-2xl overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
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

        <div className="px-5 py-4 space-y-4">
          {/* 미리보기 */}
          <div className="bg-mint-50 border border-mint-100 rounded-card p-4 flex flex-col">
            <div className="text-[22px] mb-2">{emoji}</div>
            <div className="text-[13.5px] font-bold text-ink-900 leading-tight">
              {title || "(제목 미정)"}
            </div>
            {description && (
              <p className="text-[11px] text-ink-500 mt-2 leading-snug">
                {description}
              </p>
            )}
          </div>

          {/* 아이콘 선택 */}
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
                        ? "bg-mint-500 ring-2 ring-mint-700"
                        : "bg-white border border-ink-100 hover:bg-mint-50")
                    }
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 제목 */}
          <label className="block">
            <span className="text-[12px] text-ink-700 font-semibold mb-1 block">
              제목 *
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 처음 참가하는 회사"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
            />
          </label>

          {/* 서브 카피 / 설명 */}
          <label className="block">
            <span className="text-[12px] text-ink-700 font-semibold mb-1 block">
              서브 카피 (한 줄~두 줄)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 예산 부담 적게 진입 채널 확보. 500만~1500만원 사이 단품·스탠다드 패키지 위주."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 resize-y"
            />
            <p className="text-[10.5px] text-ink-500 mt-1">
              참가업체가 카드를 볼 때 본인 상황과 맞는지 판단하는 단서가 됩니다.
            </p>
          </label>
        </div>

        <footer className="px-5 py-3 border-t border-ink-100 grid grid-cols-2 gap-2">
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
            className="px-4 py-2.5 rounded-btn bg-mint-500 text-ink-900 text-[13px] font-bold hover:bg-mint-700 hover:text-white disabled:opacity-50"
          >
            {saving ? "저장 중…" : mode.kind === "new" ? "추가" : "저장"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}
