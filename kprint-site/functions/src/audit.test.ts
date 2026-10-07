import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionOf,
  diffDocs,
  eventIdOf,
  labelOf,
  normalize,
  shouldLog,
  summarize,
} from "./audit";

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

test("시각 필드만 바뀐 저장은 기록하지 않음", () => {
  const before = { name: "A", updatedAt: ts("2026-10-01T00:00:00Z") };
  const after = { name: "A", updatedAt: ts("2026-10-02T00:00:00Z") };
  const changes = diffDocs(before, after);
  assert.equal(changes.length, 0);
  assert.equal(shouldLog("update", changes), false);
});

test("바뀐 필드만 before/after 로", () => {
  const changes = diffDocs(
    { status: "available", code: "X1", eventId: "e1" },
    { status: "sold", code: "X1", eventId: "e1" }
  );
  assert.deepEqual(changes, [{ field: "status", before: "available", after: "sold" }]);
});

test("객체 키 순서가 달라도 같은 값이면 변경 아님", () => {
  const changes = diffDocs({ name: { ko: "가", en: "A" } }, { name: { en: "A", ko: "가" } });
  assert.equal(changes.length, 0);
});

test("추가·삭제된 필드", () => {
  const changes = diffDocs({ a: 1 }, { b: 2 });
  assert.deepEqual(changes, [
    { field: "a", before: 1, after: null },
    { field: "b", before: null, after: 2 },
  ]);
});

test("큰 목록·긴 문자열은 요약", () => {
  const big = Array.from({ length: 100 }, (_, i) => ({ id: `slot-${i}`, label: "구좌" }));
  assert.deepEqual(summarize(big), { _summary: "목록 100개" });
  const long = "가".repeat(500);
  const s = summarize(long) as string;
  assert.equal(s.length, 201);
  assert.ok(s.endsWith("…"));
});

test("Timestamp 는 ISO 문자열", () => {
  assert.equal(normalize(ts("2026-10-07T01:02:03Z")), "2026-10-07T01:02:03.000Z");
});

test("생성·수정·삭제 판별", () => {
  assert.equal(actionOf(undefined, { a: 1 }), "create");
  assert.equal(actionOf({ a: 1 }, undefined), "delete");
  assert.equal(actionOf({ a: 1 }, { a: 2 }), "update");
  assert.equal(shouldLog("delete", []), true);
  assert.equal(shouldLog("create", []), true);
});

test("행사 ID — eventId 필드, 또는 문서 ID 가 행사 ID 인 컬렉션", () => {
  assert.equal(eventIdOf("sponsors", "s1", undefined, { eventId: "kimesbusan-2026" }), "kimesbusan-2026");
  assert.equal(eventIdOf("slots", "x", { eventId: "kprint-2026" }, undefined), "kprint-2026");
  assert.equal(eventIdOf("siteSettings", "kprint-2026", undefined, { a: 1 }), "kprint-2026");
  assert.equal(eventIdOf("quoteSettings", "main", undefined, { a: 1 }), null);
  assert.equal(eventIdOf("members", "u1", undefined, { role: "manager" }), null);
});

test("목록 표시 이름", () => {
  assert.equal(labelOf("categories", "c1", undefined, { code: "RGK", name: { ko: "등록 키오스크" } }), "RGK 등록 키오스크");
  assert.equal(labelOf("slots", "s1", { code: "RGK-01" }, undefined), "RGK-01");
  assert.equal(labelOf("sponsors", "s1", undefined, { companyName: "㈜가나" }), "㈜가나");
  assert.equal(labelOf("members", "u1", undefined, { name: "김담당", email: "kim@x.com" }), "김담당 (kim@x.com)");
  assert.equal(labelOf("siteSettings", "kprint-2026", undefined, {}), "사이트 설정");
});
