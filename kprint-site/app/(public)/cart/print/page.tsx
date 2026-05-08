"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { Printer } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useCartStore } from "@/lib/cart/cartStore";
import type {
  Category,
  Package,
  SiteSettings,
  Subcategory,
} from "@/lib/types";

export default function CartPrintPage() {
  const search = useSearchParams();
  const idsParam = search.get("ids") ?? "";
  const items = useCartStore((s) => s.items);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [subcategories, setSubcategories] = useState<Map<string, Subcategory>>(new Map());
  const [packages, setPackages] = useState<Map<string, Package>>(new Map());
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [c, s, p, st] = await Promise.all([
          getDocs(collection(db, "categories")),
          getDocs(collection(db, "subcategories")),
          getDocs(collection(db, "packages")),
          getDoc(doc(db, "siteSettings", "main")),
        ]);
        const cm = new Map<string, Category>();
        c.docs.forEach((d) => cm.set(d.id, { ...(d.data() as Category), id: d.id }));
        const sm = new Map<string, Subcategory>();
        s.docs.forEach((d) => sm.set(d.id, { ...(d.data() as Subcategory), id: d.id }));
        const pm = new Map<string, Package>();
        p.docs.forEach((d) => pm.set(d.id, { ...(d.data() as Package), id: d.id }));
        setCategories(cm);
        setSubcategories(sm);
        setPackages(pm);
        if (st.exists()) setSettings(st.data() as SiteSettings);
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const selected = useMemo(() => {
    if (!idsParam) return items;
    const ids = new Set(idsParam.split(","));
    return items.filter((it) =>
      it.type === "slot" ? ids.has(`slot:${it.slotId}`) : ids.has(`pkg:${it.packageId}`)
    );
  }, [idsParam, items]);

  // 데이터 로드 + 카트 hydrate 완료 후 자동 인쇄 다이얼로그
  useEffect(() => {
    if (!ready || !hydrated) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [ready, hydrated]);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const eventName = settings?.event?.nameKo ?? "K-PRINT 2026";
  const dateRange = settings?.event?.dateRange ?? "";
  const venue = settings?.event?.venue ?? "";

  return (
    <div className="bg-ink-50 min-h-screen print:bg-white">
      {/* 인쇄 안내 헤더 (인쇄 시 숨김) */}
      <div className="print:hidden bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between">
        <p className="text-[13px] text-ink-700">
          관심 항목 PDF 미리보기 — 자동으로 인쇄 다이얼로그가 열립니다. PDF로 저장하려면 [PDF로 저장]을 선택하세요.
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

      {/* A4 시트 */}
      <div className="mx-auto print:mx-0 my-6 print:my-0 bg-white shadow print:shadow-none w-[210mm] min-h-[297mm] p-12 print:p-10 a4-sheet">
        <header className="flex items-start justify-between gap-6 pb-5 border-b-2 border-ink-900">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-mint-700 font-bold">
              Sponsorship Wishlist
            </div>
            <h1 className="text-[28px] font-bold text-ink-900 mt-1 leading-tight">
              관심 항목 목록
            </h1>
            <p className="text-[12px] text-ink-700 mt-1">
              {eventName}
              {dateRange ? ` · ${dateRange}` : ""}
              {venue ? ` · ${venue}` : ""}
            </p>
          </div>
          <div className="text-right text-[11px] text-ink-700">
            <div>출력일자: {today}</div>
            <div className="mt-0.5">총 {selected.length}건</div>
          </div>
        </header>

        <main className="mt-6">
          {selected.length === 0 ? (
            <div className="py-16 text-center text-sm text-ink-500">
              선택된 항목이 없습니다.
            </div>
          ) : (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-ink-300 text-[10.5px] text-ink-700 uppercase tracking-wide">
                  <th className="text-left py-2 pr-3 font-semibold w-12">No</th>
                  <th className="text-left py-2 pr-3 font-semibold">유형</th>
                  <th className="text-left py-2 pr-3 font-semibold">스폰서십 항목</th>
                  <th className="text-left py-2 pr-3 font-semibold">소분류</th>
                  <th className="text-left py-2 font-semibold w-28">코드</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((it, i) => {
                  if (it.type === "slot") {
                    const cat = categories.get(it.categoryId);
                    const sub = subcategories.get(it.subcategoryId);
                    return (
                      <tr key={`s-${it.slotId}`} className="border-b border-ink-100">
                        <td className="py-2 pr-3 text-ink-500">{i + 1}</td>
                        <td className="py-2 pr-3">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-mint-50 text-mint-700 border border-mint-100 font-semibold">
                            슬롯
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-semibold text-ink-900">
                          {cat?.name.ko ?? "(삭제됨)"}
                        </td>
                        <td className="py-2 pr-3 text-ink-700">{sub?.name.ko ?? "—"}</td>
                        <td className="py-2 font-mono text-ink-900">{it.code}</td>
                      </tr>
                    );
                  }
                  const pkg = packages.get(it.packageId);
                  return (
                    <tr key={`p-${it.packageId}`} className="border-b border-ink-100">
                      <td className="py-2 pr-3 text-ink-500">{i + 1}</td>
                      <td className="py-2 pr-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 font-semibold">
                          패키지
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-semibold text-ink-900">
                        {pkg?.name.ko ?? "(삭제됨)"}
                        {pkg?.tier === "signature" && (
                          <span className="ml-2 text-[10px] text-mint-700 font-bold">SIGNATURE</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-ink-700">—</td>
                      <td className="py-2 font-mono text-ink-900">{it.code}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>

        <footer className="mt-12 pt-6 border-t border-ink-100">
          <p className="text-[11px] text-ink-700 leading-relaxed">
            본 문서는 사내 검토용 관심 항목 목록입니다. 정식 견적·계약 조건은 사무국에 문의해주세요.
          </p>
          {settings?.contact && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-[11px] text-ink-700">
              {settings.contact.phone && (
                <div>
                  <div className="text-[9px] text-ink-500 uppercase tracking-wider mb-0.5">전화</div>
                  <div>{settings.contact.phone}</div>
                </div>
              )}
              {settings.contact.email && (
                <div>
                  <div className="text-[9px] text-ink-500 uppercase tracking-wider mb-0.5">이메일</div>
                  <div className="font-mono">{settings.contact.email}</div>
                </div>
              )}
              {settings.contact.address && (
                <div>
                  <div className="text-[9px] text-ink-500 uppercase tracking-wider mb-0.5">주소</div>
                  <div>{settings.contact.address}</div>
                </div>
              )}
            </div>
          )}
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
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
}
