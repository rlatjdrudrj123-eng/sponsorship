"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Frame,
  Hand,
  ImageIcon,
  MousePointer2,
  Plus,
  Square as SquareIcon,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import type {
  CanvasImageNode,
  CanvasNode,
  CanvasPage,
  CanvasShapeNode,
  CanvasTextNode,
} from "@/lib/types";
import { NodePreview, resolveBg } from "./CanvasEditor";
import { buildStoragePath, uploadFile } from "@/lib/firebase/storage";

/**
 * Figma 식 멀티 아트보드 에디터.
 *
 * 레이아웃: [좌측 레이어 220px] [중앙 다크 캔버스] [우측 인스펙터 260px]
 *
 * 인터랙션:
 *  - V/H 도구 또는 빈 영역 드래그 = 패닝 (스페이스 홀드도 패닝)
 *  - Ctrl/Cmd + 휠 = 마우스 위치 기준 줌
 *  - T = 텍스트 삽입 모드 (캔버스 클릭으로 배치)
 *  - R = 사각형 삽입 모드
 *  - 노드 클릭 = 선택 / Shift+클릭 = 다중 선택
 *  - 선택 후 드래그 = 이동 / 모서리·변 핸들 드래그 = 리사이즈
 *  - 화살표 키 = 1px nudge / Shift+화살표 = 10px
 *  - Delete = 삭제 / Cmd+D = 복제 / Cmd+0 = 전체 핏 / Cmd+1 = 100%
 */

const W = 1920;
const H = 1080;
const HDR = 64; // 아트보드 라벨 (이름) 공간
const GAP_X = 220;
const GAP_Y = 220;
const COLS = 2;

type Tool = "select" | "hand" | "text" | "rect" | "image";

type Selection = { pageIdx: number; nodeId: string };

const randomId = () => Math.random().toString(36).slice(2, 10);
const snap8 = (v: number) => Math.round(v / 8) * 8;

export function MultiArtboardEditor({
  pages,
  onUpdatePage,
  onAddPage,
  onRemovePage,
  onMovePage,
}: {
  pages: { blockId: string; page: CanvasPage }[];
  onUpdatePage: (idx: number, page: CanvasPage) => void;
  onAddPage: () => void;
  onRemovePage: (idx: number) => void;
  onMovePage?: (from: number, to: number) => void;
}) {
  const [zoom, setZoom] = useState(0.2);
  const [pan, setPan] = useState({ x: 280, y: 80 });
  const [selections, setSelections] = useState<Selection[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [layersOpen, setLayersOpen] = useState(true);
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Selection | null>(null);
  const [uploading, setUploading] = useState(false);
  const spaceRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 클립보드 — Cmd+C 로 노드 복사, Cmd+V 로 같은 아트보드에 +20,+20 옵셋으로 붙여넣기
  const clipboardRef = useRef<CanvasNode[]>([]);

  const sel = selections[0] ?? null;
  const selectedNode =
    sel && pages[sel.pageIdx]
      ? pages[sel.pageIdx].page.nodes.find((n) => n.id === sel.nodeId) ?? null
      : null;

  // 아트보드 위치 계산
  const positions = pages.map((_, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      x: col * (W + GAP_X),
      y: row * (H + HDR + GAP_Y),
    };
  });

  // 노드 업데이트 헬퍼
  const patchNode = useCallback(
    (pageIdx: number, nodeId: string, patch: Partial<CanvasNode>) => {
      const target = pages[pageIdx];
      if (!target) return;
      onUpdatePage(pageIdx, {
        ...target.page,
        nodes: target.page.nodes.map((n) =>
          n.id === nodeId ? ({ ...n, ...patch } as CanvasNode) : n
        ),
      });
    },
    [pages, onUpdatePage]
  );

  const patchNodeData = useCallback(
    (pageIdx: number, nodeId: string, patch: Record<string, unknown>) => {
      const target = pages[pageIdx];
      if (!target) return;
      onUpdatePage(pageIdx, {
        ...target.page,
        nodes: target.page.nodes.map((n) =>
          n.id === nodeId
            ? ({ ...n, data: { ...(n.data as object), ...patch } } as CanvasNode)
            : n
        ),
      });
    },
    [pages, onUpdatePage]
  );

  const removeNode = useCallback(
    (pageIdx: number, nodeId: string) => {
      const target = pages[pageIdx];
      if (!target) return;
      onUpdatePage(pageIdx, {
        ...target.page,
        nodes: target.page.nodes.filter((n) => n.id !== nodeId),
      });
    },
    [pages, onUpdatePage]
  );

  const addNode = useCallback(
    (pageIdx: number, node: CanvasNode) => {
      const target = pages[pageIdx];
      if (!target) return;
      onUpdatePage(pageIdx, {
        ...target.page,
        nodes: [...target.page.nodes, node],
      });
      setSelections([{ pageIdx, nodeId: node.id }]);
      setTool("select");
    },
    [pages, onUpdatePage]
  );

  // ─── 레이어 순서 (z-index) 변경 ───
  const reorderInPage = useCallback(
    (
      pageIdx: number,
      nodeId: string,
      dir: "front" | "back" | "forward" | "backward"
    ) => {
      const target = pages[pageIdx];
      if (!target) return;
      const sorted = [...target.page.nodes].sort(
        (a, b) => (a.rect.z ?? 0) - (b.rect.z ?? 0)
      );
      const idx = sorted.findIndex((n) => n.id === nodeId);
      if (idx < 0) return;
      const zs = target.page.nodes.map((n) => n.rect.z ?? 0);
      const maxZ = Math.max(0, ...zs);
      const minZ = Math.min(0, ...zs);

      let updates: Map<string, number> | null = null;
      if (dir === "front") {
        updates = new Map([[nodeId, maxZ + 1]]);
      } else if (dir === "back") {
        updates = new Map([[nodeId, minZ - 1]]);
      } else if (dir === "forward" && idx < sorted.length - 1) {
        const cur = sorted[idx];
        const next = sorted[idx + 1];
        updates = new Map([
          [cur.id, next.rect.z ?? 0],
          [next.id, cur.rect.z ?? 0],
        ]);
      } else if (dir === "backward" && idx > 0) {
        const cur = sorted[idx];
        const prev = sorted[idx - 1];
        updates = new Map([
          [cur.id, prev.rect.z ?? 0],
          [prev.id, cur.rect.z ?? 0],
        ]);
      }
      if (!updates) return;
      const u = updates;
      onUpdatePage(pageIdx, {
        ...target.page,
        nodes: target.page.nodes.map((n) =>
          u.has(n.id)
            ? ({ ...n, rect: { ...n.rect, z: u.get(n.id)! } } as CanvasNode)
            : n
        ),
      });
    },
    [pages, onUpdatePage]
  );

  // ─── 키보드 ───
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable;
      if (inField) return;

      if (e.code === "Space") {
        e.preventDefault();
        spaceRef.current = true;
        if (wrapRef.current) wrapRef.current.style.cursor = "grab";
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selections.length > 0) {
          e.preventDefault();
          selections.forEach((s) => removeNode(s.pageIdx, s.nodeId));
          setSelections([]);
        }
        return;
      }
      if (e.key === "Escape") {
        setSelections([]);
        setTool("select");
        return;
      }
      // 도구 단축키 (modifier 없을 때만)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "v") setTool("select");
        else if (k === "h") setTool("hand");
        else if (k === "t") setTool("text");
        else if (k === "r") setTool("rect");
        else if (k === "i") {
          if (pages.length === 0) return;
          fileInputRef.current?.click();
        }
        // 화살표 키 nudge
        else if (
          selections.length > 0 &&
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        ) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx =
            e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy =
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          selections.forEach((s) => {
            const target = pages[s.pageIdx];
            const node = target?.page.nodes.find((n) => n.id === s.nodeId);
            if (node && !node.locked) {
              patchNode(s.pageIdx, s.nodeId, {
                rect: { ...node.rect, x: node.rect.x + dx, y: node.rect.y + dy },
              });
            }
          });
        }
      }
      // Cmd/Ctrl + D = 복제
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        if (selections.length > 0) {
          e.preventDefault();
          const newSels: Selection[] = [];
          selections.forEach((s) => {
            const node = pages[s.pageIdx]?.page.nodes.find(
              (n) => n.id === s.nodeId
            );
            if (node) {
              const copy: CanvasNode = {
                ...node,
                id: randomId(),
                rect: { ...node.rect, x: node.rect.x + 20, y: node.rect.y + 20 },
              };
              const t2 = pages[s.pageIdx];
              if (t2) {
                onUpdatePage(s.pageIdx, {
                  ...t2.page,
                  nodes: [...t2.page.nodes, copy],
                });
                newSels.push({ pageIdx: s.pageIdx, nodeId: copy.id });
              }
            }
          });
          setSelections(newSels);
        }
        return;
      }
      // Cmd/Ctrl + 0 = 전체 핏
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        fitAll();
        return;
      }
      // Cmd/Ctrl + 1 = 100% 줌
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        setZoom(1);
        return;
      }
      // Cmd/Ctrl + C = 복사 (선택 노드)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        if (selections.length > 0) {
          e.preventDefault();
          clipboardRef.current = selections
            .map((s) => pages[s.pageIdx]?.page.nodes.find((n) => n.id === s.nodeId))
            .filter((n): n is CanvasNode => !!n)
            .map((n) => JSON.parse(JSON.stringify(n)) as CanvasNode);
        }
        return;
      }
      // Cmd/Ctrl + V = 붙여넣기 (선택된 아트보드 또는 첫 아트보드에)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        if (clipboardRef.current.length === 0) return;
        e.preventDefault();
        const targetIdx = sel?.pageIdx ?? 0;
        const target = pages[targetIdx];
        if (!target) return;
        const newSels: Selection[] = [];
        const newNodes = clipboardRef.current.map((n) => {
          const copy: CanvasNode = {
            ...JSON.parse(JSON.stringify(n)),
            id: randomId(),
            rect: { ...n.rect, x: n.rect.x + 20, y: n.rect.y + 20 },
          } as CanvasNode;
          newSels.push({ pageIdx: targetIdx, nodeId: copy.id });
          return copy;
        });
        onUpdatePage(targetIdx, {
          ...target.page,
          nodes: [...target.page.nodes, ...newNodes],
        });
        setSelections(newSels);
        return;
      }
      // 레이어 이동 — Cmd+] = 앞으로 / Cmd+[ = 뒤로 / Cmd+Shift+] = 맨앞 / Cmd+Shift+[ = 맨뒤
      if ((e.metaKey || e.ctrlKey) && (e.key === "]" || e.key === "[")) {
        if (selections.length === 0) return;
        e.preventDefault();
        const dir: "front" | "back" | "forward" | "backward" = e.shiftKey
          ? e.key === "]"
            ? "front"
            : "back"
          : e.key === "]"
            ? "forward"
            : "backward";
        selections.forEach((s) => reorderInPage(s.pageIdx, s.nodeId, dir));
        return;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
        if (wrapRef.current) wrapRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, pages]);

  // ─── 줌 (마우스 위치 기준) ───
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const newZoom = Math.max(0.03, Math.min(4, zoom * (1 + delta)));
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wx = (mx - pan.x) / zoom;
        const wy = (my - pan.y) / zoom;
        setPan({ x: mx - wx * newZoom, y: my - wy * newZoom });
      }
      setZoom(newZoom);
    }
  };

  // ─── 패닝 (빈 영역 드래그) ───
  const onWrapDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isBackground =
      target === wrapRef.current ||
      target.dataset.role === "plane" ||
      target.dataset.role === "canvas-bg";
    const wantPan = spaceRef.current || tool === "hand" || e.button === 1;

    if (wantPan && isBackground) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPan = { ...pan };
      const onMove = (ev: PointerEvent) => {
        setPan({
          x: startPan.x + (ev.clientX - startX),
          y: startPan.y + (ev.clientY - startY),
        });
      };
      const onPointerUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onPointerUp);
      return;
    }

    if (isBackground) {
      setSelections([]);
    }
  };

  // ─── 아트보드 클릭 — 삽입 도구가 활성화되어 있으면 그 위치에 노드 생성 ───
  const onArtboardClick = (
    e: React.MouseEvent<HTMLDivElement>,
    pageIdx: number
  ) => {
    if (tool === "select" || tool === "hand") return;
    e.stopPropagation();
    // 아트보드 좌표계로 변환
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = snap8((e.clientX - rect.left) / zoom);
    const y = snap8((e.clientY - rect.top) / zoom);

    if (tool === "text") {
      const node: CanvasTextNode = {
        id: randomId(),
        rect: { x: Math.max(0, x - 200), y: Math.max(0, y - 30), w: 400, h: 80 },
        type: "text",
        data: {
          content: "텍스트",
          fontSize: 56,
          fontWeight: 700,
          align: "left",
        },
      };
      addNode(pageIdx, node);
    } else if (tool === "rect") {
      const node: CanvasShapeNode = {
        id: randomId(),
        rect: { x: Math.max(0, x - 150), y: Math.max(0, y - 100), w: 300, h: 200 },
        type: "shape",
        data: { shape: "rect", fill: "#DB0711", radius: 12 },
      };
      addNode(pageIdx, node);
    } else if (tool === "image") {
      const node: CanvasImageNode = {
        id: randomId(),
        rect: { x: Math.max(0, x - 200), y: Math.max(0, y - 150), w: 400, h: 300 },
        type: "image",
        data: { url: "", fit: "cover", radius: 12 },
      };
      addNode(pageIdx, node);
    }
  };

  // ─── 노드 클릭/드래그 ───
  const onNodePointerDown = (
    e: React.PointerEvent,
    pageIdx: number,
    nodeId: string,
    startRect: CanvasNode["rect"]
  ) => {
    if (tool !== "select") return;
    e.stopPropagation();
    e.preventDefault();

    // Shift+클릭 = 다중 선택 토글
    if (e.shiftKey) {
      setSelections((prev) => {
        const exists = prev.find(
          (s) => s.pageIdx === pageIdx && s.nodeId === nodeId
        );
        if (exists) {
          return prev.filter(
            (s) => !(s.pageIdx === pageIdx && s.nodeId === nodeId)
          );
        }
        return [...prev, { pageIdx, nodeId }];
      });
      return;
    }

    // 이미 선택된 노드면 그대로 (그룹 드래그를 위해), 아니면 단일 선택
    const wasAlreadySelected = selections.some(
      (s) => s.pageIdx === pageIdx && s.nodeId === nodeId
    );
    if (!wasAlreadySelected) {
      setSelections([{ pageIdx, nodeId }]);
    }

    // 잠긴 노드는 이동 불가
    const node = pages[pageIdx]?.page.nodes.find((n) => n.id === nodeId);
    if (node?.locked) return;

    // 드래그할 노드 목록 — 이미 다중 선택이면 그 전체, 아니면 이 노드만
    const dragTargets: Array<{
      pageIdx: number;
      nodeId: string;
      startRect: CanvasNode["rect"];
    }> = [];
    if (wasAlreadySelected && selections.length > 1) {
      selections.forEach((s) => {
        const n = pages[s.pageIdx]?.page.nodes.find((nn) => nn.id === s.nodeId);
        if (n && !n.locked) {
          dragTargets.push({
            pageIdx: s.pageIdx,
            nodeId: s.nodeId,
            startRect: { ...n.rect },
          });
        }
      });
    } else {
      dragTargets.push({ pageIdx, nodeId, startRect: { ...startRect } });
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      // 같은 페이지끼리 묶어 한 번에 patch (개별 patchNode 호출 N번 대신)
      const byPage = new Map<number, Map<string, CanvasNode["rect"]>>();
      dragTargets.forEach((t) => {
        const newRect: CanvasNode["rect"] = {
          ...t.startRect,
          x: snap8(t.startRect.x + dx),
          y: snap8(t.startRect.y + dy),
        };
        if (!byPage.has(t.pageIdx)) byPage.set(t.pageIdx, new Map());
        byPage.get(t.pageIdx)!.set(t.nodeId, newRect);
      });
      byPage.forEach((nodeMap, pIdx) => {
        const target = pages[pIdx];
        if (!target) return;
        onUpdatePage(pIdx, {
          ...target.page,
          nodes: target.page.nodes.map((n) =>
            nodeMap.has(n.id)
              ? ({ ...n, rect: nodeMap.get(n.id)! } as CanvasNode)
              : n
          ),
        });
      });
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // ─── 리사이즈 핸들 ───
  const onResizeDown = (
    e: React.PointerEvent,
    pageIdx: number,
    nodeId: string,
    startRect: CanvasNode["rect"],
    handle: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      const r = { ...startRect };
      if (handle.includes("e")) r.w = Math.max(20, snap8(startRect.w + dx));
      if (handle.includes("w")) {
        const newW = Math.max(20, snap8(startRect.w - dx));
        r.x = snap8(startRect.x + (startRect.w - newW));
        r.w = newW;
      }
      if (handle.includes("s")) r.h = Math.max(20, snap8(startRect.h + dy));
      if (handle.includes("n")) {
        const newH = Math.max(20, snap8(startRect.h - dy));
        r.y = snap8(startRect.y + (startRect.h - newH));
        r.h = newH;
      }
      patchNode(pageIdx, nodeId, { rect: r });
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // ─── 회전 핸들 ───
  // 노드 중심 기준으로 마우스 위치까지의 각도를 계산해 rect.rotate 갱신
  const onRotateDown = (
    e: React.PointerEvent,
    pageIdx: number,
    nodeId: string,
    startRect: CanvasNode["rect"]
  ) => {
    e.stopPropagation();
    e.preventDefault();
    // 화면상의 노드 중심 좌표 (현재 회전이 적용된 상태에서 측정)
    const handleEl = e.currentTarget as HTMLElement;
    const parentEl = handleEl.parentElement;
    if (!parentEl) return;
    const rect = parentEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // 시작 각도 (마우스가 처음 잡았을 때 중심으로부터의 각도)
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const initialRotate = startRect.rotate ?? 0;
    const onMove = (ev: PointerEvent) => {
      const currentAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const delta = ((currentAngle - startAngle) * 180) / Math.PI;
      let rotated = Math.round(initialRotate + delta);
      // Shift 누르면 15° snap
      if (ev.shiftKey) rotated = Math.round(rotated / 15) * 15;
      // -180 ~ 180 정규화
      while (rotated > 180) rotated -= 360;
      while (rotated < -180) rotated += 360;
      patchNode(pageIdx, nodeId, { rect: { ...startRect, rotate: rotated } });
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // ─── 전체 핏 ───
  const fitAll = useCallback(() => {
    if (pages.length === 0) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cols = Math.min(COLS, pages.length);
    const rows = Math.ceil(pages.length / COLS);
    const totalW = cols * W + (cols - 1) * GAP_X;
    const totalH = rows * (H + HDR) + (rows - 1) * GAP_Y;
    const sx = (rect.width - 120) / totalW;
    const sy = (rect.height - 120) / totalH;
    const z = Math.max(0.03, Math.min(1, Math.min(sx, sy)));
    setZoom(z);
    setPan({
      x: (rect.width - totalW * z) / 2,
      y: (rect.height - totalH * z) / 2 + 40,
    });
  }, [pages]);

  // ─── 레이어 패널에서 노드 클릭 → 선택 + 줌 인 ───
  const focusNode = useCallback(
    (pageIdx: number, nodeId: string) => {
      setSelections([{ pageIdx, nodeId }]);
      // 화면 중앙에 배치
      const rect = wrapRef.current?.getBoundingClientRect();
      const target = pages[pageIdx];
      const node = target?.page.nodes.find((n) => n.id === nodeId);
      if (!rect || !node) return;
      const z = 0.5;
      setZoom(z);
      const pos = positions[pageIdx];
      const cx = pos.x + node.rect.x + node.rect.w / 2;
      const cy = pos.y + HDR + node.rect.y + node.rect.h / 2;
      setPan({ x: rect.width / 2 - cx * z, y: rect.height / 2 - cy * z });
    },
    [pages, positions]
  );

  const focusArtboard = useCallback(
    (pageIdx: number) => {
      setSelections([]);
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = (rect.width - 80) / W;
      const sy = (rect.height - 80) / (H + HDR);
      const z = Math.max(0.05, Math.min(1, Math.min(sx, sy)));
      setZoom(z);
      const pos = positions[pageIdx];
      setPan({
        x: rect.width / 2 - (pos.x + W / 2) * z,
        y: rect.height / 2 - (pos.y + HDR + H / 2) * z,
      });
    },
    [positions]
  );

  // 처음 진입 시 자동 핏
  useEffect(() => {
    if (pages.length > 0) {
      setTimeout(fitAll, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full bg-[#1E1E1E] text-white text-[11px] select-none">
      {/* ═══ 좌측 — 레이어 트리 ═══ */}
      <aside
        className={
          "shrink-0 bg-[#2C2C2C] border-r border-black/40 flex flex-col transition-all " +
          (layersOpen ? "w-[220px]" : "w-[36px]")
        }
      >
        <header className="px-3 py-2.5 border-b border-black/40 flex items-center justify-between">
          {layersOpen && (
            <span className="text-[10.5px] uppercase tracking-wider font-bold text-white/60">
              레이어
            </span>
          )}
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            className="w-5 h-5 grid place-items-center rounded hover:bg-white/10 text-white/60"
          >
            {layersOpen ? "‹" : "›"}
          </button>
        </header>
        {layersOpen && (
          <div className="flex-1 overflow-y-auto py-1">
            {pages.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-white/40 leading-relaxed">
                아트보드 없음.
                <br />
                상단 「+ 새 아트보드」 클릭.
              </div>
            )}
            {pages.map(({ blockId, page }, idx) => {
              const expanded = expandedPages.has(idx);
              return (
                <div key={blockId} className="mb-0.5">
                  <div
                    className={
                      "flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-white/5 " +
                      (sel?.pageIdx === idx && !sel.nodeId
                        ? "bg-white/10"
                        : "")
                    }
                    onClick={() => focusArtboard(idx)}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPages((prev) => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                      className="w-3.5 h-3.5 grid place-items-center text-white/50 hover:text-white"
                    >
                      {expanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>
                    <Frame className="w-3 h-3 text-white/60" />
                    <span className="text-[12px] text-white/90 font-semibold truncate flex-1">
                      {page.name || `슬라이드 ${idx + 1}`}
                    </span>
                    <span className="text-[10px] text-white/40 font-num">
                      {page.nodes.length}
                    </span>
                  </div>
                  {expanded && (
                    <div className="pl-7">
                      {page.nodes.length === 0 ? (
                        <div className="px-2 py-1 text-[10.5px] text-white/35">
                          비어있음
                        </div>
                      ) : (
                        [...page.nodes]
                          .sort(
                            (a, b) => (b.rect.z ?? 0) - (a.rect.z ?? 0)
                          )
                          .map((n) => {
                            const isSel =
                              sel?.pageIdx === idx && sel?.nodeId === n.id;
                            return (
                              <div
                                key={n.id}
                                onClick={() => focusNode(idx, n.id)}
                                className={
                                  "flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[11.5px] " +
                                  (isSel
                                    ? "bg-blue-500/30 text-white"
                                    : "text-white/70 hover:bg-white/5")
                                }
                              >
                                <NodeTypeIcon type={n.type} />
                                <span className="truncate flex-1">
                                  {nodeLabel(n)}
                                </span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* ═══ 중앙 — 캔버스 ═══ */}
      <div className="flex-1 relative overflow-hidden">
        {/* 상단 중앙 — 도구 팔레트 (플로팅) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#2C2C2C] rounded-full shadow-xl px-1.5 py-1.5 flex items-center gap-0.5">
          <ToolBtn
            active={tool === "select"}
            onClick={() => setTool("select")}
            title="선택 (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn
            active={tool === "hand"}
            onClick={() => setTool("hand")}
            title="핸드 / 패닝 (H · 스페이스)"
          >
            <Hand className="w-4 h-4" />
          </ToolBtn>
          <span className="w-px h-5 bg-white/10 mx-1" />
          <ToolBtn
            active={tool === "rect"}
            onClick={() => setTool("rect")}
            title="사각형 (R) — 아트보드 클릭으로 배치"
          >
            <SquareIcon className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn
            active={tool === "text"}
            onClick={() => setTool("text")}
            title="텍스트 (T) — 아트보드 클릭으로 배치"
          >
            <TypeIcon className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn
            active={uploading}
            onClick={() => {
              if (pages.length === 0) {
                alert("먼저 아트보드를 추가해주세요.");
                return;
              }
              fileInputRef.current?.click();
            }}
            title="이미지 업로드 (I) — 클릭하면 파일 선택 다이얼로그"
          >
            <ImageIcon className="w-4 h-4" />
          </ToolBtn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const path = buildStoragePath(
                  "landing/canvas-multi",
                  file.name
                );
                const { url } = await uploadFile(file, path);
                // 첫 아트보드 가운데에 800×600 으로 배치 (또는 마지막 선택된 아트보드)
                const targetPageIdx = sel?.pageIdx ?? 0;
                const node: CanvasImageNode = {
                  id: randomId(),
                  rect: { x: 560, y: 240, w: 800, h: 600 },
                  type: "image",
                  data: { url, fit: "cover", radius: 0 },
                };
                addNode(targetPageIdx, node);
              } catch (err) {
                alert(
                  "업로드 실패: " +
                    (err instanceof Error ? err.message : String(err))
                );
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
          <span className="w-px h-5 bg-white/10 mx-1" />
          <button
            type="button"
            onClick={onAddPage}
            className="px-2.5 h-7 rounded-full bg-brand-500 hover:bg-brand-700 text-white text-[11.5px] font-bold flex items-center gap-1"
            title="새 아트보드"
          >
            <Plus className="w-3 h-3" />새 아트보드
          </button>
        </div>

        {/* 우상단 — 줌 */}
        <div className="absolute top-3 right-3 z-30 bg-[#2C2C2C] rounded-full shadow-xl px-2 py-1 flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.03, z * 0.85))}
            className="w-6 h-6 grid place-items-center rounded hover:bg-white/10 text-white/70"
          >
            −
          </button>
          <span className="font-num text-white/80 w-11 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z * 1.15))}
            className="w-6 h-6 grid place-items-center rounded hover:bg-white/10 text-white/70"
          >
            +
          </button>
          <span className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={fitAll}
            className="px-2 h-6 rounded text-[10.5px] font-semibold hover:bg-white/10"
            title="전체 핏 (Ctrl+0)"
          >
            핏
          </button>
        </div>

        {/* 좌하단 안내 */}
        <div className="absolute bottom-3 left-3 z-30 text-[10.5px] text-white/40 leading-relaxed">
          스페이스+드래그 · 패닝 / Ctrl+휠 · 줌 / V · 선택 / R · 사각형 / T ·
          텍스트
        </div>

        {/* 무한 다크 캔버스 — 닷 그리드 */}
        <div
          ref={wrapRef}
          data-role="canvas-bg"
          onPointerDown={onWrapDown}
          onWheel={onWheel}
          className="absolute inset-0 touch-none"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px) 0 0 / 32px 32px, #1E1E1E",
            cursor:
              tool === "hand" || spaceRef.current
                ? "grab"
                : tool === "rect" || tool === "text" || tool === "image"
                  ? "crosshair"
                  : "default",
          }}
        >
          <div
            data-role="plane"
            onPointerDown={onWrapDown}
            style={{
              position: "absolute",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: 1,
              height: 1,
            }}
          >
            {pages.length === 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 0,
                  height: 0,
                }}
              />
            )}
            {pages.map(({ blockId, page }, idx) => {
              const pos = positions[idx];
              return (
                <div
                  key={blockId}
                  style={{ position: "absolute", left: pos.x, top: pos.y }}
                >
                  {/* 아트보드 라벨 — Figma 스타일 (작게, 위쪽) */}
                  <div
                    style={{
                      width: W,
                      height: HDR,
                      paddingLeft: 4,
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      paddingBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(255,255,255,0.55)",
                        fontSize: 24,
                        fontWeight: 500,
                      }}
                    >
                      {page.name || `슬라이드 ${idx + 1}`}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {onMovePage && idx > 0 && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => onMovePage(idx, idx - 1)}
                          style={{
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 18,
                            padding: "4px 10px",
                          }}
                          className="hover:!text-white"
                          title="이전 순서로"
                        >
                          ↑ 앞으로
                        </button>
                      )}
                      {onMovePage && idx < pages.length - 1 && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => onMovePage(idx, idx + 1)}
                          style={{
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 18,
                            padding: "4px 10px",
                          }}
                          className="hover:!text-white"
                          title="다음 순서로"
                        >
                          ↓ 뒤로
                        </button>
                      )}
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onRemovePage(idx)}
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          fontSize: 18,
                          padding: "4px 10px",
                        }}
                        className="hover:!text-red-400"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* 아트보드 본체 */}
                  <div
                    data-role="artboard"
                    onClick={(e) => onArtboardClick(e, idx)}
                    style={{
                      width: W,
                      height: H,
                      background: resolveBg(page.bg) ?? "#FFFFFF",
                      position: "relative",
                      boxShadow:
                        "0 20px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                      overflow: "hidden",
                    }}
                    onPointerDown={(e) => {
                      // 빈 아트보드 클릭 = 선택 해제 (select 도구일 때만)
                      if (tool === "select") {
                        const tgt = e.target as HTMLElement;
                        if (tgt.dataset.role === "artboard") {
                          if (!e.shiftKey) setSelections([]);
                        }
                      }
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
                    {page.nodes
                      .filter((n) => !n.hidden)
                      .sort((a, b) => (a.rect.z ?? 0) - (b.rect.z ?? 0))
                      .map((n) => {
                        const isSel = selections.some(
                          (s) => s.pageIdx === idx && s.nodeId === n.id
                        );
                        const isEditing =
                          editing?.pageIdx === idx &&
                          editing?.nodeId === n.id &&
                          n.type === "text";
                        return (
                          <div
                            key={n.id}
                            data-node-id={n.id}
                            onPointerDown={(e) => {
                              if (isEditing) return; // 편집 중이면 드래그 무시
                              onNodePointerDown(e, idx, n.id, n.rect);
                            }}
                            onDoubleClick={(e) => {
                              if (n.type === "text" && !n.locked) {
                                e.stopPropagation();
                                setEditing({ pageIdx: idx, nodeId: n.id });
                                setSelections([{ pageIdx: idx, nodeId: n.id }]);
                              }
                            }}
                            style={{
                              position: "absolute",
                              left: n.rect.x,
                              top: n.rect.y,
                              width: n.rect.w,
                              height: n.rect.h,
                              zIndex: n.rect.z ?? 0,
                              opacity:
                                (n.opacity ?? 1) * (n.hidden ? 0.25 : 1),
                              transform: n.rect.rotate
                                ? `rotate(${n.rect.rotate}deg)`
                                : undefined,
                              cursor: n.locked
                                ? "default"
                                : isEditing
                                  ? "text"
                                  : tool === "select"
                                    ? "move"
                                    : "default",
                              outline: isSel
                                ? `${2 / zoom}px solid #0D99FF`
                                : `${1 / zoom}px solid transparent`,
                              outlineOffset: 0,
                              touchAction: "none",
                            }}
                            className="hover:!outline-blue-400/40 hover:!outline-[1.5px]"
                          >
                            {isEditing && n.type === "text" ? (
                              <TextEditOverlay
                                node={n}
                                onCommit={(newContent) => {
                                  patchNodeData(idx, n.id, {
                                    content: newContent,
                                  });
                                  setEditing(null);
                                }}
                                onCancel={() => setEditing(null)}
                              />
                            ) : (
                              <NodePreview node={n} />
                            )}

                            {/* 선택 시 8개 리사이즈 핸들 + 회전 핸들 + W×H 라벨 */}
                            {isSel && !n.locked && !isEditing && (
                              <>
                                {(
                                  [
                                    "nw",
                                    "n",
                                    "ne",
                                    "e",
                                    "se",
                                    "s",
                                    "sw",
                                    "w",
                                  ] as const
                                ).map((handle) => (
                                  <div
                                    key={handle}
                                    onPointerDown={(e) =>
                                      onResizeDown(
                                        e,
                                        idx,
                                        n.id,
                                        n.rect,
                                        handle
                                      )
                                    }
                                    style={{
                                      position: "absolute",
                                      width: 10 / zoom,
                                      height: 10 / zoom,
                                      background: "#fff",
                                      border: `${2 / zoom}px solid #0D99FF`,
                                      borderRadius: 2 / zoom,
                                      cursor: handleCursor(handle),
                                      ...handlePos(handle, zoom),
                                      touchAction: "none",
                                    }}
                                  />
                                ))}
                                {/* 회전 핸들 — 위쪽 30px 거리, 곡선 화살표 아이콘 */}
                                <div
                                  onPointerDown={(e) =>
                                    onRotateDown(e, idx, n.id, n.rect)
                                  }
                                  style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: -36 / zoom,
                                    width: 16 / zoom,
                                    height: 16 / zoom,
                                    marginLeft: -8 / zoom,
                                    background: "#fff",
                                    border: `${2 / zoom}px solid #0D99FF`,
                                    borderRadius: "50%",
                                    cursor: "grab",
                                    display: "grid",
                                    placeItems: "center",
                                    touchAction: "none",
                                  }}
                                  title="드래그 = 회전"
                                >
                                  <svg
                                    width={10 / zoom}
                                    height={10 / zoom}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#0D99FF"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ pointerEvents: "none" }}
                                  >
                                    <path d="M3 12a9 9 0 1 0 9-9" />
                                    <polyline points="12 1 12 7 18 7" />
                                  </svg>
                                </div>
                                {/* 핸들과 노드 사이 연결선 */}
                                <div
                                  style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: -28 / zoom,
                                    width: 1 / zoom,
                                    height: 28 / zoom,
                                    background: "#0D99FF",
                                    pointerEvents: "none",
                                  }}
                                />
                                {/* W × H 라벨 (회전 중에는 각도) */}
                                <div
                                  style={{
                                    position: "absolute",
                                    left: "50%",
                                    bottom: -28 / zoom,
                                    transform: "translateX(-50%)",
                                    background: "#0D99FF",
                                    color: "white",
                                    fontSize: 11 / zoom,
                                    padding: `${2 / zoom}px ${6 / zoom}px`,
                                    borderRadius: 3 / zoom,
                                    whiteSpace: "nowrap",
                                    fontFamily: "var(--font-inter), sans-serif",
                                    pointerEvents: "none",
                                  }}
                                >
                                  {n.rect.rotate
                                    ? `${Math.round(n.rect.rotate)}°`
                                    : `${n.rect.w} × ${n.rect.h}`}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}

            {/* 새 아트보드 추가 자리 */}
            {pages.length > 0 && (
              <button
                type="button"
                onClick={onAddPage}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  left:
                    positions[positions.length - 1].x +
                    (pages.length % COLS === 0 ? -(W + GAP_X) : W + GAP_X),
                  top:
                    positions[positions.length - 1].y +
                    (pages.length % COLS === 0
                      ? H + HDR + GAP_Y
                      : 0),
                  width: W,
                  height: HDR + H,
                  paddingTop: HDR,
                  fontSize: 56,
                }}
                className="grid place-items-center text-white/30 hover:text-brand-500 transition-colors"
              >
                <div className="border-4 border-dashed border-white/15 hover:border-brand-500 w-full h-full grid place-items-center">
                  <span className="flex items-center gap-4">
                    <Plus style={{ width: 72, height: 72 }} />새 아트보드
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* 빈 상태 안내 — 페이지 0개일 때 */}
        {pages.length === 0 && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none z-20">
            <div className="text-center max-w-md pointer-events-auto">
              <div className="text-[11px] font-num uppercase tracking-[0.3em] text-white/40 font-bold mb-3">
                아직 아트보드가 없습니다
              </div>
              <h3 className="text-[28px] font-bold text-white leading-tight">
                첫 슬라이드 만들기
              </h3>
              <p className="text-[12.5px] text-white/50 mt-3 leading-relaxed">
                1920×1080 빈 캔버스 위에 텍스트·이미지·도형·차트·아이콘을 자유
                배치하세요.
              </p>
              <button
                type="button"
                onClick={onAddPage}
                className="mt-6 px-6 py-3.5 rounded-pill bg-brand-500 text-white text-[13px] font-bold hover:bg-brand-700 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />첫 아트보드 추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ 우측 — 인스펙터 ═══ */}
      <aside className="shrink-0 w-[260px] bg-[#2C2C2C] border-l border-black/40 flex flex-col">
        <header className="px-3 py-2.5 border-b border-black/40">
          <span className="text-[10.5px] uppercase tracking-wider font-bold text-white/60">
            {selectedNode
              ? nodeTypeLabel(selectedNode.type)
              : sel
                ? "아트보드"
                : "설계"}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {selections.length > 1 ? (
            <div className="text-[11.5px] text-white/70 leading-relaxed">
              <div className="font-num font-bold text-blue-400 mb-2">
                {selections.length}개 노드 선택됨
              </div>
              <p className="text-white/50">
                좌측 레이어에서 개별 선택하거나, Esc로 해제.
              </p>
            </div>
          ) : selectedNode ? (
            <NodeInspectorDark
              node={selectedNode}
              onPatchRect={(rect) =>
                sel && patchNode(sel.pageIdx, sel.nodeId, { rect })
              }
              onPatchData={(data) =>
                sel && patchNodeData(sel.pageIdx, sel.nodeId, data)
              }
              onPatchNode={(patch) =>
                sel && patchNode(sel.pageIdx, sel.nodeId, patch)
              }
              onToggleLocked={() =>
                sel &&
                patchNode(sel.pageIdx, sel.nodeId, { locked: !selectedNode.locked })
              }
              onToggleHidden={() =>
                sel &&
                patchNode(sel.pageIdx, sel.nodeId, { hidden: !selectedNode.hidden })
              }
              onDelete={() => {
                if (sel) {
                  removeNode(sel.pageIdx, sel.nodeId);
                  setSelections([]);
                }
              }}
              onReorder={(dir) => sel && reorderInPage(sel.pageIdx, sel.nodeId, dir)}
            />
          ) : (
            <div className="text-[11.5px] text-white/50 leading-relaxed space-y-3">
              <div>
                <div className="text-white/80 font-semibold mb-1">단축키</div>
                <div className="space-y-0.5 text-white/55 font-mono text-[10.5px]">
                  <div>V · 선택 / H · 핸드</div>
                  <div>R · 사각형 / T · 텍스트 / I · 이미지</div>
                  <div>Space (홀드) · 임시 패닝</div>
                  <div>Ctrl+휠 · 마우스 기준 줌</div>
                  <div>Ctrl+C / Ctrl+V · 복사 / 붙여넣기</div>
                  <div>Ctrl+] · 앞으로 / Ctrl+[ · 뒤로</div>
                  <div>Ctrl+Shift+] · 맨앞 / Ctrl+Shift+[ · 맨뒤</div>
                  <div>Ctrl+0 · 전체 핏</div>
                  <div>Ctrl+1 · 100% 줌</div>
                  <div>Ctrl+D · 복제</div>
                  <div>←↑↓→ · 1px nudge</div>
                  <div>Shift+←↑↓→ · 10px</div>
                  <div>Del · 삭제</div>
                </div>
              </div>
              <hr className="border-white/10" />
              <p>
                노드 또는 아트보드를 선택하면 여기 속성이 나옵니다. 빈 영역
                클릭으로 해제.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 노드 타입 인스펙터 (다크)
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// 인라인 텍스트 편집 — 텍스트 노드 위에 contentEditable div 를 띄움
// ─────────────────────────────────────────────────────────────────────

function TextEditOverlay({
  node,
  onCommit,
  onCancel,
}: {
  node: CanvasTextNode;
  onCommit: (newContent: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const d = node.data;
  useEffect(() => {
    // 마운트 시 자동 포커스 + 전체 선택
    const el = ref.current;
    if (el) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onCommit(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        // Cmd/Ctrl + Enter = 커밋
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          onCommit((e.currentTarget as HTMLDivElement).innerText);
        }
      }}
      style={{
        fontSize: d.fontSize ?? 32,
        fontWeight: d.fontWeight ?? 500,
        color: d.color ?? "#0A0A0A",
        textAlign: d.align ?? "left",
        lineHeight: d.lineHeight ?? 1.3,
        letterSpacing: d.letterSpacing ? `${d.letterSpacing}px` : undefined,
        whiteSpace: "pre-wrap",
        wordBreak: "keep-all",
        width: "100%",
        height: "100%",
        outline: "none",
        cursor: "text",
        background: "rgba(13, 153, 255, 0.05)",
        fontFamily:
          d.family === "num"
            ? "var(--font-inter), Inter, sans-serif"
            : d.family === "mono"
              ? "var(--font-jetbrains-mono), monospace"
              : undefined,
      }}
    >
      {d.content || ""}
    </div>
  );
}

function NodeInspectorDark({
  node,
  onPatchRect,
  onPatchData,
  onPatchNode,
  onToggleLocked,
  onToggleHidden,
  onDelete,
  onReorder,
}: {
  node: CanvasNode;
  onPatchRect: (rect: CanvasNode["rect"]) => void;
  onPatchData: (data: Record<string, unknown>) => void;
  onPatchNode: (patch: Partial<CanvasNode>) => void;
  onToggleLocked: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
  onReorder: (dir: "front" | "back" | "forward" | "backward") => void;
}) {
  return (
    <div className="space-y-3 text-[11.5px]">
      {/* 위치·크기 */}
      <Section title="위치·크기">
        <div className="grid grid-cols-2 gap-1.5">
          <NumField
            label="X"
            value={node.rect.x}
            onChange={(v) => onPatchRect({ ...node.rect, x: v })}
          />
          <NumField
            label="Y"
            value={node.rect.y}
            onChange={(v) => onPatchRect({ ...node.rect, y: v })}
          />
          <NumField
            label="W"
            value={node.rect.w}
            onChange={(v) => onPatchRect({ ...node.rect, w: v })}
          />
          <NumField
            label="H"
            value={node.rect.h}
            onChange={(v) => onPatchRect({ ...node.rect, h: v })}
          />
        </div>
        <NumField
          label="회전°"
          value={node.rect.rotate ?? 0}
          onChange={(v) => onPatchRect({ ...node.rect, rotate: v })}
        />
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={onToggleHidden}
            className={
              "flex-1 px-2 py-1.5 rounded text-[10.5px] font-semibold border " +
              (node.hidden
                ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300"
                : "border-white/10 text-white/60 hover:bg-white/5")
            }
          >
            {node.hidden ? "숨김됨" : "표시"}
          </button>
          <button
            type="button"
            onClick={onToggleLocked}
            className={
              "flex-1 px-2 py-1.5 rounded text-[10.5px] font-semibold border " +
              (node.locked
                ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                : "border-white/10 text-white/60 hover:bg-white/5")
            }
          >
            {node.locked ? "잠김" : "잠금 안됨"}
          </button>
        </div>
      </Section>

      {/* 타입별 속성 */}
      {node.type === "text" && (
        <Section title="텍스트">
          <textarea
            value={node.data.content}
            onChange={(e) => onPatchData({ content: e.target.value })}
            rows={3}
            className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/10 text-white text-[12px] font-sans focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <NumField
              label="크기"
              value={node.data.fontSize ?? 32}
              onChange={(v) => onPatchData({ fontSize: v })}
            />
            <DarkSelect
              label="굵기"
              value={String(node.data.fontWeight ?? 500)}
              onChange={(v) => onPatchData({ fontWeight: Number(v) })}
              options={[
                { value: "400", label: "400 Regular" },
                { value: "500", label: "500 Medium" },
                { value: "700", label: "700 Bold" },
                { value: "800", label: "800 Heavy" },
              ]}
            />
          </div>
          <DarkSelect
            label="정렬"
            value={node.data.align ?? "left"}
            onChange={(v) => onPatchData({ align: v })}
            options={[
              { value: "left", label: "왼쪽" },
              { value: "center", label: "가운데" },
              { value: "right", label: "오른쪽" },
            ]}
          />
          <ColorField
            label="색"
            value={(node.data.color as string) ?? "#0A0A0A"}
            onChange={(v) => onPatchData({ color: v })}
          />
        </Section>
      )}

      {node.type === "shape" && (
        <Section title="도형">
          <DarkSelect
            label="모양"
            value={node.data.shape}
            onChange={(v) => onPatchData({ shape: v })}
            options={[
              { value: "rect", label: "사각형" },
              { value: "ellipse", label: "원" },
              { value: "triangle", label: "삼각형" },
              { value: "star", label: "별" },
              { value: "arrow", label: "화살표" },
              { value: "line", label: "선" },
            ]}
          />
          {typeof node.data.fill === "string" && (
            <ColorField
              label="채움"
              value={node.data.fill}
              onChange={(v) => onPatchData({ fill: v })}
            />
          )}
          {node.data.shape === "rect" && (
            <NumField
              label="모서리 r"
              value={node.data.radius ?? 0}
              onChange={(v) => onPatchData({ radius: v })}
            />
          )}
        </Section>
      )}

      {node.type === "image" && (
        <Section title="이미지">
          <label className="block text-[10.5px] text-white/50 mb-1">URL</label>
          <input
            type="text"
            value={node.data.url}
            onChange={(e) => onPatchData({ url: e.target.value })}
            placeholder="https://…"
            className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/10 text-white text-[11px] font-mono focus:outline-none focus:border-blue-500"
          />
          <DarkSelect
            label="채움 방식"
            value={node.data.fit ?? "cover"}
            onChange={(v) => onPatchData({ fit: v })}
            options={[
              { value: "cover", label: "덮기 (cover)" },
              { value: "contain", label: "포함 (contain)" },
            ]}
          />
        </Section>
      )}

      {/* 투명도 */}
      <Section title="모양">
        <label className="block text-[10.5px] text-white/50 mb-1">
          투명도 {Math.round((node.opacity ?? 1) * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((node.opacity ?? 1) * 100)}
          onChange={(e) => onPatchNode({ opacity: Number(e.target.value) / 100 })}
          className="w-full accent-blue-500"
        />
      </Section>

      {/* 레이어 순서 */}
      <Section title="레이어 순서 (z-index)">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onReorder("front")}
            className="px-2 py-1.5 rounded border border-white/10 text-white/70 text-[10.5px] font-semibold hover:bg-white/5 hover:text-white"
            title="Cmd+Shift+]"
          >
            ↟ 맨앞으로
          </button>
          <button
            type="button"
            onClick={() => onReorder("forward")}
            className="px-2 py-1.5 rounded border border-white/10 text-white/70 text-[10.5px] font-semibold hover:bg-white/5 hover:text-white"
            title="Cmd+]"
          >
            ↑ 앞으로
          </button>
          <button
            type="button"
            onClick={() => onReorder("backward")}
            className="px-2 py-1.5 rounded border border-white/10 text-white/70 text-[10.5px] font-semibold hover:bg-white/5 hover:text-white"
            title="Cmd+["
          >
            ↓ 뒤로
          </button>
          <button
            type="button"
            onClick={() => onReorder("back")}
            className="px-2 py-1.5 rounded border border-white/10 text-white/70 text-[10.5px] font-semibold hover:bg-white/5 hover:text-white"
            title="Cmd+Shift+["
          >
            ↡ 맨뒤로
          </button>
        </div>
        <div className="text-[10px] text-white/40 mt-1.5">
          현재 z = <span className="font-num font-bold">{node.rect.z ?? 0}</span>
        </div>
      </Section>

      <button
        type="button"
        onClick={onDelete}
        className="w-full px-3 py-2 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-[11.5px] font-semibold hover:bg-red-500/25 flex items-center justify-center gap-1.5"
      >
        <Trash2 className="w-3 h-3" />
        노드 삭제
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 작은 다크 인풋·필드 컴포넌트들
// ─────────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-black/20 rounded p-2.5 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function NumField({
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
      <span className="block text-[10px] text-white/45 mb-0.5">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-white text-[11.5px] font-num focus:outline-none focus:border-blue-500"
      />
    </label>
  );
}

function DarkSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] text-white/45 mb-0.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-white text-[11.5px] focus:outline-none focus:border-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#2C2C2C]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#[0-9A-Fa-f]{3,8}$/.test(value);
  return (
    <label className="block">
      <span className="block text-[10px] text-white/45 mb-0.5">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={isHex ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-7 rounded border border-white/10 bg-black/40 cursor-pointer p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1 rounded bg-black/40 border border-white/10 text-white text-[11px] font-mono focus:outline-none focus:border-blue-500"
        />
      </div>
    </label>
  );
}

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "w-9 h-9 grid place-items-center rounded-full transition-colors " +
        (active
          ? "bg-blue-500 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

function NodeTypeIcon({ type }: { type: CanvasNode["type"] }) {
  const cls = "w-3 h-3 shrink-0 text-white/55";
  if (type === "text") return <TypeIcon className={cls} />;
  if (type === "shape") return <SquareIcon className={cls} />;
  if (type === "image") return <ImageIcon className={cls} />;
  return <span className={cls} />;
}

function nodeLabel(n: CanvasNode): string {
  if (n.type === "text") return n.data.content?.slice(0, 20) || "텍스트";
  if (n.type === "image") return n.data.url ? "이미지" : "이미지 (빈)";
  if (n.type === "shape") return `${n.data.shape}`;
  if (n.type === "button") return n.data.label || "버튼";
  if (n.type === "chart") return "차트";
  if (n.type === "icon") return `${n.data.set}:${n.data.name}`;
  if (n.type === "video") return "동영상";
  return n.type;
}

function nodeTypeLabel(t: CanvasNode["type"]): string {
  const m: Record<string, string> = {
    text: "텍스트",
    image: "이미지",
    shape: "도형",
    button: "버튼",
    video: "동영상",
    chart: "차트",
    icon: "아이콘",
    component: "컴포넌트",
  };
  return m[t] ?? t;
}

function handlePos(
  h: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s",
  zoom: number
): React.CSSProperties {
  const off = -5 / zoom;
  const c: React.CSSProperties = {};
  if (h.includes("n")) c.top = off;
  else if (h.includes("s")) c.bottom = off;
  else c.top = `calc(50% - ${5 / zoom}px)`;
  if (h.includes("w")) c.left = off;
  else if (h.includes("e")) c.right = off;
  else c.left = `calc(50% - ${5 / zoom}px)`;
  return c;
}

function handleCursor(
  h: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s"
): string {
  if (h === "n" || h === "s") return "ns-resize";
  if (h === "e" || h === "w") return "ew-resize";
  if (h === "ne" || h === "sw") return "nesw-resize";
  return "nwse-resize";
}

