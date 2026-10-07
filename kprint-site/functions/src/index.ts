/**
 * 변경 이력 트리거 — 스폰서십 데이터 문서가 바뀌면 auditLogs 에 한 건 기록.
 * Firestore(default) 위치가 asia-northeast3 이라 같은 리전에 둔다.
 */
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWrittenWithAuthContext } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  WATCHED,
  actionOf,
  diffDocs,
  eventIdOf,
  labelOf,
  parentIdOf,
  shouldLog,
} from "./audit";

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

const db = getFirestore();

type Actor = { uid: string | null; name: string; email: string | null };

// 인스턴스 메모리 캐시 — 같은 사람이 연속 저장할 때 조회 반복 방지
const actorCache = new Map<string, Actor>();

async function resolveActor(authType: string, authId: string | undefined): Promise<Actor> {
  if (!authId) {
    return {
      uid: null,
      name: authType === "unauthenticated" ? "비로그인 방문자" : "시스템",
      email: null,
    };
  }
  const cached = actorCache.get(authId);
  if (cached) return cached;

  let actor: Actor = { uid: authId, name: authId, email: null };
  try {
    const m = await db.doc(`members/${authId}`).get();
    if (m.exists) {
      const d = m.data() ?? {};
      actor = {
        uid: authId,
        name: (typeof d.name === "string" && d.name) || (typeof d.email === "string" ? d.email : authId),
        email: typeof d.email === "string" ? d.email : null,
      };
    } else {
      // 멤버 문서 없는 계정(최초 관리자 등) — 로그인 계정 정보
      const u = await getAuth().getUser(authId);
      actor = {
        uid: authId,
        name: u.displayName || u.email || authId,
        email: u.email ?? null,
      };
    }
  } catch {
    // 서비스 계정 등 사용자 계정이 아닌 주체 — authId 그대로
  }
  actorCache.set(authId, actor);
  return actor;
}

export const auditTrail = onDocumentWrittenWithAuthContext("{col}/{docId}", async (event) => {
  const { col, docId } = event.params;
  if (!(col in WATCHED)) return; // auditLogs 자신 등 대상 외 컬렉션

  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  const after = event.data?.after?.exists ? event.data.after.data() : undefined;
  if (!before && !after) return;

  const action = actionOf(before, after);
  const changes = action === "delete" ? [] : diffDocs(before, after);
  if (!shouldLog(action, changes)) return;

  const actor = await resolveActor(event.authType, event.authId);

  await db.collection("auditLogs").add({
    at: Timestamp.fromDate(new Date(event.time)),
    eventId: eventIdOf(col, docId, before, after),
    col,
    colLabel: WATCHED[col],
    docId,
    parentId: parentIdOf(col, before, after),
    label: labelOf(col, docId, before, after),
    action,
    changes,
    changedFields: changes.map((c) => c.field),
    actorUid: actor.uid,
    actorName: actor.name,
    actorEmail: actor.email,
    authType: event.authType,
  });

  logger.debug("audit", { col, docId, action, authType: event.authType, authId: event.authId });
});
