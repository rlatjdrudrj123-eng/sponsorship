"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  deleteField,
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
import type {
  Category,
  Package,
  Purpose,
  Slot,
  Subcategory,
  Taxonomy,
} from "@/lib/types";
import { PURPOSE_META, PURPOSE_ORDER } from "@/lib/types";
import { derivePurposes } from "@/lib/purposes";
import { LivePreview } from "@/components/admin/CategoryEditor/LivePreview";
import { CompletenessCheck } from "@/components/admin/CategoryEditor/CompletenessCheck";
import { SubcategoryTable } from "@/components/admin/CategoryEditor/SubcategoryTable";
import { ImageSlot } from "@/components/admin/CategoryEditor/ImageSlot";
import { FloorImages } from "@/components/admin/CategoryEditor/FloorImages";
import { PdfUpload } from "@/components/admin/CategoryEditor/PdfUpload";
import { PinEditor } from "@/components/admin/CategoryEditor/PinEditor";
import {
  ContentSpecForm,
  MailingSpecForm,
  VideoSpecForm,
} from "@/components/admin/CategoryEditor/TypeSpecs";
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
  size: string;
  fileFormat: string;
  deadline: string;
};

// 카테고리 유형 — 라벨에 어떤 항목들이 이 유형에 해당하는지 예시 포함.
// 어드민이 새 카테고리 만들 때 헷갈리지 않게 "이 카테고리는 어떤 유형이지?" 를 바로 판단.
const CATEGORY_TYPE_OPTIONS: Array<{
  value: Category["type"];
  label: string;
  examples: string;
  hint: string;
}> = [
  {
    value: "floor_plan",
    label: "도면형",
    examples: "천장 배너, 등록데스크, 라이팅 월, 기둥 광고",
    hint: "전시장 도면 위에 위치를 표시해서 보여주는 매체. 구좌마다 위치가 다름.",
  },
  {
    value: "quantity",
    label: "수량형",
    examples: "목걸이, 초대장 삽지, 굿즈",
    hint: "위치는 없고 '몇 개'로 측정되는 매체. 보통 1구좌 = 정해진 수량.",
  },
  {
    value: "media",
    label: "미디어형",
    examples: "경품 LED, 시상식 영상, 무대 영상",
    hint: "현장에서 영상으로 노출되는 매체. 송출 횟수·길이가 핵심 스펙.",
  },
  {
    value: "digital_banner",
    label: "디지털 배너",
    examples: "통합검색 배너, 카테고리 검색 페이지 배너",
    hint: "공식 홈페이지·앱의 디지털 영역. 노출 페이지·기간으로 구분.",
  },
  {
    value: "mailing",
    label: "발송형",
    examples: "뉴스레터, APP 푸시, 사전등록 완료 메일",
    hint: "이메일·푸시로 발송하는 매체. 발송 대상 수·발송일이 핵심.",
  },
  {
    value: "print_page",
    label: "지면형",
    examples: "쇼가이드 표지, 쇼가이드 내지 광고",
    hint: "인쇄물 지면에 들어가는 광고. 사이즈·페이지 위치가 중요.",
  },
  {
    value: "content",
    label: "콘텐츠형",
    examples: "SNS 인터뷰, 카드뉴스, 유튜브 쇼츠",
    hint: "콘텐츠 제작·발행 형태로 노출. 채널·포맷·발행 시점이 중요.",
  },
  {
    value: "xpace",
    label: "XPACE",
    examples: "옥외 LED, 외벽 브릿지 영상 광고",
    hint: "킨텍스 옥외 LED 등 도면 + 영상이 결합된 하이브리드 매체.",
  },
  {
    value: "package",
    label: "패키지",
    examples: "A to Z 패키지, 시그니처 패키지",
    hint: "여러 단품 매체를 묶어 할인된 가격으로 판매하는 상품.",
  },
];

export default function CategoryEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [taxonomyTags, setTaxonomyTags] = useState<Taxonomy["tags"]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
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

  // packages (행사별, inPackages 선택용)
  useEffect(() => {
    const evId = category?.eventId;
    if (!evId) return;
    const u = onSnapshot(
      query(collection(getDb(), "packages"), where("eventId", "==", evId)),
      (s) =>
        setAllPackages(s.docs.map((d) => ({ ...(d.data() as Package), id: d.id })))
    );
    return () => u();
  }, [category?.eventId]);

  // taxonomy (행사별)
  useEffect(() => {
    const evId = category?.eventId;
    if (!evId) return;
    const u = onSnapshot(doc(getDb(), "taxonomy", evId), (s) => {
      if (s.exists()) {
        setTaxonomyTags((s.data() as Taxonomy).tags ?? []);
      } else {
        setTaxonomyTags([]);
      }
    });
    return () => u();
  }, [category?.eventId]);

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
          className="text-brand-700 font-semibold mt-4 inline-block hover:underline"
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
              <Field
                label="이름 (한글)"
                lockable
                lockOn={isLocked("name.ko")}
                onLockToggle={() => toggleLock("name.ko")}
                where={["slide-title", "card", "modal", "pdf"]}
              >
                <input
                  {...form.register("nameKo")}
                  readOnly={isLocked("name.ko")}
                  className={inputCls(isLocked("name.ko"))}
                />
              </Field>
              <Field
                label="이름 (영문)"
                lockable
                lockOn={isLocked("name.en")}
                onLockToggle={() => toggleLock("name.en")}
                where={["slide-title", "card", "modal", "pdf"]}
                hint="언어 스위치 EN 일 때 이름 대신 표시"
              >
                <input
                  {...form.register("nameEn")}
                  readOnly={isLocked("name.en")}
                  className={inputCls(isLocked("name.en"))}
                />
              </Field>
              <Field
                label="코드"
                lockable
                lockOn={isLocked("code")}
                onLockToggle={() => toggleLock("code")}
                where={["slide-title", "modal", "pdf"]}
                hint="제목 옆 #ABC 형태"
              >
                <input
                  {...form.register("code")}
                  readOnly={isLocked("code")}
                  className={inputCls(isLocked("code")) + " font-mono"}
                />
              </Field>
              <Field label="슬러그" hint="URL 경로 (예: /sponsorships/{슬러그})">
                <input
                  {...form.register("slug")}
                  className={inputCls(false) + " font-mono"}
                />
              </Field>
              <Field
                label="채널"
                lockable
                lockOn={isLocked("channel")}
                onLockToggle={() => toggleLock("channel")}
                where={["slide-tag", "card"]}
                hint="첫 해시태그로 사용 (#오프라인 / #온라인 / #패키지)"
              >
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
                      {o.label} — {o.examples}
                    </option>
                  ))}
                </select>
                {(() => {
                  const selected = CATEGORY_TYPE_OPTIONS.find(
                    (o) => o.value === form.watch("type")
                  );
                  if (!selected) return null;
                  return (
                    <div className="mt-1.5 px-2.5 py-1.5 bg-ink-50 rounded text-[11.5px] text-ink-700 leading-relaxed">
                      <span className="font-semibold text-ink-900">
                        예: {selected.examples}
                      </span>
                      <span className="block text-ink-500 mt-0.5">
                        {selected.hint}
                      </span>
                    </div>
                  );
                })()}
              </Field>
              <Field
                label="한 줄 설명"
                full
                where={["slide-desc", "card", "modal", "pdf"]}
                hint="제목 바로 아래 한 줄. 카드·모달·PDF 에도 동일하게 노출."
              >
                <input
                  {...form.register("shortDesc")}
                  className={inputCls(false)}
                  placeholder="예: Hall A 등록데스크 — 모든 참관객이 거치는 첫 접점."
                />
              </Field>
            </div>
          </Section>

          {/* 스펙·가이드 */}
          <Section title="스펙·가이드">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="사이즈"
                lockable
                lockOn={isLocked("size")}
                onLockToggle={() => toggleLock("size")}
                where={["slide-spec", "pdf"]}
                hint="예: W 2,000mm × H 1,000mm"
              >
                <input
                  {...form.register("size")}
                  readOnly={isLocked("size")}
                  className={inputCls(isLocked("size"))}
                />
              </Field>
              <Field
                label="파일 형식"
                lockable
                lockOn={isLocked("fileFormat")}
                onLockToggle={() => toggleLock("fileFormat")}
                where={["slide-spec", "pdf"]}
                hint="예: eps, ai, pdf 등의 인쇄용 파일형태(고해상도)"
              >
                <input
                  {...form.register("fileFormat")}
                  readOnly={isLocked("fileFormat")}
                  className={inputCls(isLocked("fileFormat"))}
                />
              </Field>
              <Field
                label="마감일"
                lockable
                lockOn={isLocked("deadline")}
                onLockToggle={() => toggleLock("deadline")}
                where={["slide-spec", "pdf"]}
              >
                <input
                  type="date"
                  {...form.register("deadline")}
                  readOnly={isLocked("deadline")}
                  className={inputCls(isLocked("deadline"))}
                />
              </Field>
              <Field
                label="가이드 PDF"
                full
                where={["slide-spec", "modal"]}
                hint="슬라이드 좌측 [가이드 다운로드] 버튼이 이 PDF 로 연결됨. 용량이 크면 Drive 링크 사용 가능."
              >
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
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="text-[12px] font-semibold text-ink-700 uppercase tracking-wide">
                  태그
                </span>
                <WhereBadges where={["slide-tag", "card"]} />
                <span className="text-[11px] text-ink-500">
                  — 채널 + 앞 2개 태그가 슬라이드/카드 해시태그로 노출
                </span>
              </div>
              {taxonomyTags.length === 0 ? (
                <div className="text-[12px] text-ink-500 bg-ink-50 rounded-btn px-3 py-2">
                  이 행사의 태그가 아직 없습니다.{" "}
                  <Link href="/admin/settings/taxonomy" className="text-brand-700 font-semibold hover:underline">
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
                            ? "bg-brand-50 border-brand-500 text-brand-700 font-semibold"
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

          {/* 타입별 스펙 — 카테고리 타입에 따라 다른 폼이 노출됨 */}
          {(category.type === "media" || category.type === "xpace") && (
            <Section title="영상 스펙">
              <VideoSpecForm
                key={`v-${id}`}
                categoryId={id}
                value={category.videoSpec}
              />
            </Section>
          )}
          {category.type === "mailing" && (
            <Section title="발송 스펙">
              <MailingSpecForm
                key={`m-${id}`}
                categoryId={id}
                value={category.mailingSpec}
              />
            </Section>
          )}
          {category.type === "content" && (
            <Section title="콘텐츠 스펙">
              <ContentSpecForm
                key={`c-${id}`}
                categoryId={id}
                value={category.contentSpec}
              />
            </Section>
          )}

          {/* 이미지 슬롯 */}
          <Section title="이미지·영상">
            <div className="mb-3 flex items-center gap-1.5 flex-wrap text-[11.5px] text-ink-500">
              <WhereBadges where={["slide-hero", "card", "modal", "pdf"]} />
              <span>슬라이드 우측 메인 영역 · 카탈로그 카드 썸네일 · PDF 우측에 노출됩니다.</span>
            </div>
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

              {/* 히어로 영상 URL — 있으면 슬라이드 우측 메인이 영상으로 대체됨 */}
              <div className="bg-ink-50/60 border border-ink-100 rounded-card p-4">
                <label className="text-[13px] font-bold flex items-center gap-2">
                  히어로 영상 URL
                  <span className="text-[10px] bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded font-mono">
                    선택
                  </span>
                </label>
                <p className="text-[11.5px] text-ink-500 mt-1 leading-relaxed">
                  값이 있으면 슬라이드 우측 메인 영역에 <strong>이미지 대신 영상</strong>이 재생됩니다.
                  비워두면 히어로 이미지의 첫 장이 노출.
                  <br />
                  YouTube · Vimeo · Google Drive · Firebase Storage · 직접 mp4 등 모두 지원.
                </p>
                <input
                  type="url"
                  defaultValue={category.heroVideoUrl ?? ""}
                  onBlur={async (e) => {
                    const v = e.target.value.trim();
                    await updateDoc(doc(getDb(), "categories", id), {
                      heroVideoUrl: v ? v : deleteField(),
                      updatedAt: Timestamp.fromDate(new Date()),
                    });
                  }}
                  placeholder="https://youtube.com/watch?v=... 또는 https://...mp4"
                  className="mt-2 w-full px-3 py-2 text-sm border border-ink-100 bg-white rounded-btn focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

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
                    <span className="text-[10px] bg-brand-500 text-ink-900 px-1.5 py-0.5 rounded-full font-bold">
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
                  className="text-[13px] text-brand-700 font-semibold hover:underline"
                >
                  슬롯 마감 일괄 처리 →
                </Link>
              </div>
            )}
          </Section>

          {/* 참가업체 시점 데이터 — 사회적 증거 + 목적 매칭 + 한정 재고 + 패키지 연결 */}
          <Section title="참가업체 시점 (사이드바·카드 노출용)">
            <ParticipantViewEditor
              category={category}
              allPackages={allPackages}
              onUpdate={async (patch) => {
                await updateDoc(doc(getDb(), "categories", id), {
                  ...patch,
                  updatedAt: Timestamp.fromDate(new Date()),
                });
              }}
            />
          </Section>

          {/* 추천·사례 */}
          <Section title="추천·이전 사례">
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={toggleFeatured}
                  className="w-4 h-4 accent-brand-500"
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
                          className="px-2.5 py-1.5 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
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
                          className="px-2.5 py-1.5 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
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
                          className="px-2.5 py-1.5 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
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
      : "border-ink-100 focus:border-brand-500 bg-white")
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

// 필드별 "공개 사이트의 어디에 보이는지" 힌트. 어드민이 어떤 값을 어디서 보게 되는지 헷갈리지 않게
// 작은 배지로 표시한다. 같은 필드가 여러 곳에 노출되면 여러 개 표시.
type FieldWhere =
  | "slide-title" // 슬라이드 큰 제목
  | "slide-desc" // 슬라이드 한 줄 설명
  | "slide-tag" // 슬라이드 해시태그
  | "slide-spec" // 슬라이드 스펙 행
  | "slide-hero" // 슬라이드 우측 메인 이미지/영상
  | "slide-price" // 슬라이드 하단 가격
  | "card" // 카탈로그 카드
  | "modal" // 자세히 보기 모달
  | "pdf"; // 전체 PDF

const WHERE_LABEL: Record<FieldWhere, string> = {
  "slide-title": "슬라이드 제목",
  "slide-desc": "슬라이드 설명",
  "slide-tag": "슬라이드 해시태그",
  "slide-spec": "슬라이드 스펙",
  "slide-hero": "슬라이드 메인 이미지",
  "slide-price": "슬라이드 가격",
  card: "카탈로그 카드",
  modal: "자세히 모달",
  pdf: "PDF 다운로드",
};

function WhereBadges({ where }: { where?: FieldWhere[] }) {
  if (!where || where.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {where.map((w) => (
        <span
          key={w}
          className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 leading-none"
          title={`공개 사이트 노출: ${WHERE_LABEL[w]}`}
        >
          → {WHERE_LABEL[w]}
        </span>
      ))}
    </span>
  );
}

function Field({
  label,
  children,
  lockable,
  lockOn,
  onLockToggle,
  full,
  where,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  lockable?: boolean;
  lockOn?: boolean;
  onLockToggle?: () => void;
  full?: boolean;
  /** 공개 사이트에서 이 필드가 어디에 보이는지 */
  where?: FieldWhere[];
  /** 보조 설명 */
  hint?: string;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <label className="text-[12px] font-semibold text-ink-700">{label}</label>
        {lockable && (
          <button
            type="button"
            onClick={onLockToggle}
            className={
              "text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors " +
              (lockOn
                ? "bg-ink-100 text-ink-700 hover:bg-ink-50"
                : "bg-brand-50 text-brand-700 hover:bg-brand-100")
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
        <WhereBadges where={where} />
      </div>
      {hint && (
        <p className="text-[11px] text-ink-500 mb-1 leading-relaxed">{hint}</p>
      )}
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
      <span
        className="text-[11px] text-red-700 flex items-center gap-1.5"
        title={error ?? ""}
      >
        <AlertCircle className="w-3 h-3" /> 저장 실패
      </span>
    );
  }
  return (
    <span className="text-[11px] text-brand-700 flex items-center gap-1.5">
      <Check className="w-3 h-3" /> 자동 저장 ·{" "}
      {lastSaved
        ? lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        : "—"}
    </span>
  );
}

// ============================================================================
// ParticipantViewEditor — 참가업체 시점 데이터 편집
// ============================================================================

function ParticipantViewEditor({
  category,
  allPackages,
  onUpdate,
}: {
  category: Category;
  allPackages: Package[];
  onUpdate: (patch: Partial<Category>) => Promise<void>;
}) {
  const purposeOverride = category.purposeOverride;
  const derived = derivePurposes(category);
  const usingOverride = !!(purposeOverride && purposeOverride.length > 0);

  const togglePurpose = (p: Purpose) => {
    const current = purposeOverride ?? derived;
    const next = current.includes(p)
      ? current.filter((x) => x !== p)
      : [...current, p];
    onUpdate({ purposeOverride: next });
  };

  const lastYear = category.lastYear ?? {};
  const buyers = lastYear.buyers ?? [];

  const inPackages = category.inPackages ?? [];

  return (
    <div className="space-y-6 text-[13px]">
      {/* 광고 목적 (참가업체 사이드바 필터) */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="text-[13px] font-semibold text-ink-900">
              광고 목적 (사이드바 필터·페르소나 매칭)
            </div>
            <p className="text-[11px] text-ink-500 mt-0.5">
              참가업체 시점에서 이 카테고리가 어떤 목적에 맞는지. 비워두면 휴리스틱
              자동 추정. 직접 토글하면 그게 우선.
            </p>
          </div>
          {usingOverride && (
            <button
              type="button"
              onClick={() => onUpdate({ purposeOverride: undefined })}
              className="text-[10px] text-ink-500 hover:text-ink-900 font-semibold"
              title="자동 추정으로 되돌리기"
            >
              ↺ 자동
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PURPOSE_ORDER.map((p) => {
            const active = (purposeOverride ?? derived).includes(p);
            const wasDerived = derived.includes(p) && !usingOverride;
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePurpose(p)}
                className={
                  "text-left px-3 py-2 rounded-btn border-2 transition-colors " +
                  (active
                    ? "border-brand-500 bg-brand-50"
                    : "border-ink-100 bg-white hover:border-ink-300")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-bold text-ink-900">
                    {PURPOSE_META[p].ko}
                  </span>
                  {wasDerived && (
                    <span className="text-[9px] text-ink-500 font-mono">
                      auto
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-ink-500 mt-0.5 leading-snug">
                  {PURPOSE_META[p].desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-ink-100" />

      {/* 작년 데이터 — 사회적 증거 */}
      <div>
        <div className="text-[13px] font-semibold text-ink-900 mb-1">
          작년 데이터 (카드·Compare 페이지 노출)
        </div>
        <p className="text-[11px] text-ink-500 mb-3">
          참가업체에게 가장 강한 확신을 주는 데이터. 빈 값이면 안 보임.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">
              매진 시점
            </label>
            <input
              type="text"
              defaultValue={lastYear.soldOutDate ?? ""}
              onBlur={(e) =>
                onUpdate({
                  lastYear: {
                    ...lastYear,
                    soldOutDate: e.target.value.trim() || undefined,
                  },
                })
              }
              placeholder="2025-01-15  또는  D-45"
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white font-mono text-[12px]"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">
              ROI / 효과 메모
            </label>
            <input
              type="text"
              defaultValue={lastYear.avgRoiNote ?? ""}
              onBlur={(e) =>
                onUpdate({
                  lastYear: {
                    ...lastYear,
                    avgRoiNote: e.target.value.trim() || undefined,
                  },
                })
              }
              placeholder="부스 방문 +27%  또는  리드 평균 30건"
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">
            작년 구매 회사 (콤마로 구분)
          </label>
          <textarea
            defaultValue={buyers.join(", ")}
            onBlur={(e) => {
              const arr = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onUpdate({
                lastYear: {
                  ...lastYear,
                  buyers: arr.length > 0 ? arr : undefined,
                },
              });
            }}
            placeholder="A사, B사, C사"
            className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white resize-y min-h-[60px]"
          />
          {buyers.length > 0 && (
            <p className="text-[11px] text-ink-500 mt-1">
              저장된 {buyers.length}곳: {buyers.slice(0, 5).join(", ")}
              {buyers.length > 5 ? ` 외 ${buyers.length - 5}곳` : ""}
            </p>
          )}
        </div>
      </div>

      <hr className="border-ink-100" />

      {/* 한정 재고 메모 */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">
          한정 재고 메모 (카드 좌하단 검은 pill)
        </label>
        <p className="text-[11px] text-ink-500 mb-2">
          자유 텍스트. 예: &quot;시그니처 단독 1자리&quot; 또는 &quot;5사 한정&quot;.
          비워두면 자동 잔여 N자리 (≤3) 만 표시.
        </p>
        <input
          type="text"
          defaultValue={category.inventoryNote ?? ""}
          onBlur={(e) =>
            onUpdate({
              inventoryNote: e.target.value.trim() || undefined,
            })
          }
          placeholder="예: 단독 1자리"
          className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
        />
      </div>

      <hr className="border-ink-100" />

      {/* inPackages 크로스 표시 */}
      <div>
        <div className="text-[13px] font-semibold text-ink-900 mb-1">
          이 카테고리를 포함하는 패키지
        </div>
        <p className="text-[11px] text-ink-500 mb-3">
          슬롯·카드에 &quot;이 패키지에 포함됨&quot; 크로스 라벨 노출. 패키지 매력 살리기용.
        </p>
        {allPackages.length === 0 ? (
          <div className="text-[12px] text-ink-500 bg-ink-50 rounded-btn px-3 py-2.5">
            이 행사에 등록된 패키지가 없습니다.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allPackages.map((pkg) => {
              const on = inPackages.includes(pkg.id);
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => {
                    const next = on
                      ? inPackages.filter((x) => x !== pkg.id)
                      : [...inPackages, pkg.id];
                    onUpdate({ inPackages: next });
                  }}
                  className={
                    "px-2.5 py-1 rounded-full text-[11px] border transition-colors " +
                    (on
                      ? "bg-brand-50 border-brand-500 text-brand-700 font-semibold"
                      : "bg-white border-ink-100 text-ink-700 hover:border-ink-300")
                  }
                  title={pkg.code}
                >
                  {pkg.tier === "signature" ? "★ " : ""}
                  {pkg.name.ko}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
