"use client";

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { AlertCircle, Check, Save } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { SiteSettings } from "@/lib/types";

type FormValues = {
  theme: {
    primary: string; // hex
  };
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

const PRESET_COLORS: Array<{ label: string; hex: string }> = [
  { label: "K-PRINT 빨강", hex: "#DB0711" },
  { label: "K-PRINT 민트", hex: "#00BFA6" },
  { label: "딥 블루", hex: "#1E40AF" },
  { label: "포레스트", hex: "#15803D" },
  { label: "퍼플", hex: "#7C3AED" },
  { label: "오렌지", hex: "#EA580C" },
  { label: "차콜", hex: "#1F2937" },
];

export default function SettingsPage() {
  const { eventId, ready } = useEventFilter();
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const initRef = useRef(false);

  const form = useForm<FormValues>({
    defaultValues: {
      theme: { primary: "#DB0711" },
      event: {
        nameKo: "",
        nameEn: "",
        dateRange: "",
        venue: "",
        applicationDeadline: "",
      },
      kv: { desktopUrl: "", mobileUrl: "", overlayText: "" },
      why: { headline: "", stats: [], chartData: [] },
      contact: { phone: "", email: "", address: "" },
      applicationSteps: [],
    },
  });

  // why.stats / why.chartData / applicationSteps 폼은 UI 에서 제거됨 — 데이터 스키마만 유지

  useEffect(() => {
    if (!ready || !eventId) return;
    initRef.current = false;
    setLoaded(false);
    const u = onSnapshot(doc(getDb(), "siteSettings", eventId), (s) => {
      setLoaded(true);
      if (!s.exists() || initRef.current) return;
      const data = s.data() as SiteSettings;
      form.reset({
        theme: {
          primary: data.theme?.primary || "#DB0711",
        },
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
        theme: {
          primary: v.theme.primary || "#DB0711",
        },
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

  // KV 업로드는 더 이상 사용 안 함 — 랜딩 빌더 캔버스로 직접 이미지 배치

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

  // KV·Why 통계·신청 절차 는 랜딩 빌더가 직접 캔버스로 디자인하는 구조라 별도 폼 불필요 → 제거.
  // 데이터 스키마는 유지 (구버전 호환), UI 만 가렸음.
  const sectionDefs = [
    { id: "theme", num: "01", title: "테마 색상", desc: "브랜드 컬러" },
    { id: "event", num: "02", title: "이벤트 정보", desc: "행사명·일정·장소" },
    { id: "contact", num: "03", title: "연락처", desc: "사무국 정보" },
  ];

  return (
    <div className="bg-ink-50 -mx-7 -my-6 min-h-[calc(100vh-56px)]">
      {/* 스티키 툴바 — 항상 노출 */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-100 px-7 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-bold text-ink-900 leading-tight">
            사이트 설정
          </h1>
          <p className="text-[11.5px] text-ink-500">
            변경 후 우측 [저장] 클릭. 좌측 메뉴로 빠르게 이동 가능.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} error={saveError} />
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="px-4 py-2 rounded-btn bg-brand-500 text-white font-bold text-[12.5px] hover:bg-brand-700 flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            저장
          </button>
        </div>
      </div>

      <div className="px-7 py-6 grid grid-cols-[200px_1fr] gap-6 items-start max-w-[1280px] mx-auto">
        {/* 좌측 앵커 네비 */}
        <nav className="sticky top-[88px] space-y-1">
          {sectionDefs.map((s) => (
            <a
              key={s.id}
              href={`#sec-${s.id}`}
              className="block px-3 py-2 rounded-btn hover:bg-white text-[12.5px] text-ink-700 hover:text-ink-900 transition-colors"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-ink-400">
                  {s.num}
                </span>
                <span className="font-bold">{s.title}</span>
              </div>
              <div className="text-[10.5px] text-ink-500 mt-0.5 ml-5">
                {s.desc}
              </div>
            </a>
          ))}
        </nav>

        {/* 우측 섹션들 */}
        <div className="space-y-5 min-w-0">
      <Section title="테마 색상" id="sec-theme" num="01">
        {/* 컬러 미리보기 — 선택한 brand 색이 어떻게 적용되는지 즉각 시각화 */}
        <ColorRampPreview hex={form.watch("theme.primary") || "#DB0711"} />
        <ThemePrimaryPicker
          value={form.watch("theme.primary")}
          onChange={(hex) =>
            form.setValue("theme.primary", hex, { shouldDirty: true })
          }
        />
      </Section>

      <Section title="이벤트 정보" id="sec-event" num="02">
        <EventCardPreview
          nameKo={form.watch("event.nameKo")}
          dateRange={form.watch("event.dateRange")}
          venue={form.watch("event.venue")}
        />
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

      {/* KV / Why 통계 / 신청 절차 섹션은 제거 — 랜딩 빌더 캔버스로 직접 구성하므로 별도 폼 불필요.
          데이터 스키마 (settings.kv / why / applicationSteps) 는 유지하여 구버전 호환만 보장. */}

      <Section title="연락처" id="sec-contact" num="03">
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
      </div>
    </div>
  );
}

function inputCls(): string {
  return "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white";
}

function Section({
  title,
  children,
  id,
  num,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
  num?: string;
}) {
  return (
    <section
      id={id}
      className="bg-white border border-ink-100 rounded-card p-5 scroll-mt-[100px]"
    >
      <h2 className="text-[15px] font-bold text-ink-900 mb-4 flex items-baseline gap-2">
        {num && (
          <span className="font-mono text-[10.5px] text-ink-400 tracking-wider">
            {num}
          </span>
        )}
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

// 컬러 램프 미리보기 — 선택한 brand 색이 50~900 어떻게 파생되는지 시각화
function ColorRampPreview({ hex }: { hex: string }) {
  // brand-50, 100, 500, 700, 900 핵심 stop 미리보기 (실제 ramp 와 비슷한 mix)
  const stops = [
    { name: "50", mix: 92, base: "white" },
    { name: "100", mix: 80, base: "white" },
    { name: "200", mix: 60, base: "white" },
    { name: "400", mix: 20, base: "white" },
    { name: "500", mix: 0, base: "white" },
    { name: "700", mix: 25, base: "black" },
    { name: "900", mix: 55, base: "black" },
  ] as const;
  return (
    <div className="mb-4 bg-ink-50/60 rounded-btn p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
        브랜드 컬러 램프 미리보기
      </div>
      <div className="flex rounded overflow-hidden h-12 shadow-sm">
        {stops.map((s) => (
          <div
            key={s.name}
            className="flex-1 grid place-items-end pb-1 text-[9px] font-mono"
            style={{
              background: `color-mix(in srgb, ${hex}, ${s.base} ${s.mix}%)`,
              color: ["50", "100", "200"].includes(s.name)
                ? "#0A0A0A"
                : "#FFFFFF",
            }}
          >
            {s.name}
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-ink-500 mt-1.5">
        실제 사이트의 버튼·강조·뱃지 색이 위 분포로 자동 파생됩니다.
      </p>
    </div>
  );
}

// 이벤트 카드 미리보기 — 행사 정보 채울 때마다 어떻게 보일지 즉각 시각화
function EventCardPreview({
  nameKo,
  dateRange,
  venue,
}: {
  nameKo: string;
  dateRange: string;
  venue: string;
}) {
  return (
    <div className="mb-4 bg-ink-50/60 rounded-btn p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
        공개 사이트 노출 미리보기
      </div>
      <div className="bg-canvas rounded p-5 shadow-sm">
        <div className="font-num text-[10px] uppercase tracking-[0.35em] text-brand-500 font-bold flex items-center gap-2">
          <span className="w-6 h-px bg-brand-500" />
          Sponsorship Package
        </div>
        <h3 className="mt-3 text-[28px] font-bold leading-[0.98] tracking-tight text-ink-900">
          {nameKo || "행사명을 입력하세요"}
          <br />
          <span className="text-brand-500">스폰서십 안내</span>
        </h3>
        {(dateRange || venue) && (
          <p className="mt-3 text-[12px] text-ink-700 font-num">
            {dateRange}
            {dateRange && venue && " · "}
            {venue}
          </p>
        )}
      </div>
    </div>
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

function ThemePrimaryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const safe = value && /^#[0-9a-fA-F]{3,6}$/.test(value) ? value : "#DB0711";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-12 rounded-btn border border-ink-100 cursor-pointer bg-white"
          aria-label="브랜드 색상"
        />
        <input
          type="text"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#DB0711"
          className="px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white font-mono w-32"
        />
        <span className="text-[11px] text-ink-500">
          이 색상이 공개 사이트의 버튼·강조·링크·로고에 적용됩니다.
        </span>
      </div>

      {/* 프리셋 */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((p) => (
          <button
            key={p.hex}
            type="button"
            onClick={() => onChange(p.hex)}
            className={
              "px-2.5 py-1.5 rounded-btn text-[11.5px] font-semibold border transition-all flex items-center gap-1.5 " +
              (safe.toUpperCase() === p.hex.toUpperCase()
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-100 hover:border-ink-900 bg-white")
            }
            title={p.hex}
          >
            <span
              className="w-3 h-3 rounded-full border border-black/10"
              style={{ background: p.hex }}
            />
            {p.label}
          </button>
        ))}
      </div>

      {/* 미리보기 */}
      <div className="flex flex-wrap items-center gap-3 mt-2 p-3 rounded-btn bg-ink-50 border border-ink-100">
        <span className="text-[11px] text-ink-500 mr-1">미리보기:</span>
        <button
          type="button"
          className="px-3.5 py-1.5 rounded-btn text-white text-[12px] font-semibold"
          style={{ background: safe }}
        >
          CTA 버튼
        </button>
        <button
          type="button"
          className="px-3.5 py-1.5 rounded-btn text-[12px] font-semibold bg-white border-2"
          style={{ borderColor: safe, color: safe }}
        >
          아웃라인
        </button>
        <span
          className="px-2.5 py-1 rounded-pill text-white text-[10px] font-bold"
          style={{ background: safe }}
        >
          BADGE
        </span>
        <span className="text-[12px] font-bold" style={{ color: safe }}>
          링크 텍스트
        </span>
      </div>
    </div>
  );
}
