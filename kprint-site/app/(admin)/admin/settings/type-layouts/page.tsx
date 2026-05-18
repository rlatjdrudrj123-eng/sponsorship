"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { ArrowDown, ArrowUp, Check, Plus, Save, X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import type {
  CategoryType,
  SiteSettings,
  SpecField,
  TypeLayout,
} from "@/lib/types";
import {
  ALL_SPEC_FIELDS,
  DEFAULT_TYPE_LAYOUTS,
  SPEC_FIELD_HINT,
  SPEC_FIELD_LABEL,
} from "@/lib/typeLayouts";

/**
 * 유형별 슬라이드 레이아웃 설정.
 * 각 카테고리 유형마다 어떤 스펙 행을, 어떤 순서로 보일지 어드민에서 직접 조정.
 *
 * 저장 위치: siteSettings/{eventId}.typeLayouts
 * 비어있으면 lib/typeLayouts.ts 의 DEFAULT_TYPE_LAYOUTS 사용.
 */

const TYPE_META: Array<{
  value: CategoryType;
  label: string;
  desc: string;
}> = [
  { value: "floor_plan", label: "도면형", desc: "천장 배너, 등록데스크 등 — 도면 위 위치가 의미 있음" },
  { value: "quantity", label: "수량형", desc: "목걸이, 초대장 삽지 — 수량으로 측정" },
  { value: "media", label: "미디어형", desc: "경품 LED, 시상식 영상" },
  { value: "digital_banner", label: "디지털 배너", desc: "홈페이지·앱 디지털 영역" },
  { value: "mailing", label: "발송형", desc: "뉴스레터, APP 푸시" },
  { value: "print_page", label: "지면형", desc: "쇼가이드 표지·내지" },
  { value: "content", label: "콘텐츠형", desc: "SNS 인터뷰, 카드뉴스" },
  { value: "xpace", label: "XPACE", desc: "옥외 LED 등 도면 + 영상" },
  { value: "package", label: "패키지", desc: "단품 매체를 묶은 상품" },
];

export default function TypeLayoutsAdminPage() {
  const selectedEventId = useAdminEvent((s) => s.selectedEventId);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!selectedEventId) return;
    const u = onSnapshot(
      doc(getDb(), "siteSettings", selectedEventId),
      (s) => {
        if (s.exists()) setSettings(s.data() as SiteSettings);
      }
    );
    return () => u();
  }, [selectedEventId]);

  // 현재 행사의 typeLayouts (없으면 빈 객체)
  const layouts: Partial<Record<CategoryType, TypeLayout>> =
    settings?.typeLayouts ?? {};

  const setLayoutFor = async (type: CategoryType, next: TypeLayout) => {
    if (!selectedEventId) return;
    setSaving(true);
    try {
      await setDoc(
        doc(getDb(), "siteSettings", selectedEventId),
        {
          typeLayouts: { ...layouts, [type]: next },
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      );
      setSavedAt(new Date());
    } catch (e) {
      console.error("typeLayouts save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const resetLayoutFor = async (type: CategoryType) => {
    if (!selectedEventId) return;
    if (!confirm(`${TYPE_META.find((m) => m.value === type)?.label} 유형의 레이아웃을 기본값으로 되돌릴까요?`)) return;
    const nextLayouts = { ...layouts };
    delete nextLayouts[type];
    setSaving(true);
    try {
      await setDoc(
        doc(getDb(), "siteSettings", selectedEventId),
        {
          typeLayouts: nextLayouts,
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      );
      setSavedAt(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!selectedEventId) {
    return (
      <div className="p-8 text-sm text-ink-500">
        먼저 상단의 행사를 선택하세요.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-ink-900">
            유형별 슬라이드 레이아웃
          </h1>
          <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">
            각 카테고리 유형의 공개 슬라이드에서 <strong>어떤 스펙 행을, 어떤 순서로</strong> 보일지
            정의합니다. 변경하지 않으면 시스템 기본값이 사용됩니다.
          </p>
        </div>
        <div className="text-[11.5px] text-ink-500">
          {saving ? "저장 중…" : savedAt ? `${savedAt.toLocaleTimeString()} 저장됨` : "자동 저장"}
        </div>
      </header>

      <div className="space-y-4">
        {TYPE_META.map((meta) => {
          const current =
            layouts[meta.value] ?? DEFAULT_TYPE_LAYOUTS[meta.value];
          const isOverride = !!layouts[meta.value];
          return (
            <TypeLayoutCard
              key={meta.value}
              meta={meta}
              layout={current}
              isOverride={isOverride}
              onChange={(next) => setLayoutFor(meta.value, next)}
              onReset={() => resetLayoutFor(meta.value)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TypeLayoutCard({
  meta,
  layout,
  isOverride,
  onChange,
  onReset,
}: {
  meta: { value: CategoryType; label: string; desc: string };
  layout: TypeLayout;
  isOverride: boolean;
  onChange: (next: TypeLayout) => void;
  onReset: () => void;
}) {
  const enabled = layout.specFields;
  const disabled = ALL_SPEC_FIELDS.filter(
    (f) => !enabled.includes(f)
  );

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...enabled];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ specFields: next });
  };

  const remove = (idx: number) => {
    onChange({ specFields: enabled.filter((_, i) => i !== idx) });
  };

  const add = (field: SpecField) => {
    onChange({ specFields: [...enabled, field] });
  };

  return (
    <section className="bg-white border border-ink-100 rounded-card p-5">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[16px] font-bold text-ink-900 flex items-center gap-2">
            {meta.label}
            {isOverride ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                커스텀
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-50 text-ink-500">
                기본값
              </span>
            )}
          </h2>
          <p className="text-[12px] text-ink-500 mt-0.5">{meta.desc}</p>
        </div>
        {isOverride && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11.5px] text-ink-500 hover:text-red-700 font-semibold"
          >
            기본값으로 되돌리기
          </button>
        )}
      </header>

      {/* 현재 노출 순서 */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
          노출 순서 (위 → 아래)
        </div>
        {enabled.length === 0 ? (
          <div className="text-[12px] text-ink-500 bg-ink-50 rounded-btn px-3 py-3 text-center">
            노출할 행이 없습니다. 아래 [추가] 에서 골라주세요.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {enabled.map((field, i) => (
              <li
                key={field}
                className="flex items-center gap-2 bg-ink-50 border border-ink-100 rounded-btn px-3 py-2"
              >
                <span className="text-[11px] font-mono text-ink-500 w-5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-ink-900">
                    {SPEC_FIELD_LABEL[field]}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {SPEC_FIELD_HINT[field]}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="w-7 h-7 grid place-items-center rounded hover:bg-white text-ink-500 disabled:opacity-30"
                  title="위로"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === enabled.length - 1}
                  className="w-7 h-7 grid place-items-center rounded hover:bg-white text-ink-500 disabled:opacity-30"
                  title="아래로"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="w-7 h-7 grid place-items-center rounded hover:bg-red-50 text-ink-500 hover:text-red-700"
                  title="제거"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 추가 가능 */}
      {disabled.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
            추가
          </div>
          <div className="flex flex-wrap gap-1.5">
            {disabled.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => add(field)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill border border-ink-100 hover:border-brand-500 hover:bg-brand-50 text-[11.5px] text-ink-700 hover:text-brand-700 font-semibold"
                title={SPEC_FIELD_HINT[field]}
              >
                <Plus className="w-3 h-3" />
                {SPEC_FIELD_LABEL[field]}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
