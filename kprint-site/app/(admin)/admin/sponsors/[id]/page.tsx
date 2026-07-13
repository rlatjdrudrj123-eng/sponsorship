"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import {
  EMPTY_FORM_VALUES,
  SponsorForm,
  type SponsorFormValues,
  type SponsorItemLibraryEntry,
} from "@/components/admin/SponsorForm";
import type {
  Category,
  Event,
  Package,
  Slot,
  Sponsor,
  SponsorItem,
  Subcategory,
} from "@/lib/types";

export default function SponsorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
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

  // 품목 라이브러리 — sponsor.eventId 의 카테고리/패키지/슬롯만.
  // 다른 행사 품목 섞임 방지 (행사 분리 보장).
  useEffect(() => {
    const eventId = sponsor?.eventId;
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const [c, p, s, sub] = await Promise.all([
          getDocs(query(collection(db, "categories"), where("eventId", "==", eventId))),
          getDocs(query(collection(db, "packages"), where("eventId", "==", eventId))),
          getDocs(query(collection(db, "slots"), where("eventId", "==", eventId))),
          getDocs(query(collection(db, "subcategories"), where("eventId", "==", eventId))),
        ]);
        setCategories(c.docs.map((d) => ({ ...(d.data() as Category), id: d.id })));
        setPackages(p.docs.map((d) => ({ ...(d.data() as Package), id: d.id })));
        setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
        setSubcategories(sub.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id })));
      } catch (e) {
        console.error("library load failed", e);
      }
    })();
  }, [sponsor?.eventId]);

  const library = useMemo<SponsorItemLibraryEntry[]>(() => {
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
  }, [categories, packages, slots, subcategories]);

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
    // 저장 전 기존 문서의 슬롯 집합/행사를 미리 캡처 (onSnapshot 이 저장 직후 갱신하므로)
    const prevSlotIds = collectSlotIds(sponsor?.items ?? []);
    const prevEventId = sponsor?.eventId ?? v.eventId;
    try {
      await updateDoc(doc(getDb(), "sponsors", id), {
        ...v,
        amountNote: v.amountNote || undefined,
        bannerType: v.bannerType || undefined,
        bannerNote: v.bannerNote || undefined,
        notes: v.notes || undefined,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // 슬롯 상태 동기화 — 기존/신규 슬롯 집합 diff:
      //   새로 참조된 슬롯 → sold, 더 이상 참조하지 않는 슬롯 → available 복귀.
      // 실패해도 sponsor 저장은 유지.
      const nextSlotIds = collectSlotIds(v.items);
      const toSold = Array.from(nextSlotIds).filter((sid) => !prevSlotIds.has(sid));
      const toAvailable = Array.from(prevSlotIds).filter((sid) => !nextSlotIds.has(sid));
      if (toSold.length > 0 || toAvailable.length > 0) {
        try {
          const db = getDb();
          // sold 처리 — 존재하는 슬롯 문서만 배치에 포함.
          // (batch.update 는 문서가 없으면 commit 전체가 원자적으로 실패하므로,
          //  삭제된 슬롯을 참조하는 고아 ID 가 정상 슬롯 갱신까지 무산시키는 것 방지)
          const soldTargets = await filterExistingSlotIds(toSold);
          if (soldTargets.length > 0) {
            const batch = writeBatch(db);
            soldTargets.forEach((sid) =>
              batch.update(doc(db, "slots", sid), { status: "sold" })
            );
            await batch.commit();
          }
          // available 복귀 — 같은 행사의 다른 스폰서가 아직 참조 중인 슬롯은
          // 스킵(이중판매 방지) + 고아 ID 스킵.
          await releaseSlotsToAvailable(toAvailable, prevEventId, id);
        } catch (err) {
          console.error("slot sync failed", err);
          alert("스폰서는 저장됐지만 슬롯 상태 업데이트에 실패했습니다 — 슬롯 관리에서 수동 확인해주세요.");
        }
      }

      // 시각적 피드백
      const el = document.createElement("div");
      el.textContent = "저장됨";
      el.className =
        "fixed bottom-6 right-6 z-50 px-4 py-2 rounded-btn bg-brand-500 text-ink-900 text-sm font-bold shadow-lg";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDelete = async () => {
    // 삭제 전 이 스폰서가 참조하던 슬롯(slotId + allocatedSlotIds)을 available 로 복귀.
    // 타 스폰서가 참조 중인 슬롯/고아 ID 는 스킵. 복귀가 실패해도 삭제는 진행.
    const heldSlotIds = Array.from(collectSlotIds(sponsor?.items ?? []));
    const eventId = sponsor?.eventId;
    if (heldSlotIds.length > 0 && eventId) {
      try {
        await releaseSlotsToAvailable(heldSlotIds, eventId, id);
      } catch (e) {
        console.error("slot release on delete failed", e);
        alert(
          "이 스폰서가 확보했던 구좌를 되돌리지 못했습니다 — 슬롯 관리에서 수동으로 확인해주세요. 삭제는 계속 진행합니다."
        );
      }
    }
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
          className="text-brand-700 font-semibold mt-4 inline-block hover:underline"
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
                    className="text-brand-700 hover:underline inline-flex items-center gap-1"
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
        packages={packages}
        slots={slots}
        categories={categories}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        submitLabel="변경사항 저장"
      />
    </div>
  );
}

/** 품목들이 참조하는 슬롯 ID 집합 — 직접 연결(slotId) + 패키지 확보(allocatedSlotIds) */
function collectSlotIds(items: SponsorItem[]): Set<string> {
  return new Set(
    items
      .flatMap((it) => [it.slotId, ...(it.allocatedSlotIds ?? [])])
      .filter((sid): sid is string => Boolean(sid))
  );
}

/**
 * 존재하는 슬롯 문서만 남긴다 — batch.update 는 문서가 없으면 commit 전체가
 * 원자적으로 실패하므로, 고아 ID 를 배치에서 제외해 정상 슬롯 갱신을 보호.
 * (스폰서당 슬롯 수가 적어 getDoc N+1 비용 무해)
 */
async function filterExistingSlotIds(slotIds: string[]): Promise<string[]> {
  if (slotIds.length === 0) return [];
  const db = getDb();
  const snaps = await Promise.all(slotIds.map((sid) => getDoc(doc(db, "slots", sid))));
  const existing: string[] = [];
  snaps.forEach((snap, i) => {
    if (snap.exists()) existing.push(slotIds[i]);
    else console.warn(`slot sync: 슬롯 문서 없음 — 배치에서 제외: ${slotIds[i]}`);
  });
  return existing;
}

/**
 * 같은 행사(eventId)의 다른 스폰서들(excludeSponsorId 제외)이 참조 중인
 * 슬롯 ID 집합 — available 복귀 시 참조 카운트 확인용 (이중판매 방지).
 */
async function getSlotIdsHeldByOtherSponsors(
  eventId: string,
  excludeSponsorId: string
): Promise<Set<string>> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, "sponsors"), where("eventId", "==", eventId))
  );
  const held = new Set<string>();
  snap.docs.forEach((d) => {
    if (d.id === excludeSponsorId) return;
    const sp = d.data() as Sponsor;
    collectSlotIds(sp.items ?? []).forEach((sid) => held.add(sid));
  });
  return held;
}

/**
 * 슬롯 available 복귀 배치 — 두 단계 필터 후 실행:
 * 1) 같은 행사 타 스폰서가 참조 중인 슬롯 스킵 (되돌리면 이중판매 위험)
 * 2) 존재하지 않는(삭제된) 슬롯 문서 스킵 (배치 원자성 보호)
 * handleSubmit(저장 diff)과 handleDelete(스폰서 삭제) 양쪽에서 재사용.
 */
async function releaseSlotsToAvailable(
  slotIds: string[],
  eventId: string,
  excludeSponsorId: string
): Promise<void> {
  if (slotIds.length === 0) return;
  const heldByOthers = await getSlotIdsHeldByOtherSponsors(eventId, excludeSponsorId);
  const candidates = slotIds.filter((sid) => {
    if (heldByOthers.has(sid)) {
      console.warn(`slot sync: 다른 스폰서가 참조 중 — available 복귀 스킵: ${sid}`);
      return false;
    }
    return true;
  });
  const targets = await filterExistingSlotIds(candidates);
  if (targets.length === 0) return;
  const db = getDb();
  const batch = writeBatch(db);
  targets.forEach((sid) => batch.update(doc(db, "slots", sid), { status: "available" }));
  await batch.commit();
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
