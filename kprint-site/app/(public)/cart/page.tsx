"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { ArrowLeft, ArrowRight, Trash2, X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useCartStore } from "@/lib/cart/cartStore";
import type {
  Category,
  Package,
  SiteSettings,
  Subcategory,
} from "@/lib/types";
import { Footer } from "@/components/public/Footer";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const removeSlot = useCartStore((s) => s.removeSlot);
  const removePackage = useCartStore((s) => s.removePackage);
  const clear = useCartStore((s) => s.clear);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [subcategories, setSubcategories] = useState<Map<string, Subcategory>>(
    new Map()
  );
  const [packages, setPackages] = useState<Map<string, Package>>(new Map());
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [catSnap, subSnap, pkgSnap, settingsSnap] = await Promise.all([
          getDocs(collection(db, "categories")),
          getDocs(collection(db, "subcategories")),
          getDocs(collection(db, "packages")),
          getDoc(doc(db, "siteSettings", "main")),
        ]);
        const cm = new Map<string, Category>();
        catSnap.docs.forEach((d) =>
          cm.set(d.id, { ...(d.data() as Category), id: d.id })
        );
        const sm = new Map<string, Subcategory>();
        subSnap.docs.forEach((d) =>
          sm.set(d.id, { ...(d.data() as Subcategory), id: d.id })
        );
        const pm = new Map<string, Package>();
        pkgSnap.docs.forEach((d) =>
          pm.set(d.id, { ...(d.data() as Package), id: d.id })
        );
        setCategories(cm);
        setSubcategories(sm);
        setPackages(pm);
        if (settingsSnap.exists())
          setSettings(settingsSnap.data() as SiteSettings);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const vat = useMemo(() => Math.round(subtotal * 0.1), [subtotal]);
  const total = subtotal + vat;

  return (
    <>
      <main className="min-h-screen bg-white">
        <header className="px-6 md:px-16 pt-12 pb-6 border-b border-ink-100">
          <Link
            href="/sponsorships"
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            전체 스폰서십
          </Link>
          <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
            견적 카트
          </h1>
          <p className="text-[13px] text-ink-700 mt-2">
            담은 항목으로 한 번에 문의하세요. 사무국이 1영업일 내 회신합니다.
          </p>
        </header>

        <div className="max-w-4xl mx-auto px-6 md:px-12 py-10">
          {!hydrated ? (
            <div className="text-center text-sm text-ink-500 py-16">
              불러오는 중…
            </div>
          ) : items.length === 0 ? (
            <div className="bg-ink-50 rounded-card py-16 text-center">
              <p className="text-[15px] text-ink-700">장바구니가 비어있어요.</p>
              <Link
                href="/sponsorships"
                className="mt-4 inline-block px-5 py-2.5 rounded-btn bg-mint-500 text-ink-900 font-semibold hover:bg-mint-700 hover:text-white"
              >
                둘러보러 가기 →
              </Link>
            </div>
          ) : (
            <>
              <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
                <ul>
                  {items.map((item, i) => {
                    if (item.type === "slot") {
                      const cat = categories.get(item.categoryId);
                      const sub = subcategories.get(item.subcategoryId);
                      return (
                        <li
                          key={`slot-${item.slotId}`}
                          className={
                            "flex items-center gap-4 px-5 py-4 " +
                            (i > 0 ? "border-t border-ink-100" : "")
                          }
                        >
                          <div className="w-1 h-10 bg-mint-500 rounded-full shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wider text-mint-700 font-semibold">
                              슬롯
                            </div>
                            <div className="font-bold text-[14px] text-ink-900">
                              {cat?.name.ko ?? "(삭제됨)"}
                              {sub?.name.ko ? (
                                <span className="text-ink-500 font-normal ml-1.5">
                                  · {sub.name.ko}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] font-mono text-ink-500 mt-0.5">
                              {item.code}
                            </div>
                          </div>
                          <div className="text-[14px] font-bold font-mono shrink-0">
                            {item.price.toLocaleString()}원
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSlot(item.slotId)}
                            className="w-8 h-8 grid place-items-center text-ink-400 hover:text-red-700 hover:bg-red-50 rounded shrink-0"
                            title="제거"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    }
                    const pkg = packages.get(item.packageId);
                    return (
                      <li
                        key={`pkg-${item.packageId}`}
                        className={
                          "flex items-center gap-4 px-5 py-4 " +
                          (i > 0 ? "border-t border-ink-100" : "")
                        }
                      >
                        <div className="w-1 h-10 bg-ink-900 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-ink-700 font-semibold">
                            패키지 · {pkg?.tier === "signature" ? "시그니처" : "스탠다드"}
                          </div>
                          <div className="font-bold text-[14px] text-ink-900">
                            {pkg?.name.ko ?? "(삭제됨)"}
                          </div>
                          <div className="text-[11px] font-mono text-ink-500 mt-0.5">
                            {item.code}
                          </div>
                        </div>
                        <div className="text-[14px] font-bold font-mono shrink-0">
                          {item.price.toLocaleString()}원
                        </div>
                        <button
                          type="button"
                          onClick={() => removePackage(item.packageId)}
                          className="w-8 h-8 grid place-items-center text-ink-400 hover:text-red-700 hover:bg-red-50 rounded shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-6 max-w-md ml-auto bg-[#fafaf7] border border-ink-100 rounded-card p-5">
                <Row label="소계" value={subtotal} />
                <Row label="VAT (10%)" value={vat} />
                <div className="mt-3 pt-3 border-t border-ink-100">
                  <Row label="합계" value={total} accent />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("카트를 모두 비울까요?")) clear();
                  }}
                  className="text-[13px] text-ink-500 hover:text-red-700 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  전체 비우기
                </button>
                <Link
                  href="/contact"
                  className="px-5 py-3 rounded-btn bg-mint-500 text-ink-900 font-semibold hover:bg-mint-700 hover:text-white flex items-center gap-2"
                >
                  문의하기
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span
        className={
          "text-[13px] " + (accent ? "text-ink-900 font-bold" : "text-ink-500")
        }
      >
        {label}
      </span>
      <span
        className={
          "font-mono " +
          (accent
            ? "text-[20px] font-bold text-mint-700"
            : "text-[13px] text-ink-700")
        }
      >
        {value.toLocaleString()}원
      </span>
    </div>
  );
}
