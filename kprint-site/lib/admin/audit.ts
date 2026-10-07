/**
 * 변경 이력(auditLogs) — 화면 표시용 타입·문구·묶음.
 * 기록은 Cloud Functions(functions/src/index.ts)가 하고, 어드민 화면은 읽기만 한다.
 */
import type { Timestamp } from "firebase/firestore";

export type AuditAction = "create" | "update" | "delete";

export type AuditChange = { field: string; before: unknown; after: unknown };

export type AuditLog = {
  id: string;
  at: Timestamp;
  eventId: string | null;
  col: string;
  colLabel?: string;
  docId: string;
  parentId?: string | null;
  label: string;
  action: AuditAction;
  changes: AuditChange[];
  changedFields?: string[];
  actorUid: string | null;
  actorName: string;
  actorEmail: string | null;
  authType?: string;
};

export const ACTION_LABEL: Record<AuditAction, string> = {
  create: "추가",
  update: "수정",
  delete: "삭제",
};

export const COL_LABEL: Record<string, string> = {
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

const FIELD_LABEL: Record<string, string> = {
  status: "상태",
  isPublished: "공개",
  soldOut: "매진",
  priceKRW: "가격(원)",
  priceUSD: "가격(USD)",
  originalPrice: "정가",
  discountPrice: "판매가",
  originalPriceUSD: "정가(USD)",
  discountPriceUSD: "판매가(USD)",
  name: "이름",
  nameEn: "영문 이름",
  code: "코드",
  slug: "주소",
  type: "유형",
  channel: "채널",
  shortDesc: "한 줄 설명",
  longDesc: "상세 설명",
  tagline: "소개 문구",
  tags: "태그",
  order: "순서",
  deadline: "마감일",
  heroImages: "대표 이미지",
  detailImages: "상세 이미지",
  floorImage: "도면",
  pins: "도면 핀",
  includedItems: "포함 품목",
  referencedSlotIds: "연결 구좌",
  slotIds: "구좌",
  unit: "단위",
  size: "규격",
  note: "메모",
  notes: "메모",
  adminNote: "메모",
  companyName: "회사명",
  contactName: "담당자",
  email: "이메일",
  phone: "전화",
  message: "문의 내용",
  amount: "협상 금액(공급가)",
  amountNote: "금액 메모",
  currency: "통화",
  items: "품목",
  benefits: "혜택",
  bannerType: "배너 종류",
  bannerNote: "배너 메모",
  designItems: "디자인물",
  contacts: "연락처",
  role: "역할",
  events: "담당 전시회",
  shortName: "단축명",
  year: "연도",
  isActive: "활성",
  lastYearTotal: "작년 합계",
  landing: "랜딩 페이지",
  theme: "테마",
  issuer: "발행자 정보",
  bank: "입금 계좌",
  eventSubtitle: "행사 부제",
  eventIntro: "행사 안내 문구",
  serialPrefix: "일련번호 접두어",
  serialNextNumber: "다음 일련번호",
  goalAffinity: "1분 진단 점수",
  personaIds: "페르소나 연결",
  synergyIds: "함께 보면 좋은",
  timing: "노출 시점",
  location: "노출 위치",
};

const VALUE_LABEL: Record<string, Record<string, string>> = {
  status: {
    available: "판매 중",
    reserved: "확보",
    sold: "매진",
    new: "신규",
    in_progress: "진행 중",
    closed: "종료",
    reviewing: "검토 중",
    declined: "진행 안 함",
    in_kind: "협찬",
    pending: "승인 대기",
    active: "사용 중",
    disabled: "사용 중지",
  },
  role: { admin: "관리자", manager: "담당자" },
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** 이력 값 → 한 줄 문구 */
export function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (typeof v === "number") return v.toLocaleString("ko-KR");
  if (typeof v === "string") {
    const mapped = VALUE_LABEL[field]?.[v];
    if (mapped) return mapped;
    if (ISO_RE.test(v)) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return formatDateTime(d);
    }
    return v;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return "(없음)";
    if (v.every((x) => typeof x === "string" || typeof x === "number")) {
      const s = v.join(", ");
      return s.length > 80 ? `${s.slice(0, 80)}… (${v.length}개)` : s;
    }
    return `목록 ${v.length}개`;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o._summary === "string") return o._summary;
    if (typeof o.ko === "string") return o.ko || (typeof o.en === "string" ? o.en : "—");
    const s = JSON.stringify(o);
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  }
  return String(v);
}

export function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 이력의 관련 화면 링크 (없으면 null) */
export function logHref(log: AuditLog): string | null {
  switch (log.col) {
    case "categories":
      return log.action === "delete" ? null : `/admin/categories/${log.docId}`;
    case "slots":
    case "subcategories":
      return log.parentId ? `/admin/categories/${log.parentId}` : null;
    case "packages":
      return log.action === "delete" ? null : `/admin/packages/${log.docId}`;
    case "sponsors":
      return log.action === "delete" ? null : `/admin/sponsors/${log.docId}`;
    case "inquiries":
      return log.action === "delete" ? null : `/admin/inquiries/${log.docId}`;
    case "members":
      return "/admin/members";
    case "siteSettings":
      return "/admin/settings";
    case "quoteSettings":
      return "/admin/settings/quote";
    case "taxonomy":
      return "/admin/settings/taxonomy";
    case "events":
      return "/admin/events";
    default:
      return null;
  }
}

export type AuditGroup = { key: string; logs: AuditLog[] };

const GROUP_GAP_MS = 3 * 60 * 1000;

/**
 * 같은 사람이 같은 종류를 같은 방식으로 연달아 바꾼 기록은 한 묶음으로
 * (엑셀 업로드·자동 저장처럼 수백 건이 한꺼번에 생기는 경우). logs 는 최신순.
 */
export function groupLogs(logs: AuditLog[]): AuditGroup[] {
  const groups: AuditGroup[] = [];
  for (const log of logs) {
    const g = groups[groups.length - 1];
    const last = g?.logs[g.logs.length - 1];
    const t = log.at?.toMillis?.() ?? 0;
    if (
      g &&
      last &&
      last.actorUid === log.actorUid &&
      last.col === log.col &&
      last.action === log.action &&
      Math.abs((last.at?.toMillis?.() ?? 0) - t) <= GROUP_GAP_MS
    ) {
      g.logs.push(log);
    } else {
      groups.push({ key: log.id, logs: [log] });
    }
  }
  return groups;
}

/** 한 줄 요약 — "구좌 RGK-01 수정: 상태 판매 중 → 매진" */
export function summarizeChanges(log: AuditLog, max = 3): string {
  if (log.action !== "update" || !log.changes?.length) return "";
  const parts = log.changes.slice(0, max).map(
    (c) => `${fieldLabel(c.field)} ${formatValue(c.field, c.before)} → ${formatValue(c.field, c.after)}`
  );
  const more = log.changes.length > max ? ` 외 ${log.changes.length - max}개` : "";
  return parts.join(" · ") + more;
}
