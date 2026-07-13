"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Library, Plus, Trash2, X } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type {
  Category,
  DesignItem,
  Event,
  Package,
  QuoteSettings,
  Slot,
  Sponsor,
  SponsorContact,
  SponsorItem,
  SponsorStatus,
} from "@/lib/types";

// 행사별 견적서 설정의 defaultBenefitItems 에서 혜택 라벨을 가져옴 — 어드민이
// 견적서 설정을 바꾸면 스폰서 폼의 혜택 라벨도 자동 반영. 비어있는 슬롯은
// 기본 라벨로 폴백.
const FALLBACK_BENEFIT_LABELS = [
  { label: "혜택 1 — 상위 고정", hint: "참가업체 검색 페이지 내 상위 노출" },
  { label: "혜택 2 — 뱃지 표기", hint: "주요 참가기업 뱃지" },
  { label: "혜택 3 — 로고/배너", hint: "도면 내 로고/배너 표시" },
] as const;

// 품목 라이브러리 항목 (카테고리/패키지/슬롯에서 선택해서 채울 수 있도록)
export type SponsorItemLibraryEntry = {
  key: string;                                    // 고유키
  label: string;                                  // 표시 라벨
  group: "패키지" | "카테고리" | "슬롯";
  categoryId?: string;
  subcategoryId?: string;
  slotId?: string;
  packageId?: string;
  hint?: string;                                  // 보조 설명 (예: 코드, 가격)
  /** 단가 (KRW 공급가액) — 선택 시 품목 price 자동 채움. 슬롯→소분류 priceKRW, 패키지→discountPrice||originalPrice */
  price?: number;
};

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
  library,
  packages,
  slots,
  categories,
  onSubmit,
  onDelete,
  submitLabel = "저장",
}: {
  initial: SponsorFormValues;
  events: Event[];
  library?: SponsorItemLibraryEntry[];
  /** 패키지 목록 — 디자인물 펼치기 + 구좌 확보 패널용 */
  packages?: Package[];
  /** 슬롯 목록 — 패키지 품목 구좌 확보 패널용 */
  slots?: Slot[];
  /** 카테고리 목록 — 구좌 확보 패널의 카테고리명 표시용 */
  categories?: Category[];
  onSubmit: (values: SponsorFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  submitLabel?: string;
}) {
  const [v, setV] = useState<SponsorFormValues>(initial);
  const [saving, setSaving] = useState(false);

  // 행사별 혜택 라벨 — 견적서 설정에서 가져옴. 행사 바뀌면 다시 로드.
  const [benefitLabels, setBenefitLabels] = useState<
    Array<{ label: string; hint?: string }>
  >([...FALLBACK_BENEFIT_LABELS]);

  useEffect(() => {
    if (!v.eventId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "quoteSettings", v.eventId));
        if (!snap.exists()) {
          setBenefitLabels([...FALLBACK_BENEFIT_LABELS]);
          return;
        }
        const qs = snap.data() as QuoteSettings;
        const items = qs.defaultBenefitItems ?? [];
        // 앞 3 개만 사용 — 데이터 모델의 topPin/badge/logoBanner 3 boolean 에 대응.
        setBenefitLabels([0, 1, 2].map((i) => ({
          label: items[i]?.label
            ? `혜택 ${i + 1} — ${items[i].label}`
            : FALLBACK_BENEFIT_LABELS[i].label,
          hint: items[i]?.note ?? FALLBACK_BENEFIT_LABELS[i].hint,
        })));
      } catch {
        setBenefitLabels([...FALLBACK_BENEFIT_LABELS]);
      }
    })();
  }, [v.eventId]);

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
                className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-brand-500"
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

        <Section
          title="품목"
          right={<AddButton onClick={() => update("items", [...v.items, { label: "" }])} />}
        >
          {v.items.length === 0 ? (
            <EmptyHint>아직 품목이 없습니다. + 버튼으로 추가하세요.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {v.items.map((it, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ItemCombo
                      value={it}
                      library={library ?? []}
                      onChange={(next) => {
                        const arr = [...v.items];
                        arr[i] = next;
                        update("items", arr);
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      value={it.price ?? ""}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        const next = [...v.items];
                        // 음수 입력은 0 으로 보정
                        next[i] = { ...next[i], price: isNaN(n) ? undefined : Math.max(0, n) };
                        update("items", next);
                      }}
                      placeholder="단가"
                      title="단가 (KRW, VAT 별도)"
                      className="w-32 px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 text-right font-num"
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
                      className="w-40 px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
                    />
                    <RemoveButton
                      onClick={() => {
                        const next = v.items.filter((_, idx) => idx !== i);
                        update("items", next);
                      }}
                    />
                  </div>
                  {it.packageId && (
                    <PackageSlotPanel
                      item={it}
                      pkg={(packages ?? []).find((p) => p.id === it.packageId)}
                      slots={slots ?? []}
                      categories={categories ?? []}
                      otherItemSlotIds={
                        // 다른 품목들이 직접 연결(slotId)했거나 확보(allocatedSlotIds)한
                        // 슬롯 집합 — 같은 슬롯의 이중 확보 방지
                        new Set(
                          v.items
                            .filter((_, idx) => idx !== i)
                            .flatMap((x) => [x.slotId, ...(x.allocatedSlotIds ?? [])])
                            .filter((sid): sid is string => Boolean(sid))
                        )
                      }
                      onChange={(ids) => {
                        const next = [...v.items];
                        next[i] = {
                          ...next[i],
                          allocatedSlotIds: ids.length > 0 ? ids : undefined,
                        };
                        update("items", next);
                      }}
                    />
                  )}
                </div>
              ))}
              {/* 품목 합계 → 비용 적용 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-100">
                <span className="text-[12px] text-ink-700">
                  합계{" "}
                  <b className="font-num text-ink-900">
                    ₩{v.items.reduce((sum, x) => sum + (x.price ?? 0), 0).toLocaleString()}
                  </b>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    update("amount", v.items.reduce((sum, x) => sum + (x.price ?? 0), 0))
                  }
                  className="px-2.5 py-1 rounded-btn border border-brand-200 bg-brand-50 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                  title="품목 단가 합계를 위의 '비용' 필드에 반영합니다 (수기 조정 가능)"
                >
                  합계를 비용에 적용
                </button>
              </div>
            </div>
          )}
          {library && library.length > 0 && (
            <p className="text-[10.5px] text-ink-500 mt-2">
              💡 품목 입력란을 클릭하면 등록된 카테고리·패키지·슬롯에서 선택할 수 있습니다. 자유 입력도 가능해요.
            </p>
          )}
        </Section>

        <Section
          title="디자인물 수령 체크리스트"
          right={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fillDesignFromItems(v, update, packages)}
                disabled={v.items.length === 0}
                className="px-2.5 py-1 rounded-btn border border-brand-200 bg-brand-50 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title={v.items.length === 0 ? "먼저 품목을 추가해주세요" : "품목에서 디자인물 항목 자동 추가"}
              >
                품목에서 자동 추가
              </button>
              <AddButton
                onClick={() =>
                  update("designItems", [...v.designItems, { label: "", status: "pending" }])
                }
              />
            </div>
          }
        >
          {v.designItems.length === 0 ? (
            <EmptyHint>
              참가업체로부터 받아야 할 디자인 파일 목록입니다. 우측 [품목에서 자동 추가] 버튼을 누르면 신청한 품목에서 자동으로 채워집니다.
            </EmptyHint>
          ) : (
            <div className="space-y-1.5">
              {v.designItems.map((it, i) => {
                const done = it.status === "done";
                return (
                  <div
                    key={i}
                    className={
                      "grid grid-cols-[auto_1fr_140px_100px_auto] gap-2 items-center px-2 py-1.5 rounded-btn border " +
                      (done
                        ? "border-brand-200 bg-brand-50"
                        : "border-transparent hover:bg-ink-50")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => {
                        const next = [...v.designItems];
                        next[i] = {
                          ...next[i],
                          status: e.target.checked ? "done" : "pending",
                        };
                        update("designItems", next);
                      }}
                      className="w-4 h-4 accent-brand-500 cursor-pointer"
                      title={done ? "수령 완료 — 클릭해 미수령으로 변경" : "체크하면 수령 완료"}
                    />
                    <input
                      type="text"
                      value={it.label}
                      onChange={(e) => {
                        const next = [...v.designItems];
                        next[i] = { ...next[i], label: e.target.value };
                        update("designItems", next);
                      }}
                      placeholder="디자인물 이름"
                      className={
                        "px-3 py-1.5 text-sm border rounded-btn focus:outline-none focus:border-brand-500 bg-white " +
                        (done ? "line-through text-ink-500 border-brand-100" : "border-ink-100")
                      }
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
                      className="px-3 py-1.5 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
                    />
                    <select
                      value={it.status ?? "pending"}
                      onChange={(e) => {
                        const next = [...v.designItems];
                        next[i] = {
                          ...next[i],
                          status: e.target.value as DesignItem["status"],
                        };
                        update("designItems", next);
                      }}
                      className="px-2 py-1.5 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-brand-500"
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
                );
              })}
              <p className="text-[10.5px] text-ink-500 mt-1">
                💡 체크박스로 수령 완료 여부를 표시합니다. 신청한 품목이 추가/제거되면 [품목에서 자동 추가] 버튼으로 다시 동기화하세요.
              </p>
            </div>
          )}
        </Section>

        <Section title="내부 메모">
          <textarea
            value={v.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="협의 내용, 특이사항 등"
            className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 min-h-[100px] resize-y"
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
                className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-brand-500"
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
                className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-brand-500"
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
              label={benefitLabels[0].label}
              hint={benefitLabels[0].hint}
              checked={v.benefits.topPin}
              onChange={(b) => updateBenefit("topPin", b)}
            />
            <BenefitToggle
              label={benefitLabels[1].label}
              hint={benefitLabels[1].hint}
              checked={v.benefits.badge}
              onChange={(b) => updateBenefit("badge", b)}
            />
            <BenefitToggle
              label={benefitLabels[2].label}
              hint={benefitLabels[2].hint}
              checked={v.benefits.logoBanner}
              onChange={(b) => updateBenefit("logoBanner", b)}
            />
          </div>
        </Section>

        <Section title="추가 혜택 — 로고/배너 상세">
          <p className="text-[10.5px] text-ink-500 mb-2 -mt-1">
            제공할 로고·배너의 종류와 상세 메모입니다.
          </p>
          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-ink-700 font-semibold mb-1 block">유형</span>
              <select
                value={v.bannerType}
                onChange={(e) => update("bannerType", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white focus:outline-none focus:border-brand-500"
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
                    className="w-full px-3 py-1.5 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
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
                    className="w-full px-3 py-1.5 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white font-mono"
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
                    className="w-full px-3 py-1.5 text-[13px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white font-mono"
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
            className="w-full px-4 py-2.5 rounded-btn bg-brand-500 text-ink-900 text-sm font-bold hover:bg-brand-700 hover:text-white disabled:opacity-50"
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
// fillDesignFromItems — 품목에서 디자인물 체크리스트 자동 추가
// 같은 카테고리/패키지의 슬롯들은 하나로 묶고, 슬롯 코드(예: " XPA-1")는 제거
// 패키지 품목은 includedItems 의 단품 라벨로 펼쳐서 추가 (비어있으면 패키지명 1줄 폴백)
// ============================================================================

function fillDesignFromItems(
  v: SponsorFormValues,
  update: <K extends keyof SponsorFormValues>(k: K, val: SponsorFormValues[K]) => void,
  packages?: Package[]
) {
  const seen = new Set<string>();
  const additions: DesignItem[] = [];
  const existing = new Set(
    v.designItems.map((d) => d.label.trim().toLowerCase())
  );

  v.items.forEach((it) => {
    let label = "";
    let key = "";

    if (it.packageId) {
      // 패키지 → 포함 단품(includedItems) 각각을 개별 디자인물로 펼침
      const pkg = (packages ?? []).find((p) => p.id === it.packageId);
      const included = pkg?.includedItems ?? [];
      if (included.length > 0) {
        included.forEach((inc) => {
          const incLabel = inc.label.trim();
          if (!incLabel) return;
          const incKey = `pkg:${it.packageId}:${incLabel.toLowerCase()}`;
          if (seen.has(incKey)) return;
          if (existing.has(incLabel.toLowerCase())) return;
          seen.add(incKey);
          // 같은 실행 내 중복 방지 — 다른 패키지가 같은 단품 라벨을 다시 추가하지 않도록
          existing.add(incLabel.toLowerCase());
          additions.push({ label: incLabel, status: "pending" });
        });
        return;
      }
      // includedItems 비어있으면 기존처럼 패키지 이름 1줄 폴백
      key = `pkg:${it.packageId}`;
      label = it.label.trim();
    } else if (it.categoryId) {
      key = `cat:${it.categoryId}`;
      // "XPACE 브릿지+빅브릿지 XPA-1" → "XPACE 브릿지+빅브릿지"
      label = it.label.replace(/\s+[A-Z]{1,5}-?\d+\s*$/i, "").trim();
    } else {
      key = `free:${it.label.trim().toLowerCase()}`;
      label = it.label.replace(/\s+[A-Z]{1,5}-?\d+\s*$/i, "").trim();
    }

    if (!label) return;
    if (seen.has(key)) return;
    if (existing.has(label.toLowerCase())) return;

    seen.add(key);
    // 같은 실행 내 중복 방지
    existing.add(label.toLowerCase());
    additions.push({ label, status: "pending" });
  });

  if (additions.length === 0) {
    alert("추가할 새 디자인물 항목이 없습니다.\n(이미 모든 품목이 체크리스트에 있거나, 품목에 라벨이 비어있습니다.)");
    return;
  }

  update("designItems", [...v.designItems, ...additions]);
}

// ============================================================================
// ItemCombo — 자유 입력 + 라이브러리 선택 콤보
// ============================================================================

function ItemCombo({
  value,
  library,
  onChange,
}: {
  value: SponsorItem;
  library: SponsorItemLibraryEntry[];
  onChange: (next: SponsorItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value.label);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 외부 value 변경 시 동기화
  useEffect(() => {
    setText(value.label);
  }, [value.label]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = q
      ? library.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            (it.hint ?? "").toLowerCase().includes(q)
        )
      : library;
    // 그룹별 상한 적용 (전체 12개)
    return list.slice(0, 12);
  }, [text, library]);

  const select = (it: SponsorItemLibraryEntry) => {
    onChange({
      label: it.label,
      categoryId: it.categoryId,
      subcategoryId: it.subcategoryId,
      slotId: it.slotId,
      packageId: it.packageId,
      // 슬롯/패키지는 라이브러리 단가 자동 채움, 카테고리는 기존 수기값 유지
      price: it.price ?? value.price,
      // 같은 패키지 재선택이면 확보 구좌 유지, 다른 항목으로 바뀌면 초기화
      allocatedSlotIds:
        it.packageId && it.packageId === value.packageId
          ? value.allocatedSlotIds
          : undefined,
      note: value.note,
    });
    setText(it.label);
    setOpen(false);
  };

  const setFreeText = (s: string) => {
    // 타이핑은 label 만 갱신 — 기존 참조(packageId/slotId/categoryId)와
    // allocatedSlotIds 는 유지한다. 한 글자 수정에 확보 구좌가 조용히
    // 풀리는 사고 방지. 참조 해제는 뱃지의 × 버튼으로만 (명시적).
    onChange({ ...value, label: s });
  };

  // 참조 해제 — 라이브러리 연결(ID들)과 확보 구좌를 명시적으로 끊고 자유 입력 품목으로 전환
  const unlink = () => {
    if ((value.allocatedSlotIds?.length ?? 0) > 0) {
      if (!confirm("연결을 해제하면 확보한 구좌 연결도 함께 해제됩니다. 계속할까요?")) {
        return;
      }
    }
    onChange({
      label: value.label,
      categoryId: undefined,
      subcategoryId: undefined,
      slotId: undefined,
      packageId: undefined,
      allocatedSlotIds: undefined,
      price: value.price,
      note: value.note,
    });
  };

  const linkedTag = value.packageId
    ? "패키지"
    : value.slotId
      ? "슬롯"
      : value.categoryId
        ? "카테고리"
        : null;

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFreeText(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="예: A홀 천장배너 1, XPACE 패키지 A"
          className="w-full pl-3 pr-16 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {linkedTag && (
            <span className="text-[10px] pl-1.5 pr-0.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-100 font-semibold inline-flex items-center gap-0.5">
              {linkedTag}
              <button
                type="button"
                onClick={unlink}
                className="p-0.5 rounded hover:bg-brand-100 text-brand-700"
                title="연결 해제 — 라이브러리 참조를 끊고 자유 입력 품목으로 전환"
                aria-label={`${linkedTag} 연결 해제`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            className="p-1 rounded hover:bg-ink-100 text-ink-500"
            title="라이브러리에서 선택"
            aria-label="라이브러리"
          >
            {library.length > 0 ? (
              <Library className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-ink-100 rounded-card shadow-xl max-h-72 overflow-y-auto">
          {(["패키지", "카테고리", "슬롯"] as const).map((g) => {
            const group = filtered.filter((it) => it.group === g);
            if (group.length === 0) return null;
            return (
              <div key={g}>
                <div className="px-3 py-1 bg-ink-50 text-[10px] uppercase tracking-wider text-ink-500 font-semibold sticky top-0">
                  {g}
                </div>
                {group.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => select(it)}
                    className="w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-brand-50 flex items-center justify-between gap-2"
                  >
                    <span className="text-ink-900 truncate">{it.label}</span>
                    {it.hint && (
                      <span className="text-[10px] text-ink-500 font-mono shrink-0">
                        {it.hint}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {open && filtered.length === 0 && text.trim() && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-ink-100 rounded-card shadow-xl px-3 py-2 text-[11.5px] text-ink-500">
          매칭되는 항목 없음 — 자유 입력으로 저장됩니다.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PackageSlotPanel — 패키지 품목의 구좌 확보 패널
// 패키지 includedItems 의 카테고리별로 슬롯을 직접 골라 확보(allocatedSlotIds).
// 저장 시 확보 슬롯은 'sold' 처리 → 공개 사이트 매진 뱃지에 자동 반영.
// ============================================================================

const SLOT_STATUS_SHORT: Record<Slot["status"], string> = {
  available: "",
  sold: "판매",
  reserved: "예약",
};

function PackageSlotPanel({
  item,
  pkg,
  slots,
  categories,
  otherItemSlotIds,
  onChange,
}: {
  item: SponsorItem;
  pkg?: Package;
  slots: Slot[];
  categories: Category[];
  /** 이 폼의 다른 품목들이 이미 연결/확보한 슬롯 ID 집합 — 이중 확보 방지 */
  otherItemSlotIds?: Set<string>;
  onChange: (allocatedSlotIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!pkg) return null; // 패키지 데이터 미로드/삭제 — 패널 생략

  const allocated = item.allocatedSlotIds ?? [];
  const lines = pkg.includedItems ?? [];
  const lineSlotsFor = (inc: Package["includedItems"][number]) =>
    slots
      .filter(
        (s) =>
          s.categoryId === inc.categoryId &&
          (!inc.subcategoryId || s.subcategoryId === inc.subcategoryId)
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const slotLines = lines.filter((l) => l.categoryId);
  const needed = slotLines.reduce((sum, l) => sum + (l.count ?? 1), 0);
  // 완료 판정 — 총합이 아니라 모든 라인이 각자 필요 수량(count)을 충족했을 때만
  const complete =
    slotLines.length > 0 &&
    slotLines.every((l) => {
      const sel = lineSlotsFor(l).filter((s) => allocated.includes(s.id)).length;
      return sel >= (l.count ?? 1);
    });

  return (
    <div className="ml-4 border border-ink-100 rounded-btn bg-ink-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-ink-50"
      >
        <span className="text-[11.5px] font-semibold text-ink-700 flex items-center gap-1.5">
          <ChevronDown
            className={"w-3.5 h-3.5 transition-transform " + (open ? "rotate-180" : "")}
          />
          구좌 확보
        </span>
        <span
          className={
            "text-[10px] px-1.5 py-0.5 rounded font-semibold font-num border " +
            (complete
              ? "bg-brand-50 text-brand-700 border-brand-100"
              : "bg-white text-ink-500 border-ink-100")
          }
        >
          {allocated.length}/{needed} 확보
        </span>
      </button>
      {open && (
        <div className="px-3 py-2.5 border-t border-ink-100 bg-white space-y-2.5">
          {lines.length === 0 && (
            <p className="text-[11px] text-ink-500">이 패키지에 등록된 포함 품목이 없습니다.</p>
          )}
          {lines.map((inc, li) => {
            if (!inc.categoryId) {
              return (
                <div key={li} className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-ink-700">{inc.label}</span>
                  <span className="text-[10.5px] text-ink-500">수동 항목 — 구좌 연결 불가</span>
                </div>
              );
            }
            const cat = categories.find((c) => c.id === inc.categoryId);
            const lineSlots = lineSlotsFor(inc);
            const count = inc.count ?? 1;
            const selectedHere = lineSlots.filter((s) => allocated.includes(s.id)).length;
            return (
              <div key={li}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-ink-900">
                    {cat?.name.ko ?? inc.label}
                  </span>
                  <span
                    className={
                      "text-[10.5px] font-num " +
                      (selectedHere >= count
                        ? "text-brand-700 font-semibold"
                        : "text-ink-500")
                    }
                  >
                    {selectedHere}/{count}개 필요
                  </span>
                </div>
                {lineSlots.length === 0 ? (
                  <p className="text-[10.5px] text-ink-500">등록된 구좌가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {lineSlots.map((s) => {
                      const selected = allocated.includes(s.id);
                      // 이미 이 품목이 확보한 슬롯(편집 시 sold 상태)은 선택 유지/해제 가능
                      const statusBlocked = !selected && s.status !== "available";
                      // 같은 폼의 다른 품목이 이미 연결/확보한 슬롯 — 이중 확보 방지
                      const heldByOther =
                        !selected && (otherItemSlotIds?.has(s.id) ?? false);
                      // 이 라인이 필요 수량을 모두 확보했으면 나머지 칩 비활성
                      const lineFull = !selected && selectedHere >= count;
                      const disabled = statusBlocked || heldByOther || lineFull;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            onChange(
                              selected
                                ? allocated.filter((sid) => sid !== s.id)
                                : [...allocated, s.id]
                            )
                          }
                          title={
                            selected
                              ? `${s.code} — 확보됨 (클릭해 해제)`
                              : heldByOther
                                ? `${s.code} — 다른 품목에서 확보됨 (선택 불가)`
                                : statusBlocked
                                  ? `${s.code} — ${s.status === "sold" ? "판매됨" : "예약됨"} (선택 불가)`
                                  : lineFull
                                    ? `${s.code} — 이 항목의 필요 수량(${count}개)을 모두 확보했습니다`
                                    : `${s.code} — 클릭해 확보`
                          }
                          className={
                            "px-2 py-1 rounded-btn border text-[11px] font-mono transition-colors " +
                            (selected
                              ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold"
                              : disabled
                                ? "border-ink-100 bg-ink-50 text-ink-300 cursor-not-allowed"
                                : "border-ink-100 bg-white text-ink-700 hover:bg-ink-50")
                          }
                        >
                          {s.code}
                          {heldByOther ? (
                            <span className="ml-1 text-[9px] opacity-70">타품목</span>
                          ) : (
                            SLOT_STATUS_SHORT[s.status] && (
                              <span className="ml-1 text-[9px] opacity-70">
                                {SLOT_STATUS_SHORT[s.status]}
                              </span>
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-ink-500 pt-0.5">
            💡 저장하면 확보한 구좌가 &lsquo;판매&rsquo; 처리되고, 공개 사이트의 매진 표시에 자동 반영됩니다.
          </p>
        </div>
      )}
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
        className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
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
        className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white text-right font-mono"
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
          ? "border-brand-500 bg-brand-50"
          : "border-ink-100 bg-white hover:bg-ink-50")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-brand-500"
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
