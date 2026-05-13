"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { Printer } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type {
  Category,
  Event,
  Inquiry,
  Package,
  QuoteSettings,
  Slot,
  Sponsor,
  Subcategory,
} from "@/lib/types";

type QuoteLine = {
  category: string;       // "스폰서십" / "추가 제공"
  label: string;
  quantity?: string;
  unit?: string;
  unitPrice?: number;
  amount?: number;
  note?: string;
};

export default function QuotePrintPage() {
  const params = useParams<{ source: string; id: string }>();
  const source = params.source; // "inquiry" or "sponsor"
  const id = params.id;

  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [target, setTarget] = useState<{
    receiver: string;
    items: QuoteLine[];
    extraItems: QuoteLine[];
    totalOverride?: number;   // sponsor의 amount처럼 명시적 합계가 있을 때
    paid?: number;
    eventName?: string;
    eventBrand?: string;      // 좌상단 큰 텍스트 (예: "KIMES 2026")
  } | null>(null);
  const [serial, setSerial] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();

        // 1) 먼저 source 도큐먼트에서 eventId 확인 — 행사별 quoteSettings 로드용
        let sourceEventId: string | null = null;
        if (source === "inquiry") {
          const s = await getDoc(doc(db, "inquiries", id));
          if (s.exists()) sourceEventId = (s.data() as Inquiry).eventId ?? null;
        } else if (source === "sponsor") {
          const s = await getDoc(doc(db, "sponsors", id));
          if (s.exists()) sourceEventId = (s.data() as Sponsor).eventId ?? null;
        }

        // 2) 행사별 quoteSettings (없으면 main 폴백 — 레거시 보호)
        let settingsSnap = sourceEventId
          ? await getDoc(doc(db, "quoteSettings", sourceEventId))
          : null;
        if (!settingsSnap || !settingsSnap.exists()) {
          settingsSnap = await getDoc(doc(db, "quoteSettings", "main"));
        }
        if (!settingsSnap.exists()) {
          alert("견적서 설정이 없습니다. /admin/settings/quote 에서 먼저 설정해주세요.");
          return;
        }
        const s = settingsSnap.data() as QuoteSettings;
        setSettings(s);

        // 일련번호 (간단히 prefix + nextNumber, 발급 시 admin이 직접 증가)
        setSerial(`${s.serialPrefix ?? ""}${String(s.serialNextNumber ?? 1).padStart(3, "0")}`);

        // 카테고리/소분류/슬롯/패키지/이벤트 일괄 로드 (단가 조회용)
        const [catSnap, subSnap, slotSnap, pkgSnap, evSnap] = await Promise.all([
          getDocs(collection(db, "categories")),
          getDocs(collection(db, "subcategories")),
          getDocs(collection(db, "slots")),
          getDocs(collection(db, "packages")),
          getDocs(collection(db, "events")),
        ]);
        const catMap = new Map<string, Category>();
        catSnap.docs.forEach((d) => catMap.set(d.id, { ...(d.data() as Category), id: d.id }));
        const subMap = new Map<string, Subcategory>();
        subSnap.docs.forEach((d) => subMap.set(d.id, { ...(d.data() as Subcategory), id: d.id }));
        const slotMap = new Map<string, Slot>();
        slotSnap.docs.forEach((d) => slotMap.set(d.id, { ...(d.data() as Slot), id: d.id }));
        const pkgMap = new Map<string, Package>();
        pkgSnap.docs.forEach((d) => pkgMap.set(d.id, { ...(d.data() as Package), id: d.id }));
        const events = evSnap.docs.map((d) => ({ ...(d.data() as Event), id: d.id }));

        // 추가 제공 — 항상 settings의 기본 4종 사용 (스폰서별 토글 무시)
        const defaultExtras: QuoteLine[] = (s.defaultBenefitItems ?? []).map((b) => ({
          category: "추가 제공",
          label: b.label,
          quantity: "1.0",
          unit: "제공",
          note: b.note,
        }));

        if (source === "inquiry") {
          const inqSnap = await getDoc(doc(db, "inquiries", id));
          if (!inqSnap.exists()) {
            alert("문의를 찾을 수 없습니다.");
            return;
          }
          const inq = inqSnap.data() as Inquiry;

          // 같은 (카테고리+소분류) 슬롯은 한 줄로 묶고 수량 카운트
          const aggregated = new Map<
            string,
            { line: QuoteLine; count: number; codes: string[] }
          >();
          inq.cartItems.forEach((ci) => {
            if (ci.type === "slot") {
              const cat = catMap.get(ci.categoryId);
              const sb = subMap.get(ci.subcategoryId);
              const key = `slot:${ci.categoryId}:${ci.subcategoryId}`;
              const existing = aggregated.get(key);
              if (existing) {
                existing.count++;
                existing.codes.push(ci.code);
              } else {
                aggregated.set(key, {
                  line: {
                    category: "스폰서십",
                    label: `${cat?.name.ko ?? ""}${sb?.name.ko ? ` · ${sb.name.ko}` : ""}`.trim() || ci.code,
                    unit: "구좌",
                    unitPrice: ci.price,
                  },
                  count: 1,
                  codes: [ci.code],
                });
              }
            } else {
              const pkg = pkgMap.get(ci.packageId);
              aggregated.set(`pkg:${ci.packageId}:${aggregated.size}`, {
                line: {
                  category: "스폰서십",
                  label: pkg?.name.ko ?? ci.code,
                  unit: "패키지",
                  unitPrice: ci.price,
                },
                count: 1,
                codes: [ci.code],
              });
            }
          });

          const items: QuoteLine[] = Array.from(aggregated.values()).map(
            ({ line, count, codes }) => ({
              ...line,
              quantity: count.toFixed(1),
              amount: (line.unitPrice ?? 0) * count,
              note: codes.join(", "),
            })
          );

          // 활성 행사를 brand로 사용
          const activeEvent = events.find((e) => e.isActive) ?? events[0];
          setTarget({
            receiver: inq.companyName,
            items,
            extraItems: defaultExtras,
            eventName: activeEvent?.name,
            eventBrand: activeEvent ? `${activeEvent.shortName} ${activeEvent.year}` : undefined,
          });
        } else if (source === "sponsor") {
          const spSnap = await getDoc(doc(db, "sponsors", id));
          if (!spSnap.exists()) {
            alert("스폰서를 찾을 수 없습니다.");
            return;
          }
          const sp = spSnap.data() as Sponsor;
          const event = events.find((e) => e.id === sp.eventId);

          // 같은 (카테고리+소분류) 슬롯은 한 줄로 묶고 수량 카운트
          const aggregated = new Map<
            string,
            { line: QuoteLine; count: number; codes: string[] }
          >();
          (sp.items ?? []).forEach((it) => {
            let unitPrice: number | undefined;
            let unit = "구좌";
            let key: string;
            let label = it.label;
            let code: string | undefined;

            if (it.slotId) {
              const slot = slotMap.get(it.slotId);
              code = slot?.code;
              if (slot) {
                const sb = subMap.get(slot.subcategoryId);
                if (sb && sb.priceKRW > 0) unitPrice = sb.priceKRW;
                // 라벨 정리 — 슬롯 코드가 라벨 끝에 붙어있으면 떼어내고 카테고리·소분류 기준으로 묶기
                const cat = catMap.get(slot.categoryId);
                if (cat && sb) {
                  label = `${cat.name.ko}${sb.name.ko ? ` · ${sb.name.ko}` : ""}`;
                }
              }
              key = `slot:${slot?.categoryId ?? "?"}:${slot?.subcategoryId ?? "?"}`;
            } else if (it.packageId) {
              const pkg = pkgMap.get(it.packageId);
              if (pkg) {
                unitPrice = pkg.discountPrice || pkg.originalPrice;
                unit = "패키지";
                label = pkg.name.ko;
              }
              key = `pkg:${it.packageId}`;
            } else if (it.subcategoryId) {
              const sb = subMap.get(it.subcategoryId);
              if (sb && sb.priceKRW > 0) unitPrice = sb.priceKRW;
              key = `sub:${it.subcategoryId}`;
            } else {
              // 자유 입력 — 묶지 않음
              key = `free:${it.label}:${aggregated.size}`;
              unit = it.note ? "" : "구좌";
            }

            const existing = aggregated.get(key);
            if (existing) {
              existing.count++;
              if (code) existing.codes.push(code);
            } else {
              aggregated.set(key, {
                line: {
                  category: "스폰서십",
                  label,
                  unit,
                  unitPrice,
                  note: it.note,
                },
                count: 1,
                codes: code ? [code] : [],
              });
            }
          });

          const items: QuoteLine[] = Array.from(aggregated.values()).map(
            ({ line, count, codes }) => ({
              ...line,
              quantity: count.toFixed(1),
              amount: line.unitPrice ? line.unitPrice * count : undefined,
              note: codes.length > 0 ? codes.join(", ") : line.note,
            })
          );

          setTarget({
            receiver: sp.companyName,
            items,
            extraItems: defaultExtras,
            totalOverride: sp.amount > 0 ? sp.amount : undefined,
            eventName: event?.name,
            eventBrand: event ? `${event.shortName} ${event.year}` : undefined,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [source, id]);

  // 자동 인쇄
  useEffect(() => {
    if (loading || !target || !settings) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [loading, target, settings]);

  // 합계 계산: items의 amount 합 (수량 × 단가) 또는 totalOverride
  const subtotal = useMemo(() => {
    if (!target) return 0;
    const itemsTotal = target.items.reduce((sum, it) => sum + (it.amount ?? 0), 0);
    if (itemsTotal > 0) return itemsTotal;
    // sponsor의 amount만 명시되어 있고 단가 합산이 0이면 totalOverride를 소계로 사용 (VAT 별도)
    if (target.totalOverride !== undefined) {
      return Math.round(target.totalOverride / 1.1);
    }
    return 0;
  }, [target]);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;
  const paid = target?.paid ?? 0;
  const remaining = total - paid;

  const today = new Date()
    .toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\./g, "-")
    .replace(/ /g, "")
    .replace(/-$/, "");

  if (loading) {
    return <div className="p-12 text-center text-sm text-ink-500">불러오는 중…</div>;
  }

  if (!target || !settings) {
    return (
      <div className="p-12 text-center text-sm text-red-700">
        견적서 데이터를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-ink-50 min-h-screen print:bg-white">
      {/* 인쇄 안내 */}
      <div className="print:hidden bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between">
        <p className="text-[13px] text-ink-700">
          견적서 미리보기 — 자동으로 인쇄 다이얼로그가 열립니다. PDF로 저장하려면 [PDF로 저장]을 선택하세요.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" />
          인쇄 / PDF
        </button>
      </div>

      {/* A4 sheet */}
      <div className="mx-auto print:mx-0 my-6 print:my-0 bg-white shadow print:shadow-none w-[210mm] min-h-[297mm] p-12 print:p-10 a4-sheet text-[11px] text-ink-900">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 pb-2">
          <div>
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="로고" className="h-12 mb-2" />
            ) : (
              <div className="text-[28px] font-black text-red-600 leading-none tracking-tight">
                {target.eventBrand ?? target.eventName ?? "EVENT"}
              </div>
            )}
            <div className="text-[10px] text-ink-700 mt-1.5">
              {settings.eventSubtitle}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[24px] font-bold tracking-[0.3em] text-ink-900">
              스폰서십 견적서
            </div>
          </div>
        </header>

        {/* Intro */}
        <p className="mt-3 text-[10.5px] leading-relaxed text-ink-700 whitespace-pre-line">
          {settings.eventIntro}
        </p>

        {/* Receiver */}
        <div className="mt-4 pb-2 border-b-2 border-ink-900">
          <div className="text-[16px] font-bold text-ink-900">{target.receiver}</div>
        </div>

        {/* Meta — 두 컬럼 (수신/발신) */}
        <div className="mt-3 grid grid-cols-2 gap-6">
          <table className="w-full border-collapse">
            <tbody className="text-[10.5px]">
              <MetaRow label="수    신" value={target.receiver} />
              <MetaRow label="견적일자" value={today} />
              <MetaRow label="지불조건" value={settings.defaultPaymentTerms} />
              <MetaRow label="입 금 액" value={paid > 0 ? `${paid.toLocaleString()}원` : "- 원"} />
              <MetaRow label="잔    액" value={remaining > 0 ? `${remaining.toLocaleString()}원` : "- 원"} />
            </tbody>
          </table>
          <table className="w-full border-collapse">
            <tbody className="text-[10.5px]">
              <MetaRow label="일련번호" value={serial} />
              <MetaRow label="상호" value={settings.issuer.companyName} />
              <MetaRow label="사업자번호" value={settings.issuer.businessNumber} />
              <MetaRow label="대표이사" value={settings.issuer.representative} />
              <MetaRow label="사업장" value={settings.issuer.address} small />
              <MetaRow
                label="업태"
                value={
                  <>
                    {settings.issuer.businessType}
                    <span className="ml-4 text-ink-500">업종</span>
                    <span className="ml-2">{settings.issuer.industry}</span>
                  </>
                }
              />
              <MetaRow
                label="전화"
                value={
                  <>
                    {settings.issuer.phone}
                    <span className="ml-4 text-ink-500">팩스</span>
                    <span className="ml-2">{settings.issuer.fax}</span>
                  </>
                }
              />
              <MetaRow label="담당자" value={`${settings.issuer.contactDept}  ${settings.issuer.contactName}`} />
            </tbody>
          </table>
        </div>

        {/* Items table */}
        <table className="w-full mt-5 border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-ink-100">
              <th className="border border-ink-300 px-2 py-1.5 text-center font-bold w-8">NO</th>
              <th className="border border-ink-300 px-2 py-1.5 text-center font-bold w-16">구분</th>
              <th className="border border-ink-300 px-2 py-1.5 text-left font-bold">품목</th>
              <th className="border border-ink-300 px-2 py-1.5 text-center font-bold w-12">수량</th>
              <th className="border border-ink-300 px-2 py-1.5 text-center font-bold w-12">단위</th>
              <th className="border border-ink-300 px-2 py-1.5 text-right font-bold w-24">단가(원)</th>
              <th className="border border-ink-300 px-2 py-1.5 text-right font-bold w-24">가격(원)</th>
              <th className="border border-ink-300 px-2 py-1.5 text-left font-bold w-40">비고</th>
            </tr>
          </thead>
          <tbody>
            {target.items.map((it, i) => (
              <tr key={`m-${i}`}>
                <td className="border border-ink-300 px-2 py-1 text-center">{i === 0 ? "1" : ""}</td>
                <td className="border border-ink-300 px-2 py-1 text-center text-[10px] [writing-mode:vertical-rl] [text-orientation:upright]">
                  {i === 0 ? "스폰서십" : ""}
                </td>
                <td className="border border-ink-300 px-2 py-1">{it.label}</td>
                <td className="border border-ink-300 px-2 py-1 text-center">{it.quantity ?? "-"}</td>
                <td className="border border-ink-300 px-2 py-1 text-center">{it.unit ?? "-"}</td>
                <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                  {it.unitPrice ? it.unitPrice.toLocaleString() : "-"}
                </td>
                <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                  {it.amount ? it.amount.toLocaleString() : "-"}
                </td>
                <td className="border border-ink-300 px-2 py-1 text-[10px]">{it.note ?? "-"}</td>
              </tr>
            ))}
            {target.extraItems.map((it, i) => (
              <tr key={`e-${i}`}>
                <td className="border border-ink-300 px-2 py-1 text-center">{i === 0 ? "2" : ""}</td>
                <td className="border border-ink-300 px-2 py-1 text-center text-[10px] [writing-mode:vertical-rl] [text-orientation:upright]">
                  {i === 0 ? "추가제공" : ""}
                </td>
                <td className="border border-ink-300 px-2 py-1">{it.label}</td>
                <td className="border border-ink-300 px-2 py-1 text-center">{it.quantity ?? "-"}</td>
                <td className="border border-ink-300 px-2 py-1 text-center">{it.unit ?? "-"}</td>
                <td className="border border-ink-300 px-2 py-1 text-right font-mono">-</td>
                <td className="border border-ink-300 px-2 py-1 text-right font-mono">-</td>
                <td className="border border-ink-300 px-2 py-1 text-[10px]">{it.note ?? "-"}</td>
              </tr>
            ))}
            {/* Totals */}
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">소계</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {subtotal > 0 ? subtotal.toLocaleString() : "-"}
              </td>
              <td className="border-0"></td>
            </tr>
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">부가세</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {vat > 0 ? vat.toLocaleString() : "-"}
              </td>
              <td className="border-0"></td>
            </tr>
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-bold">합계</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono font-bold">
                {total > 0 ? total.toLocaleString() : "-"}
              </td>
              <td className="border-0"></td>
            </tr>
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">입금총액</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {paid > 0 ? paid.toLocaleString() : "-"}
              </td>
              <td className="border-0"></td>
            </tr>
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">잔액</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {remaining > 0 ? remaining.toLocaleString() : "-"}
              </td>
              <td className="border-0"></td>
            </tr>
          </tbody>
        </table>

        {/* Bank info */}
        <section className="mt-6 text-[10.5px]">
          <div className="font-bold mb-1">* 입금하실 계좌 정보</div>
          <div className="pl-2 space-y-0.5 text-ink-700">
            <div>
              - 은 행 명 : {settings.bank.bankName} / 계좌번호 : {settings.bank.accountNumber} / 예 금 주 : {settings.bank.accountHolder}
            </div>
            <div>- 입금일자 : {today.split("-")[0]}.        .        / 입금자명 :</div>
          </div>
        </section>

        {/* Footer slogan */}
        <footer className="mt-12 pt-6 border-t border-ink-200 text-center text-[11px] text-ink-700">
          {settings.footerSlogan}
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html,
          body {
            background: white !important;
          }
          .a4-sheet {
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function MetaRow({
  label,
  value,
  small,
}: {
  label: string;
  value: React.ReactNode;
  small?: boolean;
}) {
  return (
    <tr>
      <td className="border border-ink-300 bg-ink-50 px-2 py-1 font-semibold w-20 align-top">{label}</td>
      <td className={"border border-ink-300 px-2 py-1 align-top " + (small ? "text-[10px]" : "")}>
        {value}
      </td>
    </tr>
  );
}
