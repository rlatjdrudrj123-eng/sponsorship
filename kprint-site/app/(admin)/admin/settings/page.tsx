"use client";

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { useFieldArray, useForm } from "react-hook-form";
import {
  AlertCircle,
  Check,
  Plus,
  Save,
  Upload,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import {
  buildStoragePath,
  deleteFile,
  uploadFile,
} from "@/lib/firebase/storage";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { SiteSettings } from "@/lib/types";

type FormValues = {
  event: {
    nameKo: string;
    nameEn: string;
    dateRange: string;
    venue: string;
    applicationDeadline: string; // yyyy-mm-dd
  };
  kv: {
    desktopUrl: string;
    desktopPath?: string;
    mobileUrl: string;
    mobilePath?: string;
    overlayText: string;
  };
  why: {
    headline: string;
    stats: Array<{ label: string; value: string; suffix: string; desc: string }>;
    chartData: Array<{ year: number; visitors: number; exhibitors: number }>;
  };
  contact: {
    phone: string;
    email: string;
    address: string;
  };
  applicationSteps: Array<{ title: string; desc: string }>;
};

export default function SettingsPage() {
  const { eventId, ready } = useEventFilter();
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const initRef = useRef(false);

  const form = useForm<FormValues>({
    defaultValues: {
      event: {
        nameKo: "K-PRINT 2026",
        nameEn: "K-PRINT 2026",
        dateRange: "",
        venue: "",
        applicationDeadline: "",
      },
      kv: { desktopUrl: "", mobileUrl: "", overlayText: "" },
      why: { headline: "왜 K-PRINT인가?", stats: [], chartData: [] },
      contact: { phone: "", email: "", address: "" },
      applicationSteps: [],
    },
  });

  const stats = useFieldArray({ control: form.control, name: "why.stats" });
  const chartData = useFieldArray({ control: form.control, name: "why.chartData" });
  const steps = useFieldArray({ control: form.control, name: "applicationSteps" });

  useEffect(() => {
    if (!ready || !eventId) return;
    initRef.current = false;
    setLoaded(false);
    const u = onSnapshot(doc(getDb(), "siteSettings", eventId), (s) => {
      setLoaded(true);
      if (!s.exists() || initRef.current) return;
      const data = s.data() as SiteSettings;
      form.reset({
        event: {
          nameKo: data.event?.nameKo ?? "",
          nameEn: data.event?.nameEn ?? "",
          dateRange: data.event?.dateRange ?? "",
          venue: data.event?.venue ?? "",
          applicationDeadline: data.event?.applicationDeadline
            ? data.event.applicationDeadline.toDate().toISOString().slice(0, 10)
            : "",
        },
        kv: {
          desktopUrl: data.kv?.desktopUrl ?? "",
          mobileUrl: data.kv?.mobileUrl ?? "",
          overlayText: data.kv?.overlayText ?? "",
        },
        why: {
          headline: data.why?.headline ?? "왜 K-PRINT인가?",
          stats: (data.why?.stats ?? []).map((st) => ({
            label: st.label,
            value: st.value,
            suffix: st.suffix ?? "",
            desc: st.desc ?? "",
          })),
          chartData: (data.why?.chartData ?? []).map((c) => ({
            year: c.year,
            visitors: c.visitors,
            exhibitors: c.exhibitors,
          })),
        },
        contact: {
          phone: data.contact?.phone ?? "",
          email: data.contact?.email ?? "",
          address: data.contact?.address ?? "",
        },
        applicationSteps: (data.applicationSteps ?? []).map((s) => ({
          title: s.title,
          desc: s.desc ?? "",
        })),
      });
      initRef.current = true;
    });
    return () => u();
  }, [form, ready, eventId]);

  const handleSave = async () => {
    if (!eventId) {
      setSaveStatus("error");
      setSaveError("상단에서 행사를 먼저 선택하세요.");
      return;
    }
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const v = form.getValues();
      const data: Partial<SiteSettings> = {
        eventId,
        event: {
          nameKo: v.event.nameKo,
          nameEn: v.event.nameEn,
          dateRange: v.event.dateRange,
          venue: v.event.venue,
          applicationDeadline: v.event.applicationDeadline
            ? Timestamp.fromDate(new Date(v.event.applicationDeadline))
            : (Timestamp.fromDate(new Date()) as never),
        },
        kv: {
          desktopUrl: v.kv.desktopUrl,
          mobileUrl: v.kv.mobileUrl || undefined,
          overlayText: v.kv.overlayText || undefined,
        },
        why: {
          headline: v.why.headline,
          stats: v.why.stats.filter((s) => s.label || s.value),
          chartData: v.why.chartData.filter((c) => c.year),
        },
        contact: v.contact,
        applicationSteps: v.applicationSteps.filter((s) => s.title),
      };
      await setDoc(doc(getDb(), "siteSettings", eventId), data, { merge: true });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const uploadKV = async (kind: "desktop" | "mobile", file: File) => {
    if (!eventId) {
      alert("상단에서 행사를 먼저 선택하세요.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 가능합니다.");
      return;
    }
    try {
      const path = buildStoragePath(`settings/kv-${kind}`, file.name);
      const result = await uploadFile(file, path);
      const oldPath = form.getValues(kind === "desktop" ? "kv.desktopPath" : "kv.mobilePath");
      if (oldPath) await deleteFile(oldPath).catch(() => undefined);
      if (kind === "desktop") {
        form.setValue("kv.desktopUrl", result.url);
        form.setValue("kv.desktopPath", result.storagePath);
      } else {
        form.setValue("kv.mobileUrl", result.url);
        form.setValue("kv.mobilePath", result.storagePath);
      }
      // 업로드한 즉시 doc 갱신해주는게 안전 — 명시적 저장과 별개로
      await setDoc(
        doc(getDb(), "siteSettings", eventId),
        {
          eventId,
          kv:
            kind === "desktop"
              ? { desktopUrl: result.url }
              : { mobileUrl: result.url },
        },
        { merge: true }
      );
    } catch (e) {
      alert(`KV 업로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (!ready) {
    return <div className="text-sm text-ink-500 text-center py-16">행사 정보 불러오는 중…</div>;
  }
  if (!eventId) {
    return (
      <div className="text-sm text-ink-500 text-center py-16">
        상단 셀렉터에서 행사를 먼저 선택하세요.
      </div>
    );
  }
  if (!loaded) {
    return <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">사이트 설정</h1>
          <p className="text-[13px] text-ink-700 mt-1">
            이벤트 정보·KV·통계·연락처. 변경 후 저장 버튼을 눌러주세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} error={saveError} />
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="px-4 py-2 rounded-btn bg-brand-500 text-ink-900 font-semibold text-[13px] hover:bg-brand-700 hover:text-white flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            저장
          </button>
        </div>
      </header>

      <Section title="이벤트 정보">
        <div className="grid grid-cols-2 gap-3">
          <Field label="행사명 (한글)">
            <input {...form.register("event.nameKo")} className={inputCls()} />
          </Field>
          <Field label="행사명 (영문)">
            <input {...form.register("event.nameEn")} className={inputCls()} />
          </Field>
          <Field label="일정 표시">
            <input
              {...form.register("event.dateRange")}
              placeholder="2026.08.19 — 22"
              className={inputCls()}
            />
          </Field>
          <Field label="장소">
            <input
              {...form.register("event.venue")}
              placeholder="KINTEX 제2전시장 7,8홀"
              className={inputCls()}
            />
          </Field>
          <Field label="신청 마감일">
            <input
              type="date"
              {...form.register("event.applicationDeadline")}
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      <Section title="홈 KV (메인 비주얼)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="데스크톱 KV (이미지)" full>
            <KVUpload
              currentUrl={form.watch("kv.desktopUrl")}
              onUpload={(file) => uploadKV("desktop", file)}
            />
          </Field>
          <Field label="모바일 KV (선택, 이미지)" full>
            <KVUpload
              currentUrl={form.watch("kv.mobileUrl")}
              onUpload={(file) => uploadKV("mobile", file)}
            />
          </Field>
          <Field label="오버레이 텍스트 (선택)" full>
            <input
              {...form.register("kv.overlayText")}
              placeholder="2026.08.19 — 22 · KINTEX"
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      <Section title="Why K-PRINT 통계">
        <Field label="섹션 헤드라인">
          <input {...form.register("why.headline")} className={inputCls()} />
        </Field>

        <div className="mt-4">
          <div className="text-[12px] font-semibold text-ink-700 mb-2 uppercase tracking-wide">
            통계 카드
          </div>
          <div className="space-y-2">
            {stats.fields.map((f, i) => (
              <div
                key={f.id}
                className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
              >
                <input
                  {...form.register(`why.stats.${i}.label`)}
                  placeholder="라벨 (방문객)"
                  className={inputCls()}
                />
                <input
                  {...form.register(`why.stats.${i}.value`)}
                  placeholder="값 (72,507)"
                  className={inputCls() + " font-mono"}
                />
                <input
                  {...form.register(`why.stats.${i}.suffix`)}
                  placeholder="단위 (명)"
                  className={inputCls()}
                />
                <input
                  {...form.register(`why.stats.${i}.desc`)}
                  placeholder="설명 (선택)"
                  className={inputCls()}
                />
                <button
                  type="button"
                  onClick={() => stats.remove(i)}
                  className="w-9 h-9 grid place-items-center text-ink-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => stats.append({ label: "", value: "", suffix: "", desc: "" })}
              className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[13px] text-ink-500 hover:border-brand-500 hover:text-brand-700 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              통계 카드 추가
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[12px] font-semibold text-ink-700 mb-2 uppercase tracking-wide">
            연도별 데이터 (선택)
          </div>
          <div className="space-y-2">
            {chartData.fields.map((f, i) => (
              <div
                key={f.id}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
              >
                <input
                  type="number"
                  {...form.register(`why.chartData.${i}.year`, { valueAsNumber: true })}
                  placeholder="2024"
                  className={inputCls() + " font-mono"}
                />
                <input
                  type="number"
                  {...form.register(`why.chartData.${i}.visitors`, { valueAsNumber: true })}
                  placeholder="방문객 수"
                  className={inputCls() + " font-mono"}
                />
                <input
                  type="number"
                  {...form.register(`why.chartData.${i}.exhibitors`, { valueAsNumber: true })}
                  placeholder="참가사 수"
                  className={inputCls() + " font-mono"}
                />
                <button
                  type="button"
                  onClick={() => chartData.remove(i)}
                  className="w-9 h-9 grid place-items-center text-ink-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => chartData.append({ year: 2024, visitors: 0, exhibitors: 0 })}
              className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[13px] text-ink-500 hover:border-brand-500 hover:text-brand-700 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              연도 추가
            </button>
          </div>
        </div>
      </Section>

      <Section title="신청 절차">
        <div className="space-y-2">
          {steps.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
            >
              <input
                {...form.register(`applicationSteps.${i}.title`)}
                placeholder={`${i + 1}. 단계 제목`}
                className={inputCls()}
              />
              <input
                {...form.register(`applicationSteps.${i}.desc`)}
                placeholder="설명 (선택)"
                className={inputCls()}
              />
              <button
                type="button"
                onClick={() => steps.remove(i)}
                className="w-9 h-9 grid place-items-center text-ink-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => steps.append({ title: "", desc: "" })}
            className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[13px] text-ink-500 hover:border-brand-500 hover:text-brand-700 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            단계 추가
          </button>
        </div>
      </Section>

      <Section title="연락처">
        <div className="grid grid-cols-2 gap-3">
          <Field label="전화">
            <input {...form.register("contact.phone")} className={inputCls()} />
          </Field>
          <Field label="이메일">
            <input
              type="email"
              {...form.register("contact.email")}
              className={inputCls()}
            />
          </Field>
          <Field label="주소" full>
            <input {...form.register("contact.address")} className={inputCls()} />
          </Field>
        </div>
      </Section>
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

function SaveStatus({
  status,
  error,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
}) {
  if (status === "saving") return <span className="text-[11px] text-ink-500">저장 중…</span>;
  if (status === "saved") {
    return (
      <span className="text-[11px] text-brand-700 flex items-center gap-1">
        <Check className="w-3 h-3" /> 저장됨
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-[11px] text-red-700 flex items-center gap-1" title={error ?? ""}>
        <AlertCircle className="w-3 h-3" /> 저장 실패
      </span>
    );
  }
  return null;
}

function KVUpload({
  currentUrl,
  onUpload,
}: {
  currentUrl: string;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2">
      {currentUrl && (
        <div className="rounded-btn overflow-hidden border border-ink-100 bg-ink-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="KV 미리보기" className="max-h-48 mx-auto" />
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full py-2 rounded-btn border border-ink-100 text-[13px] text-ink-700 hover:bg-ink-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <Upload className="w-3.5 h-3.5" />
        {currentUrl ? "이미지 교체" : "이미지 업로드"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          await onUpload(f);
          setBusy(false);
          e.target.value = "";
        }}
      />
    </div>
  );
}
