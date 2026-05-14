"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  FileDown,
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"blocks" | "artboard">("blocks");
  const initRef = useRef(false);

  useEffect(() => {
    if (!ready || !eventId) return;
    initRef.current = false;
    setLoaded(false);
    const unsub = onSnapshot(
      doc(getDb(), "siteSettings", eventId),
      (snap) => {
        setLoaded(true);
        if (initRef.current) return;
        if (snap.exists()) {
          const data = snap.data() as SiteSettings;
          setSettings(data);
          setBlocks(data.landing ?? []);
        } else {
          setSettings(null);
          setBlocks([]);
        }
        initRef.current = true;
      },
      () => setLoaded(true)
    );
    return unsub;
  }, [ready, eventId]);

  const persist = async (next: LandingBlock[]) => {
    if (!eventId) return;
    setSaveStatus("saving");
    try {
      await setDoc(
        doc(getDb(), "siteSettings", eventId),
        {
          eventId,
          landing: next,
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
    setSelectedIndex(next.length - 1);
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
    if (selectedIndex === idx) setSelectedIndex(null);
    await persist(next);
  };

  const moveBlock = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    setBlocks(next);
    if (selectedIndex === idx) setSelectedIndex(target);
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
            <span>랜딩 빌더</span>
          </div>
          <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
            랜딩 빌더
          </h1>
          <p className="text-[13px] text-ink-700 mt-1 max-w-2xl">
            행사 메인 페이지(/{eventId})를 블록 단위로 자유 구성합니다. 각 블록은
            한 화면 슬라이드. KIMES 톤이 자동 적용됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveBadge status={saveStatus} />
          {/* 보기 모드 토글 — 블록 / 대지 */}
          <div className="flex items-center bg-ink-100 rounded-btn p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("blocks")}
              className={
                "px-3 py-1.5 rounded text-[12.5px] font-semibold transition-colors " +
                (viewMode === "blocks"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-900")
              }
            >
              블록 리스트
            </button>
            <button
              type="button"
              onClick={() => setViewMode("artboard")}
              className={
                "px-3 py-1.5 rounded text-[12.5px] font-semibold transition-colors " +
                (viewMode === "artboard"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-900")
              }
            >
              대지 (모든 슬라이드)
            </button>
          </div>
          <Link
            href={`/${eventId}`}
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

      {viewMode === "artboard" ? (
        <div className="bg-white border border-ink-100 rounded-card overflow-hidden h-[calc(100vh-180px)] min-h-[640px]">
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
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* 좌측 — 블록 리스트 */}
        <aside className="space-y-2">
          <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-ink-100 text-[11px] uppercase tracking-wide font-bold text-ink-700 flex items-center justify-between">
              <span>블록 {blocks.length}개</span>
            </div>
            {blocks.length === 0 ? (
              <div className="px-3.5 py-8 text-center">
                <p className="text-[12.5px] text-ink-500 mb-3">
                  아직 블록이 없습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setAdderOpen(true)}
                  className="text-[12.5px] text-mint-700 font-semibold hover:underline"
                  style={{ color: "#AA0008" }}
                >
                  첫 블록 추가하기 →
                </button>
              </div>
            ) : (
              <ul>
                {blocks.map((b, i) => {
                  const meta = BLOCK_TYPE_META[b.type];
                  const active = selectedIndex === i;
                  return (
                    <li
                      key={b.id}
                      className={
                        "border-b border-ink-100 last:border-b-0 " +
                        (active ? "bg-mint-50" : "")
                      }
                      style={active ? { background: "#FEE9EA" } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedIndex(i)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-ink-50 flex items-start gap-2"
                      >
                        <span className="text-[10px] font-mono text-ink-500 w-5 shrink-0 mt-0.5 text-right">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-ink-900 truncate">
                            {meta.label}
                          </span>
                          <span className="block text-[11px] text-ink-500 truncate">
                            {blockPreview(b)}
                          </span>
                        </span>
                      </button>
                      <div className="px-2 pb-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveBlock(i, -1)}
                          disabled={i === 0}
                          className="w-7 h-6 grid place-items-center rounded text-ink-500 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-30"
                          title="위로"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(i, 1)}
                          disabled={i === blocks.length - 1}
                          className="w-7 h-6 grid place-items-center rounded text-ink-500 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-30"
                          title="아래로"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(i)}
                          className="ml-auto w-7 h-6 grid place-items-center rounded text-ink-500 hover:text-red-700 hover:bg-red-50"
                          title="삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="p-2 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setAdderOpen(true)}
                className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[12.5px] text-ink-500 hover:border-ink-900 hover:text-ink-900 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                블록 추가
              </button>
            </div>
          </div>
        </aside>

        {/* 우측 — 편집 패널 */}
        <section>
          {selectedIndex === null ||
          selectedIndex < 0 ||
          selectedIndex >= blocks.length ? (
            <div className="bg-white border border-ink-100 rounded-card py-20 text-center">
              <p className="text-[14px] text-ink-700 font-semibold">
                왼쪽에서 블록을 선택하세요.
              </p>
              <p className="text-[12px] text-ink-500 mt-2">
                또는 [블록 추가]로 새 블록을 만들 수 있어요.
              </p>
            </div>
          ) : (
            <BlockEditor
              block={blocks[selectedIndex]}
              onChange={(b) => updateBlock(selectedIndex, b)}
              onRemove={() => removeBlock(selectedIndex)}
              indexLabel={`${selectedIndex + 1} / ${blocks.length}`}
            />
          )}
        </section>
      </div>
      )}

      {adderOpen && (
        <BlockAdderModal
          onClose={() => setAdderOpen(false)}
          onPick={addBlock}
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
  }
}

function BlockAdderModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (t: LandingBlockType) => void;
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
          <h2 className="text-[16px] font-bold text-ink-900">블록 추가</h2>
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
