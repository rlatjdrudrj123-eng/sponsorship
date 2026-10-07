/**
 * 변경 이력(감사 로그) — 순수 함수 모음. Firestore 트리거(index.ts)가 사용한다.
 *
 * 문서가 바뀔 때마다 auditLogs 에 한 건씩 남긴다:
 *   누가(actor) · 언제(at) · 어느 행사(eventId) · 무엇을(col/docId/label) · 어떻게(action/changes)
 * 값은 화면 표시용 요약만 저장 (큰 객체·긴 문자열은 잘라서) — 원본 백업 용도가 아님.
 */

export type Action = "create" | "update" | "delete";

export type Change = {
  field: string;
  before: unknown;
  after: unknown;
};

/** 기록 대상 컬렉션과 화면 표시 이름 */
export const WATCHED: Record<string, string> = {
  categories: "카테고리",
  subcategories: "소분류",
  slots: "구좌",
  packages: "패키지",
  personas: "페르소나",
  sponsors: "스폰서",
  inquiries: "문의",
  events: "행사",
  members: "멤버",
  siteSettings: "사이트 설정",
  taxonomy: "분류·태그",
  quoteSettings: "견적서 설정",
};

/** 문서 ID 가 곧 행사 ID 인 컬렉션 */
const KEYED_BY_EVENT = new Set(["events", "siteSettings", "taxonomy", "quoteSettings"]);

/** 비교에서 빼는 필드 (매번 바뀌는 시각 등) */
const IGNORED_FIELDS = new Set(["updatedAt", "createdAt"]);

const MAX_STRING = 200;
const MAX_JSON = 300;
const MAX_CHANGES = 40;

type Data = Record<string, unknown> | undefined;

function isTimestampLike(v: unknown): v is { toDate: () => Date } {
  return !!v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function";
}

/** 비교용 정규화 — Timestamp 는 ISO 문자열로, 객체 키는 정렬 */
export function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (isTimestampLike(v)) {
    try {
      return v.toDate().toISOString();
    } catch {
      return String(v);
    }
  }
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    // GeoPoint / DocumentReference 등 특수 객체는 문자열로
    const ctor = (o as { constructor?: { name?: string } }).constructor?.name;
    if (ctor && ctor !== "Object") {
      const path = (o as { path?: unknown }).path;
      if (typeof path === "string") return path;
    }
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = normalize(o[k]);
    return out;
  }
  return v;
}

/** 화면 표시용 요약 — 긴 문자열·큰 목록·큰 객체는 잘라서 */
export function summarize(v: unknown): unknown {
  const n = normalize(v);
  if (n === null || typeof n === "number" || typeof n === "boolean") return n;
  if (typeof n === "string") {
    return n.length > MAX_STRING ? `${n.slice(0, MAX_STRING)}…` : n;
  }
  const json = JSON.stringify(n);
  if (json.length <= MAX_JSON) return n;
  if (Array.isArray(n)) return { _summary: `목록 ${n.length}개` };
  return { _summary: `항목 ${Object.keys(n as object).length}개 (내용 변경)` };
}

/** 최상위 필드 단위 비교 — 바뀐 필드만 (시각 필드 제외), 최대 MAX_CHANGES 개 */
export function diffDocs(before: Data, after: Data): Change[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: Change[] = [];
  for (const k of [...keys].sort()) {
    if (IGNORED_FIELDS.has(k)) continue;
    const b = before?.[k];
    const a = after?.[k];
    if (JSON.stringify(normalize(b)) === JSON.stringify(normalize(a))) continue;
    changes.push({ field: k, before: summarize(b), after: summarize(a) });
    if (changes.length >= MAX_CHANGES) break;
  }
  return changes;
}

export function actionOf(before: Data, after: Data): Action {
  if (!before) return "create";
  if (!after) return "delete";
  return "update";
}

/** 로그가 속한 행사 — 문서의 eventId, 또는 문서 ID 가 행사 ID 인 컬렉션은 ID */
export function eventIdOf(col: string, docId: string, before: Data, after: Data): string | null {
  if (KEYED_BY_EVENT.has(col)) return docId === "main" ? null : docId;
  const ev = (after?.eventId ?? before?.eventId) as unknown;
  return typeof ev === "string" && ev ? ev : null;
}

function ko(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as { ko?: unknown; en?: unknown };
    if (typeof o.ko === "string") return o.ko;
    if (typeof o.en === "string") return o.en;
  }
  return "";
}

/** 목록에서 알아볼 이름 — 컬렉션별 대표 필드 */
export function labelOf(col: string, docId: string, before: Data, after: Data): string {
  const d = (after ?? before ?? {}) as Record<string, unknown>;
  const code = typeof d.code === "string" ? d.code : "";
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
  switch (col) {
    case "categories":
    case "packages":
      return join(code, ko(d.name)) || docId;
    case "subcategories":
      return ko(d.name) || docId;
    case "slots":
      return code || docId;
    case "personas":
      return ko(d.title) || ko(d.name) || docId;
    case "sponsors":
    case "inquiries":
      return (typeof d.companyName === "string" && d.companyName) || docId;
    case "events":
      return ko(d.name) || docId;
    case "members":
      return join(
        typeof d.name === "string" ? d.name : "",
        typeof d.email === "string" ? `(${d.email})` : ""
      ) || docId;
    default:
      return WATCHED[col] ?? col;
  }
}

/** 상위 문서 — 구좌·소분류는 카테고리 (카테고리 화면에서 하위 변경까지 모아 보기용) */
export function parentIdOf(col: string, before: Data, after: Data): string | null {
  if (col !== "slots" && col !== "subcategories") return null;
  const p = (after?.categoryId ?? before?.categoryId) as unknown;
  return typeof p === "string" && p ? p : null;
}

/** 기록할 가치가 있는 변경인지 — 시각 필드만 바뀐 저장은 건너뜀 */
export function shouldLog(action: Action, changes: Change[]): boolean {
  return action !== "update" || changes.length > 0;
}
