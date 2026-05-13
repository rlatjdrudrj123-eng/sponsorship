"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  MousePointer,
  Square,
  TextCursorInput,
  Trash2,
  Video,
} from "lucide-react";
import type {
  CanvasNode,
  CanvasNodeType,
  CanvasPage,
  CanvasTextNode,
} from "@/lib/types";

// CanvasTextNode 는 TextNodeInspector 시그니처에서 직접 쓰임 (아래)

/**
 * 1920×1080 캔버스 자유 배치 에디터.
 *
 * - 좌측 툴바: 노드 추가
 * - 중앙 캔버스: 드래그/리사이즈/선택, 화면 폭에 맞춰 scale
 * - 우측 인스펙터: 선택된 노드의 속성 편집 + 모바일 reflow 옵션
 */

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const GRID = 8;

export function CanvasEditor({
  page,
  onChange,
}: {
  page: CanvasPage;
  onChange: (next: CanvasPage) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1); // 사용자 zoom 제어 (1 = fit)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.5);

  // 부모 폭에 맞춰 fit scale 계산
  useEffect(() => {
    const update = () => {
      const w = wrapRef.current?.clientWidth ?? 800;
      const s = Math.min(1, (w - 40) / CANVAS_W);
      setFitScale(s);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scale = fitScale * zoom;

  const selected =
    page.nodes.find((n) => n.id === selectedId) ?? null;

  // 노드 패치
  const updateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      onChange({
        ...page,
        nodes: page.nodes.map((n) =>
          n.id === id ? ({ ...n, ...patch } as CanvasNode) : n
        ),
      });
    },
    [page, onChange]
  );

  const updateNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      onChange({
        ...page,
        nodes: page.nodes.map((n) =>
          n.id === id
            ? ({
                ...n,
                data: { ...(n.data as object), ...patch },
              } as CanvasNode)
            : n
        ),
      });
    },
    [page, onChange]
  );

  const addNode = (type: CanvasNodeType) => {
    const n = makeNode(type);
    onChange({ ...page, nodes: [...page.nodes, n] });
    setSelectedId(n.id);
  };

  const deleteNode = (id: string) => {
    onChange({ ...page, nodes: page.nodes.filter((n) => n.id !== id) });
    setSelectedId(null);
  };

  const duplicateNode = (id: string) => {
    const n = page.nodes.find((nn) => nn.id === id);
    if (!n) return;
    const copy: CanvasNode = {
      ...n,
      id: randomId(),
      rect: { ...n.rect, x: n.rect.x + 20, y: n.rect.y + 20 },
    };
    onChange({ ...page, nodes: [...page.nodes, copy] });
    setSelectedId(copy.id);
  };

  // 키보드 — Delete 키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        (e.target as HTMLElement)?.tagName !== "INPUT" &&
        (e.target as HTMLElement)?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        deleteNode(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, page]);

  return (
    <div className="grid grid-cols-[180px_1fr_300px] gap-3 h-[calc(100vh-200px)] min-h-[600px]">
      {/* 좌측 — 노드 추가 툴바 */}
      <aside className="bg-white border border-ink-100 rounded-card overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-ink-100 text-[11px] uppercase tracking-wide font-bold text-ink-700">
          노드 추가
        </div>
        <div className="p-2 grid grid-cols-2 gap-1">
          <ToolButton
            icon={<TextCursorInput className="w-4 h-4" />}
            label="텍스트"
            onClick={() => addNode("text")}
          />
          <ToolButton
            icon={<ImageIcon className="w-4 h-4" />}
            label="이미지"
            onClick={() => addNode("image")}
          />
          <ToolButton
            icon={<Square className="w-4 h-4" />}
            label="도형"
            onClick={() => addNode("shape")}
          />
          <ToolButton
            icon={<MousePointer className="w-4 h-4" />}
            label="버튼"
            onClick={() => addNode("button")}
          />
          <ToolButton
            icon={<Video className="w-4 h-4" />}
            label="동영상"
            onClick={() => addNode("video")}
          />
        </div>

        <div className="px-3 py-2 border-t border-ink-100 mt-auto">
          <div className="text-[11px] uppercase tracking-wide font-bold text-ink-700 mb-1.5">
            노드 {page.nodes.length}개
          </div>
          <div className="text-[10.5px] text-ink-500 leading-snug">
            클릭=선택 · 드래그=이동 · 모서리=리사이즈 · Delete=삭제
          </div>
        </div>
      </aside>

      {/* 중앙 — 캔버스 */}
      <div
        ref={wrapRef}
        className="bg-ink-50 border border-ink-100 rounded-card overflow-auto relative"
      >
        {/* 상단 컨트롤 */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-ink-100 px-3 py-2 flex items-center gap-2 text-[12px]">
          <span className="text-ink-500 font-num">
            1920 × 1080
          </span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-500">
            scale {(scale * 100).toFixed(0)}%
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="w-7 h-7 grid place-items-center rounded hover:bg-ink-100 text-ink-700"
              title="축소"
            >
              −
            </button>
            <span className="text-[11px] font-num text-ink-500 w-10 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="w-7 h-7 grid place-items-center rounded hover:bg-ink-100 text-ink-700"
              title="확대"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2 h-7 rounded hover:bg-ink-100 text-ink-700 text-[11px]"
            >
              Fit
            </button>
          </div>
        </div>

        <div className="p-5 grid place-items-start">
          <div
            className="relative shadow-card"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
            style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              background: resolveBg(page.bg) ?? "#F6F6F6",
            }}
          >
            <div
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
              {page.bgImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.bgImageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              )}
              {page.nodes.map((n) => (
                <NodeFrame
                  key={n.id}
                  node={n}
                  selected={selectedId === n.id}
                  scale={scale}
                  onSelect={() => setSelectedId(n.id)}
                  onMove={(rect) => updateNode(n.id, { rect })}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 우측 — 인스펙터 */}
      <aside className="bg-white border border-ink-100 rounded-card overflow-hidden flex flex-col">
        {!selected ? (
          <div className="p-4 text-[12px] text-ink-500">
            <div className="font-bold text-ink-900 mb-1.5">캔버스 페이지 설정</div>
            <PageInspector page={page} onChange={onChange} />
          </div>
        ) : (
          <NodeInspector
            node={selected}
            onUpdateNode={(p) => updateNode(selected.id, p)}
            onUpdateData={(p) => updateNodeData(selected.id, p)}
            onDelete={() => deleteNode(selected.id)}
            onDuplicate={() => duplicateNode(selected.id)}
          />
        )}
      </aside>
    </div>
  );
}

// ============================================================================
// 노드 프레임 (드래그·리사이즈·선택 핸들)
// ============================================================================

function NodeFrame({
  node,
  selected,
  scale,
  onSelect,
  onMove,
}: {
  node: CanvasNode;
  selected: boolean;
  scale: number;
  onSelect: () => void;
  onMove: (rect: CanvasNode["rect"]) => void;
}) {
  const dragStateRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startRect: CanvasNode["rect"];
    handle?: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s";
  } | null>(null);

  const onDown = (
    e: React.MouseEvent,
    mode: "move" | "resize",
    handle?: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    dragStateRef.current = {
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...node.rect },
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = (e.clientX - s.startX) / scale;
    const dy = (e.clientY - s.startY) / scale;
    if (s.mode === "move") {
      const nx = snap(s.startRect.x + dx);
      const ny = snap(s.startRect.y + dy);
      onMove({ ...node.rect, x: nx, y: ny });
    } else {
      const r = { ...s.startRect };
      const h = s.handle ?? "se";
      if (h.includes("e")) r.w = Math.max(20, snap(s.startRect.w + dx));
      if (h.includes("w")) {
        const newW = Math.max(20, snap(s.startRect.w - dx));
        r.x = snap(s.startRect.x + (s.startRect.w - newW));
        r.w = newW;
      }
      if (h.includes("s")) r.h = Math.max(20, snap(s.startRect.h + dy));
      if (h.includes("n")) {
        const newH = Math.max(20, snap(s.startRect.h - dy));
        r.y = snap(s.startRect.y + (s.startRect.h - newH));
        r.h = newH;
      }
      onMove(r);
    }
  };

  const onMouseUp = () => {
    dragStateRef.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      onMouseDown={(e) => onDown(e, "move")}
      style={{
        position: "absolute",
        left: node.rect.x,
        top: node.rect.y,
        width: node.rect.w,
        height: node.rect.h,
        zIndex: node.rect.z ?? 0,
        opacity: node.opacity ?? 1,
        transform: node.rect.rotate
          ? `rotate(${node.rect.rotate}deg)`
          : undefined,
        outline: selected
          ? "2px solid var(--brand-500)"
          : "1px dashed transparent",
        cursor: dragStateRef.current?.mode === "move" ? "grabbing" : "grab",
      }}
      className={
        selected
          ? "ring-offset-0"
          : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-ink-300"
      }
    >
      <NodePreview node={node} />

      {selected && (
        <>
          {/* 리사이즈 핸들 8개 */}
          {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((h) => (
            <div
              key={h}
              onMouseDown={(e) => onDown(e, "resize", h)}
              className="absolute w-3 h-3 bg-white border-2 border-brand-500 rounded-sm"
              style={{
                ...handlePos(h),
                cursor: handleCursor(h),
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function handlePos(h: string): CSSProperties {
  const off = -6;
  const c: CSSProperties = {};
  if (h.includes("n")) c.top = off;
  else if (h.includes("s")) c.bottom = off;
  else c.top = `calc(50% - 6px)`;
  if (h.includes("w")) c.left = off;
  else if (h.includes("e")) c.right = off;
  else c.left = `calc(50% - 6px)`;
  return c;
}

function handleCursor(h: string): string {
  if (h === "n" || h === "s") return "ns-resize";
  if (h === "e" || h === "w") return "ew-resize";
  if (h === "ne" || h === "sw") return "nesw-resize";
  return "nwse-resize";
}

// ============================================================================
// 노드 미리보기 (캔버스 안에서 그려지는 모습)
// ============================================================================

function NodePreview({ node }: { node: CanvasNode }) {
  switch (node.type) {
    case "text": {
      const d = node.data;
      return (
        <div
          style={{
            fontSize: d.fontSize ?? 32,
            fontWeight: d.fontWeight ?? 500,
            color: d.accent ? "var(--brand-500)" : d.color ?? "#0A0A0A",
            textAlign: d.align ?? "left",
            lineHeight: d.lineHeight ?? 1.3,
            letterSpacing: d.letterSpacing ? `${d.letterSpacing}px` : undefined,
            whiteSpace: "pre-wrap",
            wordBreak: "keep-all",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            pointerEvents: "none",
            fontFamily:
              d.family === "num"
                ? "var(--font-inter), Inter, sans-serif"
                : d.family === "mono"
                  ? "var(--font-jetbrains-mono), monospace"
                  : undefined,
          }}
        >
          {d.content || "텍스트"}
        </div>
      );
    }
    case "image": {
      const d = node.data;
      if (!d.url) {
        return (
          <div
            className="w-full h-full grid place-items-center bg-ink-100 text-ink-300 text-sm pointer-events-none"
            style={{ borderRadius: d.radius }}
          >
            이미지 URL
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.url}
          alt=""
          className="w-full h-full pointer-events-none"
          style={{ objectFit: d.fit ?? "cover", borderRadius: d.radius }}
        />
      );
    }
    case "shape": {
      const d = node.data;
      if (d.shape === "ellipse") {
        return (
          <div
            className="w-full h-full pointer-events-none"
            style={{
              background: d.fill,
              border: d.stroke ? `${d.strokeWidth ?? 0}px solid ${d.stroke}` : undefined,
              borderRadius: "50%",
            }}
          />
        );
      }
      if (d.shape === "line") {
        return (
          <div
            className="w-full pointer-events-none"
            style={{
              height: d.strokeWidth ?? 1,
              background: d.stroke ?? d.fill ?? "#0A0A0A",
              marginTop: "calc(50% - 0.5px)",
            }}
          />
        );
      }
      return (
        <div
          className="w-full h-full pointer-events-none"
          style={{
            background: d.fill,
            border: d.stroke ? `${d.strokeWidth ?? 0}px solid ${d.stroke}` : undefined,
            borderRadius: d.radius ?? 0,
          }}
        />
      );
    }
    case "button": {
      const d = node.data;
      const variant = d.variant ?? "primary";
      const cls =
        variant === "primary"
          ? "bg-brand-500 text-white"
          : variant === "outline"
            ? "border-2 border-ink-900 text-ink-900"
            : "text-ink-900 underline";
      return (
        <div
          className={"w-full h-full flex items-center justify-center font-bold rounded-pill pointer-events-none " + cls}
          style={{ fontSize: d.fontSize ?? 16 }}
        >
          {d.label || "버튼"}
        </div>
      );
    }
    case "video":
      return (
        <div className="w-full h-full grid place-items-center bg-ink-900 text-white text-xs pointer-events-none">
          ▶ 동영상
        </div>
      );
  }
}

// ============================================================================
// 페이지 인스펙터 (배경 등)
// ============================================================================

function PageInspector({
  page,
  onChange,
}: {
  page: CanvasPage;
  onChange: (p: CanvasPage) => void;
}) {
  return (
    <div className="space-y-3 mt-3">
      <Field label="이름 (어드민용)">
        <input
          type="text"
          value={page.name ?? ""}
          onChange={(e) => onChange({ ...page, name: e.target.value })}
          placeholder="페이지 1"
          className={inputCls()}
        />
      </Field>
      <Field label="배경 색">
        <div className="flex gap-2">
          <input
            type="color"
            value={page.bg && page.bg.startsWith("#") ? page.bg : "#F6F6F6"}
            onChange={(e) => onChange({ ...page, bg: e.target.value })}
            className="w-10 h-9 rounded-btn border border-ink-100 cursor-pointer"
          />
          <input
            type="text"
            value={page.bg ?? ""}
            onChange={(e) => onChange({ ...page, bg: e.target.value })}
            placeholder="canvas/surface/ink/brand 또는 hex"
            className={inputCls() + " font-mono text-[11px]"}
          />
        </div>
      </Field>
      <Field label="배경 이미지 URL">
        <input
          type="text"
          value={page.bgImageUrl ?? ""}
          onChange={(e) => onChange({ ...page, bgImageUrl: e.target.value })}
          placeholder="https://…"
          className={inputCls() + " font-mono text-[11px]"}
        />
      </Field>
    </div>
  );
}

// ============================================================================
// 노드 인스펙터
// ============================================================================

function NodeInspector({
  node,
  onUpdateNode,
  onUpdateData,
  onDelete,
  onDuplicate,
}: {
  node: CanvasNode;
  onUpdateNode: (patch: Partial<CanvasNode>) => void;
  onUpdateData: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <header className="px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide font-bold text-ink-700">
          {NODE_TYPE_LABEL[node.type]}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="w-7 h-7 grid place-items-center rounded text-ink-500 hover:text-ink-900 hover:bg-ink-100"
            title="복제"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 grid place-items-center rounded text-ink-500 hover:text-red-700 hover:bg-red-50"
            title="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {/* 좌표 */}
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X"
            value={node.rect.x}
            onChange={(v) => onUpdateNode({ rect: { ...node.rect, x: v } })}
          />
          <NumberField
            label="Y"
            value={node.rect.y}
            onChange={(v) => onUpdateNode({ rect: { ...node.rect, y: v } })}
          />
          <NumberField
            label="W"
            value={node.rect.w}
            onChange={(v) => onUpdateNode({ rect: { ...node.rect, w: v } })}
          />
          <NumberField
            label="H"
            value={node.rect.h}
            onChange={(v) => onUpdateNode({ rect: { ...node.rect, h: v } })}
          />
        </div>

        <hr className="border-ink-100" />

        {/* 타입별 속성 */}
        {node.type === "text" && (
          <TextNodeInspector node={node} onUpdateData={onUpdateData} />
        )}
        {node.type === "image" && (
          <ImageNodeInspector node={node} onUpdateData={onUpdateData} />
        )}
        {node.type === "shape" && (
          <ShapeNodeInspector node={node} onUpdateData={onUpdateData} />
        )}
        {node.type === "button" && (
          <ButtonNodeInspector node={node} onUpdateData={onUpdateData} />
        )}
        {node.type === "video" && (
          <VideoNodeInspector node={node} onUpdateData={onUpdateData} />
        )}

        <hr className="border-ink-100" />

        {/* 모바일 reflow */}
        <details>
          <summary className="cursor-pointer text-[11px] uppercase tracking-wide font-bold text-ink-700">
            모바일 동작
          </summary>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={node.mobile?.hidden ?? false}
                onChange={(e) =>
                  onUpdateNode({
                    mobile: { ...node.mobile, hidden: e.target.checked },
                  })
                }
                className="accent-ink-900"
              />
              {node.mobile?.hidden ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              모바일에서 숨김
            </label>
            <NumberField
              label="모바일 순서"
              value={node.mobile?.order ?? 0}
              onChange={(v) =>
                onUpdateNode({
                  mobile: { ...node.mobile, order: v },
                })
              }
            />
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={node.mobile?.fullWidth ?? false}
                onChange={(e) =>
                  onUpdateNode({
                    mobile: { ...node.mobile, fullWidth: e.target.checked },
                  })
                }
                className="accent-ink-900"
              />
              가로 꽉
            </label>
          </div>
        </details>

        {/* 공통 */}
        <details>
          <summary className="cursor-pointer text-[11px] uppercase tracking-wide font-bold text-ink-700">
            고급
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField
              label="회전°"
              value={node.rect.rotate ?? 0}
              onChange={(v) =>
                onUpdateNode({ rect: { ...node.rect, rotate: v } })
              }
            />
            <NumberField
              label="z-index"
              value={node.rect.z ?? 0}
              onChange={(v) => onUpdateNode({ rect: { ...node.rect, z: v } })}
            />
            <NumberField
              label="투명도 (0~100)"
              value={Math.round((node.opacity ?? 1) * 100)}
              onChange={(v) =>
                onUpdateNode({ opacity: Math.max(0, Math.min(1, v / 100)) })
              }
            />
          </div>
        </details>
      </div>
    </div>
  );
}

// ── 타입별 인스펙터 ────────────────────────────────────────────────────────

function TextNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasTextNode;
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const d = node.data;
  return (
    <div className="space-y-3">
      <Field label="텍스트">
        <textarea
          value={d.content}
          onChange={(e) => onUpdateData({ content: e.target.value })}
          className={inputCls() + " min-h-[80px]"}
          rows={4}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="크기"
          value={d.fontSize ?? 32}
          onChange={(v) => onUpdateData({ fontSize: v })}
        />
        <Field label="굵기">
          <select
            value={d.fontWeight ?? 500}
            onChange={(e) =>
              onUpdateData({ fontWeight: parseInt(e.target.value, 10) })
            }
            className={inputCls()}
          >
            {[300, 400, 500, 600, 700, 800].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="색">
        <div className="flex gap-1">
          <input
            type="color"
            value={d.color ?? "#0A0A0A"}
            onChange={(e) => onUpdateData({ color: e.target.value })}
            className="w-10 h-8 rounded-btn border border-ink-100 cursor-pointer"
          />
          <input
            type="text"
            value={d.color ?? ""}
            onChange={(e) => onUpdateData({ color: e.target.value })}
            placeholder="#0A0A0A"
            className={inputCls() + " font-mono text-[11px]"}
          />
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-ink-700 mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={d.accent ?? false}
            onChange={(e) => onUpdateData({ accent: e.target.checked })}
            className="accent-ink-900"
          />
          브랜드 색상 (한 줄 강조)
        </label>
      </Field>
      <Field label="정렬">
        <div className="inline-flex bg-ink-50 border border-ink-100 rounded-btn p-0.5">
          {(
            [
              { v: "left", I: AlignLeft },
              { v: "center", I: AlignCenter },
              { v: "right", I: AlignRight },
            ] as const
          ).map(({ v, I }) => (
            <button
              key={v}
              type="button"
              onClick={() => onUpdateData({ align: v })}
              className={
                "w-7 h-7 grid place-items-center rounded " +
                ((d.align ?? "left") === v
                  ? "bg-ink-900 text-white"
                  : "text-ink-500 hover:text-ink-900")
              }
            >
              <I className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </Field>
      <Field label="폰트 패밀리">
        <select
          value={d.family ?? "sans"}
          onChange={(e) => onUpdateData({ family: e.target.value })}
          className={inputCls()}
        >
          <option value="sans">Pretendard (한글·기본)</option>
          <option value="num">Inter (숫자)</option>
          <option value="mono">JetBrains Mono</option>
        </select>
      </Field>
    </div>
  );
}

function ImageNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasNode & { type: "image" };
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const d = node.data;
  return (
    <div className="space-y-3">
      <Field label="이미지 URL">
        <input
          type="text"
          value={d.url}
          onChange={(e) => onUpdateData({ url: e.target.value })}
          placeholder="https://…"
          className={inputCls() + " font-mono text-[11px]"}
        />
      </Field>
      <Field label="alt (선택)">
        <input
          type="text"
          value={d.alt ?? ""}
          onChange={(e) => onUpdateData({ alt: e.target.value })}
          className={inputCls()}
        />
      </Field>
      <Field label="채움 방식">
        <select
          value={d.fit ?? "cover"}
          onChange={(e) => onUpdateData({ fit: e.target.value })}
          className={inputCls()}
        >
          <option value="cover">덮기 (cover)</option>
          <option value="contain">포함 (contain)</option>
        </select>
      </Field>
      <NumberField
        label="모서리 둥글기 (px)"
        value={d.radius ?? 0}
        onChange={(v) => onUpdateData({ radius: v })}
      />
    </div>
  );
}

function ShapeNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasNode & { type: "shape" };
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const d = node.data;
  return (
    <div className="space-y-3">
      <Field label="모양">
        <select
          value={d.shape}
          onChange={(e) => onUpdateData({ shape: e.target.value })}
          className={inputCls()}
        >
          <option value="rect">사각형</option>
          <option value="ellipse">원</option>
          <option value="line">선</option>
        </select>
      </Field>
      <Field label="채움 색">
        <div className="flex gap-1">
          <input
            type="color"
            value={d.fill ?? "#DB0711"}
            onChange={(e) => onUpdateData({ fill: e.target.value })}
            className="w-10 h-8 rounded-btn border border-ink-100 cursor-pointer"
          />
          <input
            type="text"
            value={d.fill ?? ""}
            onChange={(e) => onUpdateData({ fill: e.target.value })}
            className={inputCls() + " font-mono text-[11px]"}
            placeholder="transparent 가능"
          />
        </div>
      </Field>
      <Field label="외곽선">
        <div className="flex gap-1">
          <input
            type="color"
            value={d.stroke ?? "#0A0A0A"}
            onChange={(e) => onUpdateData({ stroke: e.target.value })}
            className="w-10 h-8 rounded-btn border border-ink-100 cursor-pointer"
          />
          <input
            type="number"
            value={d.strokeWidth ?? 0}
            onChange={(e) =>
              onUpdateData({ strokeWidth: parseInt(e.target.value, 10) || 0 })
            }
            className={inputCls() + " font-mono w-20"}
            placeholder="굵기"
          />
        </div>
      </Field>
      {d.shape === "rect" && (
        <NumberField
          label="모서리 둥글기"
          value={d.radius ?? 0}
          onChange={(v) => onUpdateData({ radius: v })}
        />
      )}
    </div>
  );
}

function ButtonNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasNode & { type: "button" };
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const d = node.data;
  return (
    <div className="space-y-3">
      <Field label="라벨">
        <input
          type="text"
          value={d.label}
          onChange={(e) => onUpdateData({ label: e.target.value })}
          className={inputCls()}
        />
      </Field>
      <Field label="링크">
        <input
          type="text"
          value={d.href}
          onChange={(e) => onUpdateData({ href: e.target.value })}
          placeholder="/sponsorships 또는 https://…"
          className={inputCls() + " font-mono text-[11px]"}
        />
      </Field>
      <Field label="스타일">
        <select
          value={d.variant ?? "primary"}
          onChange={(e) => onUpdateData({ variant: e.target.value })}
          className={inputCls()}
        >
          <option value="primary">기본 (빨강)</option>
          <option value="outline">아웃라인</option>
          <option value="ghost">고스트</option>
        </select>
      </Field>
      <NumberField
        label="폰트 크기"
        value={d.fontSize ?? 16}
        onChange={(v) => onUpdateData({ fontSize: v })}
      />
    </div>
  );
}

function VideoNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasNode & { type: "video" };
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  return (
    <Field label="동영상 URL (YouTube / Vimeo / mp4)">
      <input
        type="text"
        value={node.data.url}
        onChange={(e) => onUpdateData({ url: e.target.value })}
        className={inputCls() + " font-mono text-[11px]"}
      />
    </Field>
  );
}

// ── 작은 헬퍼 ────────────────────────────────────────────────────────────

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded-btn border border-ink-100 hover:border-ink-900 hover:bg-ink-50 flex flex-col items-center gap-1 text-[11px] text-ink-700 font-semibold"
    >
      {icon}
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold block mb-0.5">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full px-2 py-1 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-ink-900 bg-white font-mono"
      />
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold block mb-0.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function inputCls(): string {
  return "w-full px-2 py-1.5 text-[12px] border border-ink-100 rounded-btn focus:outline-none focus:border-ink-900 bg-white";
}

const NODE_TYPE_LABEL: Record<CanvasNodeType, string> = {
  text: "텍스트",
  image: "이미지",
  shape: "도형",
  button: "버튼",
  video: "동영상",
};

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeNode(type: CanvasNodeType): CanvasNode {
  const base = {
    id: randomId(),
    rect: { x: 200, y: 200, w: 400, h: 200 },
  };
  switch (type) {
    case "text":
      return {
        ...base,
        type: "text",
        data: {
          content: "텍스트를 입력하세요",
          fontSize: 48,
          fontWeight: 700,
          align: "left",
        },
      };
    case "image":
      return {
        ...base,
        type: "image",
        data: { url: "", fit: "cover", radius: 12 },
      };
    case "shape":
      return {
        ...base,
        rect: { ...base.rect, w: 300, h: 300 },
        type: "shape",
        data: { shape: "rect", fill: "#DB0711", radius: 12 },
      };
    case "button":
      return {
        ...base,
        rect: { ...base.rect, w: 240, h: 64 },
        type: "button",
        data: {
          label: "스폰서십 보기",
          href: "/sponsorships",
          variant: "primary",
          fontSize: 18,
        },
      };
    case "video":
      return {
        ...base,
        rect: { ...base.rect, w: 640, h: 360 },
        type: "video",
        data: { url: "" },
      };
  }
}

function resolveBg(bg?: string): string | undefined {
  if (!bg) return undefined;
  if (bg === "canvas") return "#F6F6F6";
  if (bg === "surface") return "#FFFFFF";
  if (bg === "ink") return "#0A0A0A";
  if (bg === "brand") return "var(--brand-500)";
  return bg;
}

