"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Package, SiteSettings } from "@/lib/types";
import { Footer } from "@/components/public/Footer";

type Tab = "all" | "signature" | "standard";

export default function PackagesListPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [pkgSnap, settingsSnap] = await Promise.all([
          getDocs(
            query(collection(db, "packages"), where("isPublished", "==", true))
          ),
          getDoc(doc(db, "siteSettings", "main")),
        ]);
        setPackages(
          pkgSnap.docs.map((d) => ({ ...(d.data() as Package), id: d.id }))
        );
        if (settingsSnap.exists())
          setSettings(settingsSnap.data() as SiteSettings);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return [...packages]
      .filter((p) => (tab === "all" ? true : p.tier === tab))
      .sort((a, b) => a.order - b.order);
  }, [packages, tab]);

  return (
    <>
      <main className="min-h-screen bg-white">
        <header className="px-6 md:px-16 pt-12 pb-6 border-b border-ink-100">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            홈
          </Link>
          <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
            패키지
          </h1>
          <p className="text-[13px] text-ink-700 mt-2">
            오프라인·온라인 채널을 묶은 할인 구성. 협의 후 배정합니다.
          </p>
        </header>

        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10">
          <div className="flex gap-1 bg-ink-50 rounded-btn p-0.5 mb-8 w-fit">
            {(["all", "signature", "standard"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  "px-4 py-2 rounded text-[13px] font-semibold transition-colors " +
                  (tab === t
                    ? "bg-white shadow-sm text-ink-900"
                    : "text-ink-500 hover:text-ink-900")
                }
              >
                {t === "all" ? "전체" : t === "signature" ? "시그니처" : "스탠다드"}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-ink-50 rounded-card py-16 text-center text-sm text-ink-500">
              패키지가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map((pkg) => {
                const hero = pkg.heroImages?.images?.[0]?.url;
                const discount =
                  pkg.originalPrice > 0
                    ? Math.round((1 - pkg.discountPrice / pkg.originalPrice) * 100)
                    : 0;
                return (
                  <Link
                    key={pkg.id}
                    href={`/packages/${pkg.id}`}
                    className="group bg-[#fafaf7] border border-ink-100 rounded-card overflow-hidden hover:border-mint-500 transition-colors flex flex-col h-full"
                  >
                    <div className="aspect-[16/9] bg-ink-100 relative shrink-0">
                      {hero ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={hero}
                          alt={pkg.name.ko}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-ink-300 text-xs">
                          이미지 없음
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-1">
                        <span className="text-[9px] uppercase tracking-wider bg-white/90 text-ink-700 px-1.5 py-0.5 rounded font-mono">
                          {pkg.code}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider bg-mint-500 text-ink-900 px-1.5 py-0.5 rounded font-bold">
                          {pkg.tier === "signature" ? "시그니처" : "스탠다드"}
                        </span>
                      </div>
                      {discount > 0 && (
                        <div className="absolute top-3 right-3 bg-ink-900 text-mint-500 text-[11px] font-bold px-2 py-1 rounded">
                          {discount}% OFF
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="font-bold text-[18px] text-ink-900 group-hover:text-mint-700 leading-tight">
                        {pkg.name.ko}
                      </div>
                      {pkg.tagline && (
                        <p className="text-[12px] text-ink-500 mt-2 leading-relaxed line-clamp-2">
                          {pkg.tagline}
                        </p>
                      )}
                      <div className="mt-auto pt-4 flex items-baseline gap-2">
                        <span className="text-[20px] font-bold text-mint-700">
                          {pkg.discountPrice.toLocaleString()}원
                        </span>
                        {pkg.originalPrice > pkg.discountPrice && (
                          <span className="text-[12px] text-ink-300 line-through">
                            {pkg.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}
