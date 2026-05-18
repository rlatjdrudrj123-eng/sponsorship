"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { ArrowDown, ArrowUp, Maximize2, Plus, X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import { CanvasEditor } from "../landing/canvas/CanvasEditor";
import { NodePreview, resolveBg } from "../landing/canvas/CanvasEditor";
import type {
  CanvasPage,
  Category,
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
import { buildDefaultMasterPage } from "@/lib/typeMasterDefaults";

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

function newEmptyCanvasPage(): CanvasPage {
  return { id: "master", nodes: [] };
}

/** 유형마다 텍스트 노드에 박을 수 있는 토큰 (공개 페이지에서 실데이터로 치환) */
const TOKENS_BY_TYPE: Record<CategoryType, Array<{ token: string; desc: string }>> = {
  floor_plan: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{location}}", desc: "위치 (예: A1 출입구)" },
    { token: "{{size}}", desc: "크기 (예: 2000×1000mm)" },
    { token: "{{fileFormat}}", desc: "파일 포맷" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세 (구좌 분포)" },
    { token: "{{slotsLabel}}", desc: "구좌 가용 (예: 11/11 가능)" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  quantity: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{size}}", desc: "수량 (예: 5,000개/구좌)" },
    { token: "{{fileFormat}}", desc: "파일 포맷" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세" },
    { token: "{{slotsLabel}}", desc: "구좌 가용" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  media: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{video}}", desc: "영상 스펙" },
    { token: "{{size}}", desc: "해상도" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세" },
    { token: "{{slotsLabel}}", desc: "구좌 가용" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  digital_banner: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{size}}", desc: "사이즈 (PC/모바일)" },
    { token: "{{fileFormat}}", desc: "파일 포맷" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세" },
    { token: "{{slotsLabel}}", desc: "구좌 가용" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  mailing: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{mailing}}", desc: "발송 (대상·시기)" },
    { token: "{{size}}", desc: "사이즈" },
    { token: "{{fileFormat}}", desc: "파일 포맷" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세" },
    { token: "{{slotsLabel}}", desc: "구좌 가용" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  print_page: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{size}}", desc: "지면 크기" },
    { token: "{{fileFormat}}", desc: "파일 포맷" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세" },
    { token: "{{slotsLabel}}", desc: "구좌 가용" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  content: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{content}}", desc: "콘텐츠 스펙" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세" },
    { token: "{{slotsLabel}}", desc: "구좌 가용" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  xpace: [
    { token: "{{title}}", desc: "카테고리 이름" },
    { token: "{{location}}", desc: "위치" },
    { token: "{{video}}", desc: "영상 스펙" },
    { token: "{{size}}", desc: "크기" },
    { token: "{{fileFormat}}", desc: "파일 포맷" },
    { token: "{{deadline}}", desc: "마감일" },
    { token: "{{detail}}", desc: "상세" },
    { token: "{{slotsLabel}}", desc: "구좌 가용" },
    { token: "{{minPrice}}", desc: "최저가" },
  ],
  package: [
    { token: "{{title}}", desc: "패키지 이름" },
    { token: "{{detail}}", desc: "패키지 구성" },
    { token: "{{minPrice}}", desc: "패키지 가격" },
  ],
};

export default function TypeLayoutsAdminPage() {
  const selectedEventId = useAdminEvent((s) => s.selectedEventId);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [editingType, setEditingType] = useState<CategoryType | null>(null);

  useEffect(() => {
    if (!selectedEventId) return;
    const db = getDb();
    const u1 = onSnapshot(
      doc(db, "siteSettings", selectedEventId),
      (s) => {
        if (s.exists()) setSettings(s.data() as SiteSettings);
      }
    );
    const u2 = onSnapshot(
      query(collection(db, "categories"), where("eventId", "==", selectedEventId)),
      (s) =>
        setCategories(
          s.docs.map((d) => ({ ...(d.data() as Category), id: d.id }))
        )
    );
    return () => {
      u1();
      u2();
    };
  }, [selectedEventId]);

  // 현재 행사의 typeLayouts (없으면 빈 객체)
  const layouts: Partial<Record<CategoryType, TypeLayout>> =
    settings?.typeLayouts ?? {};

  // 실제 카테고리에서 쓰이는 유형만 자동 감지 — 9개 박지 않음
  const typesInUse = useMemo<CategoryType[]>(() => {
    const set = new Set<CategoryType>();
    categories.forEach((c) => set.add(c.type));
    // 패키지는 별도 컬렉션이라 categories 에 없어도 항상 노출
    set.add("package");
    return TYPE_META.filter((m) => set.has(m.value)).map((m) => m.value);
  }, [categories]);

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

  // 캔버스 마스터 편집 모달용 — 현재 편집 중인 type 의 page.
  // 저장된 canvasPage 가 있으면 그걸로, 없으면 유형별 기본 마스터로 (PPT 마스터시트 패턴).
  // buildDefaultMasterPage 는 매 호출마다 랜덤 ID 를 새로 만들어내므로 useMemo 로 고정.
  // 훅은 early return 보다 위에 있어야 한다.
  const editingLayout =
    editingType !== null
      ? layouts[editingType] ?? DEFAULT_TYPE_LAYOUTS[editingType]
      : null;
  const editingPage: CanvasPage = useMemo(() => {
    if (editingLayout?.canvasPage) return editingLayout.canvasPage;
    if (editingType !== null) return buildDefaultMasterPage(editingType);
    return newEmptyCanvasPage();
  }, [editingType, editingLayout?.canvasPage]);

  if (!selectedEventId) {
    return (
      <div className="p-8 text-sm text-ink-500">
        먼저 상단의 행사를 선택하세요.
      </div>
    );
  }

  const visibleMeta = TYPE_META.filter((m) => typesInUse.includes(m.value));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-ink-900">
            유형별 슬라이드 레이아웃
          </h1>
          <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">
            각 카테고리 유형의 공개 슬라이드를 <strong>자유 캔버스(1920×1080)</strong> 로 디자인합니다.
            텍스트 안에 <code className="bg-ink-50 px-1 rounded font-mono">{"{{title}}"}</code> 같은
            토큰을 박으면 공개 페이지에서 실데이터로 치환됩니다. 마스터를 만들지 않으면 시스템 기본 폼이 사용됩니다.
          </p>
        </div>
        <div className="text-[11.5px] text-ink-500">
          {saving ? "저장 중…" : savedAt ? `${savedAt.toLocaleTimeString()} 저장됨` : "자동 저장"}
        </div>
      </header>

      <div className="space-y-4">
        {visibleMeta.length === 0 ? (
          <div className="bg-white border border-ink-100 rounded-card p-8 text-center text-[13px] text-ink-500">
            카테고리가 아직 없습니다. 먼저 카테고리를 추가해야 유형이 자동 노출됩니다.
          </div>
        ) : (
          visibleMeta.map((meta) => {
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
                onEditCanvas={() => setEditingType(meta.value)}
              />
            );
          })
        )}
      </div>

      {/* ─── 캔버스 마스터 풀스크린 모달 ─── */}
      {editingType !== null && (
        <CanvasMasterModal
          type={editingType}
          page={editingPage}
          onChange={(nextPage) => {
            if (!editingType) return;
            const cur =
              layouts[editingType] ?? DEFAULT_TYPE_LAYOUTS[editingType];
            void setLayoutFor(editingType, { ...cur, canvasPage: nextPage });
          }}
          onClose={() => setEditingType(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// CanvasMasterModal — 풀스크린 모달 + CanvasEditor + 토큰 사이드바
// ============================================================================

function CanvasMasterModal({
  type,
  page,
  onChange,
  onClose,
}: {
  type: CategoryType;
  page: CanvasPage;
  onChange: (next: CanvasPage) => void;
  onClose: () => void;
}) {
  const meta = TYPE_META.find((m) => m.value === type);
  const tokens = TOKENS_BY_TYPE[type] ?? [];

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const t = e.target as HTMLElement | null;
        const inField =
          t?.tagName === "INPUT" ||
          t?.tagName === "TEXTAREA" ||
          t?.isContentEditable;
        if (inField) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex flex-col">
      {/* 상단 바 */}
      <header className="bg-white border-b border-ink-100 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-ink-900">
            마스터 슬라이드 — {meta?.label}
          </h2>
          <span className="text-[11.5px] text-ink-500">{meta?.desc}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-btn border border-ink-100 text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50 flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          닫기 (Esc)
        </button>
      </header>

      {/* 본문 — 좌측 토큰 가이드 + 우측 캔버스 */}
      <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr] gap-0 overflow-hidden">
        <aside className="bg-white border-r border-ink-100 overflow-y-auto p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-ink-500 font-bold mb-2">
            사용 가능한 토큰
          </div>
          <p className="text-[11px] text-ink-500 leading-snug mb-3">
            텍스트 노드 안에 그대로 박아두면 공개 페이지에서 카테고리·슬롯 실데이터로 치환됩니다.
          </p>
          <ul className="space-y-1">
            {tokens.map((t) => (
              <li
                key={t.token}
                className="px-2 py-1.5 rounded border border-ink-100 hover:border-brand-500 cursor-pointer group"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(t.token)
                    .catch(() => {});
                }}
                title="클릭해서 복사"
              >
                <div className="font-mono text-[11px] text-brand-700 font-bold group-hover:underline">
                  {t.token}
                </div>
                <div className="text-[10.5px] text-ink-500 leading-tight mt-0.5">
                  {t.desc}
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <div className="bg-canvas overflow-hidden">
          <CanvasEditor page={page} onChange={onChange} />
        </div>
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
  onEditCanvas,
}: {
  meta: { value: CategoryType; label: string; desc: string };
  layout: TypeLayout;
  isOverride: boolean;
  onChange: (next: TypeLayout) => void;
  onReset: () => void;
  onEditCanvas: () => void;
}) {
  const enabled = layout.specFields;
  const disabled = ALL_SPEC_FIELDS.filter(
    (f) => !enabled.includes(f)
  );
  const hasCanvas = !!layout.canvasPage && layout.canvasPage.nodes.length > 0;

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...enabled];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ ...layout, specFields: next });
  };

  const remove = (idx: number) => {
    onChange({ ...layout, specFields: enabled.filter((_, i) => i !== idx) });
  };

  const add = (field: SpecField) => {
    onChange({ ...layout, specFields: [...enabled, field] });
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

      {/* 좌: 컨트롤 / 우: 슬라이드 미리보기 */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div>
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

      {/* 추가 옵션 — 토글들 */}
      <div className="mt-5 pt-4 border-t border-ink-100 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
          기타 옵션
        </div>
        <Toggle
          label="해시태그 노출"
          hint="채널 + 태그 (첫 2개)"
          checked={layout.showHashtags !== false}
          onChange={(v) => onChange({ ...layout, showHashtags: v })}
        />
        <Toggle
          label="작년 데이터 노출"
          hint="작년 buyers · 매진일"
          checked={layout.showLastYear !== false}
          onChange={(v) => onChange({ ...layout, showLastYear: v })}
        />
        <Toggle
          label="동봉 혜택 배너 노출"
          hint="스폰서십 신청 시 추가 혜택 미니 배너"
          checked={layout.showPerksBanner !== false}
          onChange={(v) => onChange({ ...layout, showPerksBanner: v })}
        />
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-700 font-semibold">제목 크기</span>
          <div className="flex gap-1">
            {(["small", "medium", "large"] as const).map((s) => {
              const active = (layout.titleSize ?? "large") === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ ...layout, titleSize: s })}
                  className={
                    "px-2.5 py-1 rounded text-[11px] font-mono border " +
                    (active
                      ? "bg-brand-50 border-brand-500 text-brand-700 font-bold"
                      : "bg-white border-ink-100 text-ink-700 hover:border-ink-300")
                  }
                >
                  {s === "small" ? "S 36px" : s === "medium" ? "M 44px" : "L 56px"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 커스텀 스펙 행 */}
      <div className="mt-5 pt-4 border-t border-ink-100">
        <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
          커스텀 행 (정적 텍스트)
        </div>
        <div className="space-y-1.5">
          {(layout.customRows ?? []).map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_2fr_auto] gap-1.5 items-center bg-ink-50 border border-ink-100 rounded-btn px-2 py-1"
            >
              <input
                value={row.label}
                onChange={(e) => {
                  const next = [...(layout.customRows ?? [])];
                  next[i] = { ...next[i], label: e.target.value };
                  onChange({ ...layout, customRows: next });
                }}
                placeholder="라벨 (예: 보너스)"
                className="px-2 py-1 text-[12.5px] font-semibold border border-transparent hover:border-ink-100 focus:border-brand-500 rounded outline-none"
              />
              <input
                value={row.value}
                onChange={(e) => {
                  const next = [...(layout.customRows ?? [])];
                  next[i] = { ...next[i], value: e.target.value };
                  onChange({ ...layout, customRows: next });
                }}
                placeholder="값 (예: 카탈로그 후표지 광고 추가 제공)"
                className="px-2 py-1 text-[12px] border border-transparent hover:border-ink-100 focus:border-brand-500 rounded outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const next = (layout.customRows ?? []).filter(
                    (_, j) => j !== i
                  );
                  onChange({ ...layout, customRows: next });
                }}
                className="w-7 h-7 grid place-items-center rounded hover:bg-red-50 text-ink-500 hover:text-red-700"
                title="제거"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...layout,
                customRows: [
                  ...(layout.customRows ?? []),
                  { label: "", value: "" },
                ],
              })
            }
            className="w-full py-1.5 rounded-btn border-dashed border border-ink-300 hover:border-brand-500 hover:bg-brand-50 text-[11px] text-ink-500 hover:text-brand-700 flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            커스텀 행 추가
          </button>
        </div>
      </div>
        </div>
        {/* 우 — 캔버스 마스터 슬라이드 (우선 노출), 없으면 폴백 미리보기 */}
        <CanvasMasterCard
          page={layout.canvasPage}
          hasCanvas={hasCanvas}
          onEdit={onEditCanvas}
          fallbackPreview={
            <SlidePreview type={meta.value} layout={layout} />
          }
        />
      </div>
    </section>
  );
}

// ============================================================================
// CanvasMasterCard — 마스터 슬라이드 썸네일 + "디자인" 버튼
// ============================================================================

function CanvasMasterCard({
  page,
  hasCanvas,
  onEdit,
  fallbackPreview,
}: {
  page: CanvasPage | undefined;
  hasCanvas: boolean;
  onEdit: () => void;
  fallbackPreview: React.ReactNode;
}) {
  return (
    <div className="sticky top-4 space-y-3">
      <div className="bg-canvas border border-ink-100 rounded-btn p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500 font-bold">
            마스터 슬라이드
          </div>
          {hasCanvas ? (
            <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
              활성
            </span>
          ) : (
            <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-ink-50 text-ink-500">
              미설정 — 폼 폴백
            </span>
          )}
        </div>

        {/* 캔버스 마스터가 있으면 NodePreview 로 축소 렌더, 없으면 빈 슬레이트 */}
        <div className="bg-white border border-ink-100 aspect-[16/9] overflow-hidden relative rounded">
          {hasCanvas && page ? (
            <CanvasThumbnail page={page} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[11px] text-ink-400 leading-snug text-center p-3">
              마스터 슬라이드 없음
              <br />
              아래 버튼으로 디자인 시작
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="mt-3 w-full py-2 rounded-btn bg-ink-900 hover:bg-ink-700 text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          {hasCanvas ? "캔버스 편집" : "캔버스 디자인 시작"}
        </button>

        <p className="text-[10.5px] text-ink-500 mt-2 leading-snug">
          1920×1080 자유 배치. 텍스트에{" "}
          <code className="font-mono bg-ink-50 px-1 rounded">{"{{title}}"}</code>{" "}
          같은 토큰 사용 가능.
        </p>
      </div>

      {/* 마스터가 없을 때만 기존 폼 폴백 미리보기 노출 */}
      {!hasCanvas && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500 font-bold mb-2">
            폴백 폼 미리보기
          </div>
          {fallbackPreview}
        </div>
      )}
    </div>
  );
}

function CanvasThumbnail({ page }: { page: CanvasPage }) {
  // 1920×1080 → 컨테이너에 맞춰 축소
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: resolveBg(page.bg) ?? "#FFFFFF" }}>
      <div
        className="absolute top-0 left-0"
        style={{
          width: 1920,
          height: 1080,
          transform: "scale(0.16)",
          transformOrigin: "top left",
        }}
      >
        {page.bgImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.bgImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}
        {page.nodes
          .filter((n) => !n.hidden)
          .sort((a, b) => (a.rect.z ?? 0) - (b.rect.z ?? 0))
          .map((n) => (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: n.rect.x,
                top: n.rect.y,
                width: n.rect.w,
                height: n.rect.h,
                opacity: n.opacity ?? 1,
                transform: n.rect.rotate
                  ? `rotate(${n.rect.rotate}deg)`
                  : undefined,
              }}
            >
              <NodePreview node={n} />
            </div>
          ))}
      </div>
    </div>
  );
}

// ============================================================================
// SlidePreview — 유형별 샘플 데이터로 실제 공개 슬라이드 모양을 축소 렌더
// ============================================================================

const MOCK_BY_TYPE: Record<
  CategoryType,
  {
    title: string;
    tags: string[];
    location?: string;
    size?: string;
    fileFormat?: string;
    deadline?: string;
    detail?: string;
    slotsLabel?: string;
    video?: string;
    mailing?: string;
    content?: string;
    minPrice: number;
  }
> = {
  floor_plan: {
    title: "등록데스크 (출입증 발급대)",
    tags: ["오프라인", "등록", "입구"],
    location: "A1 출입구, A2 출입구, B홀, C홀",
    size: "2,000mm × 1,000mm",
    fileFormat: "eps, ai, pdf 등의 인쇄용 파일형태",
    deadline: "2026년 2월 28일",
    detail: "A1 출입구 5구좌, A2 출입구 4구좌, B홀 2구좌",
    slotsLabel: "11 / 11 가능",
    minPrice: 2_000_000,
  },
  quantity: {
    title: "참관객 목걸이",
    tags: ["오프라인", "목걸이", "수량"],
    size: "5,000개 / 구좌",
    fileFormat: "eps, ai, pdf",
    deadline: "2026년 2월 28일",
    detail: "참관객 목걸이 3구좌",
    slotsLabel: "3 / 3 가능",
    minPrice: 8_000_000,
  },
  media: {
    title: "경품 LED",
    tags: ["오프라인", "미디어", "영상"],
    video: "15초 · 1920×1080 · 2,000회 송출",
    size: "1,920px × 1,080px",
    fileFormat: "mp4, mov",
    deadline: "2026년 2월 28일",
    detail: "경품 LED 1구좌",
    slotsLabel: "1 / 1 가능",
    minPrice: 5_000_000,
  },
  digital_banner: {
    title: "참가업체 검색 배너",
    tags: ["온라인", "검색", "배너"],
    size: "PC : 1,200px × 200px",
    fileFormat: "jpg, png, jpeg",
    deadline: "2026년 2월 28일",
    detail: "참가업체 검색 배너 3구좌",
    slotsLabel: "3 / 3 가능",
    minPrice: 1_000_000,
  },
  mailing: {
    title: "국내 뉴스레터",
    tags: ["온라인", "뉴스레터", "국내"],
    mailing: "35,000명 (사전등록자) · 7월·8월",
    size: "630px × 160px",
    fileFormat: "jpg, png, jpeg",
    deadline: "2026년 2월 28일",
    detail: "7월 발송, 8월 발송",
    slotsLabel: "2 / 2 가능",
    minPrice: 1_500_000,
  },
  print_page: {
    title: "가이드북 후표지",
    tags: ["오프라인", "가이드북", "지면"],
    size: "210mm × 297mm",
    fileFormat: "ai, pdf",
    deadline: "2026년 2월 15일",
    detail: "표4 국/영문 1구좌",
    slotsLabel: "1 / 1 가능",
    minPrice: 4_000_000,
  },
  content: {
    title: "참가업체 인터뷰 + SNS",
    tags: ["온라인", "인터뷰", "콘텐츠"],
    content: "Instagram · 인터뷰 영상 + 카드뉴스",
    deadline: "2026년 3월 15일",
    detail: "인터뷰 + SNS 5건",
    slotsLabel: "5 / 5 가능",
    minPrice: 1_000_000,
  },
  xpace: {
    title: "옥외 LED 브릿지",
    tags: ["오프라인", "XPACE", "옥외"],
    location: "킨텍스 브릿지 외벽",
    video: "30초 · 4K · 5,000회 송출",
    size: "옥외 LED 전체",
    fileFormat: "mp4, mov",
    deadline: "2026년 2월 15일",
    detail: "옥외 LED 브릿지 1구좌",
    slotsLabel: "1 / 1 가능",
    minPrice: 10_000_000,
  },
  package: {
    title: "참관객 A to Z 패키지",
    tags: ["패키지", "시그니처"],
    detail: "등록대 1구좌, 사전등록 배너, 완료 이메일, 목걸이 1구좌, 라이팅월 1구좌",
    minPrice: 12_000_000,
  },
};

function SlidePreview({
  type,
  layout,
}: {
  type: CategoryType;
  layout: TypeLayout;
}) {
  const m = MOCK_BY_TYPE[type];
  return (
    <div className="bg-canvas border border-ink-100 rounded-btn p-4 sticky top-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500 font-bold mb-2">
        슬라이드 미리보기
      </div>
      <div className="bg-white rounded-btn p-3 shadow-card aspect-[4/3] flex flex-col overflow-hidden">
        {/* 해시태그 */}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold text-brand-500 mb-1">
          {m.tags.map((t, i) => (
            <span key={i}>#{t}</span>
          ))}
        </div>
        {/* 제목 */}
        <div className="text-[14px] font-bold text-ink-900 leading-tight tracking-tight">
          {m.title}
        </div>
        <div className="border-t border-ink-100 my-2" />
        {/* 스펙 행 — 현재 layout 기준으로 동적 */}
        <dl className="space-y-1 flex-1 overflow-hidden">
          {layout.specFields.map((field) => {
            const row = renderRow(field, m);
            if (!row) return null;
            return (
              <div
                key={field}
                className="flex items-baseline gap-2 border-b border-ink-50 pb-1"
              >
                <dt className="text-[8.5px] text-ink-500 font-semibold w-14 shrink-0">
                  {SPEC_FIELD_LABEL[field]}
                </dt>
                <dd className="text-[9px] text-ink-900 font-bold flex-1 truncate">
                  {row}
                </dd>
              </div>
            );
          })}
          {layout.specFields.length === 0 && (
            <div className="text-[10px] text-ink-400 italic">
              노출할 스펙이 없습니다.
            </div>
          )}
        </dl>
        {/* 가격 */}
        <div className="border-t border-ink-100 mt-2 pt-1.5 text-right">
          <span className="font-num text-[14px] font-bold text-ink-900">
            {m.minPrice.toLocaleString()}
            <span className="text-[9px] ml-0.5">원</span>
          </span>
        </div>
      </div>
      <p className="text-[10px] text-ink-500 mt-2 leading-snug">
        실제 슬라이드는 카테고리의 실데이터로 채워지지만, 표시 순서·종류는 위 설정대로 노출됩니다.
      </p>
    </div>
  );
}

function renderRow(
  field: SpecField,
  m: (typeof MOCK_BY_TYPE)[CategoryType]
): string | null {
  switch (field) {
    case "location":
      return m.location ?? null;
    case "size":
      return m.size ?? null;
    case "fileFormat":
      return m.fileFormat ?? null;
    case "deadline":
      return m.deadline ?? null;
    case "detail":
      return m.detail ?? null;
    case "slots":
      return m.slotsLabel ?? null;
    case "video":
      return m.video ?? null;
    case "mailing":
      return m.mailing ?? null;
    case "content":
      return m.content ?? null;
  }
}

// ============================================================================
// Toggle — 작은 체크 토글 (라벨 + 힌트 + 우측 스위치)
// ============================================================================

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none py-1">
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-ink-900 leading-tight">
          {label}
        </div>
        {hint && (
          <div className="text-[11px] text-ink-500 mt-0.5 leading-tight">
            {hint}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors " +
          (checked ? "bg-brand-500" : "bg-ink-200")
        }
        aria-pressed={checked}
      >
        <span
          className={
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </button>
    </label>
  );
}
