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
import type { ImageSlot as ImageSlotType, Package, Slot } from "@/lib/types";
import { ImageSlot } from "@/components/admin/CategoryEditor/ImageSlot";

type FormValues = {
  nameKo: string;
  nameEn: string;
  code: string;
  tier: Package["tier"];
  tagline: string;
  originalPrice: number;
  discountPrice: number;
  unit: string;
  priceNote: string;
  isPublished: boolean;
  order: number;
  includedItems: Array<{ label: string; slotCodes: string }>;
};

export default function PackageEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
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
      originalPrice: 0,
      discountPrice: 0,
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
        // slot ID → code 매핑은 allSlots 로딩 후
        form.reset({
          nameKo: data.name.ko ?? "",
          nameEn: data.name.en ?? "",
          code: data.code ?? "",
          tier: data.tier,
          tagline: data.tagline ?? "",
          originalPrice: data.originalPrice ?? 0,
          discountPrice: data.discountPrice ?? 0,
          unit: data.unit ?? "패키지",
          priceNote: data.priceNote ?? "",
          isPublished: data.isPublished,
          order: data.order ?? 0,
          includedItems: (data.includedItems ?? []).map((it) => ({
            label: it.label,
            slotCodes: "", // resolve later
          })),
        });
        initRef.current = true;
      }
    });
    return () => u();
  }, [id, form]);

  // load all slots once for code <-> id resolution
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(getDb(), "slots"));
        setAllSlots(snap.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })));
      } catch {
        // ignore
      }
    })();
  }, []);

  // After slots loaded, fill in slotCodes for includedItems
  useEffect(() => {
    if (!pkg || allSlots.length === 0) return;
    const codeById = new Map(allSlots.map((s) => [s.id, s.code]));
    const current = form.getValues("includedItems");
    const next = (pkg.includedItems ?? []).map((it) => ({
      label: it.label,
      slotCodes: (it.referencedSlotIds ?? [])
        .map((rid) => codeById.get(rid) ?? "")
        .filter(Boolean)
        .join(", "),
    }));
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      form.setValue("includedItems", next, { shouldDirty: false });
    }
  }, [pkg, allSlots, form]);

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
          const codeBySlotCode = new Map(allSlots.map((s) => [s.code, s.id]));
          const includedItems = v.includedItems.map((it) => ({
            label: it.label,
            referencedSlotIds: it.slotCodes
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
              .map((c) => codeBySlotCode.get(c))
              .filter((x): x is string => !!x),
          }));
          await updateDoc(doc(getDb(), "packages", id), {
            name: { ko: v.nameKo, en: v.nameEn },
            code: v.code,
            tier: v.tier,
            tagline: v.tagline || undefined,
            originalPrice: Number(v.originalPrice) || 0,
            discountPrice: Number(v.discountPrice) || 0,
            unit: v.unit || undefined,
            priceNote: v.priceNote || undefined,
            isPublished: !!v.isPublished,
            order: Number(v.order) || 0,
            includedItems,
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
  }, [form, id, allSlots]);

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

  const orig = form.watch("originalPrice");
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

        <Section title="가격">
          <div className="grid grid-cols-3 gap-3">
            <Field label="원가 (원)">
              <input
                type="number"
                {...form.register("originalPrice", { valueAsNumber: true })}
                className={inputCls() + " font-mono text-right"}
              />
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
            <Field label="단위">
              <input {...form.register("unit")} className={inputCls()} />
            </Field>
            <Field label="가격 메모" full>
              <input {...form.register("priceNote")} className={inputCls()} placeholder="예) 약 18% 할인. 부가세 별도." />
            </Field>
          </div>
        </Section>

        <Section title="포함 항목">
          <div className="space-y-2">
            {fields.fields.length === 0 && (
              <div className="text-sm text-ink-500 py-4 text-center bg-ink-50 rounded-btn">
                포함 항목이 없습니다. 추가하세요.
              </div>
            )}
            {fields.fields.map((f, i) => (
              <div
                key={f.id}
                className="flex items-start gap-2 p-3 rounded-btn bg-ink-50/60 border border-ink-100"
              >
                <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                  <input
                    {...form.register(`includedItems.${i}.label` as const)}
                    placeholder="포함 항목 이름 (예: 천장 배너 Hall A 5구좌)"
                    className={inputCls()}
                  />
                  <input
                    {...form.register(`includedItems.${i}.slotCodes` as const)}
                    placeholder="연결 슬롯 코드 (콤마 구분, 선택)"
                    className={inputCls() + " font-mono text-[12px]"}
                  />
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
            ))}
            <button
              type="button"
              onClick={() => fields.append({ label: "", slotCodes: "" })}
              className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[13px] text-ink-500 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              항목 추가
            </button>
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
