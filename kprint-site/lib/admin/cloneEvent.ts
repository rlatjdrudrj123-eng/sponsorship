/**
 * 행사 복제 실행 — 원본 행사 데이터를 읽어 planClone 계획대로 새 행사에 쓴다.
 * 관리자 전용 (행사 생성은 보안 규칙상 관리자만).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import {
  planClone,
  type CloneInclude,
  type ClonePlan,
  type CloneSource,
  type CloneTarget,
  type Doc,
} from "./clonePlan";

const BATCH = 400;

async function loadByEvent(col: string, eventId: string): Promise<Doc[]> {
  const snap = await getDocs(query(collection(getDb(), col), where("eventId", "==", eventId)));
  return snap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }));
}

async function loadDoc(col: string, id: string): Promise<Record<string, unknown> | null> {
  const s = await getDoc(doc(getDb(), col, id));
  return s.exists() ? (s.data() as Record<string, unknown>) : null;
}

export async function loadCloneSource(sourceEventId: string): Promise<CloneSource> {
  const [categories, subcategories, slots, packages, personas, taxonomy, siteSettings, quoteSettings] =
    await Promise.all([
      loadByEvent("categories", sourceEventId),
      loadByEvent("subcategories", sourceEventId),
      loadByEvent("slots", sourceEventId),
      loadByEvent("packages", sourceEventId),
      loadByEvent("personas", sourceEventId),
      loadDoc("taxonomy", sourceEventId),
      loadDoc("siteSettings", sourceEventId),
      loadDoc("quoteSettings", sourceEventId),
    ]);
  return { categories, subcategories, slots, packages, personas, taxonomy, siteSettings, quoteSettings };
}

/**
 * 새 행사 문서 만들기 — 만든 사람이 소유자(ownerUids). 담당자(관리자가 아닌 멤버)는
 * 같은 batch 로 본인 members 문서에 이 행사를 배정한다 (보안 규칙 isOwnerAssignment).
 */
export async function createEventDoc(opts: {
  target: CloneTarget & { order: number };
  creator: { uid: string; selfAssign: boolean; currentEvents: string[] };
  note?: string;
}): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, "events", opts.target.id), {
    id: opts.target.id,
    name: opts.target.name,
    shortName: opts.target.shortName,
    year: opts.target.year,
    isActive: true,
    order: opts.target.order,
    note: opts.note ?? "",
    ownerUids: [opts.creator.uid],
    createdBy: opts.creator.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (opts.creator.selfAssign && !opts.creator.currentEvents.includes(opts.target.id)) {
    batch.update(doc(db, "members", opts.creator.uid), {
      events: [...opts.creator.currentEvents, opts.target.id],
      lastAssign: { eventId: opts.target.id, op: "add", by: opts.creator.uid, at: serverTimestamp() },
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function cloneEvent(opts: {
  sourceEventId: string;
  target: CloneTarget & { order: number };
  include: CloneInclude;
  creator: { uid: string; selfAssign: boolean; currentEvents: string[] };
  onProgress?: (done: number, total: number) => void;
}): Promise<ClonePlan> {
  const db = getDb();
  const src = await loadCloneSource(opts.sourceEventId);
  const plan = planClone(
    src,
    opts.target,
    opts.include,
    (col) => doc(collection(db, col)).id,
    () => Timestamp.fromDate(new Date())
  );

  // 1) 행사 문서 + (담당자면) 본인 배정 먼저 — 이후 문서들은 이 행사 권한으로 쓴다
  await createEventDoc({
    target: opts.target,
    creator: opts.creator,
    note: `복사 원본: ${opts.sourceEventId}`,
  });

  // 2) 나머지 — 400건씩
  const total = plan.writes.length;
  let done = 0;
  for (let i = 0; i < total; i += BATCH) {
    const chunk = plan.writes.slice(i, i + BATCH);
    const batch = writeBatch(db);
    for (const w of chunk) batch.set(doc(db, w.col, w.id), w.data);
    await batch.commit();
    done += chunk.length;
    opts.onProgress?.(done, total);
  }
  return plan;
}
