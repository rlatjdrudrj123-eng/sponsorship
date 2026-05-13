"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { ArrowLeft, ArrowRight, Bookmark, FileDown, Trash2, X } from "lucide-react";
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
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;

  const allItems = useCartStore((s) => s.items);
  // 현재 행사 항목만 노출
  const items = useMemo(
    () => allItems.filter((it) => it.eventId === eventId),
    [allItems, eventId]
  );
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
  const [dataLoaded, setDataLoaded] = useState(false);
  const [cleanedCount, setCleanedCount] = useState(0);

  // 선택된 항목 (PDF 출력용) — 기본 전체 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        // 행사·published 필터
        const [catSnap, subSnap, pkgSnap, settingsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "categories"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDocs(
            query(collection(db, "subcategories"), where("eventId", "==", eventId))
          ),
          getDocs(
            query(
              collection(db, "packages"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDoc(doc(db, "siteSettings", eventId)),
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
      } finally {
        setDataLoaded(true);
      }
    })();
  }, [eventId]);

  // 데이터 로드 후 더 이상 존재하지 않는 카트 항목 자동 정리
  useEffect(() => {
    if (!hydrated || !dataLoaded) return;
    if (items.length === 0) return;

    let removed = 0;
    items.forEach((it) => {
      if (it.type === "slot") {
        // 카테고리 자체가 없어진 경우만 정리 (slots는 별도 콜렉션이라 cart는 categoryId 기준)
        if (!categories.has(it.categoryId)) {
          removeSlot(it.slotId);
          removed++;
        }
      } else {
        if (!packages.has(it.packageId)) {
          removePackage(it.packageId);
          removed++;
        }
      }
    });
    if (removed > 0) setCleanedCount(removed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, dataLoaded, categories, packages]);

  // 카트 변경 시 선택을 전체로 동기화
  useEffect(() => {
    setSelected(new Set(items.map(itemKey)));
  }, [items]);

  const allSelected = items.length > 0 && selected.size === items.length;
  const noneSelected = selected.size === 0;

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map(itemKey)));
  };

  const printPdf = () => {
    if (noneSelected) return;
    const ids = Array.from(selected).join(",");
    window.open(`/${eventId}/cart/print?ids=${encodeURIComponent(ids)}`, "_blank");
  };

  return (
    <>
      <main className="min-h-screen bg-canvas">
        <header className="px-6 md:px-16 pt-16 md:pt-20 pb-8 md:pb-10 border-b border-ink-100 bg-surface">
          <div className="max-w-4xl mx-auto">
            <Link
              href={`/${eventId}/sponsorships`}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-4 font-num font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              전체 스폰서십
            </Link>
            <div className="font-num text-[11px] md:text-[12px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-px bg-brand-500" />
              cart
            </div>
            <h1 className="text-[36px] md:text-[64px] font-bold tracking-tight leading-[1.05] text-ink-900 flex items-center gap-3">
              <Bookmark className="w-8 h-8 md:w-10 md:h-10 text-brand-500" fill="currentColor" />
              관심 항목
            </h1>
            <p className="text-[14px] md:text-[16px] text-ink-500 mt-3 leading-relaxed">
              관심 표시한 항목들입니다. 사무국에 문의하시면 1영업일 내 정식 견적을 회신드려요.
            </p>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 md:px-12 py-10">
          {cleanedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-card p-3 mb-4 flex items-center justify-between gap-3">
              <p className="text-[12.5px] text-amber-800">
                ⓘ 더 이상 제공되지 않는 항목 <strong>{cleanedCount}개</strong>가 자동으로 정리되었습니다.
              </p>
              <button
                type="button"
                onClick={() => setCleanedCount(0)}
                className="p-1 rounded hover:bg-amber-100 text-amber-700"
                aria-label="알림 닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {!hydrated || !dataLoaded ? (
            <div className="text-center text-sm text-ink-500 py-16">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="bg-surface border border-ink-100 rounded-card py-20 text-center">
              <Bookmark className="w-10 h-10 text-ink-300 mx-auto mb-4" />
              <p className="text-[15px] text-ink-700 font-semibold">
                아직 관심 표시한 항목이 없습니다.
              </p>
              <p className="text-[13px] text-ink-500 mt-1.5">
                마음에 드는 스폰서십을 찾아보세요.
              </p>
              <Link
                href={`/${eventId}/sponsorships`}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 hover:shadow-glow-sm transition-all"
              >
                스폰서십 둘러보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              {/* 선택 / PDF 출력 */}
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-brand-500 w-4 h-4"
                  />
                  <span>
                    전체 선택{" "}
                    <span className="text-ink-500">
                      ({selected.size}/{items.length})
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={printPdf}
                  disabled={noneSelected}
                  className="px-3.5 py-2 rounded-btn border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  선택 항목 PDF로 저장
                </button>
              </div>

              <div className="bg-surface border border-ink-100 rounded-card overflow-hidden shadow-card">
                <ul>
                  {items.map((item, i) => {
                    const key = itemKey(item);
                    const checked = selected.has(key);
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
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(key)}
                            className="accent-brand-500 w-4 h-4 shrink-0"
                          />
                          <div className="w-1 h-10 bg-brand-500 rounded-full shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">
                              스폰서십
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
                          <button
                            type="button"
                            onClick={() => removeSlot(item.slotId)}
                            className="w-8 h-8 grid place-items-center text-ink-400 hover:text-red-700 hover:bg-red-50 rounded shrink-0"
                            title="관심 해제"
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
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(key)}
                          className="accent-brand-500 w-4 h-4 shrink-0"
                        />
                        <div className="w-1 h-10 bg-ink-900 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-ink-700 font-semibold">
                            패키지
                            {pkg?.tier === "signature" ? " · 시그니처" : pkg?.tier === "standard" ? " · 스탠다드" : ""}
                          </div>
                          <div className="font-bold text-[14px] text-ink-900">
                            {pkg?.name.ko ?? "(삭제됨)"}
                          </div>
                          <div className="text-[11px] font-mono text-ink-500 mt-0.5">
                            {item.code}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePackage(item.packageId)}
                          className="w-8 h-8 grid place-items-center text-ink-400 hover:text-red-700 hover:bg-red-50 rounded shrink-0"
                          title="관심 해제"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("관심 항목을 모두 비울까요?")) clear();
                  }}
                  className="text-[13px] text-ink-500 hover:text-red-700 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  전체 비우기
                </button>
                <Link
                  href={`/${eventId}/contact`}
                  className="px-6 py-3.5 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 hover:shadow-glow-sm flex items-center gap-2 transition-all"
                >
                  관심 항목으로 문의 보내기
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <p className="mt-4 text-[11.5px] text-ink-500 leading-relaxed">
                * 정식 견적은 사무국 검토 후 회신드립니다. 가격은 협의 단계에 따라 달라질 수 있어요.
              </p>
            </>
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

function itemKey(item: { type: "slot"; slotId: string } | { type: "package"; packageId: string }): string {
  return item.type === "slot" ? `slot:${item.slotId}` : `pkg:${item.packageId}`;
}
