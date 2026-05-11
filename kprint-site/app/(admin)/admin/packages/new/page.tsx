"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Package } from "@/lib/types";

export default function NewPackagePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { eventId, ready } = useEventFilter();

  useEffect(() => {
    if (!ready) return;
    if (!eventId) {
      setError("상단 셀렉터에서 행사를 먼저 선택하세요.");
      return;
    }
    (async () => {
      try {
        const db = getDb();
        const ref = doc(collection(db, "packages"));
        // 다음 order 결정 (해당 행사 내에서)
        const all = await getDocs(
          query(collection(db, "packages"), where("eventId", "==", eventId))
        );
        const maxOrder = all.docs.reduce((m, d) => {
          const v = d.data().order;
          return typeof v === "number" && v > m ? v : m;
        }, -1);

        const draft: Package = {
          id: ref.id,
          eventId,
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
  }, [router, ready, eventId]);

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
