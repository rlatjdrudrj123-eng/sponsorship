"use client";

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useFieldArray, useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Save,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Taxonomy } from "@/lib/types";

const TAXONOMY_DOC_ID = "main";

type FormValues = {
  tags: Array<{ id: string; label: string; color: string }>;
};

const FIXED_CHANNELS: Taxonomy["channels"] = [
  { id: "offline", label: "오프라인" },
  { id: "online", label: "온라인" },
  { id: "package", label: "패키지" },
];

export default function TaxonomyPage() {
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const initRef = useRef(false);

  const form = useForm<FormValues>({
    defaultValues: { tags: [] },
  });
  const fields = useFieldArray({ control: form.control, name: "tags" });

  useEffect(() => {
    const u = onSnapshot(doc(getDb(), "taxonomy", TAXONOMY_DOC_ID), (s) => {
      setLoaded(true);
      if (initRef.current) return;
      if (!s.exists()) {
        initRef.current = true;
        return;
      }
      const data = s.data() as Taxonomy;
      form.reset({
        tags: (data.tags ?? []).map((t) => ({
          id: t.id,
          label: t.label,
          color: t.color ?? "",
        })),
      });
      initRef.current = true;
    });
    return () => u();
  }, [form]);

  const handleSave = async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const v = form.getValues();
      const data: Taxonomy = {
        tags: v.tags
          .filter((t) => t.id && t.label)
          .map((t) => ({
            id: t.id.trim(),
            label: t.label.trim(),
            color: t.color.trim() || undefined,
          })),
        channels: FIXED_CHANNELS,
      };
      await setDoc(doc(getDb(), "taxonomy", TAXONOMY_DOC_ID), data);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!loaded) {
    return <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">분류·태그</h1>
          <p className="text-[13px] text-ink-700 mt-1">
            카테고리에 붙일 태그를 정의합니다. 채널은 고정입니다 (offline/online/package).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} error={saveError} />
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="px-4 py-2 rounded-btn bg-mint-500 text-ink-900 font-semibold text-[13px] hover:bg-mint-700 hover:text-white flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            저장
          </button>
        </div>
      </header>

      <Section title="태그">
        <div className="space-y-2">
          {fields.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid grid-cols-[1.5fr_2fr_auto_auto_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
            >
              <input
                {...form.register(`tags.${i}.id`)}
                placeholder="ID (영문/숫자/언더바)"
                className={inputCls() + " font-mono text-[12px]"}
              />
              <input
                {...form.register(`tags.${i}.label`)}
                placeholder="표시 이름"
                className={inputCls()}
              />
              <input
                type="color"
                {...form.register(`tags.${i}.color`)}
                className="w-9 h-9 rounded border border-ink-100 bg-white cursor-pointer"
                title="색상 (선택)"
              />
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => i > 0 && fields.move(i, i - 1)}
                  disabled={i === 0}
                  className="w-7 h-7 grid place-items-center text-ink-500 hover:text-ink-900 disabled:opacity-30"
                  title="위로"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => i < fields.fields.length - 1 && fields.move(i, i + 1)}
                  disabled={i === fields.fields.length - 1}
                  className="w-7 h-7 grid place-items-center text-ink-500 hover:text-ink-900 disabled:opacity-30"
                  title="아래로"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => fields.remove(i)}
                className="w-9 h-9 grid place-items-center text-ink-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {fields.fields.length === 0 && (
            <div className="text-sm text-ink-500 py-4 text-center bg-ink-50 rounded-btn">
              태그가 없습니다. 추가하세요.
            </div>
          )}
          <button
            type="button"
            onClick={() => fields.append({ id: "", label: "", color: "#00bfa6" })}
            className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[13px] text-ink-500 hover:border-mint-500 hover:text-mint-700 hover:bg-mint-50 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            태그 추가
          </button>
        </div>
      </Section>

      <Section title="채널 (고정)">
        <div className="flex gap-2">
          {FIXED_CHANNELS.map((ch) => (
            <span
              key={ch.id}
              className="px-3 py-1.5 rounded-full text-[12px] bg-ink-100 text-ink-700 font-mono"
            >
              {ch.id} — {ch.label}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-ink-500 mt-2">
          채널은 SPEC상 3종 고정입니다. 변경하려면 코드 수정이 필요합니다.
        </p>
      </Section>
    </div>
  );
}

function inputCls(): string {
  return "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500 bg-white";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-ink-100 rounded-card p-5">
      <h2 className="text-[15px] font-bold text-ink-900 mb-3">{title}</h2>
      {children}
    </section>
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
      <span className="text-[11px] text-mint-700 flex items-center gap-1">
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
