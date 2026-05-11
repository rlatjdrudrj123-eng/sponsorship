"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  Check,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type { Category, Slot, Subcategory, Taxonomy } from "@/lib/types";
import { LivePreview } from "@/components/admin/CategoryEditor/LivePreview";
import { CompletenessCheck } from "@/components/admin/CategoryEditor/CompletenessCheck";
import { SubcategoryTable } from "@/components/admin/CategoryEditor/SubcategoryTable";
import { ImageSlot } from "@/components/admin/CategoryEditor/ImageSlot";
import { FloorImages } from "@/components/admin/CategoryEditor/FloorImages";
import { PdfUpload } from "@/components/admin/CategoryEditor/PdfUpload";
import { PinEditor } from "@/components/admin/CategoryEditor/PinEditor";
import type { FloorImage, ImageSlot as ImageSlotType } from "@/lib/types";

type LockableField =
  | "code"
  | "channel"
  | "type"
  | "name.ko"
  | "name.en"
  | "size"
  | "fileFormat"
  | "deadline";

type FormValues = {
  nameKo: string;
  nameEn: string;
  code: string;
  channel: Category["channel"];
  type: Category["type"];
  slug: string;
  shortDesc: string;
  longDesc: string;
  size: string;
  fileFormat: string;
  deadline: string;
};

const CATEGORY_TYPE_OPTIONS: Array<{ value: Category["type"]; label: string }> = [
  { value: "floor_plan", label: "도면형" },
  { value: "quantity", label: "수량형" },
  { value: "media", label: "미디어" },
  { value: "digital_banner", label: "디지털 배너" },
  { value: "mailing", label: "발송형" },
  { value: "print_page", label: "지면" },
  { value: "content", label: "콘텐츠" },
  { value: "xpace", label: "XPACE" },
  { value: "package", label: "패키지" },
];

export default function CategoryEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [taxonomyTags, setTaxonomyTags] = useState<Taxonomy["tags"]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pinEditorSubId, setPinEditorSubId] = useState<string | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [caseStudies, setCaseStudies] = useState<NonNullable<Category["caseStudies"]>>([]);
  const initRef = useRef(false);

  const form = useForm<FormValues>({
    defaultValues: {
      nameKo: "",
      nameEn: "",
      code: "",
      channel: "offline",
      type: "floor_plan",
      slug: "",
      shortDesc: "",
      longDesc: "",
      size: "",
      fileFormat: "",
      deadline: "",
    },
  });

  // category subscribe
  useEffect(() => {
    const u = onSnapshot(doc(getDb(), "categories", id), (s) => {
      if (!s.exists()) {
        setNotFound(true);
        return;
      }
      const data = { ...(s.data() as Category), id: s.id };
      setCategory(data);
      if (!initRef.current) {
        form.reset({
          nameKo: data.name?.ko ?? "",
          nameEn: data.name?.en ?? "",
          code: data.code ?? "",
          channel: data.channel,
          type: data.type,
          slug: data.slug ?? "",
          shortDesc: data.shortDesc ?? "",
          longDesc: data.longDesc ?? "",
          size: data.size ?? "",
          fileFormat: data.fileFormat ?? "",
          deadline: data.deadline ? data.deadline.toDate().toISOString().slice(0, 10) : "",
        });
        setSelectedTags(data.tags ?? []);
        setIsFeatured(data.isFeatured ?? false);
        setCaseStudies(data.caseStudies ?? []);
        initRef.current = true;
      }
    });
    return () => u();
  }, [id, form]);

  // subs + slots
  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(getDb(), "subcategories"), where("categoryId", "==", id)),
      (s) => setSubcategories(s.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id })))
    );
    const u2 = onSnapshot(
      query(collection(getDb(), "slots"), where("categoryId", "==", id)),
      (s) => setSlots(s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id })))
    );
    return () => {
      u1();
      u2();
    };
  }, [id]);

  // taxonomy
  useEffect(() => {
    const u = onSnapshot(doc(getDb(), "taxonomy", "main"), (s) => {
      if (s.exists()) {
        setTaxonomyTags((s.data() as Taxonomy).tags ?? []);
      } else {
        setTaxonomyTags([]);
      }
    });
    return () => u();
  }, []);

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
          await updateDoc(doc(getDb(), "categories", id), {
            name: { ko: v.nameKo, en: v.nameEn },
            code: v.code,
            channel: v.channel,
            type: v.type,
            slug: v.slug,
            shortDesc: v.shortDesc || undefined,
            longDesc: v.longDesc || undefined,
            size: v.size || undefined,
            fileFormat: v.fileFormat || undefined,
            deadline: v.deadline ? Timestamp.fromDate(new Date(v.deadline)) : undefined,
            updatedAt: Timestamp.fromDate(new Date()),
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
  }, [form, id]);

  const isLocked = (field: LockableField) => (category?.lockedFields ?? []).includes(field);

  const toggleLock = async (field: LockableField) => {
    if (!category) return;
    const current = category.lockedFields ?? [];
    const next = current.includes(field)
      ? current.filter((f) => f !== field)
      : [...current, field];
    try {
      await updateDoc(doc(getDb(), "categories", id), {
        lockedFields: next,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`잠금 토글 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toggleTag = async (tagId: string) => {
    const prev = selectedTags;
    const next = prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId];
    setSelectedTags(next);
    try {
      await updateDoc(doc(getDb(), "categories", id), {
        tags: next,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`태그 갱신 실패: ${e instanceof Error ? e.message : String(e)}`);
      setSelectedTags(prev);
    }
  };

  const toggleFeatured = async () => {
    const next = !isFeatured;
    setIsFeatured(next);
    try {
      await updateDoc(doc(getDb(), "categories", id), {
        isFeatured: next,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`인기 토글 실패: ${e instanceof Error ? e.message : String(e)}`);
      setIsFeatured(!next);
    }
  };

  const saveCaseStudies = async (next: NonNullable<Category["caseStudies"]>) => {
    setCaseStudies(next);
    try {
      await updateDoc(doc(getDb(), "categories", id), {
        caseStudies: next,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`이전 사례 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (notFound) {
    return (
      <div className="bg-white border border-ink-100 rounded-card p-12 text-center">
        <p className="text-sm text-ink-500">카테고리를 찾을 수 없습니다.</p>
        <Link
          href="/admin/categories"
          className="text-mint-700 font-semibold mt-4 inline-block hover:underline"
        >
          목록으로
        </Link>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/categories"
            className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
            aria-label="목록으로"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
              {category.name.ko}
            </h1>
            <div className="text-[12px] text-ink-500 mt-0.5 font-mono">
              {category.code} · /sponsorships/{category.slug}
            </div>
          </div>
        </div>
        <SaveStatusBadge status={saveStatus} lastSaved={lastSaved} error={saveError} />
      </header>

      <div className="grid grid-cols-[1fr_320px] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          {/* 기본 정보 */}
          <Section title="기본 정보">
            <div className="grid grid-cols-2 gap-3">
              <Field label="이름 (한글)" lockable lockOn={isLocked("name.ko")} onLockToggle={() => toggleLock("name.ko")}>
                <input
                  {...form.register("nameKo")}
                  readOnly={isLocked("name.ko")}
                  className={inputCls(isLocked("name.ko"))}
                />
              </Field>
              <Field label="이름 (영문)" lockable lockOn={isLocked("name.en")} onLockToggle={() => toggleLock("name.en")}>
                <input
                  {...form.register("nameEn")}
                  readOnly={isLocked("name.en")}
                  className={inputCls(isLocked("name.en"))}
                />
              </Field>
              <Field label="코드" lockable lockOn={isLocked("code")} onLockToggle={() => toggleLock("code")}>
                <input
                  {...form.register("code")}
                  readOnly={isLocked("code")}
                  className={inputCls(isLocked("code")) + " font-mono"}
                />
              </Field>
              <Field label="슬러그">
                <input
                  {...form.register("slug")}
                  className={inputCls(false) + " font-mono"}
                />
              </Field>
              <Field label="채널" lockable lockOn={isLocked("channel")} onLockToggle={() => toggleLock("channel")}>
                <select
                  {...form.register("channel")}
                  disabled={isLocked("channel")}
                  className={inputCls(isLocked("channel"))}
                >
                  <option value="offline">offline</option>
                  <option value="online">online</option>
                  <option value="package">package</option>
                </select>
              </Field>
              <Field label="유형" lockable lockOn={isLocked("type")} onLockToggle={() => toggleLock("type")}>
                <select
                  {...form.register("type")}
                  disabled={isLocked("type")}
                  className={inputCls(isLocked("type"))}
                >
                  {CATEGORY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value} ({o.label})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="한 줄 설명 (페이지 상단)" full>
                <input
                  {...form.register("shortDesc")}
                  className={inputCls(false)}
                  placeholder="페이지 상단 strip에 노출"
                />
              </Field>
              <Field label="본문 (선택)" full>
                <textarea
                  {...form.register("longDesc")}
                  className={inputCls(false) + " min-h-[80px] resize-y"}
                  placeholder="카테고리 페이지 본문 (마크다운 미지원)"
                />
              </Field>
            </div>
          </Section>

          {/* 스펙·가이드 */}
          <Section title="스펙·가이드">
            <div className="grid grid-cols-2 gap-3">
              <Field label="사이즈" lockable lockOn={isLocked("size")} onLockToggle={() => toggleLock("size")}>
                <input
                  {...form.register("size")}
                  readOnly={isLocked("size")}
                  className={inputCls(isLocked("size"))}
                />
              </Field>
              <Field label="파일 형식" lockable lockOn={isLocked("fileFormat")} onLockToggle={() => toggleLock("fileFormat")}>
                <input
                  {...form.register("fileFormat")}
                  readOnly={isLocked("fileFormat")}
                  className={inputCls(isLocked("fileFormat"))}
                />
              </Field>
              <Field label="마감일" lockable lockOn={isLocked("deadline")} onLockToggle={() => toggleLock("deadline")}>
                <input
                  type="date"
                  {...form.register("deadline")}
                  readOnly={isLocked("deadline")}
                  className={inputCls(isLocked("deadline"))}
                />
              </Field>
              <Field label="가이드 PDF" full>
                <PdfUpload
                  categoryId={id}
                  fileUrl={category.designGuideFileUrl}
                  filePath={category.designGuideFilePath}
                  onChange={async (next) => {
                    await updateDoc(doc(getDb(), "categories", id), {
                      designGuideFileUrl: next?.url ?? undefined,
                      designGuideFilePath: next?.path ?? undefined,
                      updatedAt: Timestamp.fromDate(new Date()),
                    });
                  }}
                />
              </Field>
            </div>

            <div className="mt-4">
              <div className="text-[12px] font-semibold text-ink-700 mb-2 uppercase tracking-wide">태그</div>
              {taxonomyTags.length === 0 ? (
                <div className="text-[12px] text-ink-500 bg-ink-50 rounded-btn px-3 py-2">
                  taxonomy/main 도큐먼트가 없습니다.{" "}
                  <Link href="/admin/settings/taxonomy" className="text-mint-700 font-semibold hover:underline">
                    분류·태그에서 먼저 추가하세요 →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {taxonomyTags.map((t) => {
                    const on = selectedTags.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={
                          "px-2.5 py-1 rounded-full text-[11px] border transition-colors " +
                          (on
                            ? "bg-mint-50 border-mint-500 text-mint-700 font-semibold"
                            : "bg-white border-ink-100 text-ink-700 hover:border-ink-300")
                        }
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* 이미지 슬롯 */}
          <Section title="이미지">
            <div className="space-y-3">
              <ImageSlot
                label="히어로 이미지"
                required
                storagePathPrefix={`categories/${id}/hero`}
                value={category.heroImages}
                onChange={async (next: ImageSlotType) => {
                  await updateDoc(doc(getDb(), "categories", id), {
                    heroImages: next,
                    updatedAt: Timestamp.fromDate(new Date()),
                  });
                }}
              />
              <ImageSlot
                label="디테일 이미지 (선택)"
                storagePathPrefix={`categories/${id}/detail`}
                value={category.detailImages}
                onChange={async (next: ImageSlotType) => {
                  await updateDoc(doc(getDb(), "categories", id), {
                    detailImages: next,
                    updatedAt: Timestamp.fromDate(new Date()),
                  });
                }}
              />

              {(category.type === "floor_plan" || category.type === "xpace") && (
                <div className="bg-ink-50/60 border border-ink-100 rounded-card p-4">
                  <h4 className="text-[13px] font-bold mb-3 flex items-center gap-2">
                    <span>도면 이미지 (소분류별)</span>
                    <span className="text-[10px] bg-mint-500 text-ink-900 px-1.5 py-0.5 rounded-full font-bold">
                      필수
                    </span>
                  </h4>
                  <FloorImages
                    categoryId={id}
                    subcategories={subcategories}
                    floorImages={category.floorImages}
                    onChange={async (next: FloorImage[]) => {
                      await updateDoc(doc(getDb(), "categories", id), {
                        floorImages: next,
                        updatedAt: Timestamp.fromDate(new Date()),
                      });
                    }}
                    onOpenPinEditor={(subId) => setPinEditorSubId(subId)}
                  />
                </div>
              )}
            </div>
          </Section>

          {/* 소분류·구좌 */}
          <Section title={`소분류·구좌 (${subcategories.length}개)`}>
            <SubcategoryTable
              categoryId={id}
              subcategories={subcategories}
              slots={slots}
            />
            {subcategories.length > 0 && (
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/admin/categories/${id}/slots`}
                  className="text-[13px] text-mint-700 font-semibold hover:underline"
                >
                  슬롯 마감 일괄 처리 →
                </Link>
              </div>
            )}
          </Section>

          {/* 추천·사례 */}
          <Section title="추천·이전 사례">
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={toggleFeatured}
                  className="w-4 h-4 accent-mint-500"
                />
                <div>
                  <div className="text-[13px] font-semibold text-ink-900">
                    인기 뱃지 표시
                  </div>
                  <div className="text-[11px] text-ink-500">
                    /sponsorships 카드 좌상단에 mint &quot;인기&quot; 뱃지 노출
                  </div>
                </div>
              </label>

              <hr className="border-ink-100" />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[13px] font-semibold text-ink-900">
                      이전 행사 사례
                    </div>
                    <p className="text-[11px] text-ink-500">
                      카테고리 상세 페이지 하단에 &quot;이 자리를 선택한 회사들&quot;로 노출
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      saveCaseStudies([
                        ...caseStudies,
                        { company: "", year: "", quote: "" },
                      ])
                    }
                    className="px-3 py-1.5 rounded-btn border border-ink-100 text-[12px] font-semibold hover:bg-ink-50"
                  >
                    + 추가
                  </button>
                </div>
                {caseStudies.length === 0 ? (
                  <div className="text-[12px] text-ink-500 text-center py-4 bg-ink-50 rounded-btn">
                    등록된 사례가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {caseStudies.map((cs, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_80px_2fr_auto] gap-2 items-start p-3 border border-ink-100 rounded-btn bg-white"
                      >
                        <input
                          type="text"
                          value={cs.company}
                          onChange={(e) => {
                            const next = [...caseStudies];
                            next[i] = { ...next[i], company: e.target.value };
                            saveCaseStudies(next);
                          }}
                          placeholder="회사명"
                          className="px-2.5 py-1.5 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
                        />
                        <input
                          type="text"
                          value={cs.year ?? ""}
                          onChange={(e) => {
                            const next = [...caseStudies];
                            next[i] = { ...next[i], year: e.target.value };
                            saveCaseStudies(next);
                          }}
                          placeholder="2025"
                          className="px-2.5 py-1.5 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
                        />
                        <input
                          type="text"
                          value={cs.quote ?? ""}
                          onChange={(e) => {
                            const next = [...caseStudies];
                            next[i] = { ...next[i], quote: e.target.value };
                            saveCaseStudies(next);
                          }}
                          placeholder="한 줄 후기 (선택)"
                          className="px-2.5 py-1.5 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-mint-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            saveCaseStudies(
                              caseStudies.filter((_, idx) => idx !== i)
                            )
                          }
                          className="p-1.5 text-ink-500 hover:text-red-700"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-4 sticky top-[72px]">
          <LivePreview category={category} />
          <CompletenessCheck category={category} />
        </div>
      </div>

      {pinEditorSubId && (
        <PinEditor
          open={true}
          onClose={() => setPinEditorSubId(null)}
          category={category}
          subcategoryId={pinEditorSubId}
          subcategoryName={
            subcategories.find((s) => s.id === pinEditorSubId)?.name.ko ?? ""
          }
          slots={slots.filter((s) => s.subcategoryId === pinEditorSubId)}
        />
      )}
    </div>
  );
}

function inputCls(locked: boolean): string {
  return (
    "w-full px-3 py-2 text-sm border rounded-btn focus:outline-none transition-colors " +
    (locked
      ? "border-ink-100 bg-ink-50 text-ink-700 cursor-not-allowed"
      : "border-ink-100 focus:border-mint-500 bg-white")
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  lockable,
  lockOn,
  onLockToggle,
  full,
}: {
  label: string;
  children: React.ReactNode;
  lockable?: boolean;
  lockOn?: boolean;
  onLockToggle?: () => void;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-[12px] font-semibold text-ink-700">{label}</label>
        {lockable && (
          <button
            type="button"
            onClick={onLockToggle}
            className={
              "text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors " +
              (lockOn
                ? "bg-ink-100 text-ink-700 hover:bg-ink-50"
                : "bg-mint-50 text-mint-700 hover:bg-mint-100")
            }
            title={lockOn ? "잠금 해제 (다음 임포트 때 덮어써짐)" : "잠금 (엑셀 임포트로부터 보호)"}
          >
            {lockOn ? (
              <span className="flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> 잠금
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Unlock className="w-2.5 h-2.5" /> 해제
              </span>
            )}
          </button>
        )}
      </div>
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
  if (status === "idle") {
    return <span className="text-[11px] text-ink-300">자동 저장 대기</span>;
  }
  if (status === "saving") {
    return (
      <span className="text-[11px] text-ink-500 flex items-center gap-1.5">
        <svg className="animate-spin w-3 h-3 text-mint-500" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        저장 중…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="text-[11px] text-red-700 flex items-center gap-1.5"
        title={error ?? ""}
      >
        <AlertCircle className="w-3 h-3" /> 저장 실패
      </span>
    );
  }
  return (
    <span className="text-[11px] text-mint-700 flex items-center gap-1.5">
      <Check className="w-3 h-3" /> 자동 저장 ·{" "}
      {lastSaved
        ? lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        : "—"}
    </span>
  );
}
