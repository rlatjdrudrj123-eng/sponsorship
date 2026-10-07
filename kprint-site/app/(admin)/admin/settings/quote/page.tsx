"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { AlertTriangle, Check, FileText, Plus, Trash2 } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Event as EventDoc, QuoteSettings } from "@/lib/types";

// 회사 확정 정보 (사업자등록번호·대표이사 — 대표 확인, 사이트 푸터와 같은 값)
const CONFIRMED_BIZ_NO = "120-81-81311";
const CONFIRMED_REPRESENTATIVE = "김충한·김정조";
// 예전 기본값에 들어 있던 잘못된 번호 (끝자리 1 추가)
const KNOWN_WRONG_BIZ_NO = "120-81-813111";

// 회사 공통 기본값 — 행사와 무관한 항목만
const COMPANY_DEFAULTS: Pick<
  QuoteSettings,
  "issuer" | "bank" | "defaultPaymentTerms" | "footerSlogan"
> = {
  issuer: {
    companyName: "㈜한국이앤엑스",
    businessNumber: CONFIRMED_BIZ_NO,
    representative: CONFIRMED_REPRESENTATIVE,
    address: "서울시 강남구 영동대로 511 트레이드타워 2001호",
    businessType: "서비스",
    industry: "전시회장",
    phone: "02)551-0102",
    fax: "02)551-0103",
    contactDept: "전시사업부",
    contactName: "",
  },
  bank: {
    bankName: "우리은행",
    accountNumber: "424-04-132799",
    accountHolder: "(주)한국이앤엑스",
  },
  defaultPaymentTerms: "전액 현금 완납",
  footerSlogan: "한국의 전시문화를 선도하는 ㈜한국이앤엑스가 되겠습니다.",
};

function nameOf(n: unknown): string {
  if (typeof n === "string") return n;
  if (n && typeof n === "object") {
    const o = n as { ko?: unknown };
    if (typeof o.ko === "string") return o.ko;
  }
  return "";
}

// 행사별 기본 문구 — 행사명만 넣고 일정·장소는 담당자가 채운다 (다른 행사 문구 복사 방지)
function eventDefaults(
  ev: EventDoc | undefined
): Pick<
  QuoteSettings,
  "eventSubtitle" | "eventIntro" | "serialPrefix" | "serialNextNumber" | "defaultBenefitItems"
> {
  const name = nameOf(ev?.name) || "전시회";
  const short = (ev?.shortName || name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "SPN";
  const yy = String(ev?.year ?? new Date().getFullYear()).slice(-2);
  return {
    eventSubtitle: name,
    eventIntro: `${name} 전시회의 스폰서십 참가에 관하여, 다음과 같이 제안하오니 검토해주시기 바랍니다.`,
    serialPrefix: `${short}${yy}-`,
    serialNextNumber: 1,
    defaultBenefitItems: [
      { label: "상위 고정", note: "참가업체 검색 페이지 내 상위 고정" },
      { label: "뱃지 표기", note: "주요 참가기업 뱃지 표기" },
      { label: "도면 내 로고 표기" },
      { label: "홍보자료 노출", note: "뉴스레터 및 SNS 추가 노출" },
    ],
  };
}

export default function QuoteSettingsPage() {
  const { eventId, ready } = useEventFilter();
  const [v, setV] = useState<QuoteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [events, setEvents] = useState<EventDoc[]>([]);
  // 저장된 설정이 없어 기본값을 채운 상태
  const [isDraft, setIsDraft] = useState(false);

  useEffect(() => {
    if (!ready || !eventId) return;
    setLoading(true);
    (async () => {
      try {
        const db = getDb();
        const [snap, evSnap] = await Promise.all([
          getDoc(doc(db, "quoteSettings", eventId)),
          getDocs(collection(db, "events")),
        ]);
        const evList = evSnap.docs.map((d) => ({ ...(d.data() as EventDoc), id: d.id }));
        setEvents(evList);
        const ev = evList.find((e) => e.id === eventId);
        if (snap.exists()) {
          setV({
            ...COMPANY_DEFAULTS,
            ...eventDefaults(ev),
            ...(snap.data() as QuoteSettings),
          });
          setIsDraft(false);
        } else {
          // 회사 정보는 공용(main) 설정이 있으면 그 값, 행사 문구는 이 행사 이름으로
          let company = COMPANY_DEFAULTS;
          try {
            const main = await getDoc(doc(db, "quoteSettings", "main"));
            if (main.exists()) {
              const m = main.data() as QuoteSettings;
              company = {
                issuer: { ...COMPANY_DEFAULTS.issuer, ...m.issuer },
                bank: { ...COMPANY_DEFAULTS.bank, ...m.bank },
                defaultPaymentTerms: m.defaultPaymentTerms ?? COMPANY_DEFAULTS.defaultPaymentTerms,
                footerSlogan: m.footerSlogan ?? COMPANY_DEFAULTS.footerSlogan,
              };
            }
          } catch {
            // 읽기 권한 없음 — 회사 기본값 사용
          }
          // 담당자 이름은 행사(팀)마다 달라 비워 둔다
          setV({
            ...company,
            issuer: { ...company.issuer, contactName: "" },
            ...eventDefaults(ev),
          } as QuoteSettings);
          setIsDraft(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, eventId]);

  // 확인할 사항 — 잘못된 사업자번호, 대표이사 누락, 다른 행사 문구
  const issues = useMemo(() => {
    if (!v || !eventId) return null;
    const cur = events.find((e) => e.id === eventId);
    const text = `${v.eventSubtitle ?? ""} ${v.eventIntro ?? ""}`.toUpperCase();
    const curShort = (cur?.shortName ?? "").toUpperCase();
    const otherMentioned = events
      .filter((e) => e.id !== eventId && e.shortName)
      .map((e) => e.shortName)
      .filter(
        (s) =>
          text.includes(s.toUpperCase()) &&
          // 이 행사 단축명이 다른 행사 단축명을 포함하는 경우(KIMES ⊂ KIMES 부산) 오탐 방지
          !(curShort && curShort.includes(s.toUpperCase()))
      );
    return {
      bizWrong: v.issuer.businessNumber.replace(/\s/g, "") === KNOWN_WRONG_BIZ_NO,
      repSingle: v.issuer.representative.trim() === "김정조",
      otherMentioned,
      eventName: nameOf(cur?.name),
    };
  }, [v, events, eventId]);

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
      setIsDraft(false);
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
            data-tour="quote-save"
            className="px-4 py-2 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-bold hover:bg-brand-700 hover:text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </header>

      {isDraft && (
        <div className="bg-brand-50 border border-brand-100 rounded-card px-4 py-3 text-[13px] text-ink-900 break-keep">
          이 행사는 저장된 견적서 설정이 없어 기본값을 채웠습니다. 행사 일정·장소와 담당자를 확인한 뒤
          저장하세요. 저장 전에는 견적서를 뽑을 수 없습니다.
        </div>
      )}

      {issues && (issues.bizWrong || issues.repSingle || issues.otherMentioned.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            확인할 사항 — 고친 뒤 [저장]을 눌러야 반영됩니다
          </div>
          {issues.bizWrong && (
            <IssueRow
              text={`사업자번호가 ${KNOWN_WRONG_BIZ_NO} 로 저장돼 있습니다. 확정값은 ${CONFIRMED_BIZ_NO} 입니다.`}
              action="확정값으로 고치기"
              onFix={() =>
                update((p) => ({ ...p, issuer: { ...p.issuer, businessNumber: CONFIRMED_BIZ_NO } }))
              }
            />
          )}
          {issues.repSingle && (
            <IssueRow
              text={`대표이사가 김정조 한 명만 있습니다. 확정값은 ${CONFIRMED_REPRESENTATIVE} 입니다.`}
              action="확정값으로 고치기"
              onFix={() =>
                update((p) => ({
                  ...p,
                  issuer: { ...p.issuer, representative: CONFIRMED_REPRESENTATIVE },
                }))
              }
            />
          )}
          {issues.otherMentioned.length > 0 && (
            <IssueRow
              text={`견적서 문구에 다른 행사(${issues.otherMentioned.join(", ")}) 이름이 들어 있습니다. ${
                issues.eventName || "이 행사"
              }의 부제·안내 문구·일련번호 접두어를 확인하세요.`}
              action="이 행사 기본 문구로 바꾸기"
              onFix={() =>
                update((p) => {
                  const d = eventDefaults(events.find((e) => e.id === eventId));
                  return {
                    ...p,
                    eventSubtitle: d.eventSubtitle,
                    eventIntro: d.eventIntro,
                    serialPrefix: d.serialPrefix,
                  };
                })
              }
            />
          )}
        </div>
      )}

      {/* 발행자 정보 */}
      <Section title="사무국(발행자) 정보" tour="quote-issuer">
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
      <Section title="문의 알림">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-700 font-semibold">
            새 문의가 오면 메일 받을 주소 (쉼표로 구분)
          </span>
          <input
            type="text"
            value={(v as QuoteSettings & { notifyEmails?: string }).notifyEmails ?? ""}
            onChange={(e) => update((p) => ({ ...p, notifyEmails: e.target.value }) as QuoteSettings)}
            placeholder="sales@eandex.co.kr, kim@eandex.co.kr"
            className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
          />
          <span className="text-[11.5px] text-ink-500 break-keep">
            이 전시회에 배정된 담당자에게는 따로 적지 않아도 갑니다. 둘 다 없으면 관리자 메일로 갑니다.
            이 화면은 내부 전용이라 공개 사이트에 노출되지 않습니다.
          </span>
        </label>
      </Section>

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
      <Section title="견적서 본문 기본값" tour="quote-body">
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
  tour,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  /** 따라하기가 짚는 대상 (data-tour) */
  tour?: string;
}) {
  return (
    <section data-tour={tour} className="bg-white border border-ink-100 rounded-card p-5">
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

function IssueRow({
  text,
  action,
  onFix,
}: {
  text: string;
  action: string;
  onFix: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12.5px] text-amber-900">
      <span className="break-keep leading-relaxed">{text}</span>
      <button
        type="button"
        onClick={onFix}
        className="shrink-0 px-2.5 py-1 rounded-btn border border-amber-300 bg-white text-[12px] font-semibold text-amber-800 hover:bg-amber-100"
      >
        {action}
      </button>
    </div>
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
