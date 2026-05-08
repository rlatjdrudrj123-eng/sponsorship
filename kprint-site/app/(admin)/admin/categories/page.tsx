"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Palette,
  Search,
  Upload,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { seedSampleImages, type SeedResult } from "@/lib/admin/seedSamples";
import type {
  Category,
  CategoryType,
  Channel,
  Slot,
  Subcategory,
} from "@/lib/types";

type EnrichedCategory = Category & {
  subcategoryCount: number;
  slotTotal: number;
  slotAvailable: number;
};

const CHANNEL_LABELS: Record<Channel, string> = {
  offline: "오프라인",
  online: "온라인",
  package: "패키지",
};

const TYPE_LABELS: Record<CategoryType, string> = {
  floor_plan: "도면형",
  quantity: "수량형",
  media: "미디어",
  digital_banner: "디지털 배너",
  mailing: "발송형",
  print_page: "지면",
  content: "콘텐츠",
  xpace: "XPACE",
  package: "패키지",
};

type SortKey = "order" | "code" | "name";

export default function CategoriesListPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterChannel, setFilterChannel] = useState<Channel | "all">("all");
  const [filterType, setFilterType] = useState<CategoryType | "all">("all");
  const [filterPublished, setFilterPublished] = useState<"all" | "published" | "draft">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    const u1 = onSnapshot(collection(db, "categories"), (s) => {
      setCategories(s.docs.map((d) => ({ ...(d.data() as Category), id: d.id })));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db, "subcategories"), (s) =>
      setSubcategories(s.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id })))
    );
    const u3 = onSnapshot(collection(db, "slots"), (s) =>
      setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })))
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const enriched: EnrichedCategory[] = useMemo(() => {
    return categories.map((c) => {
      const subs = subcategories.filter((s) => s.categoryId === c.id);
      const cs = slots.filter((s) => s.categoryId === c.id);
      return {
        ...c,
        subcategoryCount: subs.length,
        slotTotal: cs.length,
        slotAvailable: cs.filter((s) => s.status === "available").length,
      };
    });
  }, [categories, subcategories, slots]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterChannel !== "all") rows = rows.filter((r) => r.channel === filterChannel);
    if (filterType !== "all") rows = rows.filter((r) => r.type === filterType);
    if (filterPublished === "published") rows = rows.filter((r) => r.isPublished);
    if (filterPublished === "draft") rows = rows.filter((r) => !r.isPublished);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.name.ko.toLowerCase().includes(q) ||
          r.name.en.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.ko.localeCompare(b.name.ko) * dir;
      if (sortKey === "code") return a.code.localeCompare(b.code) * dir;
      return (a.order - b.order) * dir;
    });
  }, [enriched, filterChannel, filterType, filterPublished, search, sortKey, sortDir]);

  const handleSeed = async () => {
    if (
      !confirm(
        "모든 카테고리에 샘플 이미지·텍스트를 주입합니다. 기존 이미지가 있으면 덮어씁니다. 계속?"
      )
    )
      return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const r = await seedSampleImages();
      setSeedResult(r);
    } catch (e) {
      alert(`시드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(false);
    }
  };

  /** 드래그앤드롭으로 source 카테고리를 target 위치에 끼워넣고 모든 order 0..N 재할당. */
  const reorderTo = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sorted = [...enriched].sort((a, b) => a.order - b.order);
    const fromIdx = sorted.findIndex((c) => c.id === sourceId);
    const toIdx = sorted.findIndex((c) => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);

    try {
      // 변경된 카테고리만 batch update (500개 한계 안전 — 카테고리는 보통 < 100)
      const now = Timestamp.fromDate(new Date());
      const batch = writeBatch(getDb());
      let changes = 0;
      sorted.forEach((c, i) => {
        if (c.order !== i) {
          batch.update(doc(getDb(), "categories", c.id), {
            order: i,
            updatedAt: now,
          });
          changes++;
        }
      });
      if (changes > 0) await batch.commit();
    } catch (e) {
      alert(`순서 일괄 갱신 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, catId: string) => {
    setDraggingId(catId);
    e.dataTransfer.effectAllowed = "move";
    // Firefox 호환: 데이터 설정 필수
    try {
      e.dataTransfer.setData("text/plain", catId);
    } catch {
      /* ignore */
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, catId: string) => {
    if (!draggingId || draggingId === catId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== catId) setDragOverId(catId);
  };

  const handleDragLeave = (catId: string) => {
    if (dragOverId === catId) setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId) return;
    await reorderTo(sourceId, targetId);
  };

  const moveOrder = async (cat: EnrichedCategory, dir: -1 | 1) => {
    // order 오름차순으로 sorting된 list에서 인접 카테고리와 swap
    const sortedByOrder = [...enriched].sort((a, b) => a.order - b.order);
    const idx = sortedByOrder.findIndex((c) => c.id === cat.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sortedByOrder.length) return;
    const target = sortedByOrder[targetIdx];
    try {
      const batch = writeBatch(getDb());
      batch.update(doc(getDb(), "categories", cat.id), {
        order: target.order,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      batch.update(doc(getDb(), "categories", target.id), {
        order: cat.order,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      await batch.commit();
    } catch (e) {
      alert(`순서 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const togglePublish = async (cat: EnrichedCategory) => {
    try {
      await updateDoc(doc(getDb(), "categories", cat.id), {
        isPublished: !cat.isPublished,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`게시 상태 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const sortHeader = (key: SortKey, label: string) => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => {
          if (active) setSortDir(sortDir === "asc" ? "desc" : "asc");
          else {
            setSortKey(key);
            setSortDir("asc");
          }
        }}
        className={
          "inline-flex items-center gap-1 hover:text-ink-900 " +
          (active ? "text-ink-900 font-bold" : "text-ink-700")
        }
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">카테고리</h1>
          <p className="text-[13px] text-ink-700 mt-1">
            대분류를 편집하거나 게시 여부를 토글합니다.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="px-3.5 py-2 rounded-btn border-2 border-red-300 bg-red-50 text-red-700 text-[13px] font-semibold hover:bg-red-100 disabled:opacity-50 flex items-center gap-1.5"
              title="11개 카테고리에 Unsplash 샘플 이미지를 일괄 주입"
            >
              <Palette className="w-4 h-4" />
              {seeding ? "주입 중…" : "🎨 샘플 이미지 시드"}
            </button>
            <span className="text-[9px] uppercase tracking-[0.15em] text-red-700 font-bold">
              테스트용 — 운영 전 제거
            </span>
          </div>
          <Link
            href="/admin/import"
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            엑셀 업로드
          </Link>
        </div>
      </header>

      {seedResult && (
        <div className="bg-mint-50 border border-mint-100 rounded-card p-4 flex items-start gap-3">
          <div className="flex-1 text-[13px]">
            <div className="font-bold text-mint-700 mb-1">
              샘플 이미지 시드 완료 — 처리 {seedResult.processed.length}개
              {seedResult.skipped.length > 0 &&
                ` · 스킵 ${seedResult.skipped.length}개`}
              {seedResult.errors.length > 0 &&
                ` · 오류 ${seedResult.errors.length}개`}
            </div>
            {seedResult.processed.length > 0 && (
              <div className="text-ink-700 font-mono text-[11px]">
                ✓ {seedResult.processed.join(", ")}
              </div>
            )}
            {seedResult.skipped.length > 0 && (
              <div className="text-ink-500 font-mono text-[11px] mt-1">
                ⤳ 스킵 (카테고리 없음): {seedResult.skipped.join(", ")}
              </div>
            )}
            {seedResult.errors.length > 0 && (
              <div className="text-red-700 font-mono text-[11px] mt-1">
                {seedResult.errors
                  .map((e) => `✗ ${e.code}: ${e.reason}`)
                  .join(" / ")}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSeedResult(null)}
            className="w-7 h-7 grid place-items-center text-ink-500 hover:text-ink-900"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-white border border-ink-100 rounded-card p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·코드 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
          />
        </div>
        <Select<Channel | "all">
          value={filterChannel}
          onChange={setFilterChannel}
          options={[
            { value: "all", label: "전체 채널" },
            { value: "offline", label: "오프라인" },
            { value: "online", label: "온라인" },
            { value: "package", label: "패키지" },
          ]}
        />
        <Select<CategoryType | "all">
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: "all", label: "전체 유형" },
            { value: "floor_plan", label: "도면형" },
            { value: "quantity", label: "수량형" },
            { value: "media", label: "미디어" },
            { value: "digital_banner", label: "디지털 배너" },
            { value: "mailing", label: "발송형" },
            { value: "print_page", label: "지면" },
            { value: "content", label: "콘텐츠" },
            { value: "xpace", label: "XPACE" },
            { value: "package", label: "패키지" },
          ]}
        />
        <Select<"all" | "published" | "draft">
          value={filterPublished}
          onChange={setFilterPublished}
          options={[
            { value: "all", label: "전체 상태" },
            { value: "published", label: "게시" },
            { value: "draft", label: "비공개" },
          ]}
        />
      </div>

      <div className="text-[11px] text-ink-500 -mb-2 px-1 flex items-center gap-1.5">
        <GripVertical className="w-3 h-3" />
        행을 잡고 드래그해서 순서 변경 — 또는 ▲▼ 버튼으로 한 칸씩
      </div>

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
              <th className="w-7"></th>
              <th className="text-left px-3 py-2.5 font-semibold">{sortHeader("code", "코드")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">{sortHeader("name", "이름")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">채널</th>
              <th className="text-left px-4 py-2.5 font-semibold">유형</th>
              <th className="text-right px-4 py-2.5 font-semibold">소분류</th>
              <th className="text-right px-4 py-2.5 font-semibold">슬롯</th>
              <th className="text-center px-4 py-2.5 font-semibold">게시</th>
              <th className="text-right px-4 py-2.5 font-semibold">{sortHeader("order", "순서")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-ink-500">
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && categories.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-ink-500">
                  아직 카테고리가 없습니다.{" "}
                  <Link href="/admin/import" className="text-mint-700 font-semibold hover:underline">
                    엑셀 업로드부터 시작하세요 →
                  </Link>
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && categories.length > 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-ink-500">
                  필터 조건에 맞는 카테고리가 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr
                key={c.id}
                draggable
                onDragStart={(e) => handleDragStart(e, c.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, c.id)}
                onDragLeave={() => handleDragLeave(c.id)}
                onDrop={(e) => handleDrop(e, c.id)}
                className={
                  "border-t border-ink-100 cursor-pointer transition-colors " +
                  (draggingId === c.id
                    ? "opacity-40 "
                    : dragOverId === c.id
                      ? "bg-mint-50 outline outline-2 outline-mint-500 "
                      : "hover:bg-ink-50 ")
                }
                onClick={(e) => {
                  if (draggingId) return;
                  if ((e.target as HTMLElement).closest("button,a,input")) return;
                  window.location.href = `/admin/categories/${c.id}`;
                }}
              >
                <td className="w-7 text-ink-300 hover:text-ink-500 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-3.5 h-3.5 mx-auto" />
                </td>
                <td className="px-4 py-2.5 font-mono text-ink-900 text-[12px]">{c.code}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/categories/${c.id}`} className="text-ink-900 font-semibold hover:text-mint-700">
                    {c.name.ko}
                  </Link>
                  <div className="text-[11px] text-ink-500 mt-0.5">{c.name.en}</div>
                </td>
                <td className="px-4 py-2.5 text-ink-700 text-[12px]">{CHANNEL_LABELS[c.channel]}</td>
                <td className="px-4 py-2.5 text-ink-700 text-[12px]">{TYPE_LABELS[c.type]}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-700">{c.subcategoryCount}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px]">
                  <span className="text-mint-700 font-semibold">{c.slotAvailable}</span>
                  <span className="text-ink-500"> / {c.slotTotal}</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Switch checked={c.isPublished} onChange={() => togglePublish(c)} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveOrder(c, -1);
                      }}
                      className="w-6 h-6 grid place-items-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded"
                      title="위로"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px] text-ink-500 w-7 text-center">
                      {c.order}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveOrder(c, 1);
                      }}
                      className="w-6 h-6 grid place-items-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded"
                      title="아래로"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 bg-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
        (checked ? "bg-mint-500" : "bg-ink-100")
      }
    >
      <span
        className={
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow " +
          (checked ? "translate-x-5" : "translate-x-1")
        }
      />
    </button>
  );
}
