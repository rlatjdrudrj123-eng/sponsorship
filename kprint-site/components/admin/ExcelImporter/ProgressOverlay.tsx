"use client";

import type { ImportPhase } from "@/lib/excel/importer";

type Props = {
  phase: ImportPhase;
  current: number;
  total: number;
};

const PHASE_LABEL: Record<ImportPhase, string> = {
  preserve: "기존 데이터 보존 중",
  delete: "기존 데이터 삭제 중",
  write: "Firestore 쓰기 중",
  history: "임포트 이력 기록 중",
};

export function ProgressOverlay({ phase, current, total }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/60 grid place-items-center px-4">
      <div className="bg-white rounded-card p-7 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <svg
            className="animate-spin w-5 h-5 text-mint-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <path
              d="M22 12a10 10 0 0 1-10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <h3 className="font-bold text-ink-900">{PHASE_LABEL[phase]}…</h3>
        </div>
        <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
          <div
            className="h-full bg-mint-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
          <span>
            {current} / {total} ({pct}%)
          </span>
          <span className="font-mono">phase: {phase}</span>
        </div>
        <p className="mt-4 text-xs text-ink-500 leading-relaxed">
          이 창을 닫지 마세요. 완료될 때까지 잠시 기다려 주세요.
        </p>
      </div>
    </div>
  );
}
