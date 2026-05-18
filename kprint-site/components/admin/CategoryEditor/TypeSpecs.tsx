"use client";

import { useEffect, useRef, useState } from "react";
import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Category } from "@/lib/types";

// 카테고리 타입별 스펙 편집 폼 — videoSpec / mailingSpec / contentSpec.
// 각 폼은 자체적으로 디바운스 자동 저장.

const SAVE_DEBOUNCE_MS = 1000;

function inputCls(): string {
  return "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white";
}

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-1 flex items-baseline gap-2">
      <label className="text-[12px] font-semibold text-ink-700">{label}</label>
      {hint && <span className="text-[10.5px] text-ink-500">{hint}</span>}
    </div>
  );
}

function useDebouncedSave<T>(
  categoryId: string,
  field: "videoSpec" | "mailingSpec" | "contentSpec",
  value: T,
  enabled: boolean
) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    // 초기 로드 시 한 번은 저장 트리거 안 하기
    if (!initRef.current) {
      initRef.current = true;
      return;
    }
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await updateDoc(doc(getDb(), "categories", categoryId), {
          [field]: value,
          updatedAt: Timestamp.fromDate(new Date()),
        });
        setStatus("saved");
      } catch (e) {
        console.error("typespec save failed", e);
        setStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [categoryId, field, value, enabled]);

  return status;
}

function SaveStatus({ status }: { status: ReturnType<typeof useDebouncedSave> }) {
  if (status === "saving")
    return <span className="text-[11px] text-ink-500">저장 중…</span>;
  if (status === "saved")
    return <span className="text-[11px] text-emerald-600">저장됨</span>;
  if (status === "error")
    return <span className="text-[11px] text-red-600">저장 실패</span>;
  return <span className="text-[11px] text-ink-300">자동 저장 대기</span>;
}

// ============================================================================
// VideoSpec — 미디어형 / XPACE
// ============================================================================

export function VideoSpecForm({
  categoryId,
  value,
}: {
  categoryId: string;
  value?: Category["videoSpec"];
}) {
  const [duration, setDuration] = useState<string>(
    value?.duration?.toString() ?? ""
  );
  const [resolution, setResolution] = useState<string>(value?.resolution ?? "");
  const [plays, setPlays] = useState<string>(value?.plays?.toString() ?? "");

  const payload = {
    duration: duration ? Number(duration) : undefined,
    resolution: resolution || undefined,
    plays: plays ? Number(plays) : undefined,
  };

  const status = useDebouncedSave(
    categoryId,
    "videoSpec",
    Object.values(payload).some((v) => v !== undefined) ? payload : undefined,
    true
  );

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel label="길이" hint="초" />
          <input
            type="number"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="15"
            className={inputCls()}
          />
        </div>
        <div>
          <FieldLabel label="해상도" hint="W×H" />
          <input
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="2480x2160"
            className={inputCls()}
          />
        </div>
        <div>
          <FieldLabel label="송출 횟수" hint="회" />
          <input
            type="number"
            min={0}
            value={plays}
            onChange={(e) => setPlays(e.target.value)}
            placeholder="2000"
            className={inputCls()}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatus status={status} />
      </div>
    </div>
  );
}

// ============================================================================
// MailingSpec — 발송형 (뉴스레터 등)
// ============================================================================

export function MailingSpecForm({
  categoryId,
  value,
}: {
  categoryId: string;
  value?: Category["mailingSpec"];
}) {
  const [sendDates, setSendDates] = useState<string[]>(
    value?.sendDates ?? []
  );
  const [audience, setAudience] = useState<string>(
    value?.audience?.toString() ?? ""
  );
  const [audienceLabel, setAudienceLabel] = useState<string>(
    value?.audienceLabel ?? ""
  );
  const [dateInput, setDateInput] = useState("");

  const addDate = () => {
    const v = dateInput.trim();
    if (!v) return;
    if (sendDates.includes(v)) return;
    setSendDates([...sendDates, v]);
    setDateInput("");
  };

  const payload =
    sendDates.length > 0 || audience || audienceLabel
      ? {
          sendDates,
          audience: audience ? Number(audience) : 0,
          audienceLabel: audienceLabel || undefined,
        }
      : undefined;

  const status = useDebouncedSave(
    categoryId,
    "mailingSpec",
    payload,
    true
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel label="발송 대상" hint="명" />
          <input
            type="number"
            min={0}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="35000"
            className={inputCls()}
          />
        </div>
        <div>
          <FieldLabel label="대상 라벨" hint="예: 전체 / 사전등록자" />
          <input
            value={audienceLabel}
            onChange={(e) => setAudienceLabel(e.target.value)}
            placeholder="사전등록자"
            className={inputCls()}
          />
        </div>
      </div>

      <div className="mt-3">
        <FieldLabel label="발송 예정일" hint="여러 회차 가능" />
        <div className="flex gap-2">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className={inputCls()}
          />
          <button
            type="button"
            onClick={addDate}
            disabled={!dateInput}
            className="px-3 py-1.5 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 disabled:opacity-40"
          >
            추가
          </button>
        </div>
        {sendDates.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {sendDates.map((d) => (
              <li
                key={d}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-50 text-ink-700 text-[11px] font-mono"
              >
                {d}
                <button
                  type="button"
                  onClick={() =>
                    setSendDates(sendDates.filter((x) => x !== d))
                  }
                  className="text-ink-400 hover:text-red-700"
                  aria-label="제거"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <SaveStatus status={status} />
      </div>
    </div>
  );
}

// ============================================================================
// ContentSpec — 콘텐츠형 (SNS 인터뷰, 카드뉴스 등)
// ============================================================================

export function ContentSpecForm({
  categoryId,
  value,
}: {
  categoryId: string;
  value?: Category["contentSpec"];
}) {
  const [channel, setChannel] = useState<string>(value?.channel ?? "");
  const [format, setFormat] = useState<string>(value?.format ?? "");

  const payload =
    channel || format
      ? { channel, format }
      : undefined;

  const status = useDebouncedSave(
    categoryId,
    "contentSpec",
    payload,
    true
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel label="채널" hint="예: Instagram / YouTube" />
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="Instagram"
            className={inputCls()}
          />
        </div>
        <div>
          <FieldLabel label="포맷" hint="예: 카드뉴스 / 인터뷰 영상" />
          <input
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder="카드뉴스 5장"
            className={inputCls()}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatus status={status} />
      </div>
    </div>
  );
}
