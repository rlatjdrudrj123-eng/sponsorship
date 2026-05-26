"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Check, ChevronRight, Loader2, Plus } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Slot, Subcategory } from "@/lib/types";

type Props = {
  categoryId: string;
  eventId: string;
  subcategories: Subcategory[];
  slots: Slot[];
};

export function SubcategoryTable({
  categoryId,
  eventId,
  subcategories,
  slots,
}: Props) {
  return (
    <div className="space-y-3">
      {subcategories.length === 0 ? (
        <div className="text-sm text-ink-500 py-6 text-center bg-ink-50 rounded-btn">
          소분류가 없습니다. 아래 [+ 소분류 추가] 로 직접 만들거나 엑셀 업로드.
        </div>
      ) : (
        <div className="overflow-hidden border border-ink-100 rounded-btn">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-700">
                <th className="text-left px-3 py-2 font-semibold">소분류</th>
                <th className="text-left px-3 py-2 font-semibold">단위</th>
                <th className="text-right px-3 py-2 font-semibold">구좌</th>
                <th className="text-right px-3 py-2 font-semibold">가능</th>
                <th className="text-right px-3 py-2 font-semibold">마감</th>
                <th className="text-right px-3 py-2 font-semibold">가격 KRW</th>
                <th className="text-right px-3 py-2 font-semibold">가격 USD</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...subcategories]
                .sort((a, b) => a.order - b.order)
                .map((sub) => {
                  const subSlots = slots.filter(
                    (s) => s.subcategoryId === sub.id
                  );
                  const available = subSlots.filter(
                    (s) => s.status === "available"
                  ).length;
                  const sold = subSlots.filter(
                    (s) => s.status === "sold"
                  ).length;
                  return (
                    <SubcategoryRow
                      key={sub.id}
                      categoryId={categoryId}
                      sub={sub}
                      total={subSlots.length}
                      available={available}
                      sold={sold}
                    />
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      <AddSubcategoryForm
        categoryId={categoryId}
        eventId={eventId}
        nextOrder={subcategories.length}
        disabled={!eventId}
      />
    </div>
  );
}

// 소분류 추가 폼 — 인라인. 이름·단위·가격·기본 구좌 수 입력 후 [추가].
// subcategory doc + 지정한 수의 빈 slot doc 을 한 batch 로 생성.
function AddSubcategoryForm({
  categoryId,
  eventId,
  nextOrder,
  disabled,
}: {
  categoryId: string;
  eventId: string;
  nextOrder: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [nameKo, setNameKo] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [unitKo, setUnitKo] = useState("구좌");
  const [priceKRW, setPriceKRW] = useState("");
  const [slotCount, setSlotCount] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setNameKo("");
    setNameEn("");
    setUnitKo("구좌");
    setPriceKRW("");
    setSlotCount("1");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!eventId) {
      setError("이 카테고리에 eventId 가 없어요 — 페이지 새로고침 후 다시 시도.");
      return;
    }
    const ko = nameKo.trim();
    if (!ko) {
      setError("소분류 이름(한글) 은 필수입니다.");
      return;
    }
    const price = Number(priceKRW.replace(/[,\s]/g, ""));
    if (!Number.isFinite(price) || price < 0) {
      setError("가격은 0 이상 숫자.");
      return;
    }
    const count = parseInt(slotCount, 10);
    if (!Number.isFinite(count) || count < 0 || count > 100) {
      setError("구좌 수는 0–100.");
      return;
    }
    setSaving(true);
    try {
      const db = getDb();
      const subRef = doc(collection(db, "subcategories"));
      const sub: Subcategory = {
        id: subRef.id,
        eventId,
        categoryId,
        name: { ko, en: nameEn.trim() || ko },
        priceKRW: price,
        unit: { ko: unitKo.trim() || "구좌", en: unitKo.trim() || "slot" },
        order: nextOrder,
        size: "",
      };
      // subcategory + slots 를 한 batch 로
      const batch = writeBatch(db);
      batch.set(subRef, sub);
      for (let i = 0; i < count; i++) {
        const slotRef = doc(collection(db, "slots"));
        const slot: Slot = {
          id: slotRef.id,
          eventId,
          categoryId,
          subcategoryId: subRef.id,
          code: `${subRef.id.slice(0, 6)}-${String(i + 1).padStart(2, "0")}`,
          status: "available",
          order: i,
        };
        batch.set(slotRef, slot);
      }
      await batch.commit();
      reset();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="px-3.5 py-2 rounded-btn border border-dashed border-ink-300 text-[13px] text-ink-700 font-semibold hover:border-brand-500 hover:text-brand-700 flex items-center gap-1.5 disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" />
        소분류 추가
      </button>
    );
  }

  return (
    <div className="rounded-btn border border-brand-500 bg-brand-50/30 p-3 space-y-2">
      <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_0.6fr_auto] gap-2 items-center">
        <input
          type="text"
          placeholder="소분류 이름 (한글) *"
          value={nameKo}
          onChange={(e) => setNameKo(e.target.value)}
          className="px-2.5 py-1.5 text-[13px] border border-ink-200 rounded-btn focus:outline-none focus:border-brand-500"
          autoFocus
        />
        <input
          type="text"
          placeholder="이름 (영문)"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className="px-2.5 py-1.5 text-[13px] border border-ink-200 rounded-btn focus:outline-none focus:border-brand-500"
        />
        <input
          type="text"
          placeholder="단위"
          value={unitKo}
          onChange={(e) => setUnitKo(e.target.value)}
          className="px-2.5 py-1.5 text-[13px] border border-ink-200 rounded-btn focus:outline-none focus:border-brand-500"
        />
        <input
          type="text"
          placeholder="가격 KRW *"
          value={priceKRW}
          onChange={(e) => setPriceKRW(e.target.value)}
          className="px-2.5 py-1.5 text-[13px] border border-ink-200 rounded-btn focus:outline-none focus:border-brand-500 text-right font-mono"
        />
        <input
          type="number"
          placeholder="구좌 #"
          value={slotCount}
          onChange={(e) => setSlotCount(e.target.value)}
          min={0}
          max={100}
          className="px-2.5 py-1.5 text-[13px] border border-ink-200 rounded-btn focus:outline-none focus:border-brand-500 text-right font-mono w-20"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-3 py-1.5 rounded-btn bg-brand-500 text-white text-[12.5px] font-bold hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "저장중…" : "추가"}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={saving}
            className="px-3 py-1.5 rounded-btn border border-ink-200 text-[12.5px] text-ink-700 hover:bg-white"
          >
            취소
          </button>
        </div>
      </div>
      {error && (
        <div className="text-[11.5px] text-red-600 px-1">{error}</div>
      )}
      <div className="text-[11px] text-ink-500 px-1">
        ⓘ 소분류 + 지정한 수의 빈 구좌(slot) 가 한 번에 생성됩니다. 추가 후 구좌
        코드/상태는 [관리] 에서 수정.
      </div>
    </div>
  );
}

// 행 1줄 — 단위·가격 KRW/USD 인라인 편집.
// 엑셀 임포트로만 가능하던 값을 이제 어드민 표에서 직접 수정 (디바운스 저장).
function SubcategoryRow({
  categoryId,
  sub,
  total,
  available,
  sold,
}: {
  categoryId: string;
  sub: Subcategory;
  total: number;
  available: number;
  sold: number;
}) {
  return (
    <tr className="border-t border-ink-100 hover:bg-ink-50/40">
      <td className="px-3 py-2.5">
        <InlineEdit
          subcategoryId={sub.id}
          field="name.ko"
          value={sub.name?.ko ?? ""}
          placeholder="(기본)"
          width="w-36"
        />
      </td>
      <td className="px-3 py-2.5">
        <InlineEdit
          subcategoryId={sub.id}
          field="unit.ko"
          value={sub.unit?.ko ?? ""}
          placeholder="구좌"
          width="w-20"
        />
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px]">{total}</td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-brand-700 font-semibold">
        {available}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink-500">
        {sold}
      </td>
      <td className="px-3 py-2.5 text-right">
        <InlineEdit
          subcategoryId={sub.id}
          field="priceKRW"
          value={sub.priceKRW ?? 0}
          numeric
          suffix="원"
          width="w-28"
          align="right"
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <InlineEdit
          subcategoryId={sub.id}
          field="priceUSD"
          value={sub.priceUSD ?? ""}
          numeric
          suffix="$"
          width="w-24"
          align="right"
          placeholder="—"
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link
          href={`/admin/categories/${categoryId}/slots`}
          className="text-[11px] text-brand-700 font-semibold hover:underline inline-flex items-center"
        >
          관리
          <ChevronRight className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

// 인라인 편집 셀 — focus 시 input 처럼 보이고 blur·1초 디바운스로 저장.
function InlineEdit({
  subcategoryId,
  field,
  value,
  numeric = false,
  placeholder,
  suffix,
  width = "w-24",
  align = "left",
}: {
  subcategoryId: string;
  field: "priceKRW" | "priceUSD" | "unit.ko" | "name.ko";
  value: number | string;
  numeric?: boolean;
  placeholder?: string;
  suffix?: string;
  width?: string;
  align?: "left" | "right";
}) {
  const [local, setLocal] = useState<string>(
    value === null || value === undefined ? "" : String(value)
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(true);

  // 외부에서 value 가 갱신되면 (예: 다른 곳에서 저장) local 도 동기화
  useEffect(() => {
    setLocal(value === null || value === undefined ? "" : String(value));
    initRef.current = true;
  }, [value]);

  const save = async (raw: string) => {
    setStatus("saving");
    try {
      let payload: Record<string, unknown>;
      if (numeric) {
        const num = raw === "" ? 0 : Number(raw);
        if (Number.isNaN(num)) {
          setStatus("error");
          return;
        }
        // priceUSD 는 빈 값일 때 필드 제거
        if (field === "priceUSD" && raw === "") {
          payload = { priceUSD: null };
        } else {
          payload = { [field]: num };
        }
      } else if (field === "unit.ko" || field === "name.ko") {
        // nested field — dot notation 으로 부분 업데이트
        payload = { [field]: raw };
      } else {
        payload = { [field]: raw };
      }
      payload.updatedAt = Timestamp.fromDate(new Date());
      await updateDoc(doc(getDb(), "subcategories", subcategoryId), payload);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      console.error("inline save failed", e);
      setStatus("error");
    }
  };

  const onChange = (v: string) => {
    setLocal(v);
    if (initRef.current) {
      initRef.current = false;
    }
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => save(v), 1000);
  };

  const onBlur = () => {
    // 디바운스 보류 중이면 즉시 저장
    if (tRef.current) {
      clearTimeout(tRef.current);
      tRef.current = null;
      save(local);
    }
  };

  return (
    <div
      className={
        "inline-flex items-center gap-1 " +
        (align === "right" ? "justify-end" : "justify-start")
      }
    >
      <input
        value={local}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode={numeric ? "numeric" : "text"}
        placeholder={placeholder}
        className={
          width +
          " px-1.5 py-1 text-[12px] font-mono bg-transparent border border-transparent hover:border-ink-100 focus:border-brand-500 focus:bg-white rounded outline-none " +
          (align === "right" ? "text-right" : "text-left")
        }
      />
      {suffix && (
        <span className="text-[11px] text-ink-500 shrink-0">{suffix}</span>
      )}
      <span className="w-3 h-3 shrink-0">
        {status === "saving" && (
          <Loader2 className="w-3 h-3 text-ink-400 animate-spin" />
        )}
        {status === "saved" && <Check className="w-3 h-3 text-emerald-600" />}
        {status === "error" && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        )}
      </span>
    </div>
  );
}
