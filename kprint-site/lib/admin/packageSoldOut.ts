/**
 * 스폰서 저장·삭제 뒤 패키지 매진 표시 맞추기 — 담당자 확인을 받은 뒤에만 바꾼다.
 *
 *  - 새로 붙은 패키지가 판매 중이면: "단독 패키지면 매진 처리" 확인
 *    (A to Z 처럼 한 업체만 사는 패키지. 여러 업체에 파는 패키지는 취소)
 *  - 빠진 패키지가 매진 상태이고 같은 행사의 다른 스폰서가 안 쓰면: "매진 해제" 확인
 *
 * 예전에는 패키지 화면에 따로 들어가 매진 체크를 해야 해서 빠뜨리기 쉬웠다.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Package, Sponsor, SponsorItem } from "@/lib/types";

export function packageIdsOf(items: SponsorItem[] | undefined): Set<string> {
  return new Set((items ?? []).map((i) => i.packageId).filter((x): x is string => !!x));
}

function nameOf(p: Package): string {
  return p.name?.ko || p.code || p.id;
}

export async function syncPackageSoldOut(opts: {
  /** 이번 저장 기준 행사 (빠진 패키지 확인은 이전 행사 기준) */
  eventId: string;
  prevEventId?: string;
  sponsorId: string;
  prev: Set<string>;
  next: Set<string>;
}): Promise<void> {
  const db = getDb();
  const added = Array.from(opts.next).filter((id) => !opts.prev.has(id));
  const removed = Array.from(opts.prev).filter((id) => !opts.next.has(id));
  const now = () => Timestamp.fromDate(new Date());

  for (const pid of added) {
    try {
      const snap = await getDoc(doc(db, "packages", pid));
      if (!snap.exists()) continue;
      const p = { ...(snap.data() as Package), id: snap.id };
      if (p.soldOut) continue;
      const ok = window.confirm(
        `'${nameOf(p)}' 패키지가 포함됐습니다.\n\n` +
          `한 업체만 살 수 있는 단독 패키지면 [확인]을 눌러 매진 처리하세요.\n` +
          `(공개 사이트에 '매진'으로 표시되고 담기가 막힙니다)\n\n` +
          `여러 업체에 파는 패키지면 [취소].`
      );
      if (ok) await updateDoc(doc(db, "packages", pid), { soldOut: true, updatedAt: now() });
    } catch (e) {
      console.error("package soldOut sync failed", e);
    }
  }

  if (removed.length === 0) return;
  const evId = opts.prevEventId ?? opts.eventId;
  let others: Sponsor[] = [];
  try {
    const snap = await getDocs(query(collection(db, "sponsors"), where("eventId", "==", evId)));
    others = snap.docs
      .map((d) => ({ ...(d.data() as Sponsor), id: d.id }))
      .filter((s) => s.id !== opts.sponsorId);
  } catch (e) {
    console.error("sponsor lookup failed", e);
    return; // 다른 스폰서 사용 여부를 모르면 해제를 묻지 않는다
  }
  const usedByOthers = new Set(others.flatMap((s) => Array.from(packageIdsOf(s.items))));

  for (const pid of removed) {
    if (usedByOthers.has(pid)) continue;
    try {
      const snap = await getDoc(doc(db, "packages", pid));
      if (!snap.exists()) continue;
      const p = { ...(snap.data() as Package), id: snap.id };
      if (!p.soldOut) continue;
      const ok = window.confirm(
        `'${nameOf(p)}' 패키지가 이 스폰서에서 빠졌고, 다른 스폰서도 쓰지 않습니다.\n\n` +
          `매진 표시를 풀어 다시 판매할까요?`
      );
      if (ok) await updateDoc(doc(db, "packages", pid), { soldOut: false, updatedAt: now() });
    } catch (e) {
      console.error("package soldOut release failed", e);
    }
  }
}
