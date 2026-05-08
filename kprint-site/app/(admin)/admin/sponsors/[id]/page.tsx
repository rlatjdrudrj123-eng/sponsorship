"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import {
  EMPTY_FORM_VALUES,
  SponsorForm,
  type SponsorFormValues,
  type SponsorItemLibraryEntry,
} from "@/components/admin/SponsorForm";
import type { Category, Event, Package, Slot, Sponsor } from "@/lib/types";

export default function SponsorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const u = onSnapshot(doc(getDb(), "sponsors", id), (s) => {
      if (!s.exists()) {
        setNotFound(true);
        return;
      }
      setSponsor({ ...(s.data() as Sponsor), id: s.id });
    });
    return () => u();
  }, [id]);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => {
        setEvents(s.docs.map((d) => ({ ...(d.data() as Event), id: d.id })));
      }
    );
    return () => u();
  }, []);

  // 품목 라이브러리용 데이터
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

  const library = useMemo<SponsorItemLibraryEntry[]>(() => {
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
  }, [categories, packages, slots]);

  const initial = useMemo<SponsorFormValues | null>(() => {
    if (!sponsor) return null;
    return {
      eventId: sponsor.eventId,
      companyName: sponsor.companyName,
      amount: sponsor.amount,
      currency: sponsor.currency,
      amountNote: sponsor.amountNote ?? "",
      items: sponsor.items ?? [],
      benefits: sponsor.benefits ?? EMPTY_FORM_VALUES.benefits,
      bannerType: sponsor.bannerType ?? "",
      bannerNote: sponsor.bannerNote ?? "",
      designItems: sponsor.designItems ?? [],
      contacts: sponsor.contacts ?? [],
      status: sponsor.status,
      notes: sponsor.notes ?? "",
    };
  }, [sponsor]);

  const handleSubmit = async (v: SponsorFormValues) => {
    try {
      await updateDoc(doc(getDb(), "sponsors", id), {
        ...v,
        amountNote: v.amountNote || undefined,
        bannerType: v.bannerType || undefined,
        bannerNote: v.bannerNote || undefined,
        notes: v.notes || undefined,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      // 시각적 피드백
      const el = document.createElement("div");
      el.textContent = "저장됨";
      el.className =
        "fixed bottom-6 right-6 z-50 px-4 py-2 rounded-btn bg-mint-500 text-ink-900 text-sm font-bold shadow-lg";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(getDb(), "sponsors", id));
      router.push("/admin/sponsors");
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (notFound) {
    return (
      <div className="bg-white border border-ink-100 rounded-card p-12 text-center">
        <p className="text-sm text-ink-500">스폰서를 찾을 수 없습니다.</p>
        <Link
          href="/admin/sponsors"
          className="text-mint-700 font-semibold mt-4 inline-block hover:underline"
        >
          목록으로
        </Link>
      </div>
    );
  }

  if (!sponsor || !initial) {
    return <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/sponsors"
            className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-ink-900 leading-tight truncate">
              {sponsor.companyName}
            </h1>
            <div className="text-[12px] text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
              {sponsor.createdAt && <span>{fmtDate(sponsor.createdAt)} 등록</span>}
              {sponsor.inquiryId && (
                <>
                  <span>·</span>
                  <Link
                    href={`/admin/inquiries/${sponsor.inquiryId}`}
                    className="text-mint-700 hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" />
                    원본 문의
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/quotes/print/sponsor/${sponsor.id}`}
            target="_blank"
            className="px-3 py-2 rounded-btn border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            견적서 추출
          </Link>
        </div>
      </header>

      <SponsorForm
        initial={initial}
        events={events}
        library={library}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        submitLabel="변경사항 저장"
      />
    </div>
  );
}

function fmtDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
