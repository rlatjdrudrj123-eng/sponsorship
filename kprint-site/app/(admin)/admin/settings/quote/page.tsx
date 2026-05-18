"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Check, FileText, Plus, Trash2 } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { QuoteSettings } from "@/lib/types";

const DEFAULT_SETTINGS: QuoteSettings = {
  issuer: {
    companyName: "㈜한국이앤엑스",
    businessNumber: "120-81-813111",
    representative: "김정조",
    address: "서울시 강남구 영동대로 511 트레이드타워 2001호",
    businessType: "서비스",
    industry: "전시회장",
    phone: "02)551-0102",
    fax: "02)551-0103",
    contactDept: "전시사업부",
    contactName: "조준현 대리",
  },
  bank: {
    bankName: "우리은행",
    accountNumber: "424-04-132799",
    accountHolder: "(주)한국이앤엑스",
  },
  eventSubtitle: "K-PRINT 2026 — 국제 인쇄·디지털 프린팅 전시회",
  eventIntro:
    "오는 2026년 8월 26일부터 28일까지 KINTEX 제1전시장에서 개최되는 K-PRINT 2026 전시회의 스폰서십 참가에 관하여, 다음과 같이 제안하오니 검토해주시기 바랍니다.",
  serialPrefix: "KPR26-",
  serialNextNumber: 1,
  defaultPaymentTerms: "전액 현금 완납",
  defaultBenefitItems: [
    { label: "상위 고정", note: "참가업체 검색 페이지 내 상위 고정" },
    { label: "뱃지 표기", note: "주요 참가기업 뱃지 표기" },
    { label: "도면 내 로고 표기" },
    { label: "홍보자료 노출", note: "K-PRINT 뉴스레터 및 SNS 추가 노출" },
  ],
  footerSlogan: "한국의 전시문화를 선도하는 ㈜한국이앤엑스가 되겠습니다.",
};

export default function QuoteSettingsPage() {
  const { eventId, ready } = useEventFilter();
  const [v, setV] = useState<QuoteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!ready || !eventId) return;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "quoteSettings", eventId));
        if (snap.exists()) {
          setV({ ...DEFAULT_SETTINGS, ...(snap.data() as QuoteSettings) });
        } else {
          setV(DEFAULT_SETTINGS);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, eventId]);

  const update = (updater: (prev: QuoteSettings) => QuoteSettings) => {
    setV((p) => (p ? updater(p) : p));
  };

  const save = async () => {
    if (!v || !eventId) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(getDb(), "quoteSettings", eventId), {
        ...v,
        eventId,
        updatedAt: serverTimestamp(),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setSaveStatus("error");
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (!ready) {
    return <div className="text-sm text-ink-500 text-center py-16">행사 정보 불러오는 중…</div>;
  }
  if (!eventId) {
    return (
      <div className="text-sm text-ink-500 text-center py-16">
        상단 셀렉터에서 행사를 먼저 선택하세요.
      </div>
    );
  }
  if (loading || !v) {
    return <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-700" />
            견적서 설정
          </h1>
          <p className="text-[13px] text-ink-700 mt-1">
            견적서에 자동으로 채워질 사무국 정보·계좌·기본 문구입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} />
          <button
            type="button"
            onClick={save}
            disabled={saveStatus === "saving"}
            className="px-4 py-2 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-bold hover:bg-brand-700 hover:text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </header>

      {/* 발행자 정보 */}
      <Section title="사무국(발행자) 정보">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="상호"
            value={v.issuer.companyName}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, companyName: s } }))}
          />
          <Field
            label="사업자번호"
            value={v.issuer.businessNumber}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, businessNumber: s } }))}
          />
          <Field
            label="대표이사"
            value={v.issuer.representative}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, representative: s } }))}
          />
          <Field
            label="업태"
            value={v.issuer.businessType}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, businessType: s } }))}
          />
          <Field
            label="업종"
            value={v.issuer.industry}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, industry: s } }))}
          />
          <div />
          <FieldFull
            label="사업장 주소"
            value={v.issuer.address}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, address: s } }))}
          />
          <Field
            label="전화"
            value={v.issuer.phone}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, phone: s } }))}
          />
          <Field
            label="팩스"
            value={v.issuer.fax}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, fax: s } }))}
          />
          <Field
            label="담당 부서"
            value={v.issuer.contactDept}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, contactDept: s } }))}
          />
          <Field
            label="담당자"
            value={v.issuer.contactName}
            onChange={(s) => update((p) => ({ ...p, issuer: { ...p.issuer, contactName: s } }))}
          />
        </div>
      </Section>

      {/* 계좌 정보 */}
      <Section title="입금 계좌">
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="은행명"
            value={v.bank.bankName}
            onChange={(s) => update((p) => ({ ...p, bank: { ...p.bank, bankName: s } }))}
          />
          <Field
            label="계좌번호"
            value={v.bank.accountNumber}
            onChange={(s) => update((p) => ({ ...p, bank: { ...p.bank, accountNumber: s } }))}
          />
          <Field
            label="예금주"
            value={v.bank.accountHolder}
            onChange={(s) => update((p) => ({ ...p, bank: { ...p.bank, accountHolder: s } }))}
          />
        </div>
      </Section>

      {/* 행사·일련번호 */}
      <Section title="견적서 본문 기본값">
        <FieldFull
          label="행사 부제 (제목 옆)"
          value={v.eventSubtitle}
          onChange={(s) => update((p) => ({ ...p, eventSubtitle: s }))}
        />
        <div className="mt-3">
          <span className="text-[12px] text-ink-700 font-semibold mb-1 block">
            행사 안내 문구 (견적서 상단)
          </span>
          <textarea
            value={v.eventIntro}
            onChange={(e) => update((p) => ({ ...p, eventIntro: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 resize-y"
          />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Field
            label="일련번호 prefix"
            value={v.serialPrefix}
            onChange={(s) => update((p) => ({ ...p, serialPrefix: s }))}
          />
          <FieldNumber
            label="다음 일련번호"
            value={v.serialNextNumber}
            onChange={(n) => update((p) => ({ ...p, serialNextNumber: n }))}
          />
          <Field
            label="지불 조건 기본값"
            value={v.defaultPaymentTerms}
            onChange={(s) => update((p) => ({ ...p, defaultPaymentTerms: s }))}
          />
        </div>
      </Section>

      {/* 추가제공 항목 */}
      <Section
        title="추가 제공 항목 (기본값)"
        right={
          <button
            type="button"
            onClick={() =>
              update((p) => ({
                ...p,
                defaultBenefitItems: [...p.defaultBenefitItems, { label: "" }],
              }))
            }
            className="px-2.5 py-1 rounded-btn border border-ink-100 text-[11px] font-semibold text-ink-700 hover:bg-ink-50 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> 추가
          </button>
        }
      >
        <div className="space-y-2">
          {v.defaultBenefitItems.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <input
                type="text"
                value={it.label}
                onChange={(e) =>
                  update((p) => {
                    const next = [...p.defaultBenefitItems];
                    next[i] = { ...next[i], label: e.target.value };
                    return { ...p, defaultBenefitItems: next };
                  })
                }
                placeholder="예: 상위 고정"
                className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                value={it.note ?? ""}
                onChange={(e) =>
                  update((p) => {
                    const next = [...p.defaultBenefitItems];
                    next[i] = { ...next[i], note: e.target.value };
                    return { ...p, defaultBenefitItems: next };
                  })
                }
                placeholder="비고 (선택)"
                className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() =>
                  update((p) => ({
                    ...p,
                    defaultBenefitItems: p.defaultBenefitItems.filter((_, idx) => idx !== i),
                  }))
                }
                className="p-1.5 rounded text-ink-500 hover:text-red-700 hover:bg-red-50"
                title="삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* 푸터 */}
      <Section title="푸터 슬로건">
        <FieldFull
          label="견적서 하단 한 줄"
          value={v.footerSlogan}
          onChange={(s) => update((p) => ({ ...p, footerSlogan: s }))}
        />
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saveStatus === "saving"}
          className="px-5 py-2.5 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-bold hover:bg-brand-700 hover:text-white disabled:opacity-50"
        >
          {saveStatus === "saving" ? "저장 중…" : "전체 저장"}
        </button>
      </div>
    </div>
  );
}

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

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-ink-700 font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
      />
    </label>
  );
}

function FieldFull({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="col-span-full flex flex-col gap-1">
      <span className="text-[12px] text-ink-700 font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(isNaN(n) ? 0 : n);
        }}
        className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white text-right font-mono"
      />
    </label>
  );
}

function SaveStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saved") {
    return (
      <span className="text-[11px] text-brand-700 flex items-center gap-1">
        <Check className="w-3 h-3" /> 저장됨
      </span>
    );
  }
  if (status === "saving") return <span className="text-[11px] text-ink-500">저장 중…</span>;
  if (status === "error") return <span className="text-[11px] text-red-700">실패</span>;
  return null;
}
