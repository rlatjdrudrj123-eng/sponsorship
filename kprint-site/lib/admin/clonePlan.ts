/**
 * 행사 복제 계획 — 순수 함수 (Firestore 접근 없음, 런타임 import 없음 → node 로 단독 시험 가능).
 *
 * 원본 행사의 상품 구성(카테고리·소분류·구좌·패키지·페르소나)과 설정을 새 행사 ID 로 옮겨 쓸
 * 문서 목록을 만든다. 문서 간 참조(소분류→카테고리, 구좌→소분류, 도면 핀→구좌, 패키지 품목→구좌,
 * 카테고리→페르소나·시너지·패키지)는 모두 새 ID 로 바꾼다.
 *
 * 복사하지 않는 것: 스폰서·문의·업로드 이력(영업 기록), 행사 전체 PDF(원본 행사 자료).
 * 초기화: 구좌 상태 → 판매 중, 패키지 매진 → 해제, 견적서 일련번호 → 1.
 * 이미지·PDF 파일은 원본 파일 주소를 그대로 쓴다 (교체·삭제는 소유 경로 확인으로 원본 보호).
 */

export type Doc = Record<string, unknown> & { id: string };

export type CloneSource = {
  categories: Doc[];
  subcategories: Doc[];
  slots: Doc[];
  packages: Doc[];
  personas: Doc[];
  taxonomy: Record<string, unknown> | null;
  siteSettings: Record<string, unknown> | null;
  quoteSettings: Record<string, unknown> | null;
};

export type CloneTarget = {
  id: string;
  name: string;
  shortName: string;
  year: number;
};

export type CloneInclude = {
  /** 카테고리·소분류·구좌 */
  catalog: boolean;
  /** 패키지 (catalog 필요) */
  packages: boolean;
  /** 페르소나·분류(태그·버킷) */
  personas: boolean;
  /** 사이트 설정·메인 디자인 */
  site: boolean;
  /** 견적서 설정 (회사 정보 + 새 행사 기본 문구) */
  quote: boolean;
};

export type PlannedWrite = { col: string; id: string; data: Record<string, unknown> };

export type ClonePlan = {
  writes: PlannedWrite[];
  counts: {
    categories: number;
    subcategories: number;
    slots: number;
    packages: number;
    personas: number;
  };
  /** 복사 후 담당자가 확인해야 할 항목 */
  checklist: string[];
};

export type IdGen = (col: string) => string;

/** 시각 필드 값 생성기 (Firestore Timestamp 등) — 시험에서는 고정값 */
export type NowFn = () => unknown;

const str = (v: unknown) => (typeof v === "string" ? v : "");

function mapIds(ids: unknown, m: Map<string, string>): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((x) => (typeof x === "string" ? m.get(x) : undefined)).filter((x): x is string => !!x);
}

/** 견적서 행사 문구 기본값 — 설정 화면(settings/quote)과 같은 규칙 */
export function quoteEventDefaults(t: CloneTarget) {
  const short = (t.shortName || t.name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "SPN";
  const yy = String(t.year).slice(-2);
  return {
    eventSubtitle: t.name,
    eventIntro: `${t.name} 전시회의 스폰서십 참가에 관하여, 다음과 같이 제안하오니 검토해주시기 바랍니다.`,
    serialPrefix: `${short}${yy}-`,
    serialNextNumber: 1,
  };
}

export function planClone(
  src: CloneSource,
  target: CloneTarget,
  include: CloneInclude,
  newId: IdGen,
  now: NowFn
): ClonePlan {
  const writes: PlannedWrite[] = [];
  const counts = { categories: 0, subcategories: 0, slots: 0, packages: 0, personas: 0 };
  const checklist: string[] = [];
  const ev = target.id;

  const withPackages = include.packages && include.catalog;

  // ---- ID 매핑 ----
  const catMap = new Map<string, string>();
  const subMap = new Map<string, string>();
  const slotMap = new Map<string, string>();
  const pkgMap = new Map<string, string>();
  const personaMap = new Map<string, string>();
  if (include.catalog) {
    src.categories.forEach((c) => catMap.set(c.id, newId("categories")));
    src.subcategories.forEach((s) => {
      if (catMap.has(str(s.categoryId))) subMap.set(s.id, newId("subcategories"));
    });
    src.slots.forEach((s) => {
      if (subMap.has(str(s.subcategoryId))) slotMap.set(s.id, newId("slots"));
    });
  }
  if (withPackages) src.packages.forEach((p) => pkgMap.set(p.id, newId("packages")));
  if (include.personas) src.personas.forEach((p) => personaMap.set(p.id, newId("personas")));

  // ---- 페르소나 ----
  if (include.personas) {
    for (const p of src.personas) {
      const id = personaMap.get(p.id)!;
      writes.push({ col: "personas", id, data: { ...p, id, eventId: ev } });
      counts.personas++;
    }
  }

  // ---- 카테고리 ----
  if (include.catalog) {
    for (const c of src.categories) {
      const id = catMap.get(c.id)!;
      const data: Record<string, unknown> = { ...c, id, eventId: ev, createdAt: now(), updatedAt: now() };
      delete data.lastImportId;
      // 도면 — 소분류·핀(구좌) 참조 변경
      if (Array.isArray(c.floorImages)) {
        data.floorImages = (c.floorImages as Array<Record<string, unknown>>)
          .filter((f) => subMap.has(str(f.subcategoryId)))
          .map((f) => ({
            ...f,
            subcategoryId: subMap.get(str(f.subcategoryId)),
            pins: Array.isArray(f.pins)
              ? (f.pins as Array<Record<string, unknown>>)
                  .filter((p) => slotMap.has(str(p.slotId)))
                  .map((p) => ({ ...p, slotId: slotMap.get(str(p.slotId)) }))
              : [],
          }));
      }
      if (Array.isArray(c.synergyTargets)) data.synergyTargets = mapIds(c.synergyTargets, catMap);
      if (Array.isArray(c.personas)) data.personas = mapIds(c.personas, personaMap);
      if (Array.isArray(c.inPackages)) data.inPackages = mapIds(c.inPackages, pkgMap);
      writes.push({ col: "categories", id, data });
      counts.categories++;
    }
    for (const s of src.subcategories) {
      const id = subMap.get(s.id);
      if (!id) continue;
      writes.push({
        col: "subcategories",
        id,
        data: { ...s, id, eventId: ev, categoryId: catMap.get(str(s.categoryId)) },
      });
      counts.subcategories++;
    }
    for (const s of src.slots) {
      const id = slotMap.get(s.id);
      if (!id) continue;
      writes.push({
        col: "slots",
        id,
        data: {
          ...s,
          id,
          eventId: ev,
          subcategoryId: subMap.get(str(s.subcategoryId)),
          categoryId: catMap.get(str(s.categoryId)) ?? catMap.get(str(src.subcategories.find((x) => x.id === s.subcategoryId)?.categoryId)),
          status: "available",
        },
      });
      counts.slots++;
    }
  }

  // ---- 패키지 ----
  if (withPackages) {
    for (const p of src.packages) {
      const id = pkgMap.get(p.id)!;
      const items = Array.isArray(p.includedItems)
        ? (p.includedItems as Array<Record<string, unknown>>).map((it) => {
            const out: Record<string, unknown> = { ...it };
            if (typeof it.categoryId === "string") {
              const m = catMap.get(it.categoryId);
              if (m) out.categoryId = m;
              else delete out.categoryId;
            }
            if (typeof it.subcategoryId === "string") {
              const m = subMap.get(it.subcategoryId);
              if (m) out.subcategoryId = m;
              else delete out.subcategoryId;
            }
            if (Array.isArray(it.referencedSlotIds)) out.referencedSlotIds = mapIds(it.referencedSlotIds, slotMap);
            return out;
          })
        : [];
      writes.push({
        col: "packages",
        id,
        data: { ...p, id, eventId: ev, includedItems: items, soldOut: false },
      });
      counts.packages++;
    }
  }

  // ---- 분류(태그·버킷) ----
  if (include.personas && src.taxonomy) {
    writes.push({ col: "taxonomy", id: ev, data: { ...src.taxonomy } });
  }

  // ---- 사이트 설정 ----
  if (include.site && src.siteSettings) {
    const s: Record<string, unknown> = { ...src.siteSettings, eventId: ev };
    const event = (s.event && typeof s.event === "object" ? { ...(s.event as object) } : {}) as Record<string, unknown>;
    event.nameKo = target.name;
    event.nameEn = target.name;
    s.event = event;
    // 원본 행사의 전체 PDF 는 새 행사 자료가 아니다
    for (const k of [
      "pdfFullUrl",
      "pdfFullStoragePath",
      "pdfFullUploadedAt",
      "pdfFullUrlEn",
      "pdfFullStoragePathEn",
      "pdfFullUploadedAtEn",
    ]) {
      delete s[k];
    }
    writes.push({ col: "siteSettings", id: ev, data: s });
    checklist.push("사이트 설정: 행사 일정·장소, 대표 이미지, 연락처를 새 행사 기준으로 확인");
    if (str(src.siteSettings.applyUrl) || str(src.siteSettings.applyUrlEn)) {
      checklist.push("사이트 설정: '온라인 신청' 바로가기 주소가 새 행사 주소인지 확인");
    }
    checklist.push("메인 페이지 디자인: 원본 행사 문구·이미지가 그대로 있으니 교체");
    checklist.push("전체 PDF: 새 행사 자료로 다시 만들어 올리기");
  }

  // ---- 견적서 설정 ----
  if (include.quote && src.quoteSettings) {
    const q: Record<string, unknown> = { ...src.quoteSettings, ...quoteEventDefaults(target), eventId: ev };
    // 담당자는 행사(팀)마다 다름
    if (q.issuer && typeof q.issuer === "object") q.issuer = { ...(q.issuer as object), contactName: "" };
    delete q.updatedAt;
    writes.push({ col: "quoteSettings", id: ev, data: q });
    checklist.push("견적서 설정: 행사 일정·장소 문구와 담당자 입력");
  }

  if (include.catalog) {
    checklist.push("스폰서십 매체: 가격·마감일·작년 실적 문구를 새 행사 기준으로 확인");
  }
  checklist.push("멤버 관리: 담당자에게 새 행사 배정");

  return { writes, counts, checklist };
}
