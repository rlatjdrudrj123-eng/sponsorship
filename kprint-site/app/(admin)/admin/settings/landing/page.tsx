"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  FileDown,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { useEventFilter } from "@/lib/admin/useEventFilter";
import type {
  LandingBlock,
  LandingBlockType,
  SiteSettings,
} from "@/lib/types";
import {
  BLOCK_TYPE_META,
  buildDefaultBlocks,
  emptyBlock,
} from "@/components/public/landing/defaults";
import { BlockEditor } from "./BlockEditor";
import { MultiArtboardEditor } from "./canvas/MultiArtboardEditor";

/**
 * 랜딩 빌더 — settings.landing 의 블록 배열을 추가/삭제/순서/인라인 편집.
 */
export default function LandingBuilderPage() {
  const { eventId, ready } = useEventFilter();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [blocks, setBlocks] = useState<LandingBlock[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [adderOpen, setAdderOpen] = useState(false);
  // 비-캔버스 블록 추가 시 BlockAdderModal 의 필터 — true 면 캔버스 제외
  const [adderNonCanvasOnly, setAdderNonCanvasOnly] = useState(false);
  // 비-캔버스 블록 편집 모달 — null 이면 닫힘
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  // ko/en 탭 — 한국어 페이지(/[eventSlug]) vs 영문 페이지(/[eventSlug]/en) 각각 별도 편집
  const [editingLocale, setEditingLocale] = useState<"ko" | "en">("ko");

  // settings 만 onSnapshot 으로 받고, 표시될 blocks 는 editingLocale 에 따라 분기.
  // locale 탭 전환 시 즉시 새 데이터로 갱신.
  useEffect(() => {
    if (!ready || !eventId) return;
    setLoaded(false);
    const unsub = onSnapshot(
      doc(getDb(), "siteSettings", eventId),
      (snap) => {
        setLoaded(true);
        if (snap.exists()) setSettings(snap.data() as SiteSettings);
        else setSettings(null);
      },
      () => setLoaded(true)
    );
    return unsub;
  }, [ready, eventId]);

  // settings 변경 / locale 탭 전환 시 blocks 재동기화. setBlocks 후 사용자 편집은
  // 즉시 persist 로 Firestore 에 반영되므로 외부 변경 충돌 우려 없음.
  useEffect(() => {
    if (!settings) {
      setBlocks([]);
      return;
    }
    const src = editingLocale === "en" ? settings.landingEn : settings.landing;
    setBlocks(src ?? []);
    setEditingBlockIdx(null);
  }, [settings, editingLocale]);

  const persist = async (next: LandingBlock[]) => {
    if (!eventId) return;
    setSaveStatus("saving");
    try {
      const fieldName = editingLocale === "en" ? "landingEn" : "landing";
      await setDoc(
        doc(getDb(), "siteSettings", eventId),
        {
          eventId,
          [fieldName]: next,
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setSaveStatus("error");
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const addBlock = async (type: LandingBlockType) => {
    const b = emptyBlock(type);
    const next = [...blocks, b];
    setBlocks(next);
    setAdderOpen(false);
    // 캔버스 블록은 대지에서 즉시 보이므로 자동 편집 모달 안 띄움.
    // 비-캔버스(데이터) 블록은 편집 모달 자동 오픈.
    if (type !== "canvasPage") {
      setEditingBlockIdx(next.length - 1);
    }
    await persist(next);
  };

  const updateBlock = async (idx: number, patch: LandingBlock) => {
    const next = blocks.map((b, i) => (i === idx ? patch : b));
    setBlocks(next);
    await persist(next);
  };

  const removeBlock = async (idx: number) => {
    if (!confirm("이 블록을 삭제할까요?")) return;
    const next = blocks.filter((_, i) => i !== idx);
    setBlocks(next);
    if (editingBlockIdx === idx) setEditingBlockIdx(null);
    await persist(next);
  };

  const moveBlock = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    setBlocks(next);
    if (editingBlockIdx === idx) setEditingBlockIdx(target);
    await persist(next);
  };

  const seedDefault = async () => {
    if (
      blocks.length > 0 &&
      !confirm(
        `현재 ${blocks.length}개 블록을 모두 지우고 기본 시퀀스로 새로 채울까요?`
      )
    )
      return;
    const next = buildDefaultBlocks(settings);
    setBlocks(next);
    await persist(next);
  };

  // 한국어 → 영문 (또는 영문 → 한국어) 시퀀스 깊은 복사.
  // 두 언어 페이지가 동일 레이아웃을 공유할 때 유용. 복사 후 어드민이 텍스트만
  // 영문(또는 한글) 으로 바꿔 편집. 기존 시퀀스가 있으면 덮어쓰기 confirm.
  const copyFromOtherLocale = async () => {
    const sourceLocale = editingLocale === "en" ? "ko" : "en";
    const source =
      sourceLocale === "ko" ? settings?.landing : settings?.landingEn;
    if (!source || source.length === 0) {
      alert(
        `${sourceLocale === "ko" ? "한국어" : "영문"} 시퀀스가 비어있어 복사할 게 없어요.`
      );
      return;
    }
    if (
      blocks.length > 0 &&
      !confirm(
        `현재 ${
          editingLocale === "en" ? "영문" : "한국어"
        } 시퀀스(${blocks.length}개 블록)를 모두 지우고 ${
          sourceLocale === "ko" ? "한국어" : "영문"
        }(${source.length}개 블록)을 그대로 복사할까요?`
      )
    )
      return;
    // JSON 깊은 복사 — Date/Timestamp 가 블록 데이터에 없다고 가정 (LandingBlock 은 직렬화 가능)
    const next = JSON.parse(JSON.stringify(source)) as LandingBlock[];
    setBlocks(next);
    await persist(next);
  };

  if (!ready) {
    return (
      <div className="text-sm text-ink-500 text-center py-16">
        행사 정보 불러오는 중…
      </div>
    );
  }
  if (!eventId) {
    return (
      <div className="text-sm text-ink-500 text-center py-16">
        상단 셀렉터에서 행사를 먼저 선택하세요.
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-ink-500 mb-1">
            <Link
              href="/admin/settings"
              className="hover:text-ink-900 flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              사이트 설정
            </Link>
            <span>/</span>
            <span>메인 페이지 디자인</span>
          </div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
            메인 페이지 디자인
          </h1>
          <p className="text-[13px] text-ink-700 mt-1 max-w-2xl">
            행사 메인 페이지(/{eventId})를 블록 단위로 자유 구성합니다. 각 블록은
            한 화면 슬라이드. 행사 브랜드 컬러가 자동 적용됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveBadge status={saveStatus} />
          {/* 언어 탭 — 한국어 / 영문 페이지 각각 별도 디자인 */}
          <div className="flex items-center bg-ink-100 rounded-btn p-0.5">
            <button
              type="button"
              onClick={() => setEditingLocale("ko")}
              className={
                "px-3 py-1.5 rounded text-[12.5px] font-semibold transition-colors " +
                (editingLocale === "ko"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-900")
              }
              title="/[eventSlug] 한국어 페이지"
            >
              🇰🇷 한국어
            </button>
            <button
              type="button"
              onClick={() => setEditingLocale("en")}
              className={
                "px-3 py-1.5 rounded text-[12.5px] font-semibold transition-colors " +
                (editingLocale === "en"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-900")
              }
              title="/[eventSlug]/en 영문 페이지"
            >
              🇬🇧 영문
            </button>
          </div>
          <Link
            href={`/${eventId}${editingLocale === "en" ? "/en" : ""}`}
            target="_blank"
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            미리보기 열기
          </Link>
          <Link
            href={`/${eventId}/landing/print`}
            target="_blank"
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-[12.5px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5"
            title="현재 랜딩 시퀀스를 PDF로 출력"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF 출력
          </Link>
          <button
            type="button"
            onClick={copyFromOtherLocale}
            className="px-3.5 py-2 rounded-btn border border-ink-200 bg-white text-[12.5px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5"
            title={
              editingLocale === "en"
                ? "한국어 시퀀스를 영문으로 그대로 복사 (디자인 동일, 텍스트만 영문으로 수정)"
                : "영문 시퀀스를 한국어로 그대로 복사"
            }
          >
            {editingLocale === "en" ? "🇰🇷 → 🇬🇧" : "🇬🇧 → 🇰🇷"} 불러오기
          </button>
          <button
            type="button"
            onClick={seedDefault}
            className="px-3.5 py-2 rounded-btn border border-mint-200 bg-mint-50 text-[12.5px] font-semibold text-mint-700 hover:bg-mint-100 flex items-center gap-1.5"
            style={{
              borderColor: "#FFC7C9",
              background: "#FEE9EA",
              color: "#AA0008",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            기본값으로 채우기
          </button>
        </div>
      </header>

      {/* 비-캔버스(데이터) 블록 strip — 캔버스 슬라이드와 같은 시퀀스의 일부지만
          시각적 캔버스가 없어 대지에는 표시 안 됨. 따로 카드로 노출. */}
      <NonCanvasBlockStrip
        blocks={blocks}
        onEditAt={(i) => setEditingBlockIdx(i)}
        onMove={(i, dir) => void moveBlock(i, dir)}
        onRemove={(i) => void removeBlock(i)}
        onAdd={() => {
          setAdderNonCanvasOnly(true);
          setAdderOpen(true);
        }}
      />

      {/* 대지 — 캔버스 슬라이드. + 새 아트보드 = 캔버스 페이지 추가. */}
      <div className="bg-white border border-ink-100 rounded-card overflow-hidden h-[calc(100vh-260px)] min-h-[560px]">
        <MultiArtboardEditor
          pages={blocks
            .map((b, blockIdx) =>
              b.type === "canvasPage"
                ? { blockId: b.id, page: b.data.page, blockIdx }
                : null
            )
            .filter(
              (
                x
              ): x is {
                blockId: string;
                page: import("@/lib/types").CanvasPage;
                blockIdx: number;
              } => x !== null
            )}
          onUpdatePage={(idx, page) => {
            const canvasIndices = blocks
              .map((b, i) => (b.type === "canvasPage" ? i : -1))
              .filter((i) => i >= 0);
            const blockIdx = canvasIndices[idx];
            const b = blocks[blockIdx];
            if (b?.type !== "canvasPage") return;
            void updateBlock(blockIdx, { ...b, data: { page } });
          }}
          onAddPage={() => {
            const b = emptyBlock("canvasPage");
            const next = [...blocks, b];
            setBlocks(next);
            void persist(next);
          }}
          onRemovePage={(idx) => {
            const canvasIndices = blocks
              .map((b, i) => (b.type === "canvasPage" ? i : -1))
              .filter((i) => i >= 0);
            const blockIdx = canvasIndices[idx];
            if (blockIdx < 0) return;
            if (!confirm("이 아트보드를 삭제할까요?")) return;
            const next = blocks.filter((_, i) => i !== blockIdx);
            setBlocks(next);
            void persist(next);
          }}
          onMovePage={(from, to) => {
            const canvasIndices = blocks
              .map((b, i) => (b.type === "canvasPage" ? i : -1))
              .filter((i) => i >= 0);
            const fromBlockIdx = canvasIndices[from];
            const toBlockIdx = canvasIndices[to];
            if (fromBlockIdx < 0 || toBlockIdx < 0) return;
            const next = [...blocks];
            const [moved] = next.splice(fromBlockIdx, 1);
            next.splice(toBlockIdx, 0, moved);
            setBlocks(next);
            void persist(next);
          }}
        />
      </div>

      {/* 비-캔버스 블록 편집 모달 */}
      {editingBlockIdx !== null &&
        editingBlockIdx >= 0 &&
        editingBlockIdx < blocks.length &&
        blocks[editingBlockIdx].type !== "canvasPage" && (
          <div
            className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[1px] flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setEditingBlockIdx(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl mt-10 mb-10"
            >
              <BlockEditor
                block={blocks[editingBlockIdx]}
                onChange={(b) => updateBlock(editingBlockIdx, b)}
                onRemove={() => {
                  removeBlock(editingBlockIdx);
                  setEditingBlockIdx(null);
                }}
                indexLabel={`${editingBlockIdx + 1} / ${blocks.length}`}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingBlockIdx(null)}
                  className="px-4 py-2 rounded-btn bg-ink-900 text-white text-[12.5px] font-bold hover:bg-brand-500"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

      {adderOpen && (
        <BlockAdderModal
          nonCanvasOnly={adderNonCanvasOnly}
          onClose={() => {
            setAdderOpen(false);
            setAdderNonCanvasOnly(false);
          }}
          onPick={(t) => {
            void addBlock(t);
            setAdderNonCanvasOnly(false);
          }}
        />
      )}
    </div>
  );
}

function blockPreview(b: LandingBlock): string {
  switch (b.type) {
    case "cover":
      return b.data.title || "(제목 없음)";
    case "stats3year":
    case "adGoals4":
    case "benefits4":
    case "steps4":
      return b.data.headline || "(헤드라인 없음)";
    case "textHero":
      return b.data.lines?.[0] ?? "";
    case "bigStat":
      return `${b.data.value ?? ""} ${b.data.label ?? ""}`.trim();
    case "cta":
      return b.data.lines?.[0] ?? "";
    case "image":
      return b.data.url ? b.data.url.slice(0, 40) + "…" : "(이미지 미설정)";
    case "richText":
      return (b.data.headline || b.data.body || "").slice(0, 40);
    case "twoColumn":
      return b.data.left.headline || b.data.right.headline || "2-컬럼";
    case "imageGrid":
      return `${b.data.images.length}장 / ${b.data.columns}열`;
    case "divider":
      return b.data.label || "구분선";
    case "spacer":
      return `여백 (${b.data.size})`;
    case "buttonRow":
      return b.data.headline || `버튼 ${b.data.buttons.length}개`;
    case "videoEmbed":
      return b.data.headline || b.data.url || "(동영상 미설정)";
    case "customHtml":
      return (b.data.html || "").replace(/<[^>]+>/g, "").slice(0, 40) || "HTML";
    case "slotsTeaser":
      return b.data.headline || `슬롯 ${b.data.categorySlugs?.length ?? 0}개`;
    case "canvasPage":
      return (
        b.data.page.name ||
        `캔버스 (노드 ${b.data.page.nodes.length}개)`
      );
    case "pdfDownload":
      return b.data.headline || b.data.buttonLabel || "전체 PDF 다운로드";
  }
}

function BlockAdderModal({
  onClose,
  onPick,
  nonCanvasOnly = false,
}: {
  onClose: () => void;
  onPick: (t: LandingBlockType) => void;
  nonCanvasOnly?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-card shadow-2xl overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink-900">
            {nonCanvasOnly ? "데이터 블록 추가" : "블록 추가"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-btn hover:bg-ink-50 text-ink-500"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(BLOCK_TYPE_META) as LandingBlockType[])
            .filter((t) => !BLOCK_TYPE_META[t].hidden)
            .filter((t) => (nonCanvasOnly ? t !== "canvasPage" : true))
            .map((t) => {
              const meta = BLOCK_TYPE_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onPick(t)}
                  className="text-left p-3.5 rounded-btn border-2 border-brand-500 hover:bg-brand-50 transition-colors"
                >
                  <div className="text-[13.5px] font-bold text-ink-900">
                    {meta.label}
                  </div>
                  <div className="text-[11.5px] text-ink-500 mt-0.5">
                    {meta.desc}
                  </div>
                </button>
              );
            })}
        </div>
        <div className="px-5 pb-4 text-[10.5px] text-ink-500 leading-snug border-t border-ink-100 pt-3">
          💡 모든 콘텐츠는 캔버스 페이지 안에서 자유 배치합니다. 이전 버전의 단일
          블록(Cover, 통계, 혜택 등)은 캔버스 안에서 <strong>컴포넌트</strong>로 추가하세요.
        </div>
      </div>
    </div>
  );
}

/**
 * 비-캔버스 (데이터) 블록 strip — cover/stats/benefits/PDF 다운로드 등 시각 캔버스가
 * 없는 블록들. 대지 뷰에는 안 나오지만 시퀀스의 일부. 카드로 노출 + 편집·이동·삭제.
 */
function NonCanvasBlockStrip({
  blocks,
  onEditAt,
  onMove,
  onRemove,
  onAdd,
}: {
  blocks: LandingBlock[];
  onEditAt: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  const dataBlocks = useMemo(
    () =>
      blocks
        .map((b, i) => ({ block: b, blockIdx: i }))
        .filter(({ block }) => block.type !== "canvasPage"),
    [blocks]
  );

  if (dataBlocks.length === 0) {
    return (
      <div className="bg-white border border-dashed border-ink-200 rounded-card px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11.5px] text-ink-500">
          데이터 블록(통계·혜택·PDF 다운로드 등) 이 없습니다. 캔버스 슬라이드 외에
          추가할 수 있어요.
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-btn text-[12px] font-bold text-brand-700 hover:bg-brand-50 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> 데이터 블록 추가
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-ink-100 rounded-card p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10.5px] uppercase tracking-wider font-bold text-ink-700">
          데이터 블록 ({dataBlocks.length})
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="text-[11.5px] font-bold text-brand-700 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> 추가
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dataBlocks.map(({ block, blockIdx }, listIdx) => {
          const meta = BLOCK_TYPE_META[block.type];
          return (
            <div
              key={block.id}
              className="shrink-0 w-[200px] bg-canvas border border-ink-100 rounded-btn p-2.5 flex flex-col gap-1.5"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-ink-500">
                    {String(blockIdx + 1).padStart(2, "0")} · {meta.label}
                  </div>
                  <div className="text-[12px] font-semibold text-ink-900 truncate mt-0.5">
                    {blockPreview(block)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onEditAt(blockIdx)}
                  className="px-2 py-1 rounded text-[10.5px] font-bold text-brand-700 hover:bg-brand-50 flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> 편집
                </button>
                <button
                  type="button"
                  onClick={() => onMove(blockIdx, -1)}
                  disabled={listIdx === 0}
                  className="w-6 h-6 grid place-items-center rounded text-ink-500 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-30"
                  title="앞으로"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(blockIdx, 1)}
                  disabled={listIdx === dataBlocks.length - 1}
                  className="w-6 h-6 grid place-items-center rounded text-ink-500 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-30"
                  title="뒤로"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(blockIdx)}
                  className="ml-auto w-6 h-6 grid place-items-center rounded text-ink-500 hover:text-red-700 hover:bg-red-50"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SaveBadge({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  if (status === "saving") {
    return <span className="text-[11px] text-ink-500">저장 중…</span>;
  }
  if (status === "saved") {
    return (
      <span className="text-[11px] text-mint-700 font-semibold">✓ 저장됨</span>
    );
  }
  if (status === "error") {
    return <span className="text-[11px] text-red-700">저장 실패</span>;
  }
  return null;
}
