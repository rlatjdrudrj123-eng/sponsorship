"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Gift,
  Plus,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import type { BundledPerk, SiteSettings } from "@/lib/types";
import { DEFAULT_BUNDLED_PERKS, calcPerksTotalValue } from "@/lib/perks";

/**
 * 동봉 혜택 관리 — 스폰서십 신청 시 모두에게 추가로 제공되는 매체 권리.
 * 저장 위치: siteSettings/{eventId}.bundledPerks
 * 비어있으면 lib/perks.ts 의 DEFAULT_BUNDLED_PERKS 가 폴백.
 */
export default function PerksAdminPage() {
  const selectedEventId = useAdminEvent((s) => s.selectedEventId);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [perks, setPerks] = useState<BundledPerk[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!selectedEventId) return;
    const u = onSnapshot(
      doc(getDb(), "siteSettings", selectedEventId),
      (s) => {
        if (s.exists()) {
          const data = s.data() as SiteSettings;
          setSettings(data);
          // 외부에서 갱신된 값을 가져오되, 작업 중(dirty)이면 덮어쓰지 않음
          if (!dirty) {
            setPerks(data.bundledPerks ?? DEFAULT_BUNDLED_PERKS);
          }
        }
      }
    );
    return () => u();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  if (!selectedEventId) {
    return (
      <div className="p-8 text-sm text-ink-500">
        먼저 상단의 행사를 선택하세요.
      </div>
    );
  }

  const update = (idx: number, next: Partial<BundledPerk>) => {
    setPerks((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], ...next };
      return arr;
    });
    setDirty(true);
  };

  const remove = (idx: number) => {
    setPerks((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const add = () => {
    setPerks((prev) => [
      ...prev,
      { label: "새 혜택", description: "", valueKRW: undefined },
    ]);
    setDirty(true);
  };

  const move = (idx: number, dir: -1 | 1) => {
    setPerks((prev) => {
      const arr = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
    setDirty(true);
  };

  const resetToDefault = () => {
    if (!confirm("기본 혜택 목록으로 되돌릴까요? 현재 편집 내용은 사라집니다.")) return;
    setPerks([...DEFAULT_BUNDLED_PERKS]);
    setDirty(true);
  };

  const save = async () => {
    if (!selectedEventId) return;
    setSaving(true);
    try {
      // 빈 문자열·undefined 정리
      const clean = perks
        .filter((p) => p.label.trim() !== "")
        .map((p) => ({
          label: p.label.trim(),
          ...(p.description ? { description: p.description.trim() } : {}),
          ...(p.valueKRW ? { valueKRW: Number(p.valueKRW) } : {}),
          ...(p.condition ? { condition: p.condition.trim() } : {}),
        }));
      await setDoc(
        doc(getDb(), "siteSettings", selectedEventId),
        { bundledPerks: clean, updatedAt: Timestamp.fromDate(new Date()) },
        { merge: true }
      );
      setSavedAt(new Date());
      setDirty(false);
    } catch (e) {
      alert("저장 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const totalValue = calcPerksTotalValue(perks);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-ink-900 flex items-center gap-2">
            <Gift className="w-5 h-5 text-brand-500" />
            동봉 혜택 관리
          </h1>
          <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">
            스폰서십 신청 시 모두에게 자동으로 제공되는 추가 매체 권리.
            공개 스폰서십 페이지 / 패키지 상세 / PDF 에 "추가 혜택" 카드로 노출됩니다.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] text-ink-500 uppercase tracking-wide font-semibold">
            총 상당 가치
          </div>
          <div className="text-[22px] font-bold text-brand-700 font-num leading-tight">
            {totalValue.toLocaleString()}
            <span className="text-[12px] ml-0.5">원</span>
          </div>
        </div>
      </header>

      <div className="bg-amber-50 border border-amber-200 rounded-card p-3 text-[12px] text-amber-800 leading-relaxed mb-4">
        ⚠️ <strong>혜택 조건</strong> (예: "큰 회사 우선") 이 있는 항목은 총 가치 계산에서 제외됩니다.
        조건 없는 항목들의 합산만 영업 시 "총 X만원 상당" 으로 보입니다.
      </div>

      <div className="space-y-2.5">
        {perks.map((perk, i) => (
          <div
            key={i}
            className="bg-white border border-ink-100 rounded-card p-4 grid grid-cols-[auto_1fr_auto] gap-3 items-start"
          >
            <div className="flex flex-col gap-1 pt-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="w-7 h-7 grid place-items-center rounded hover:bg-ink-50 text-ink-500 disabled:opacity-30"
                title="위로"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === perks.length - 1}
                className="w-7 h-7 grid place-items-center rounded hover:bg-ink-50 text-ink-500 disabled:opacity-30"
                title="아래로"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_140px_160px] gap-2">
                <input
                  value={perk.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="혜택 이름 (예: 등록대 스폰서 로고)"
                  className="px-3 py-2 text-[14px] font-semibold border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
                />
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={perk.valueKRW ?? ""}
                  onChange={(e) =>
                    update(i, {
                      valueKRW: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="상당 가치 (KRW)"
                  className="px-3 py-2 text-[13px] font-mono border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
                />
                <input
                  value={perk.condition ?? ""}
                  onChange={(e) =>
                    update(i, { condition: e.target.value || undefined })
                  }
                  placeholder="조건 (선택, 예: 큰 회사 우선)"
                  className="px-3 py-2 text-[12.5px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
                />
              </div>
              <textarea
                value={perk.description ?? ""}
                onChange={(e) =>
                  update(i, { description: e.target.value || undefined })
                }
                placeholder="한 줄 설명 (선택)"
                rows={2}
                className="w-full px-3 py-2 text-[12.5px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={() => remove(i)}
              className="w-8 h-8 grid place-items-center rounded hover:bg-red-50 text-ink-500 hover:text-red-700"
              title="제거"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {perks.length === 0 && (
          <div className="bg-ink-50 border border-ink-100 rounded-card p-6 text-center text-[13px] text-ink-500">
            동봉 혜택이 없습니다. 아래 [혜택 추가] 또는 [기본값으로 되돌리기]
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={add}
          className="px-3.5 py-2 rounded-btn border border-ink-100 hover:border-brand-500 text-[13px] font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          혜택 추가
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          className="px-3.5 py-2 rounded-btn border border-ink-100 hover:border-ink-900 text-[13px] font-semibold flex items-center gap-1.5 text-ink-700"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          기본값으로 되돌리기
        </button>
        <span className="ml-auto text-[11.5px] text-ink-500">
          {saving
            ? "저장 중…"
            : dirty
              ? "수정 사항 미저장"
              : savedAt
                ? `${savedAt.toLocaleTimeString()} 저장됨`
                : settings?.bundledPerks
                  ? "현재 저장된 혜택"
                  : "기본값 사용 중"}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-btn bg-brand-500 text-white text-[13px] font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          저장
        </button>
      </div>
    </div>
  );
}
