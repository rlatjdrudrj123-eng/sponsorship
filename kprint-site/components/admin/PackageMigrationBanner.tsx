"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowDownToLine, Check, X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Category, Package, Subcategory } from "@/lib/types";

export function PackageMigrationBanner() {
  const [candidates, setCandidates] = useState<Category[]>([]);
  const [subsByCategory, setSubsByCategory] = useState<Map<string, Subcategory[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const catSnap = await getDocs(
          query(collection(db, "categories"), where("type", "==", "package"))
        );
        const cats = catSnap.docs.map((d) => ({
          ...(d.data() as Category),
          id: d.id,
        }));
        setCandidates(cats);

        if (cats.length > 0) {
          const subSnap = await getDocs(collection(db, "subcategories"));
          const map = new Map<string, Subcategory[]>();
          subSnap.docs.forEach((d) => {
            const sub = { ...(d.data() as Subcategory), id: d.id };
            const arr = map.get(sub.categoryId) ?? [];
            arr.push(sub);
            map.set(sub.categoryId, arr);
          });
          setSubsByCategory(map);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const migrate = async () => {
    if (!confirm(
      `Categories의 패키지 타입 ${candidates.length}개를 Packages로 가져옵니다.\n` +
        `원본 카테고리는 비공개 처리됩니다 (삭제되지 않음).\n` +
        `진행할까요?`
    )) {
      return;
    }
    setMigrating(true);
    try {
      const db = getDb();
      const batch = writeBatch(db);
      const now = Timestamp.fromDate(new Date());

      for (const cat of candidates) {
        const subs = subsByCategory.get(cat.id) ?? [];
        const sortedSubs = [...subs].sort((a, b) => a.order - b.order);
        const prices = sortedSubs.map((s) => s.priceKRW).filter((p) => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

        const newPkgId = `pkg-${cat.code.toLowerCase()}`;
        const pkgDoc: Omit<Package, "id"> & { id: string; createdAt: unknown; updatedAt: unknown } = {
          id: newPkgId,
          eventId: cat.eventId,
          code: cat.code,
          name: cat.name,
          tier: "standard",
          tagline: cat.shortDesc,
          includedItems: sortedSubs.map((s) => ({
            label: `${s.name.ko}${s.unit?.ko ? ` (${s.unit.ko})` : ""}`,
          })),
          originalPrice: minPrice,
          discountPrice: minPrice,
          unit: sortedSubs[0]?.unit?.ko,
          priceNote: cat.longDesc,
          heroImages: cat.heroImages,
          isPublished: cat.isPublished,
          order: cat.order,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        batch.set(doc(db, "packages", newPkgId), pkgDoc);
        // 원본 카테고리는 비공개 + 메모 추가 (안전 — 삭제하지 않음)
        batch.update(doc(db, "categories", cat.id), {
          isPublished: false,
          longDesc: `${cat.longDesc ?? ""}\n[마이그레이션됨: Packages/${newPkgId}]`.trim(),
          updatedAt: now,
        });
      }

      await batch.commit();
      setDone(true);
      setCandidates([]);
    } catch (e) {
      alert(`마이그레이션 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) return null;
  if (dismissed) return null;
  if (done) {
    return (
      <div className="bg-brand-50 border border-brand-100 rounded-card p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-brand-700 font-semibold text-[13px]">
          <Check className="w-4 h-4" />
          마이그레이션 완료. 새로 생성된 패키지를 확인하세요.
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-brand-100"
        >
          <X className="w-4 h-4 text-brand-700" />
        </button>
      </div>
    );
  }
  if (candidates.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-amber-800 font-bold text-[13px]">
          <ArrowDownToLine className="w-4 h-4" />
          Categories에 패키지 타입 항목 {candidates.length}개 발견
        </div>
        <p className="text-[12px] text-amber-700 mt-1">
          이 항목들을 Packages 콜렉션으로 옮겨 통합 관리할 수 있습니다. 원본 카테고리는 비공개로 보존됩니다.
        </p>
        <ul className="mt-2 text-[11px] text-amber-700 font-mono space-y-0.5">
          {candidates.slice(0, 5).map((c) => (
            <li key={c.id}>
              · {c.code} — {c.name.ko}
            </li>
          ))}
          {candidates.length > 5 && (
            <li className="text-amber-600">… 외 {candidates.length - 5}개</li>
          )}
        </ul>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={migrate}
          disabled={migrating}
          className="px-3.5 py-2 rounded-btn bg-amber-700 text-white text-[12px] font-bold hover:bg-amber-800 disabled:opacity-50 whitespace-nowrap"
        >
          {migrating ? "이동 중…" : "Packages로 이동"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={migrating}
          className="px-3.5 py-1.5 rounded-btn border border-amber-300 text-amber-700 text-[11px] font-semibold hover:bg-amber-100"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
