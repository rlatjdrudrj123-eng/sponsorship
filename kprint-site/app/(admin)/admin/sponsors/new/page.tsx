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
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import {
  EMPTY_FORM_VALUES,
  SponsorForm,
  type SponsorFormValues,
  type SponsorItemLibraryEntry,
} from "@/components/admin/SponsorForm";
import type {
  Category,
  Event,
  Inquiry,
  Package,
  Slot,
  Sponsor,
  Subcategory,
} from "@/lib/types";

export default function NewSponsorPage() {
  const router = useRouter();
  const search = useSearchParams();
  const inquiryId = search.get("inquiryId");
  const presetEvent = search.get("event");
  // 라이브러리 fetch 용 — preset query param 우선 → 문의의 행사(inquiry 로드 후 채워짐)
  // → 헤더 행사 셀렉터 폴백. 전환 플로우에서 헤더 셀렉터가 다른 행사여도
  // 문의가 속한 행사의 패키지/슬롯이 로드되어 구좌 확보 패널이 정상 표시됨.
  const headerEventId = useEventFilter().eventId;
  const [inqEventId, setInqEventId] = useState<string>("");
  const libraryEventId = presetEvent || inqEventId || headerEventId || "";

  const [events, setEvents] = useState<Event[]>([]);
  const [initial, setInitial] = useState<SponsorFormValues | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => {
        setEvents(s.docs.map((d) => ({ ...(d.data() as Event), id: d.id })));
      }
    );
    return () => u();
  }, []);

  // 품목 라이브러리용 데이터 — libraryEventId (preset query 또는 헤더 행사 셀렉터)
  // 의 카테고리/패키지/슬롯만. 다른 행사 품목이 sponsor 에 잘못 연결되는 사고 방지.
  useEffect(() => {
    if (!libraryEventId) {
      setCategories([]);
      setPackages([]);
      setSlots([]);
      setSubcategories([]);
      return;
    }
    (async () => {
      try {
        const db = getDb();
        const [c, p, s, sub] = await Promise.all([
          getDocs(query(collection(db, "categories"), where("eventId", "==", libraryEventId))),
          getDocs(query(collection(db, "packages"), where("eventId", "==", libraryEventId))),
          getDocs(query(collection(db, "slots"), where("eventId", "==", libraryEventId))),
          getDocs(query(collection(db, "subcategories"), where("eventId", "==", libraryEventId))),
        ]);
        setCategories(c.docs.map((d) => ({ ...(d.data() as Category), id: d.id })));
        setPackages(p.docs.map((d) => ({ ...(d.data() as Package), id: d.id })));
        setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
        setSubcategories(sub.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id })));
      } catch (e) {
        console.error("library load failed", e);
      }
    })();
  }, [libraryEventId]);

  const library = useMemo<SponsorItemLibraryEntry[]>(
    () => buildLibrary(categories, packages, slots, subcategories),
    [categories, packages, slots, subcategories]
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
        // 문의의 행사를 라이브러리 로드 폴백에 반영 (libraryEventId 계산에 사용)
        setInqEventId(inq.eventId ?? "");

        // cart items → sponsor items 매핑 (코드 + 카테고리/패키지 명)
        const items = await Promise.all(
          (inq.cartItems ?? []).map(async (ci) => {
            if (ci.type === "slot") {
              const cat = await getDoc(doc(getDb(), "categories", ci.categoryId));
              const catName = cat.exists() ? (cat.data() as { name: { ko: string } }).name.ko : "";
              return {
                label: `${catName} ${ci.code}`.trim(),
                slotId: ci.slotId,
                categoryId: ci.categoryId,
                price: ci.price,
              };
            }
            const pkg = await getDoc(doc(getDb(), "packages", ci.packageId));
            const pkgName = pkg.exists() ? (pkg.data() as { name: { ko: string } }).name.ko : "";
            return {
              label: pkgName || ci.code,
              packageId: ci.packageId,
              price: ci.price,
            };
          })
        );

        setInitial({
          ...EMPTY_FORM_VALUES,
          // preset query param 우선, 없으면 inquiry 자신의 eventId 사용.
          // (inquiry 가 자기 행사를 알고 있으므로 빈 값으로 두지 않음 — SponsorForm 저장 차단 방지)
          eventId: presetEvent ?? inq.eventId ?? "",
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

      // 품목이 참조하는 슬롯(직접 연결 slotId + 패키지 확보 allocatedSlotIds)을
      // 'sold' 처리 — 공개 사이트 매진 뱃지(슬롯 기반 자동 계산)에 반영.
      // 실패해도 sponsor 저장은 유지.
      const slotIds = Array.from(
        new Set(
          v.items
            .flatMap((it) => [it.slotId, ...(it.allocatedSlotIds ?? [])])
            .filter((sid): sid is string => Boolean(sid))
        )
      );
      if (slotIds.length > 0) {
        try {
          const db = getDb();
          // 존재하는 슬롯 문서만 배치에 포함 — batch.update 는 문서가 없으면
          // commit 전체가 원자적으로 실패하므로, 삭제된 슬롯의 고아 ID 가
          // 정상 슬롯 갱신까지 무산시키는 것 방지. (슬롯 수가 적어 N+1 무해)
          const snaps = await Promise.all(
            slotIds.map((sid) => getDoc(doc(db, "slots", sid)))
          );
          const existing = slotIds.filter((sid, i) => {
            if (snaps[i].exists()) return true;
            console.warn(`slot sync: 슬롯 문서 없음 — 배치에서 제외: ${sid}`);
            return false;
          });
          if (existing.length > 0) {
            const batch = writeBatch(db);
            existing.forEach((sid) =>
              batch.update(doc(db, "slots", sid), { status: "sold" })
            );
            await batch.commit();
          }
        } catch (e) {
          console.error("slot sync failed", e);
          alert("스폰서는 저장됐지만 슬롯 상태 업데이트에 실패했습니다 — 슬롯 관리에서 수동 확인해주세요.");
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
          packages={packages}
          slots={slots}
          categories={categories}
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
  slots: Slot[],
  subcategories: Subcategory[]
): SponsorItemLibraryEntry[] {
  const entries: SponsorItemLibraryEntry[] = [];
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const subMap = new Map(subcategories.map((s) => [s.id, s]));
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
        price: p.discountPrice || p.originalPrice,
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
        // 카테고리는 단가 자동 채움 없음 (수기)
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
      price: subMap.get(s.subcategoryId)?.priceKRW,
    });
  });
  return entries;
}
