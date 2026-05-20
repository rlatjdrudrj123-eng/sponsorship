"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useForm, useFieldArray } from "react-hook-form";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type {
  Category,
  ImageSlot as ImageSlotType,
  Package,
  Slot,
  Subcategory,
} from "@/lib/types";
import { ImageSlot } from "@/components/admin/CategoryEditor/ImageSlot";

type FormValues = {
  nameKo: string;
  nameEn: string;
  code: string;
  tier: Package["tier"];
  tagline: string;
  /** 할인가 수기 입력. 원가는 includedItems 합산으로 자동. */
  discountPrice: number;
  /** 해외 가격(USD). 비워두면 KRW 에서 자동 변환. */
  originalPriceUSD?: number;
  discountPriceUSD?: number;
  unit: string;
  priceNote: string;
  isPublished: boolean;
  order: number;
  /** 자동 구성: 카테고리/소분류/수량 선택 → label·가격·composition 자동 */
  includedItems: Array<{
    categoryId: string;
    subcategoryId: string; // 'all' = 카테고리 최저가 소분류 자동
    count: number;
  }>;
};

export default function PackageEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [notFound, setNotFound] = useState(false);
  const initRef = useRef(false);

  const form = useForm<FormValues>({
    defaultValues: {
      nameKo: "",
      nameEn: "",
      code: "",
      tier: "standard",
      tagline: "",
      discountPrice: 0,
      originalPriceUSD: undefined,
      discountPriceUSD: undefined,
      unit: "패키지",
      priceNote: "",
      isPublished: false,
      order: 0,
      includedItems: [],
    },
  });

  const fields = useFieldArray({ control: form.control, name: "includedItems" });

  // subscribe
  useEffect(() => {
    const u = onSnapshot(doc(getDb(), "packages", id), (s) => {
      if (!s.exists()) {
        setNotFound(true);
        return;
      }
      const data = { ...(s.data() as Package), id: s.id };
      setPkg(data);
      if (!initRef.current) {
        form.reset({
          nameKo: data.name.ko ?? "",
          nameEn: data.name.en ?? "",
          code: data.code ?? "",
          tier: data.tier,
          tagline: data.tagline ?? "",
          discountPrice: data.discountPrice ?? 0,
          originalPriceUSD: data.originalPriceUSD,
          discountPriceUSD: data.discountPriceUSD,
          unit: data.unit ?? "패키지",
          priceNote: data.priceNote ?? "",
          isPublished: data.isPublished,
          order: data.order ?? 0,
          // categoryId 가 있는 신규 형태만 가져옴. 옛 데이터(label only)는 비어있게 두고
          // 어드민이 다시 카테고리 골라서 채움.
          includedItems: (data.includedItems ?? [])
            .filter((it) => it.categoryId)
            .map((it) => ({
              categoryId: it.categoryId!,
              subcategoryId: it.subcategoryId ?? "all",
              count: it.count ?? 1,
            })),
        });
        initRef.current = true;
      }
    });
    return () => u();
  }, [id, form]);

  // load categories / subcategories / slots once
  useEffect(() => {
    (async () => {
      try {
        const [c, s, sl] = await Promise.all([
          getDocs(collection(getDb(), "categories")),
          getDocs(collection(getDb(), "subcategories")),
          getDocs(collection(getDb(), "slots")),
        ]);
        setAllCategories(
          c.docs.map((d) => ({ ...(d.data() as Category), id: d.id }))
        );
        setAllSubcategories(
          s.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id }))
        );
        setAllSlots(sl.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
      } catch {
        // ignore
      }
    })();
  }, []);

  // 카테고리/소분류별 최저가 정리 (자동 가격 계산용)
  const subsByCategory = new Map<string, Subcategory[]>();
  allSubcategories.forEach((sub) => {
    const arr = subsByCategory.get(sub.categoryId) ?? [];
    arr.push(sub);
    subsByCategory.set(sub.categoryId, arr);
  });

  // includedItems → 합산 원가 + label / referencedSlotIds / composition 자동 생성
  function resolveItems(items: FormValues["includedItems"]) {
    let originalPrice = 0;
    const resolved: Package["includedItems"] = [];
    const composition: string[] = [];
    for (const it of items) {
      if (!it.categoryId) continue;
      const cat = allCategories.find((c) => c.id === it.categoryId);
      if (!cat) continue;
      const subs = subsByCategory.get(it.categoryId) ?? [];
      const sub =
        it.subcategoryId && it.subcategoryId !== "all"
          ? subs.find((s) => s.id === it.subcategoryId)
          : [...subs].sort((a, b) => a.priceKRW - b.priceKRW)[0];
      const count = Math.max(1, Number(it.count) || 1);
      const unitPrice = sub?.priceKRW ?? 0;
      originalPrice += unitPrice * count;

      const unitLabel = sub?.unit?.ko ?? "구좌";
      const subLabel = sub && sub.id !== subs[0]?.id ? ` (${sub.name?.ko})` : "";
      const label = `${cat.name.ko}${subLabel} ${count}${unitLabel}`;

      // referencedSlotIds — 같은 소분류의 가용 슬롯 앞 N 개
      const matchedSlots = allSlots
        .filter((sl) => sl.categoryId === cat.id)
        .filter((sl) => !sub || sl.subcategoryId === sub.id)
        .slice(0, count)
        .map((sl) => sl.id);

      resolved.push({
        label,
        referencedSlotIds: matchedSlots,
        categoryId: it.categoryId,
        ...(it.subcategoryId && it.subcategoryId !== "all"
          ? { subcategoryId: it.subcategoryId }
          : {}),
        count,
      });
      if (cat.selectorId) composition.push(cat.selectorId);
    }
    return { originalPrice, resolved, composition };
  }

  // auto-save
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const sub = form.watch((_v, info) => {
      if (info.type !== "change") return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const v = form.getValues();
        setSaveStatus("saving");
        try {
          const { originalPrice, resolved, composition } = resolveItems(
            v.includedItems
          );
          await updateDoc(doc(getDb(), "packages", id), {
            name: { ko: v.nameKo, en: v.nameEn },
            code: v.code,
            tier: v.tier,
            tagline: v.tagline || undefined,
            originalPrice,
            discountPrice: Number(v.discountPrice) || 0,
            originalPriceUSD:
              typeof v.originalPriceUSD === "number" && v.originalPriceUSD > 0
                ? v.originalPriceUSD
                : null,
            discountPriceUSD:
              typeof v.discountPriceUSD === "number" && v.discountPriceUSD > 0
                ? v.discountPriceUSD
                : null,
            unit: v.unit || undefined,
            priceNote: v.priceNote || undefined,
            isPublished: !!v.isPublished,
            order: Number(v.order) || 0,
            includedItems: resolved,
            composition,
          });
          setSaveStatus("saved");
          setLastSaved(new Date());
          setSaveError(null);
        } catch (e) {
          setSaveStatus("error");
          setSaveError(e instanceof Error ? e.message : String(e));
        }
      }, 1500);
    });
    return () => {
      sub.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, id, allSlots, allCategories, allSubcategories]);

  const handleDelete = async () => {
    if (!confirm("이 패키지를 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      await deleteDoc(doc(getDb(), "packages", id));
      router.replace("/admin/packages");
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (notFound) {
    return (
      <div className="bg-white border border-ink-100 rounded-card p-12 text-center">
        <p className="text-sm text-ink-500">패키지를 찾을 수 없습니다.</p>
        <Link href="/admin/packages" className="text-brand-700 font-semibold mt-4 inline-block hover:underline">
          목록으로
        </Link>
      </div>
    );
  }

  if (!pkg) {
    return <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>;
  }

  const watchedItems = form.watch("includedItems");
  const { originalPrice: orig } = resolveItems(watchedItems ?? []);
  const disc = form.watch("discountPrice");
  const discountPct = orig > 0 ? Math.round((1 - disc / orig) * 100) : 0;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/packages"
            className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
            aria-label="목록으로"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
              {pkg.name.ko}
            </h1>
            <div className="text-[12px] text-ink-500 mt-0.5 font-mono">{pkg.code}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusBadge status={saveStatus} lastSaved={lastSaved} error={saveError} />
          <button
            type="button"
            onClick={handleDelete}
            className="text-[12px] text-red-700 hover:text-red-800 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            삭제
          </button>
        </div>
      </header>

      <div className="space-y-4">
        <Section title="기본 정보">
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름 (한글)">
              <input {...form.register("nameKo")} className={inputCls()} />
            </Field>
            <Field label="이름 (영문)">
              <input {...form.register("nameEn")} className={inputCls()} />
            </Field>
            <Field label="코드">
              <input {...form.register("code")} className={inputCls() + " font-mono"} />
            </Field>
            <Field label="티어">
              <select {...form.register("tier")} className={inputCls()}>
                <option value="signature">시그니처</option>
                <option value="standard">스탠다드</option>
              </select>
            </Field>
            <Field label="태그라인 (선택)" full>
              <input {...form.register("tagline")} className={inputCls()} />
            </Field>
          </div>
        </Section>

        <Section title="포함 항목 (단품 선택 → 자동 구성)">
          <p className="text-[12px] text-ink-500 mb-3 leading-relaxed">
            카테고리·수량을 고르면 원가·라벨·연결 슬롯·매트릭스 composition 이 자동 계산됩니다.
          </p>
          <div className="space-y-2">
            {fields.fields.length === 0 && (
              <div className="text-sm text-ink-500 py-4 text-center bg-ink-50 rounded-btn">
                포함 항목이 없습니다. 추가하세요.
              </div>
            )}
            {fields.fields.map((f, i) => {
              const watchedItem = watchedItems?.[i];
              const cat = allCategories.find(
                (c) => c.id === watchedItem?.categoryId
              );
              const subs = cat ? subsByCategory.get(cat.id) ?? [] : [];
              const sub =
                watchedItem?.subcategoryId && watchedItem.subcategoryId !== "all"
                  ? subs.find((s) => s.id === watchedItem.subcategoryId)
                  : [...subs].sort((a, b) => a.priceKRW - b.priceKRW)[0];
              const unitPrice = sub?.priceKRW ?? 0;
              const lineTotal = unitPrice * (Number(watchedItem?.count) || 1);
              return (
                <div
                  key={f.id}
                  className="grid grid-cols-[1.4fr_1fr_80px_120px_36px] gap-2 items-center p-3 rounded-btn bg-ink-50/60 border border-ink-100"
                >
                  <select
                    {...form.register(`includedItems.${i}.categoryId` as const)}
                    className={inputCls()}
                  >
                    <option value="">카테고리 선택…</option>
                    {allCategories
                      .filter((c) => c.type !== "package")
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name.ko}
                        </option>
                      ))}
                  </select>
                  <select
                    {...form.register(`includedItems.${i}.subcategoryId` as const)}
                    className={inputCls()}
                    disabled={!cat || subs.length <= 1}
                  >
                    <option value="all">
                      {subs.length <= 1
                        ? "—"
                        : `최저가 (${[...subs].sort((a, b) => a.priceKRW - b.priceKRW)[0]?.priceKRW.toLocaleString()}원)`}
                    </option>
                    {subs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name?.ko} · {s.priceKRW.toLocaleString()}원
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    {...form.register(`includedItems.${i}.count` as const, {
                      valueAsNumber: true,
                    })}
                    className={inputCls() + " font-mono text-right"}
                  />
                  <div className="px-3 py-2 text-[12.5px] bg-white rounded-btn border border-ink-100 text-ink-700 font-mono text-right">
                    {lineTotal > 0 ? `${lineTotal.toLocaleString()}원` : "—"}
                  </div>
                  <button
                    type="button"
                    onClick={() => fields.remove(i)}
                    className="w-9 h-9 grid place-items-center text-ink-500 hover:text-red-700 shrink-0"
                    title="제거"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                fields.append({ categoryId: "", subcategoryId: "all", count: 1 })
              }
              className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[13px] text-ink-500 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              단품 추가
            </button>
          </div>
        </Section>

        <Section title="가격">
          <div className="grid grid-cols-3 gap-3">
            <Field label="원가 (자동 계산)">
              <div className="px-3 py-2 text-sm bg-ink-50 rounded-btn border border-ink-100 text-ink-900 font-mono font-bold text-right">
                {orig > 0 ? `${orig.toLocaleString()}원` : "—"}
              </div>
            </Field>
            <Field label="할인가 (원)">
              <input
                type="number"
                {...form.register("discountPrice", { valueAsNumber: true })}
                className={inputCls() + " font-mono text-right"}
              />
            </Field>
            <Field label="할인율 (자동 계산)">
              <div className="px-3 py-2 text-sm bg-ink-50 rounded-btn border border-ink-100 text-ink-700 font-mono">
                {discountPct > 0 ? `${discountPct}%` : "—"}
              </div>
            </Field>
            <Field label="해외 원가 ($) — 비워두면 자동 (1USD≈1,000KRW)">
              <input
                type="number"
                {...form.register("originalPriceUSD", { valueAsNumber: true })}
                className={inputCls() + " font-mono text-right"}
                placeholder="auto"
              />
            </Field>
            <Field label="해외 할인가 ($) — 비워두면 자동">
              <input
                type="number"
                {...form.register("discountPriceUSD", { valueAsNumber: true })}
                className={inputCls() + " font-mono text-right"}
                placeholder="auto"
              />
            </Field>
            <Field label="단위">
              <input {...form.register("unit")} className={inputCls()} />
            </Field>
            <Field label="가격 메모" full>
              <input
                {...form.register("priceNote")}
                className={inputCls()}
                placeholder="예) 약 18% 할인. 부가세 별도."
              />
            </Field>
          </div>
        </Section>

        <Section title="히어로 이미지">
          <ImageSlot
            label="패키지 대표 이미지"
            storagePathPrefix={`packages/${id}/hero`}
            value={pkg.heroImages}
            onChange={async (next: ImageSlotType) => {
              await updateDoc(doc(getDb(), "packages", id), { heroImages: next });
            }}
          />
        </Section>

        <Section title="게시 / 순서">
          <div className="grid grid-cols-2 gap-3 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...form.register("isPublished")}
                className="accent-brand-500 w-4 h-4"
              />
              공개 사이트에 게시
            </label>
            <Field label="순서">
              <input
                type="number"
                {...form.register("order", { valueAsNumber: true })}
                className={inputCls() + " font-mono"}
              />
            </Field>
          </div>
        </Section>
      </div>
    </div>
  );
}

function inputCls(): string {
  return "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-ink-100 rounded-card p-5">
      <h2 className="text-[15px] font-bold text-ink-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-[12px] font-semibold text-ink-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SaveStatusBadge({
  status,
  lastSaved,
  error,
}: {
  status: "idle" | "saving" | "saved" | "error";
  lastSaved: Date | null;
  error: string | null;
}) {
  if (status === "idle") return <span className="text-[11px] text-ink-300">자동 저장 대기</span>;
  if (status === "saving") {
    return (
      <span className="text-[11px] text-ink-500 flex items-center gap-1.5">
        <svg className="animate-spin w-3 h-3 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        저장 중…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-[11px] text-red-700 flex items-center gap-1.5" title={error ?? ""}>
        <AlertCircle className="w-3 h-3" /> 저장 실패
      </span>
    );
  }
  return (
    <span className="text-[11px] text-brand-700 flex items-center gap-1.5">
      <Check className="w-3 h-3" /> 자동 저장 ·{" "}
      {lastSaved ? lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—"}
    </span>
  );
}
