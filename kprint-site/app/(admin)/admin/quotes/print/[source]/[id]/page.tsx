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
  Inquiry,
  Package,
  QuoteSettings,
  Sponsor,
  Subcategory,
} from "@/lib/types";

type QuoteLine = {
  category: string;       // "스폰서십" / "추가 제공" 등
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
    contactName?: string;
    items: QuoteLine[];
    extraItems: QuoteLine[];
    paid?: number;          // 입금액
  } | null>(null);
  const [serial, setSerial] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const settingsSnap = await getDoc(doc(db, "quoteSettings", "main"));
        if (!settingsSnap.exists()) {
          alert("견적서 설정이 없습니다. /admin/settings/quote 에서 먼저 설정해주세요.");
          return;
        }
        const s = settingsSnap.data() as QuoteSettings;
        setSettings(s);

        // 일련번호 조립 — 단순 prefix + nextNumber (실제 발행 시 수동 증가)
        setSerial(`${s.serialPrefix ?? ""}${String(s.serialNextNumber ?? 1).padStart(3, "0")}`);

        if (source === "inquiry") {
          const inqSnap = await getDoc(doc(db, "inquiries", id));
          if (!inqSnap.exists()) {
            alert("문의를 찾을 수 없습니다.");
            return;
          }
          const inq = inqSnap.data() as Inquiry;

          const [c, sub, p] = await Promise.all([
            getDocs(collection(db, "categories")),
            getDocs(collection(db, "subcategories")),
            getDocs(collection(db, "packages")),
          ]);
          const catMap = new Map<string, Category>();
          c.docs.forEach((d) => catMap.set(d.id, { ...(d.data() as Category), id: d.id }));
          const subMap = new Map<string, Subcategory>();
          sub.docs.forEach((d) => subMap.set(d.id, { ...(d.data() as Subcategory), id: d.id }));
          const pkgMap = new Map<string, Package>();
          p.docs.forEach((d) => pkgMap.set(d.id, { ...(d.data() as Package), id: d.id }));

          const items: QuoteLine[] = inq.cartItems.map((ci) => {
            if (ci.type === "slot") {
              const cat = catMap.get(ci.categoryId);
              const sb = subMap.get(ci.subcategoryId);
              return {
                category: "스폰서십",
                label: `${cat?.name.ko ?? ""}${sb?.name.ko ? ` · ${sb.name.ko}` : ""}`.trim() || ci.code,
                quantity: "1.0",
                unit: "구좌",
                unitPrice: ci.price,
                amount: ci.price,
                note: ci.code,
              };
            }
            const pkg = pkgMap.get(ci.packageId);
            return {
              category: "스폰서십",
              label: pkg?.name.ko ?? ci.code,
              quantity: "1.0",
              unit: "패키지",
              unitPrice: ci.price,
              amount: ci.price,
              note: ci.code,
            };
          });

          // 추가 제공 — 견적서 설정의 기본값
          const extraItems: QuoteLine[] = (s.defaultBenefitItems ?? []).map((b) => ({
            category: "추가 제공",
            label: b.label,
            quantity: "1.0",
            unit: "제공",
            note: b.note,
          }));

          setTarget({
            receiver: inq.companyName,
            contactName: inq.contactName,
            items,
            extraItems,
          });
        } else if (source === "sponsor") {
          const spSnap = await getDoc(doc(db, "sponsors", id));
          if (!spSnap.exists()) {
            alert("스폰서를 찾을 수 없습니다.");
            return;
          }
          const sp = spSnap.data() as Sponsor;

          // 단가 미산출 — 합계만 표시 가능
          const total = sp.amount ?? 0;
          const items: QuoteLine[] = (sp.items ?? []).map((it) => ({
            category: "스폰서십",
            label: it.label,
            unit: it.note ? undefined : "구좌",
            note: it.note,
          }));
          // 합계 라인 (마지막 행에 비용 표기)
          if (items.length > 0 && total > 0) {
            items[items.length - 1] = {
              ...items[items.length - 1],
              amount: total,
            };
          } else if (total > 0) {
            items.push({
              category: "스폰서십",
              label: sp.companyName,
              quantity: "1.0",
              unit: "건",
              amount: total,
            });
          }

          // 혜택 → 추가 제공
          const extraItems: QuoteLine[] = [];
          if (sp.benefits?.topPin)
            extraItems.push({ category: "추가 제공", label: "상위 고정", quantity: "1.0", unit: "제공", note: "참가업체 검색 페이지 내 상위 고정" });
          if (sp.benefits?.badge)
            extraItems.push({ category: "추가 제공", label: "뱃지 표기", quantity: "1.0", unit: "제공", note: "주요 참가기업 뱃지" });
          if (sp.benefits?.logoBanner)
            extraItems.push({ category: "추가 제공", label: "도면 내 로고/배너", quantity: "1.0", unit: "제공" });
          if (sp.benefits?.eventNotice)
            extraItems.push({ category: "추가 제공", label: "이벤트 안내", quantity: "1.0", unit: "제공" });
          if (extraItems.length === 0) {
            // fallback to defaults
            (s.defaultBenefitItems ?? []).forEach((b) =>
              extraItems.push({ category: "추가 제공", label: b.label, quantity: "1.0", unit: "제공", note: b.note })
            );
          }

          setTarget({
            receiver: sp.companyName,
            contactName: sp.contacts?.[0]?.name,
            items,
            extraItems,
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

  const subtotal = useMemo(() => {
    if (!target) return 0;
    return target.items.reduce((sum, it) => sum + (it.amount ?? 0), 0);
  }, [target]);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;
  const paid = target?.paid ?? 0;
  const remaining = total - paid;

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\./g, "-").replace(/ /g, "").replace(/-$/, "");

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
              <img src={settings.logoUrl} alt="로고" className="h-12 mb-2" />
            ) : (
              <div className="text-[28px] font-black text-red-600 leading-none">
                {settings.eventSubtitle?.split(" ")[0] || "EVENT"}
              </div>
            )}
            <div className="text-[10px] text-ink-700 mt-1">{settings.eventSubtitle}</div>
          </div>
          <div className="text-right">
            <div className="text-[24px] font-bold tracking-[0.3em] text-ink-900">스폰서십 견적서</div>
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
              <MetaRow label="수    신" value={target.contactName ?? target.receiver} />
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
            {/* Spacer rows */}
            {Array.from({ length: Math.max(0, 4 - target.items.length - target.extraItems.length) }).map((_, i) => (
              <tr key={`sp-${i}`}>
                <td className="border border-ink-300 px-2 py-2.5"></td>
                <td className="border border-ink-300"></td>
                <td className="border border-ink-300"></td>
                <td className="border border-ink-300"></td>
                <td className="border border-ink-300"></td>
                <td className="border border-ink-300 text-right">-</td>
                <td className="border border-ink-300 text-right">-</td>
                <td className="border border-ink-300"></td>
              </tr>
            ))}
            {/* Totals */}
            <tr>
              <td colSpan={5}></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">소계</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {subtotal > 0 ? subtotal.toLocaleString() : "-"}
              </td>
              <td className="border border-ink-300"></td>
            </tr>
            <tr>
              <td colSpan={5}></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">부가세</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {vat > 0 ? vat.toLocaleString() : "-"}
              </td>
              <td className="border border-ink-300"></td>
            </tr>
            <tr>
              <td colSpan={5}></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-bold">합계</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono font-bold">
                {total > 0 ? total.toLocaleString() : "-"}
              </td>
              <td className="border border-ink-300"></td>
            </tr>
            <tr>
              <td colSpan={5}></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">입금총액</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {paid > 0 ? paid.toLocaleString() : "-"}
              </td>
              <td className="border border-ink-300"></td>
            </tr>
            <tr>
              <td colSpan={5}></td>
              <td className="border border-ink-300 px-2 py-1 text-center bg-ink-50 font-semibold">잔액</td>
              <td className="border border-ink-300 px-2 py-1 text-right font-mono">
                {remaining > 0 ? remaining.toLocaleString() : "-"}
              </td>
              <td className="border border-ink-300"></td>
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
        <footer className="absolute-print mt-12 pt-6 border-t border-ink-200 text-center text-[11px] text-ink-700">
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
