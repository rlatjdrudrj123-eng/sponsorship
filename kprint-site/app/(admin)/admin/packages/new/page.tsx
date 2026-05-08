"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Package } from "@/lib/types";

export default function NewPackagePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const ref = doc(collection(db, "packages"));
        // 다음 order 결정
        const all = await getDocs(collection(db, "packages"));
        const maxOrder = all.docs.reduce((m, d) => {
          const v = d.data().order;
          return typeof v === "number" && v > m ? v : m;
        }, -1);

        const draft: Package = {
          id: ref.id,
          code: `PC-${ref.id.slice(0, 4).toUpperCase()}`,
          name: { ko: "새 패키지", en: "New Package" },
          tier: "standard",
          tagline: "",
          includedItems: [],
          originalPrice: 0,
          discountPrice: 0,
          unit: "패키지",
          priceNote: "",
          heroImages: { mode: "carousel", images: [] },
          isPublished: false,
          order: maxOrder + 1,
        };
        await setDoc(ref, draft as unknown as Record<string, unknown>);
        router.replace(`/admin/packages/${ref.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [router]);

  return (
    <div className="text-sm text-ink-500 text-center py-16">
      {error ? (
        <div className="text-red-700">생성 실패: {error}</div>
      ) : (
        "신규 패키지 생성 중…"
      )}
    </div>
  );
}
