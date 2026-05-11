"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Plus } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Package } from "@/lib/types";
import { PackageMigrationBanner } from "@/components/admin/PackageMigrationBanner";

type Tab = "all" | "signature" | "standard";

export default function PackagesListPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [filterPublished, setFilterPublished] = useState<"all" | "published" | "draft">("all");

  const { eventId, ready } = useEventFilter();

  useEffect(() => {
    if (!ready || !eventId) return;
    const u = onSnapshot(
      query(collection(getDb(), "packages"), where("eventId", "==", eventId)),
      (s) => setPackages(s.docs.map((d) => ({ ...(d.data() as Package), id: d.id })))
    );
    return () => u();
  }, [ready, eventId]);

  const filtered = useMemo(() => {
    let rows = packages;
    if (tab !== "all") rows = rows.filter((p) => p.tier === tab);
    if (filterPublished === "published") rows = rows.filter((p) => p.isPublished);
    if (filterPublished === "draft") rows = rows.filter((p) => !p.isPublished);
    return [...rows].sort((a, b) => a.order - b.order);
  }, [packages, tab, filterPublished]);

  const togglePublish = async (pkg: Package) => {
    try {
      await updateDoc(doc(getDb(), "packages", pkg.id), {
        isPublished: !pkg.isPublished,
      });
    } catch (e) {
      alert(`게시 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">패키지</h1>
          <p className="text-[13px] text-ink-700 mt-1">
            시그니처/스탠다드 패키지 묶음을 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/packages/new"
          className="px-3.5 py-2 rounded-btn bg-mint-500 text-ink-900 font-semibold text-[13px] hover:bg-mint-700 hover:text-white flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          신규 패키지
        </Link>
      </header>

      <PackageMigrationBanner />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white border border-ink-100 rounded-btn p-0.5">
          {(["all", "signature", "standard"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "px-3 py-1.5 rounded text-[12px] font-semibold " +
                (tab === t
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:text-ink-900")
              }
            >
              {t === "all" ? "전체" : t === "signature" ? "시그니처" : "스탠다드"}
            </button>
          ))}
        </div>
        <select
          value={filterPublished}
          onChange={(e) =>
            setFilterPublished(e.target.value as typeof filterPublished)
          }
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn bg-white"
        >
          <option value="all">전체 상태</option>
          <option value="published">게시</option>
          <option value="draft">비공개</option>
        </select>
      </div>

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              <th className="text-left px-4 py-2.5 font-semibold">코드</th>
              <th className="text-left px-4 py-2.5 font-semibold">이름</th>
              <th className="text-left px-4 py-2.5 font-semibold">티어</th>
              <th className="text-right px-4 py-2.5 font-semibold">가격</th>
              <th className="text-right px-4 py-2.5 font-semibold">할인</th>
              <th className="text-center px-4 py-2.5 font-semibold">게시</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-500">
                  패키지가 없습니다.{" "}
                  <Link href="/admin/packages/new" className="text-mint-700 font-semibold hover:underline">
                    추가하세요 →
                  </Link>
                </td>
              </tr>
            )}
            {filtered.map((pkg) => {
              const discount = pkg.originalPrice > 0 ? Math.round((1 - pkg.discountPrice / pkg.originalPrice) * 100) : 0;
              return (
                <tr
                  key={pkg.id}
                  className="border-t border-ink-100 hover:bg-ink-50 cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button,a,input")) return;
                    window.location.href = `/admin/packages/${pkg.id}`;
                  }}
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink-900">{pkg.code}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/packages/${pkg.id}`} className="text-ink-900 font-semibold hover:text-mint-700">
                      {pkg.name.ko}
                    </Link>
                    {pkg.tagline && (
                      <div className="text-[11px] text-ink-500 mt-0.5 truncate max-w-md">
                        {pkg.tagline}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        "text-[11px] px-2 py-0.5 rounded-full font-semibold " +
                        (pkg.tier === "signature"
                          ? "bg-mint-50 text-mint-700 border border-mint-100"
                          : "bg-ink-100 text-ink-700")
                      }
                    >
                      {pkg.tier === "signature" ? "시그니처" : "스탠다드"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px]">
                    <div className="text-ink-900 font-semibold">
                      {pkg.discountPrice.toLocaleString()}원
                    </div>
                    <div className="text-ink-500 line-through">
                      {pkg.originalPrice.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {discount > 0 && (
                      <span className="text-[11px] font-semibold text-mint-700">
                        {discount}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Switch checked={pkg.isPublished} onChange={() => togglePublish(pkg)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
        (checked ? "bg-mint-500" : "bg-ink-100")
      }
    >
      <span
        className={
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow " +
          (checked ? "translate-x-5" : "translate-x-1")
        }
      />
    </button>
  );
}
