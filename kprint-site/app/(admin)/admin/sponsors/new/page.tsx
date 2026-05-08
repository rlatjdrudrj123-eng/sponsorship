"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import {
  EMPTY_FORM_VALUES,
  SponsorForm,
  type SponsorFormValues,
  type SponsorItemLibraryEntry,
} from "@/components/admin/SponsorForm";
import type { Category, Event, Inquiry, Package, Slot, Sponsor } from "@/lib/types";

export default function NewSponsorPage() {
  const router = useRouter();
  const search = useSearchParams();
  const inquiryId = search.get("inquiryId");
  const presetEvent = search.get("event");

  const [events, setEvents] = useState<Event[]>([]);
  const [initial, setInitial] = useState<SponsorFormValues | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => {
        setEvents(s.docs.map((d) => ({ ...(d.data() as Event), id: d.id })));
      }
    );
    return () => u();
  }, []);

  // 품목 라이브러리용 데이터 (카테고리/패키지/슬롯)
  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [c, p, s] = await Promise.all([
          getDocs(collection(db, "categories")),
          getDocs(collection(db, "packages")),
          getDocs(collection(db, "slots")),
        ]);
        setCategories(c.docs.map((d) => ({ ...(d.data() as Category), id: d.id })));
        setPackages(p.docs.map((d) => ({ ...(d.data() as Package), id: d.id })));
        setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
      } catch (e) {
        console.error("library load failed", e);
      }
    })();
  }, []);

  const library = useMemo<SponsorItemLibraryEntry[]>(
    () => buildLibrary(categories, packages, slots),
    [categories, packages, slots]
  );

  // 초기값 설정 — inquiry로부터 변환 또는 빈값
  useEffect(() => {
    (async () => {
      if (!inquiryId) {
        setInitial({
          ...EMPTY_FORM_VALUES,
          eventId: presetEvent ?? "",
        });
        return;
      }
      try {
        const inqSnap = await getDoc(doc(getDb(), "inquiries", inquiryId));
        if (!inqSnap.exists()) {
          setInitial({ ...EMPTY_FORM_VALUES, eventId: presetEvent ?? "" });
          return;
        }
        const inq = { ...(inqSnap.data() as Inquiry), id: inqSnap.id };

        // cart items → sponsor items 매핑 (코드 + 카테고리/패키지 명)
        const items = await Promise.all(
          inq.cartItems.map(async (ci) => {
            if (ci.type === "slot") {
              const cat = await getDoc(doc(getDb(), "categories", ci.categoryId));
              const catName = cat.exists() ? (cat.data() as { name: { ko: string } }).name.ko : "";
              return {
                label: `${catName} ${ci.code}`.trim(),
                slotId: ci.slotId,
                categoryId: ci.categoryId,
              };
            }
            const pkg = await getDoc(doc(getDb(), "packages", ci.packageId));
            const pkgName = pkg.exists() ? (pkg.data() as { name: { ko: string } }).name.ko : "";
            return {
              label: pkgName || ci.code,
              packageId: ci.packageId,
            };
          })
        );

        setInitial({
          ...EMPTY_FORM_VALUES,
          eventId: presetEvent ?? "",
          companyName: inq.companyName,
          amount: Math.round((inq.cartTotal ?? 0) / 1.1), // VAT 제외 (소계 기준)
          currency: "KRW",
          items,
          contacts: [
            {
              name: inq.contactName,
              email: inq.email,
              phone: inq.phone,
            },
          ],
          notes: inq.message ? `[원본 문의 메시지]\n${inq.message}` : "",
          status: "reviewing",
        });
      } catch (e) {
        console.error("inquiry load failed", e);
        setInitial({ ...EMPTY_FORM_VALUES, eventId: presetEvent ?? "" });
      }
    })();
  }, [inquiryId, presetEvent]);

  const handleSubmit = async (v: SponsorFormValues) => {
    const id = crypto.randomUUID();
    try {
      await setDoc(doc(getDb(), "sponsors", id), {
        ...v,
        id,
        inquiryId: inquiryId ?? undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies Omit<Sponsor, "createdAt" | "updatedAt"> & {
        createdAt: unknown;
        updatedAt: unknown;
      });

      // 변환된 inquiry 상태 업데이트
      if (inquiryId) {
        try {
          await updateDoc(doc(getDb(), "inquiries", inquiryId), {
            status: "in_progress",
            updatedAt: Timestamp.fromDate(new Date()),
          });
        } catch {
          // ignore
        }
      }

      router.push(`/admin/sponsors/${id}`);
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/admin/sponsors"
          className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
            {inquiryId ? "문의 → 스폰서 전환" : "새 스폰서"}
          </h1>
          {inquiryId && (
            <p className="text-[12px] text-ink-500 mt-0.5">
              원본 문의({inquiryId.slice(0, 8)}…) 의 정보가 자동으로 채워졌습니다. 필요한 부분을 수정 후 저장하세요.
            </p>
          )}
        </div>
      </header>

      {!initial ? (
        <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>
      ) : (
        <SponsorForm
          initial={initial}
          events={events}
          library={library}
          onSubmit={handleSubmit}
          submitLabel="스폰서 등록"
        />
      )}
    </div>
  );
}

function buildLibrary(
  categories: Category[],
  packages: Package[],
  slots: Slot[]
): SponsorItemLibraryEntry[] {
  const entries: SponsorItemLibraryEntry[] = [];
  const catMap = new Map(categories.map((c) => [c.id, c]));
  packages
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach((p) =>
      entries.push({
        key: `pkg:${p.id}`,
        label: p.name.ko,
        group: "패키지",
        packageId: p.id,
        hint: p.code,
      })
    );
  categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((c) =>
      entries.push({
        key: `cat:${c.id}`,
        label: c.name.ko,
        group: "카테고리",
        categoryId: c.id,
        hint: c.code,
      })
    );
  slots.forEach((s) => {
    const cat = catMap.get(s.categoryId);
    if (!cat) return;
    entries.push({
      key: `slot:${s.id}`,
      label: `${cat.name.ko} ${s.code}`,
      group: "슬롯",
      slotId: s.id,
      categoryId: s.categoryId,
      subcategoryId: s.subcategoryId,
      hint: s.code,
    });
  });
  return entries;
}
