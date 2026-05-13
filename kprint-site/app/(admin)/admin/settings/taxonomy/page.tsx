"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { useFieldArray, useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Plus,
  Save,
  Wand2,
  X,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type { Category, Tag, TagKind, Taxonomy } from "@/lib/types";

const FIXED_CHANNELS: Taxonomy["channels"] = [
  { id: "offline", label: "오프라인" },
  { id: "online", label: "온라인" },
  { id: "package", label: "패키지" },
];

const PURPOSE_LABELS = new Set([
  "브랜드 확산형",
  "현장 방문객 유도형",
  "신제품 홍보형",
  "맞춤형 타겟팅 광고",
]);

function inferKind(label: string): TagKind {
  if (PURPOSE_LABELS.has(label.trim())) return "purpose";
  const t = label.trim();
  if (t.endsWith("_패키지") || t.endsWith(" 패키지")) return "package";
  return "custom";
}

/** 라벨에서 ID 자동 생성. 영문/숫자는 그대로, 공백·특수문자는 언더바로. */
function labelToId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "tag";
}

function defaultColorForKind(kind: TagKind): string {
  if (kind === "purpose") return "#00bfa6"; // mint
  if (kind === "package") return "#0f172a"; // ink-900
  return "#94a3b8"; // ink-500
}

const KIND_META: Record<TagKind, { label: string; desc: string }> = {
  purpose: {
    label: "광고 목적",
    desc: "/sponsorships 사이드바 필터 옵션으로 사용됩니다.",
  },
  package: {
    label: "패키지 분류",
    desc: "패키지 묶음 식별용 메타 태그. 사이드바 필터에는 사용 안 함.",
  },
  custom: {
    label: "기타",
    desc: "자유 분류용 태그. 어드민이 임의로 활용.",
  },
};

type FormTag = {
  id: string;
  label: string;
  color: string;
  kind: TagKind;
  isActive: boolean;
};

type FormValues = {
  tags: FormTag[];
};

export default function TaxonomyPage() {
  const { eventId, ready } = useEventFilter();
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  const initRef = useRef(false);

  const form = useForm<FormValues>({
    defaultValues: { tags: [] },
  });
  const fields = useFieldArray({ control: form.control, name: "tags" });
  const watchedTags = form.watch("tags");

  // 그룹별 array index 계산 (재렌더마다 갱신)
  const grouped = useMemo(() => {
    const out: Record<TagKind, number[]> = {
      purpose: [],
      package: [],
      custom: [],
    };
    (watchedTags ?? []).forEach((t, i) => {
      out[t.kind ?? "custom"].push(i);
    });
    return out;
  }, [watchedTags]);

  // 1회성 마이그레이션: 첫 로드 시 누락 필드 자동 채움 + 저장
  useEffect(() => {
    if (!ready || !eventId) return;
    initRef.current = false;
    setLoaded(false);
    const u = onSnapshot(doc(getDb(), "taxonomy", eventId), (s) => {
      setLoaded(true);
      if (initRef.current) return;
      initRef.current = true;

      if (!s.exists()) return;
      const raw = s.data() as { tags?: Array<Partial<Tag>>; channels?: Taxonomy["channels"] };
      const rawTags = raw.tags ?? [];

      let migrated = false;
      const normalized: FormTag[] = rawTags.map((t, i) => {
        const tag: FormTag = {
          id: String(t.id ?? "").trim(),
          label: String(t.label ?? "").trim(),
          color: t.color ?? "",
          kind: t.kind ?? inferKind(String(t.label ?? "")),
          isActive: t.isActive !== false,
        };
        if (
          t.kind === undefined ||
          t.order === undefined ||
          t.isActive === undefined
        ) {
          migrated = true;
        }
        // order 누락도 마이그레이션 대상이지만 form 상태에선 array 순서로 관리
        void i;
        return tag;
      });

      form.reset({ tags: normalized });

      if (migrated && normalized.length > 0) {
        // 자동 저장 (silent)
        const data: Taxonomy & { eventId: string } = {
          eventId,
          tags: normalized.map((t, i) => buildTag(t, i, normalized)),
          channels: FIXED_CHANNELS,
        };
        setDoc(doc(getDb(), "taxonomy", eventId), data)
          .then(() => {
            setMigrationNote(
              `기존 태그 ${normalized.length}개에 kind / isActive / order 자동 적용 완료.`
            );
            setTimeout(() => setMigrationNote(null), 6000);
          })
          .catch((e) => {
            console.error("auto migration failed", e);
          });
      }
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
      const validTags = v.tags.filter((t) => t.id.trim() && t.label.trim());
      const data: Taxonomy & { eventId: string } = {
        eventId,
        tags: validTags.map((t, i) => buildTag(t, i, validTags)),
        channels: FIXED_CHANNELS,
      };
      await setDoc(doc(getDb(), "taxonomy", eventId), data);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAutoClassify = () => {
    const ok = confirm(
      "모든 태그의 kind를 라벨 기반으로 다시 분류합니다.\n수동으로 바꿔둔 kind도 덮어씁니다. 계속?"
    );
    if (!ok) return;
    const current = form.getValues("tags");
    current.forEach((t, i) => {
      form.setValue(`tags.${i}.kind`, inferKind(t.label), {
        shouldDirty: true,
      });
    });
  };

  /** categories 컬렉션 전체를 스캔해서 사용 중인 태그 라벨을 수집 → 중복 제거 → 누락된 것만 폼에 추가 */
  const handleImportFromCategories = async () => {
    if (!eventId) {
      alert("상단에서 행사를 먼저 선택하세요.");
      return;
    }
    try {
      const snap = await getDocs(
        query(collection(getDb(), "categories"), where("eventId", "==", eventId))
      );
      const labelSet = new Set<string>();
      snap.docs.forEach((d) => {
        const cat = d.data() as Category;
        (cat.tags ?? []).forEach((t) => {
          const trimmed = String(t).trim();
          if (trimmed) labelSet.add(trimmed);
        });
      });

      const existing = new Set(
        form
          .getValues("tags")
          .map((t) => t.label.trim())
          .filter(Boolean)
      );
      const newLabels = Array.from(labelSet).filter((l) => !existing.has(l));

      if (newLabels.length === 0) {
        setMigrationNote(
          `카테고리에서 사용 중인 ${labelSet.size}개 태그 모두 이미 등록되어 있습니다.`
        );
        setTimeout(() => setMigrationNote(null), 5000);
        return;
      }

      const ok = confirm(
        `카테고리에서 ${labelSet.size}개의 태그를 발견했어요.\n그 중 ${newLabels.length}개가 새로 추가됩니다 (kind 자동 분류).\n저장하기 전엔 폼에만 반영되니 검토 후 [저장] 누르세요.\n\n계속?`
      );
      if (!ok) return;

      newLabels.forEach((label) => {
        const id = labelToId(label);
        fields.append({
          id,
          label,
          color: defaultColorForKind(inferKind(label)),
          kind: inferKind(label),
          isActive: true,
        });
      });

      setMigrationNote(
        `${newLabels.length}개 태그가 폼에 추가됐어요. 검토 후 [저장]을 눌러주세요.`
      );
      setTimeout(() => setMigrationNote(null), 8000);
    } catch (e) {
      alert(
        `카테고리 스캔 실패: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  // 그룹 내에서 위/아래 이동
  const moveWithinGroup = (currentIdx: number, kind: TagKind, dir: -1 | 1) => {
    const groupIdxs = grouped[kind];
    const pos = groupIdxs.indexOf(currentIdx);
    const targetPos = pos + dir;
    if (targetPos < 0 || targetPos >= groupIdxs.length) return;
    fields.move(currentIdx, groupIdxs[targetPos]);
  };

  const addTag = (kind: TagKind) => {
    fields.append({
      id: "",
      label: "",
      color: "#00bfa6",
      kind,
      isActive: true,
    });
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
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">분류·태그</h1>
          <p className="text-[13px] text-ink-700 mt-1">
            카테고리에 붙일 태그를 종류별로 관리합니다. 채널은 고정입니다.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SaveStatusBadge status={saveStatus} error={saveError} />
          <button
            type="button"
            onClick={handleImportFromCategories}
            className="px-3 py-2 rounded-btn border border-brand-200 bg-brand-50 text-[12px] font-semibold text-brand-700 hover:bg-brand-100 flex items-center gap-1.5"
            title="카테고리 컬렉션에서 사용 중인 태그를 자동 수집"
          >
            <Download className="w-3.5 h-3.5" />
            카테고리에서 가져오기
          </button>
          <button
            type="button"
            onClick={handleAutoClassify}
            className="px-3 py-2 rounded-btn border border-ink-100 text-[12px] font-semibold text-ink-700 hover:bg-ink-50 flex items-center gap-1.5"
            title="라벨 기반으로 모든 태그의 kind를 재분류"
          >
            <Wand2 className="w-3.5 h-3.5" />
            태그 일괄 분류
          </button>
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

      {migrationNote && (
        <div className="bg-brand-50 border border-brand-100 rounded-btn p-3 text-[12px] text-brand-700">
          ✓ {migrationNote}
        </div>
      )}

      {(["purpose", "package", "custom"] as const).map((kind) => (
        <Section
          key={kind}
          title={KIND_META[kind].label}
          desc={KIND_META[kind].desc}
          right={
            <button
              type="button"
              onClick={() => addTag(kind)}
              className="text-[12px] text-brand-700 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              추가
            </button>
          }
        >
          {grouped[kind].length === 0 ? (
            <div className="text-[12px] text-ink-500 py-3 text-center bg-ink-50 rounded-btn">
              이 종류의 태그가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {grouped[kind].map((idx, posInGroup) => {
                const total = grouped[kind].length;
                return (
                  <div
                    key={fields.fields[idx]?.id ?? idx}
                    className="grid grid-cols-[1.4fr_1.8fr_auto_auto_auto_auto_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
                  >
                    <input
                      {...form.register(`tags.${idx}.id`)}
                      placeholder="ID (영문/숫자/언더바)"
                      className={inputCls() + " font-mono text-[12px]"}
                    />
                    <input
                      {...form.register(`tags.${idx}.label`)}
                      placeholder="표시 이름"
                      className={inputCls()}
                    />
                    <input
                      type="color"
                      {...form.register(`tags.${idx}.color`)}
                      className="w-9 h-9 rounded border border-ink-100 bg-white cursor-pointer"
                      title="색상 (선택)"
                    />
                    <select
                      {...form.register(`tags.${idx}.kind`)}
                      className="px-2 py-2 text-[12px] border border-ink-100 rounded-btn bg-white"
                      title="종류"
                    >
                      <option value="purpose">광고 목적</option>
                      <option value="package">패키지</option>
                      <option value="custom">기타</option>
                    </select>
                    <ActiveToggle
                      checked={!!watchedTags?.[idx]?.isActive}
                      onChange={(v) =>
                        form.setValue(`tags.${idx}.isActive`, v, {
                          shouldDirty: true,
                        })
                      }
                    />
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveWithinGroup(idx, kind, -1)}
                        disabled={posInGroup === 0}
                        className="w-7 h-7 grid place-items-center text-ink-500 hover:text-ink-900 disabled:opacity-30"
                        title="위로"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWithinGroup(idx, kind, 1)}
                        disabled={posInGroup === total - 1}
                        className="w-7 h-7 grid place-items-center text-ink-500 hover:text-ink-900 disabled:opacity-30"
                        title="아래로"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => fields.remove(idx)}
                      className="w-9 h-9 grid place-items-center text-ink-500 hover:text-red-700"
                      title="삭제"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      ))}

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
          채널은 SPEC상 3종 고정입니다.
        </p>
      </Section>
    </div>
  );
}

// ============================================================================
// Helpers / sub-components
// ============================================================================

/** form 입력값 → Firestore 저장 형태로 변환. order는 같은 kind 내 등장 순서. */
function buildTag(t: FormTag, _: number, all: FormTag[]): Tag {
  const sameKindBefore = all.filter(
    (other, j) => other.kind === t.kind && j < all.indexOf(t)
  );
  const tag: Tag = {
    id: t.id.trim(),
    label: t.label.trim(),
    kind: t.kind,
    order: sameKindBefore.length,
    isActive: t.isActive,
  };
  const color = t.color.trim();
  if (color) tag.color = color;
  return tag;
}

function inputCls(): string {
  return "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white";
}

function Section({
  title,
  desc,
  right,
  children,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-ink-100 rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {desc && <p className="text-[11px] text-ink-500 mt-0.5">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function ActiveToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={checked ? "활성 — 필터에 노출" : "비활성 — 필터에서 숨김"}
      className={
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
        (checked ? "bg-brand-500" : "bg-ink-100")
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

function SaveStatusBadge({
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
