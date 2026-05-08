"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  DesignItem,
  Event,
  Sponsor,
  SponsorContact,
  SponsorItem,
  SponsorStatus,
} from "@/lib/types";

const STATUS_LABELS: Record<SponsorStatus, string> = {
  in_progress: "진행중",
  reviewing: "검토중",
  declined: "진행X",
  in_kind: "협찬 (합계 제외)",
};

const DESIGN_STATUS_LABELS: Record<NonNullable<DesignItem["status"]>, string> = {
  pending: "대기",
  received: "접수",
  done: "완료",
};

const BANNER_TYPE_OPTIONS = [
  "",
  "로고",
  "참가업체 배너",
  "전시품 배너",
  "이미지",
  "해당없음",
];

export type SponsorFormValues = {
  eventId: string;
  companyName: string;
  amount: number;
  currency: "KRW" | "USD";
  amountNote: string;
  items: SponsorItem[];
  benefits: Sponsor["benefits"];
  bannerType: string;
  bannerNote: string;
  designItems: DesignItem[];
  contacts: SponsorContact[];
  status: SponsorStatus;
  notes: string;
};

export const EMPTY_FORM_VALUES: SponsorFormValues = {
  eventId: "",
  companyName: "",
  amount: 0,
  currency: "KRW",
  amountNote: "",
  items: [],
  benefits: { eventNotice: false, topPin: false, badge: false, logoBanner: false },
  bannerType: "",
  bannerNote: "",
  designItems: [],
  contacts: [],
  status: "reviewing",
  notes: "",
};

export function SponsorForm({
  initial,
  events,
  onSubmit,
  onDelete,
  submitLabel = "저장",
}: {
  initial: SponsorFormValues;
  events: Event[];
  onSubmit: (values: SponsorFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  submitLabel?: string;
}) {
  const [v, setV] = useState<SponsorFormValues>(initial);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof SponsorFormValues>(key: K, val: SponsorFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: val }));
  };

  const updateBenefit = (k: keyof Sponsor["benefits"], val: boolean) => {
    setV((p) => ({ ...p, benefits: { ...p.benefits, [k]: val } }));
  };

  const submit = async () => {
    if (!v.companyName.trim()) {
      alert("기업명을 입력해주세요.");
      return;
    }
    if (!v.eventId) {
      alert("행사를 선택해주세요.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(v);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">
      {/* LEFT */}
      <div className="space-y-4 min-w-0">
        <Section title="기본 정보">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FieldText
              label="기업명 *"
              value={v.companyName}
              onChange={(s) => update("companyName", s)}
              placeholder="예: 유비케어"
            />
            <FieldNumber
              label="비용"
              value={v.amount}
              onChange={(n) => update("amount", n)}
            />
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-ink-700 font-semibold">통화</span>
              <select
                value={v.currency}
                onChange={(e) => update("currency", e.target.value as "KRW" | "USD")}
                className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-mint-500"
              >
                <option value="KRW">KRW (원)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <FieldText
              label="비용 메모 (선택)"
              value={v.amountNote}
              onChange={(s) => update("amountNote", s)}
              placeholder="예: (할인가)"
            />
          </div>
        </Section>

        <Section title="품목" right={<AddButton onClick={() => update("items", [...v.items, { label: "" }])} />}>
          {v.items.length === 0 ? (
            <EmptyHint>아직 품목이 없습니다. + 버튼으로 추가하세요.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {v.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.label}
                    onChange={(e) => {
                      const next = [...v.items];
                      next[i] = { ...next[i], label: e.target.value };
                      update("items", next);
                    }}
                    placeholder="예: A홀 천장배너 1, XPACE 패키지 A"
                    className="flex-1 px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
                  />
                  <input
                    type="text"
                    value={it.note ?? ""}
                    onChange={(e) => {
                      const next = [...v.items];
                      next[i] = { ...next[i], note: e.target.value };
                      update("items", next);
                    }}
                    placeholder="메모"
                    className="w-40 px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
                  />
                  <RemoveButton
                    onClick={() => {
                      const next = v.items.filter((_, idx) => idx !== i);
                      update("items", next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="디자인물"
          right={
            <AddButton
              onClick={() =>
                update("designItems", [...v.designItems, { label: "", status: "pending" }])
              }
            />
          }
        >
          {v.designItems.length === 0 ? (
            <EmptyHint>디자인물 항목이 없습니다.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {v.designItems.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_100px_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={it.label}
                    onChange={(e) => {
                      const next = [...v.designItems];
                      next[i] = { ...next[i], label: e.target.value };
                      update("designItems", next);
                    }}
                    placeholder="예: 천장배너, 쇼가이드"
                    className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
                  />
                  <input
                    type="text"
                    value={it.deadline ?? ""}
                    onChange={(e) => {
                      const next = [...v.designItems];
                      next[i] = { ...next[i], deadline: e.target.value };
                      update("designItems", next);
                    }}
                    placeholder="마감 (예: 3월 4일)"
                    className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
                  />
                  <select
                    value={it.status ?? "pending"}
                    onChange={(e) => {
                      const next = [...v.designItems];
                      next[i] = { ...next[i], status: e.target.value as DesignItem["status"] };
                      update("designItems", next);
                    }}
                    className="px-2 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-mint-500"
                  >
                    {Object.entries(DESIGN_STATUS_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <RemoveButton
                    onClick={() => {
                      const next = v.designItems.filter((_, idx) => idx !== i);
                      update("designItems", next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="내부 메모">
          <textarea
            value={v.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="협의 내용, 특이사항 등"
            className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 min-h-[100px] resize-y"
          />
        </Section>
      </div>

      {/* RIGHT */}
      <div className="space-y-4 xl:sticky xl:top-[72px]">
        <Section title="상태 / 행사">
          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-ink-700 font-semibold mb-1 block">상태</span>
              <select
                value={v.status}
                onChange={(e) => update("status", e.target.value as SponsorStatus)}
                className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-mint-500"
              >
                {Object.entries(STATUS_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-[11px] text-ink-700 font-semibold mb-1 block">행사</span>
              <select
                value={v.eventId}
                onChange={(e) => update("eventId", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-mint-500"
              >
                <option value="">— 선택 —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section title="혜택">
          <div className="space-y-1.5">
            <BenefitToggle
              label="이벤트 안내"
              hint="* 표시 — 이벤트/소식 알림 대상"
              checked={v.benefits.eventNotice}
              onChange={(b) => updateBenefit("eventNotice", b)}
            />
            <BenefitToggle
              label="혜택 1 — 상위 고정"
              hint="참가업체 검색 페이지 내 상위 노출"
              checked={v.benefits.topPin}
              onChange={(b) => updateBenefit("topPin", b)}
            />
            <BenefitToggle
              label="혜택 2 — 뱃지 표기"
              hint="주요 참가기업 뱃지"
              checked={v.benefits.badge}
              onChange={(b) => updateBenefit("badge", b)}
            />
            <BenefitToggle
              label="혜택 3 — 로고/배너"
              hint="도면 내 로고/배너 표시"
              checked={v.benefits.logoBanner}
              onChange={(b) => updateBenefit("logoBanner", b)}
            />
          </div>
        </Section>

        <Section title="로고 / 배너">
          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-ink-700 font-semibold mb-1 block">유형</span>
              <select
                value={v.bannerType}
                onChange={(e) => update("bannerType", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-mint-500"
              >
                {BANNER_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o || "— 선택 —"}
                  </option>
                ))}
              </select>
            </div>
            <FieldText
              label="메모"
              value={v.bannerNote}
              onChange={(s) => update("bannerNote", s)}
              placeholder="예: - 준현조, 15초 교차 노출"
            />
          </div>
        </Section>

        <Section
          title="담당자"
          right={
            <AddButton
              onClick={() =>
                update("contacts", [...v.contacts, { name: "", email: "", phone: "" }])
              }
            />
          }
        >
          {v.contacts.length === 0 ? (
            <EmptyHint>담당자가 없습니다.</EmptyHint>
          ) : (
            <div className="space-y-3">
              {v.contacts.map((ct, i) => (
                <div key={i} className="border border-ink-100 rounded-btn p-3 bg-ink-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-ink-700">담당자 {i + 1}</span>
                    <RemoveButton
                      onClick={() => {
                        const next = v.contacts.filter((_, idx) => idx !== i);
                        update("contacts", next);
                      }}
                    />
                  </div>
                  <input
                    type="text"
                    value={ct.name}
                    onChange={(e) => {
                      const next = [...v.contacts];
                      next[i] = { ...next[i], name: e.target.value };
                      update("contacts", next);
                    }}
                    placeholder="이름"
                    className="w-full px-3 py-1.5 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 bg-white"
                  />
                  <input
                    type="email"
                    value={ct.email ?? ""}
                    onChange={(e) => {
                      const next = [...v.contacts];
                      next[i] = { ...next[i], email: e.target.value };
                      update("contacts", next);
                    }}
                    placeholder="이메일"
                    className="w-full px-3 py-1.5 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 bg-white font-mono"
                  />
                  <input
                    type="text"
                    value={ct.phone ?? ""}
                    onChange={(e) => {
                      const next = [...v.contacts];
                      next[i] = { ...next[i], phone: e.target.value };
                      update("contacts", next);
                    }}
                    placeholder="전화 (선택)"
                    className="w-full px-3 py-1.5 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 bg-white font-mono"
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Save / Delete */}
        <div className="bg-white border border-ink-100 rounded-card p-4 space-y-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full px-4 py-2.5 rounded-btn bg-mint-500 text-ink-900 text-sm font-bold hover:bg-mint-700 hover:text-white disabled:opacity-50"
          >
            {saving ? "저장 중…" : submitLabel}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("이 스폰서를 삭제할까요? 되돌릴 수 없습니다.")) return;
                setSaving(true);
                try {
                  await onDelete();
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="w-full px-4 py-2 rounded-btn border border-red-200 text-red-700 text-[12px] font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-ink-100 rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-ink-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-ink-700 font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 bg-white"
      />
    </label>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-ink-700 font-semibold">{label}</span>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(isNaN(n) ? 0 : n);
        }}
        className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 bg-white text-right font-mono"
        placeholder="0"
      />
    </label>
  );
}

function BenefitToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label
      className={
        "flex items-start gap-2.5 px-3 py-2 rounded-btn border cursor-pointer transition-colors " +
        (checked
          ? "border-mint-500 bg-mint-50"
          : "border-ink-100 bg-white hover:bg-ink-50")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-mint-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-ink-900">{label}</div>
        {hint && <div className="text-[10.5px] text-ink-500 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-btn border border-ink-100 text-[11px] font-semibold text-ink-700 hover:bg-ink-50 flex items-center gap-1"
    >
      <Plus className="w-3 h-3" /> 추가
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded text-ink-500 hover:text-red-700 hover:bg-red-50"
      title="삭제"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] text-ink-500 py-3 px-3 bg-ink-50 rounded-btn text-center">
      {children}
    </div>
  );
}
