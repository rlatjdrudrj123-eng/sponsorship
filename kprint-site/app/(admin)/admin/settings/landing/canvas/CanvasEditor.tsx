"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { buildStoragePath, uploadFile } from "@/lib/firebase/storage";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  Lock,
  MousePointer,
  Sparkles,
  Square,
  TextCursorInput,
  Trash2,
  Type as TypeIcon,
  Unlock,
  Video,
} from "lucide-react";
import type {
  CanvasChartNode,
  CanvasComponentNode,
  CanvasIconNode,
  CanvasNode,
  CanvasNodeType,
  CanvasPage,
  CanvasShapeNode,
  CanvasTextNode,
  Gradient,
  ShapeFill,
} from "@/lib/types";
import {
  ShapeSVG,
  ChartNodeView,
  IconNodeView,
} from "@/components/public/canvas/CanvasRenderer";

// CanvasTextNode 는 TextNodeInspector 시그니처에서 직접 쓰임 (아래)

// ─────────────────────────────────────────────────────────────────────────
// (구) 디자인 완성된 컴포넌트들 — 사용자가 헷갈린다고 해서 UI에서 제거.
//      백워드 호환을 위해 데이터 타입과 렌더러는 남기지만 어드민에서 새로 추가 불가.
// ─────────────────────────────────────────────────────────────────────────
const COMPONENT_META_DEPRECATED: Record<
  string,
  { label: string; desc: string; defaultW: number; defaultH: number }
> = {
  cover: {
    label: "표지",
    desc: "행사명 + 일정 히어로",
    defaultW: 1920,
    defaultH: 1080,
  },
  stats3year: {
    label: "3년 통계",
    desc: "방문객·해외바이어 카드",
    defaultW: 1600,
    defaultH: 600,
  },
  adGoals4: {
    label: "광고 목적 4",
    desc: "타입 1~4 그리드",
    defaultW: 1600,
    defaultH: 700,
  },
  benefits4: {
    label: "혜택 4",
    desc: "Sponsor Benefits 카드",
    defaultW: 1600,
    defaultH: 700,
  },
  steps4: {
    label: "신청 절차 4",
    desc: "01~04 번호 카드",
    defaultW: 1600,
    defaultH: 600,
  },
  textHero: {
    label: "큰 텍스트",
    desc: "여러 줄 디스플레이",
    defaultW: 1200,
    defaultH: 500,
  },
  bigStat: {
    label: "큰 숫자",
    desc: "70,000명 / 4일",
    defaultW: 1200,
    defaultH: 500,
  },
  cta: {
    label: "CTA (빨강)",
    desc: "빨강 풀브리드 + 버튼",
    defaultW: 1920,
    defaultH: 1080,
  },
  slotsTeaser: {
    label: "슬롯 미리보기",
    desc: "카테고리 카드 그리드",
    defaultW: 1600,
    defaultH: 600,
  },
  richText: {
    label: "본문 텍스트",
    desc: "긴 텍스트 블록",
    defaultW: 1200,
    defaultH: 500,
  },
};

// (deprecated) — 옛 데이터 호환만. 실제 사용 안 함.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _defaultComponentDataDeprecated(kind: string): Record<string, unknown> {
  switch (kind) {
    case "cover":
      return {
        eyebrow: "Sponsorship",
        title: "행사명",
        subtitle: "일정 · 장소",
      };
    case "stats3year":
      return {
        eyebrow: "scale",
        headline: "참관 규모",
        years: [
          { year: 2023, visitors: 70163, overseas: 3029 },
          { year: 2024, visitors: 70760, overseas: 4274 },
          { year: 2025, visitors: 72507, overseas: 4941 },
        ],
        footnote: "전체 방문객의 70% 이상 B2B 참관객.",
      };
    case "adGoals4":
      return {
        eyebrow: "ad goals",
        headline: "어떤 목적으로 스폰서십을 진행하시나요?",
        cards: [
          { label: "브랜드 확산형", description: "전 동선 통합 노출" },
          { label: "현장 방문객 유도형", description: "부스로 유도" },
          { label: "신제품 홍보형", description: "제품 인지 확보" },
          { label: "맞춤형 타겟팅", description: "결정권자 직접 도달" },
        ],
      };
    case "benefits4":
      return {
        eyebrow: "sponsors benefits",
        headline: "스폰서 참가사 4가지 혜택",
        cards: [
          { title: "상위 고정", description: "검색 상단 노출" },
          { title: "스폰서 뱃지", description: "참가업체 카드 강조" },
          { title: "홈페이지 배너", description: "추가 노출" },
          { title: "도면 내 로고", description: "도면 표기" },
        ],
      };
    case "steps4":
      return {
        eyebrow: "application",
        headline: "신청 절차",
        steps: [
          { title: "신청 상담", description: "사무국 문의" },
          { title: "견적서 발송", description: "체크리스트 후" },
          { title: "입금", description: "마감일까지" },
          { title: "관련 서류", description: "계산서 발행" },
        ],
      };
    case "textHero":
      return {
        eyebrow: "exposure",
        lines: ["모든 동선 위에", "*당신의 브랜드를."],
        description: "4일간 모든 참관객이 거치는 동선 위에서.",
      };
    case "bigStat":
      return {
        eyebrow: "scale",
        value: "70,000",
        valueSuffix: "명",
        label: "이 4일간 다녀갑니다.",
      };
    case "cta":
      return {
        eyebrow: "get in touch",
        lines: ["어떤 자리에", "들어갈지,", "먼저 둘러보세요."],
        primaryLabel: "스폰서십 둘러보기",
        secondaryLabel: "바로 문의하기",
        showContact: true,
      };
    case "slotsTeaser":
      return {
        eyebrow: "spotlight",
        headline: "추천 슬롯",
        categorySlugs: [],
        layout: "grid",
      };
    case "richText":
      return {
        eyebrow: "",
        headline: "",
        body: "본문 텍스트를 자유롭게 입력하세요.",
      };
    default:
      return {};
  }
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 마퀴(드래그 박스) 선택 — 캔버스 좌표계 기준
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // 단일 선택 — 인스펙터에 1개 노드 편집 띄울 때만 의미
  const selectedId =
    selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
  const setSelectedId = (id: string | null) => {
    setSelectedIds(id ? new Set([id]) : new Set());
  };
  // shift-aware 선택 — NodeFrame 에서 호출
  const toggleSelect = (id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  };

  // 그룹 이동 — 선택된 모든 노드를 같은 델타만큼 이동 (잠긴 노드는 제외)
  const groupMove = (dx: number, dy: number) => {
    if (selectedIds.size === 0) return;
    onChange({
      ...page,
      nodes: page.nodes.map((n) =>
        selectedIds.has(n.id) && !n.locked
          ? { ...n, rect: { ...n.rect, x: n.rect.x + dx, y: n.rect.y + dy } }
          : n
      ),
    });
  };

  // 그룹 삭제 (잠긴 노드는 보존)
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    onChange({
      ...page,
      nodes: page.nodes.filter((n) => !selectedIds.has(n.id) || n.locked),
    });
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        const n = page.nodes.find((nn) => nn.id === id);
        if (n?.locked) next.add(id);
      });
      return next;
    });
  };

  // z-index 순서 변경
  const reorderNode = (id: string, dir: "front" | "back" | "forward" | "backward") => {
    const sorted = [...page.nodes].sort(
      (a, b) => (a.rect.z ?? 0) - (b.rect.z ?? 0)
    );
    const idx = sorted.findIndex((n) => n.id === id);
    if (idx < 0) return;
    if (dir === "front") {
      const maxZ = Math.max(0, ...page.nodes.map((n) => n.rect.z ?? 0));
      onChange({
        ...page,
        nodes: page.nodes.map((n) =>
          n.id === id ? { ...n, rect: { ...n.rect, z: maxZ + 1 } } : n
        ),
      });
    } else if (dir === "back") {
      const minZ = Math.min(0, ...page.nodes.map((n) => n.rect.z ?? 0));
      onChange({
        ...page,
        nodes: page.nodes.map((n) =>
          n.id === id ? { ...n, rect: { ...n.rect, z: minZ - 1 } } : n
        ),
      });
    } else if (dir === "forward" && idx < sorted.length - 1) {
      const cur = sorted[idx];
      const next = sorted[idx + 1];
      const curZ = cur.rect.z ?? 0;
      const nextZ = next.rect.z ?? 0;
      onChange({
        ...page,
        nodes: page.nodes.map((n) => {
          if (n.id === cur.id) return { ...n, rect: { ...n.rect, z: nextZ } };
          if (n.id === next.id) return { ...n, rect: { ...n.rect, z: curZ } };
          return n;
        }),
      });
    } else if (dir === "backward" && idx > 0) {
      const cur = sorted[idx];
      const prev = sorted[idx - 1];
      const curZ = cur.rect.z ?? 0;
      const prevZ = prev.rect.z ?? 0;
      onChange({
        ...page,
        nodes: page.nodes.map((n) => {
          if (n.id === cur.id) return { ...n, rect: { ...n.rect, z: prevZ } };
          if (n.id === prev.id) return { ...n, rect: { ...n.rect, z: curZ } };
          return n;
        }),
      });
    }
  };

  // 정렬 — 선택된 노드들을 기준으로
  const alignNodes = (
    axis:
      | "left"
      | "center-x"
      | "right"
      | "top"
      | "center-y"
      | "bottom"
      | "distribute-x"
      | "distribute-y"
  ) => {
    if (selectedIds.size < 2) return;
    const sel = page.nodes.filter((n) => selectedIds.has(n.id));
    if (sel.length < 2) return;

    const updates: Record<string, { x: number; y: number }> = {};

    if (axis === "left") {
      const x = Math.min(...sel.map((n) => n.rect.x));
      sel.forEach((n) => (updates[n.id] = { x, y: n.rect.y }));
    } else if (axis === "right") {
      const right = Math.max(...sel.map((n) => n.rect.x + n.rect.w));
      sel.forEach(
        (n) => (updates[n.id] = { x: right - n.rect.w, y: n.rect.y })
      );
    } else if (axis === "center-x") {
      const minX = Math.min(...sel.map((n) => n.rect.x));
      const maxX = Math.max(...sel.map((n) => n.rect.x + n.rect.w));
      const center = (minX + maxX) / 2;
      sel.forEach(
        (n) => (updates[n.id] = { x: center - n.rect.w / 2, y: n.rect.y })
      );
    } else if (axis === "top") {
      const y = Math.min(...sel.map((n) => n.rect.y));
      sel.forEach((n) => (updates[n.id] = { x: n.rect.x, y }));
    } else if (axis === "bottom") {
      const bottom = Math.max(...sel.map((n) => n.rect.y + n.rect.h));
      sel.forEach(
        (n) => (updates[n.id] = { x: n.rect.x, y: bottom - n.rect.h })
      );
    } else if (axis === "center-y") {
      const minY = Math.min(...sel.map((n) => n.rect.y));
      const maxY = Math.max(...sel.map((n) => n.rect.y + n.rect.h));
      const center = (minY + maxY) / 2;
      sel.forEach(
        (n) => (updates[n.id] = { x: n.rect.x, y: center - n.rect.h / 2 })
      );
    } else if (axis === "distribute-x" && sel.length >= 3) {
      // 가로 균등 분배 — 양 끝은 그대로, 중간 노드들 같은 간격
      const sorted = [...sel].sort((a, b) => a.rect.x - b.rect.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const total = last.rect.x - first.rect.x;
      const step = total / (sorted.length - 1);
      sorted.forEach((n, i) => {
        if (i === 0 || i === sorted.length - 1) {
          updates[n.id] = { x: n.rect.x, y: n.rect.y };
        } else {
          updates[n.id] = { x: first.rect.x + step * i, y: n.rect.y };
        }
      });
    } else if (axis === "distribute-y" && sel.length >= 3) {
      const sorted = [...sel].sort((a, b) => a.rect.y - b.rect.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const total = last.rect.y - first.rect.y;
      const step = total / (sorted.length - 1);
      sorted.forEach((n, i) => {
        if (i === 0 || i === sorted.length - 1) {
          updates[n.id] = { x: n.rect.x, y: n.rect.y };
        } else {
          updates[n.id] = { x: n.rect.x, y: first.rect.y + step * i };
        }
      });
    }

    onChange({
      ...page,
      nodes: page.nodes.map((n) => {
        const u = updates[n.id];
        if (!u) return n;
        return { ...n, rect: { ...n.rect, x: Math.round(u.x), y: Math.round(u.y) } };
      }),
    });
  };
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

  // (deprecated) 컴포넌트 추가 — 새 노드 생성은 ToolButton (primitives) 으로만.
  void _defaultComponentDataDeprecated;

  // 슬라이드 템플릿 — 미리 만든 노드 묶음을 현재 페이지에 한꺼번에 추가
  const insertTemplate = (key: SlideTemplateKey) => {
    const tpl = SLIDE_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    const nodes = tpl.make();
    onChange({ ...page, nodes: [...page.nodes, ...nodes] });
    setSelectedIds(new Set(nodes.map((n) => n.id)));
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

  // 이미지 Blob 을 받아 Storage 업로드 후 캔버스 중앙에 이미지 노드 생성
  const addImageFromBlob = useCallback(
    async (blob: Blob, suggestedName = "paste.png") => {
      try {
        const file =
          blob instanceof File
            ? blob
            : new File([blob], suggestedName, { type: blob.type || "image/png" });
        const path = buildStoragePath("landing/canvas-paste", file.name);
        const result = await uploadFile(file, path);

        // 이미지 본래 크기로 노드 만들고 캔버스 안에서 80% 이내로 맞춤
        const dims = await loadImageDims(result.url);
        const max = 800;
        let w = dims.w;
        let h = dims.h;
        const ratio = w / h;
        if (w > max) {
          w = max;
          h = Math.round(max / ratio);
        }
        if (h > 800) {
          h = 800;
          w = Math.round(800 * ratio);
        }

        const node: CanvasNode = {
          id: randomId(),
          rect: {
            x: snap((CANVAS_W - w) / 2),
            y: snap((CANVAS_H - h) / 2),
            w,
            h,
          },
          type: "image",
          data: { url: result.url, fit: "cover", radius: 0 },
        };
        onChange({ ...page, nodes: [...page.nodes, node] });
        setSelectedId(node.id);
      } catch (e) {
        alert(
          `이미지 업로드 실패: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    },
    [page, onChange]
  );

  // 클립보드 텍스트 → 텍스트 노드 (또는 선택된 텍스트 노드 안에 채움)
  const addTextFromString = useCallback(
    (text: string) => {
      const trimmed = text.replace(/\r\n/g, "\n");
      if (!trimmed.trim()) return;

      // 선택된 텍스트 노드가 있으면 거기에 추가/대체 (Cmd+V on focused empty text)
      if (selectedId) {
        const n = page.nodes.find((nn) => nn.id === selectedId);
        if (n && n.type === "text" && !n.data.content?.trim()) {
          onChange({
            ...page,
            nodes: page.nodes.map((nn) => {
              if (nn.id !== selectedId) return nn;
              if (nn.type !== "text") return nn;
              return {
                ...nn,
                data: { ...nn.data, content: trimmed },
              };
            }),
          });
          return;
        }
      }

      // 새 텍스트 노드 — 줄 수·길이로 적당한 크기 추정
      const lines = trimmed.split("\n");
      const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
      const fontSize = lines.length === 1 && longest < 20 ? 64 : 32;
      const w = Math.min(1200, Math.max(300, longest * fontSize * 0.55));
      const h = Math.max(80, lines.length * fontSize * 1.4);
      const node: CanvasNode = {
        id: randomId(),
        rect: {
          x: snap((CANVAS_W - w) / 2),
          y: snap((CANVAS_H - h) / 2),
          w: snap(w),
          h: snap(h),
        },
        type: "text",
        data: {
          content: trimmed,
          fontSize,
          fontWeight: 500,
          align: "left",
        },
      };
      onChange({ ...page, nodes: [...page.nodes, node] });
      setSelectedId(node.id);
    },
    [page, selectedId, onChange]
  );

  // 실행 취소 / 다시 실행 — page prop 변경을 추적해서 스택 유지
  const [past, setPast] = useState<CanvasPage[]>([]);
  const [future, setFuture] = useState<CanvasPage[]>([]);
  const prevPageRef = useRef<CanvasPage>(page);
  const skipHistoryRef = useRef(false);
  useEffect(() => {
    if (prevPageRef.current !== page) {
      if (skipHistoryRef.current) {
        skipHistoryRef.current = false;
      } else {
        setPast((p) => [...p, prevPageRef.current].slice(-50));
        setFuture([]);
      }
      prevPageRef.current = page;
    }
  }, [page]);
  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [...f, page]);
      skipHistoryRef.current = true;
      onChange(prev);
      return p.slice(0, -1);
    });
  }, [page, onChange]);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      setPast((p) => [...p, page]);
      skipHistoryRef.current = true;
      onChange(next);
      return f.slice(0, -1);
    });
  }, [page, onChange]);

  // 키보드: Figma 호환 단축키
  //   V=선택(deselect), T=텍스트, R=사각형, O=원, L=선
  //   Delete=삭제, Cmd/Ctrl+D=복제, ←↑↓→=1px 이동, Shift+화살표=10px
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (inField) return;

      // Delete / Backspace — 그룹 삭제
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        e.preventDefault();
        if (selectedIds.size === 1) deleteNode(Array.from(selectedIds)[0]);
        else deleteSelected();
        return;
      }
      // Cmd/Ctrl + A — 전체 선택
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(new Set(page.nodes.map((n) => n.id)));
        return;
      }
      // Cmd/Ctrl + Z — 실행 취소 / Cmd/Ctrl + Shift + Z — 다시 실행
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Cmd/Ctrl + Y — 다시 실행 (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      // Cmd/Ctrl + D = 복제
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        if (selectedId) {
          e.preventDefault();
          duplicateNode(selectedId);
        }
        return;
      }
      // Escape = 선택 해제
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      // 단일 키 단축키 (modifier 없을 때만)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "v") {
          setSelectedId(null);
          return;
        }
        if (k === "t") {
          e.preventDefault();
          addNode("text");
          return;
        }
        if (k === "r") {
          e.preventDefault();
          addNode("shape");
          // 추가된 노드는 setSelectedId 안에서 갱신됨
          return;
        }
        if (k === "o") {
          e.preventDefault();
          // 원 추가 — addNode("shape") 직후 shape 를 ellipse 로 패치
          const n = makeNode("shape") as CanvasShapeNode;
          n.data = { ...n.data, shape: "ellipse" };
          onChange({ ...page, nodes: [...page.nodes, n] });
          setSelectedId(n.id);
          return;
        }
        if (k === "l") {
          e.preventDefault();
          const n = makeNode("shape") as CanvasShapeNode;
          n.data = {
            ...n.data,
            shape: "line",
            stroke: "#0A0A0A",
            strokeWidth: 4,
          };
          onChange({ ...page, nodes: [...page.nodes, n] });
          setSelectedId(n.id);
          return;
        }
        // 화살표 키 — 선택된 노드(들) nudge
        if (
          selectedIds.size > 0 &&
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        ) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          groupMove(dx, dy);
          return;
        }
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // 입력 필드 안에서 Ctrl+V 는 정상 동작 (캔버스용 핸들러 무시)
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      // 1) 이미지 파일 — 우선 (스크린샷, 일반 이미지 복사)
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            void addImageFromBlob(file);
            return;
          }
        }
      }

      // 2) Figma 호환 — Figma 는 SVG 를 text/html 안에 넣어 줌
      const html = e.clipboardData?.getData("text/html");
      if (html && html.includes("<svg")) {
        const m = html.match(/<svg[\s\S]*?<\/svg>/i);
        if (m) {
          e.preventDefault();
          const blob = new Blob([m[0]], { type: "image/svg+xml" });
          void addImageFromBlob(blob, "figma-paste.svg");
          return;
        }
      }

      // 3) image/svg+xml 직접 — 일부 브라우저·앱
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type === "image/svg+xml") {
          e.preventDefault();
          it.getAsString((s) => {
            if (s && s.includes("<svg")) {
              const blob = new Blob([s], { type: "image/svg+xml" });
              void addImageFromBlob(blob, "paste.svg");
            }
          });
          return;
        }
      }

      // 4) 텍스트 — 마지막 fallback (Figma 메타 텍스트는 거름)
      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim() && !/^FIGMA-/i.test(text)) {
        e.preventDefault();
        addTextFromString(text);
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, page, addImageFromBlob, addTextFromString, undo, redo]);

  // 풀스크린 상태 — 캔버스 작업 시 모달처럼 viewport 전체 사용
  const [fullscreen, setFullscreen] = useState(false);

  // 스냅 가이드 — 드래그 중 활성화된 정렬선들
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({
    v: [],
    h: [],
  });

  const editor = (
    <div
      className={
        "grid grid-cols-[200px_1fr_320px] gap-3 " +
        (fullscreen ? "h-full p-3" : "h-[calc(100vh-220px)] min-h-[640px]")
      }
    >
      {/* 좌측 — 노드 추가 툴바 */}
      <aside className="bg-white border border-ink-100 rounded-card overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-ink-100 text-[11px] uppercase tracking-wide font-bold text-ink-700">
          기본 도형
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
          <ToolButton
            icon={<BarChart3 className="w-4 h-4" />}
            label="차트"
            onClick={() => addNode("chart")}
          />
          <ToolButton
            icon={<Sparkles className="w-4 h-4" />}
            label="아이콘"
            onClick={() => addNode("icon")}
          />
        </div>

        {/* 슬라이드 템플릿 — 그룹별 (K-PRINT 만 표시, KIMES 그룹은 폐기) */}
        <div className="border-t border-ink-100 px-2 py-2 space-y-3">
          {(["K-PRINT", "공통"] as const).map((groupKey) => {
            const groupItems = SLIDE_TEMPLATES.filter(
              (t) => t.group === groupKey
            );
            if (groupItems.length === 0) return null;
            return (
              <div key={groupKey}>
                <div className="text-[10.5px] uppercase tracking-wide font-bold mb-1.5 px-1 flex items-center gap-1.5">
                  <span
                    className={
                      groupKey === "K-PRINT"
                        ? "text-brand-500"
                        : "text-ink-700"
                    }
                  >
                    {groupKey === "공통"
                      ? "공통 템플릿"
                      : `${groupKey} 템플릿`}
                  </span>
                  <span className="text-ink-300 font-num">
                    ({groupItems.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {groupItems.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => insertTemplate(t.key)}
                      className={
                        "text-left px-2 py-1.5 rounded border text-[10.5px] font-semibold leading-tight transition-colors " +
                        (t.group === "K-PRINT"
                          ? "border-brand-100 bg-brand-50/40 text-ink-900 hover:border-brand-500 hover:bg-brand-50"
                          : "border-ink-100 text-ink-700 hover:border-ink-900 hover:bg-ink-50")
                      }
                      title={t.desc}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 레이어 패널 — z-index 정렬·가시성·잠금 */}
        <div className="border-t border-ink-100 flex-1 min-h-0 flex flex-col">
          <div className="px-3 py-2 text-[10.5px] uppercase tracking-wide font-bold text-ink-700 flex items-center justify-between">
            <span>레이어 ({page.nodes.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
            {page.nodes.length === 0 ? (
              <div className="px-2 py-3 text-[10.5px] text-ink-400 leading-snug">
                노드 없음 — 위 도구로 추가
              </div>
            ) : (
              [...page.nodes]
                .sort((a, b) => (b.rect.z ?? 0) - (a.rect.z ?? 0))
                .map((n) => (
                  <LayerRow
                    key={n.id}
                    node={n}
                    selected={selectedIds.has(n.id)}
                    onSelect={(shift) => toggleSelect(n.id, shift)}
                    onToggleHidden={() =>
                      updateNode(n.id, { hidden: !n.hidden })
                    }
                    onToggleLocked={() =>
                      updateNode(n.id, { locked: !n.locked })
                    }
                    onForward={() => reorderNode(n.id, "forward")}
                    onBackward={() => reorderNode(n.id, "backward")}
                  />
                ))
            )}
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

          {/* 정렬 툴바 — 2개 이상 선택 시 */}
          {selectedIds.size >= 2 && (
            <div className="flex items-center gap-0.5 ml-3 pl-3 border-l border-ink-100">
              <span className="font-num text-[10.5px] text-brand-500 font-bold mr-1.5">
                {selectedIds.size}개 선택
              </span>
              <AlignBtn title="왼쪽 정렬" onClick={() => alignNodes("left")}>⫷</AlignBtn>
              <AlignBtn title="가운데 정렬 (가로)" onClick={() => alignNodes("center-x")}>↔</AlignBtn>
              <AlignBtn title="오른쪽 정렬" onClick={() => alignNodes("right")}>⫸</AlignBtn>
              <span className="w-px h-4 bg-ink-100 mx-1" />
              <AlignBtn title="위 정렬" onClick={() => alignNodes("top")}>⫯</AlignBtn>
              <AlignBtn title="가운데 정렬 (세로)" onClick={() => alignNodes("center-y")}>↕</AlignBtn>
              <AlignBtn title="아래 정렬" onClick={() => alignNodes("bottom")}>⫰</AlignBtn>
              {selectedIds.size >= 3 && (
                <>
                  <span className="w-px h-4 bg-ink-100 mx-1" />
                  <AlignBtn
                    title="가로 균등 분배"
                    onClick={() => alignNodes("distribute-x")}
                  >
                    ⇿
                  </AlignBtn>
                  <AlignBtn
                    title="세로 균등 분배"
                    onClick={() => alignNodes("distribute-y")}
                  >
                    ⇳
                  </AlignBtn>
                </>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={past.length === 0}
              className="w-7 h-7 grid place-items-center rounded hover:bg-ink-100 text-ink-700 disabled:opacity-30 disabled:cursor-not-allowed"
              title={`실행 취소 (Ctrl+Z) — ${past.length}개`}
            >
              ↶
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              className="w-7 h-7 grid place-items-center rounded hover:bg-ink-100 text-ink-700 disabled:opacity-30 disabled:cursor-not-allowed"
              title={`다시 실행 (Ctrl+Shift+Z) — ${future.length}개`}
            >
              ↷
            </button>
            <span className="w-px h-4 bg-ink-100 mx-1" />
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
            className="relative shadow-card select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
            onMouseDown={(e) => {
              // 좌클릭만, 캔버스 빈 영역에서만 시작
              if (e.button !== 0) return;
              if (e.target !== e.currentTarget) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const x0 = (e.clientX - rect.left) / scale;
              const y0 = (e.clientY - rect.top) / scale;
              const shiftKey = e.shiftKey;
              const baseSelection = shiftKey
                ? new Set(selectedIds)
                : new Set<string>();
              setMarquee({ x1: x0, y1: y0, x2: x0, y2: y0 });

              const handleMove = (ev: MouseEvent) => {
                const x = (ev.clientX - rect.left) / scale;
                const y = (ev.clientY - rect.top) / scale;
                setMarquee({ x1: x0, y1: y0, x2: x, y2: y });
              };
              const handleUp = (ev: MouseEvent) => {
                const x = (ev.clientX - rect.left) / scale;
                const y = (ev.clientY - rect.top) / scale;
                const minX = Math.min(x0, x);
                const maxX = Math.max(x0, x);
                const minY = Math.min(y0, y);
                const maxY = Math.max(y0, y);
                // 드래그 충분히 했을 때만 마퀴 선택 적용 — 미만이면 그냥 클릭
                if (maxX - minX > 4 || maxY - minY > 4) {
                  const hits = page.nodes.filter((n) => {
                    if (n.hidden) return false;
                    const nx = n.rect.x;
                    const ny = n.rect.y;
                    const nw = n.rect.w;
                    const nh = n.rect.h;
                    return (
                      nx < maxX && nx + nw > minX && ny < maxY && ny + nh > minY
                    );
                  });
                  const next = new Set(baseSelection);
                  hits.forEach((n) => next.add(n.id));
                  setSelectedIds(next);
                } else if (!shiftKey) {
                  // 단순 클릭 = 선택 해제
                  setSelectedIds(new Set());
                }
                setMarquee(null);
                window.removeEventListener("mousemove", handleMove);
                window.removeEventListener("mouseup", handleUp);
              };
              window.addEventListener("mousemove", handleMove);
              window.addEventListener("mouseup", handleUp);
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
                  selected={selectedIds.has(n.id)}
                  scale={scale}
                  otherNodes={page.nodes.filter(
                    (o) => o.id !== n.id && !selectedIds.has(o.id)
                  )}
                  onSelect={(shift) => toggleSelect(n.id, shift)}
                  onMove={(rect) => updateNode(n.id, { rect })}
                  onGroupMove={(dx, dy) => groupMove(dx, dy)}
                  isGroup={selectedIds.size > 1 && selectedIds.has(n.id)}
                  onGuides={(v, h) => setGuides({ v, h })}
                  onDragEnd={() => setGuides({ v: [], h: [] })}
                />
              ))}

              {/* 스냅 가이드 — 빨간 점선 */}
              {guides.v.map((x, i) => (
                <div
                  key={`gv-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: x,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "var(--brand-500)",
                    boxShadow: "0 0 2px var(--brand-500)",
                  }}
                />
              ))}
              {guides.h.map((y, i) => (
                <div
                  key={`gh-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    top: y,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "var(--brand-500)",
                    boxShadow: "0 0 2px var(--brand-500)",
                  }}
                />
              ))}

              {/* 마퀴 박스 — 드래그 선택 영역 시각화 */}
              {marquee && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: Math.min(marquee.x1, marquee.x2),
                    top: Math.min(marquee.y1, marquee.y2),
                    width: Math.abs(marquee.x2 - marquee.x1),
                    height: Math.abs(marquee.y2 - marquee.y1),
                    border: "1.5px solid var(--brand-500)",
                    background: "rgba(219, 7, 17, 0.08)",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 우측 — 인스펙터 */}
      <aside className="bg-white border border-ink-100 rounded-card overflow-hidden flex flex-col">
        {selectedIds.size === 0 ? (
          <div className="p-4 text-[12px] text-ink-500">
            <div className="font-bold text-ink-900 mb-1.5">캔버스 페이지 설정</div>
            <PageInspector page={page} onChange={onChange} />
          </div>
        ) : selectedIds.size > 1 ? (
          <div className="p-4 space-y-3">
            <div className="font-num text-[11px] uppercase tracking-wide text-brand-500 font-bold">
              {selectedIds.size}개 노드 선택됨
            </div>
            <p className="text-[12px] text-ink-500 leading-snug">
              상단 정렬 도구로 좌·우·중·분배 적용 가능. 화살표 키로 같이 이동.
              Delete = 한꺼번에 삭제.
            </p>
            <button
              type="button"
              onClick={deleteSelected}
              className="w-full px-3 py-2 rounded-btn border border-ink-100 text-[12px] font-semibold text-red-700 hover:bg-red-50 hover:border-red-200"
            >
              선택 항목 모두 삭제
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="w-full px-3 py-2 rounded-btn border border-ink-100 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
            >
              선택 해제
            </button>
          </div>
        ) : (
          selected && (
            <NodeInspector
              node={selected}
              onUpdateNode={(p) => updateNode(selected.id, p)}
              onUpdateData={(p) => updateNodeData(selected.id, p)}
              onDelete={() => deleteNode(selected.id)}
              onDuplicate={() => duplicateNode(selected.id)}
            />
          )
        )}
      </aside>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-ink-50 flex flex-col">
        <header className="px-4 py-2.5 border-b border-ink-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-num text-[11px] uppercase tracking-widest text-brand-500 font-bold">
              ★ 캔버스 편집
            </span>
            <span className="text-[12px] text-ink-700 truncate">
              {page.name ?? "캔버스 페이지"}
            </span>
            <span className="text-[10.5px] text-ink-300 font-num">
              {page.nodes.length} 노드 · 1920×1080
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="px-3 py-1.5 rounded-btn border border-ink-100 hover:border-ink-900 text-[12px] font-semibold flex items-center gap-1.5"
            title="작은 창으로 (Esc)"
          >
            축소
          </button>
        </header>
        <div className="flex-1 min-h-0">{editor}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-500">
          작업 공간이 좁다면 풀스크린으로 — 더 큰 캔버스에서 편집 가능
        </span>
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="px-3 py-1.5 rounded-btn bg-ink-900 text-white text-[12px] font-bold hover:bg-brand-500 flex items-center gap-1.5"
        >
          ⛶ 풀스크린으로 편집
        </button>
      </div>
      {editor}
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
  otherNodes,
  onSelect,
  onMove,
  onGroupMove,
  isGroup,
  onGuides,
  onDragEnd,
}: {
  node: CanvasNode;
  selected: boolean;
  scale: number;
  otherNodes: CanvasNode[];
  onSelect: (additive: boolean) => void;
  onMove: (rect: CanvasNode["rect"]) => void;
  onGroupMove: (dx: number, dy: number) => void;
  isGroup: boolean;
  onGuides: (v: number[], h: number[]) => void;
  onDragEnd: () => void;
}) {
  const dragStateRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startRect: CanvasNode["rect"];
    handle?: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s";
  } | null>(null);

  const lastDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const onDown = (
    e: React.PointerEvent,
    mode: "move" | "resize",
    handle?: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // 이미 선택된 노드를 쉬프트 없이 클릭 → 선택 유지(그룹 드래그 위해)
    if (e.shiftKey || !selected) {
      onSelect(e.shiftKey);
    }
    // 잠긴 노드는 선택은 허용하되 이동·리사이즈 차단
    if (node.locked) return;
    dragStateRef.current = {
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...node.rect },
    };
    lastDeltaRef.current = { dx: 0, dy: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = (e.clientX - s.startX) / scale;
    const dy = (e.clientY - s.startY) / scale;
    if (s.mode === "move") {
      const rawX = snap(s.startRect.x + dx);
      const rawY = snap(s.startRect.y + dy);
      // 스냅 — 다른 노드들의 가장자리·중심에 자석
      const snapResult = applySnap(
        rawX,
        rawY,
        s.startRect.w,
        s.startRect.h,
        otherNodes,
        8 / scale
      );
      const nx = snapResult.x;
      const ny = snapResult.y;
      onGuides(snapResult.guidesV, snapResult.guidesH);

      if (isGroup) {
        const ddx = nx - s.startRect.x - lastDeltaRef.current.dx;
        const ddy = ny - s.startRect.y - lastDeltaRef.current.dy;
        if (ddx !== 0 || ddy !== 0) {
          onGroupMove(ddx, ddy);
          lastDeltaRef.current = {
            dx: nx - s.startRect.x,
            dy: ny - s.startRect.y,
          };
        }
      } else {
        onMove({ ...node.rect, x: nx, y: ny });
      }
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

  const onPointerUp = () => {
    dragStateRef.current = null;
    onDragEnd();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      data-node-id={node.id}
      onPointerDown={(e) => onDown(e, "move")}
      style={{
        position: "absolute",
        left: node.rect.x,
        top: node.rect.y,
        width: node.rect.w,
        height: node.rect.h,
        zIndex: node.rect.z ?? 0,
        opacity: (node.opacity ?? 1) * (node.hidden ? 0.25 : 1),
        transform: node.rect.rotate
          ? `rotate(${node.rect.rotate}deg)`
          : undefined,
        outline: selected
          ? "2px solid var(--brand-500)"
          : node.locked
            ? "1px dashed rgba(0,0,0,0.15)"
            : "1px dashed transparent",
        cursor: node.locked
          ? "default"
          : dragStateRef.current?.mode === "move"
            ? "grabbing"
            : "grab",
        touchAction: "none",
      }}
      className={
        selected
          ? "ring-offset-0"
          : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-ink-300"
      }
    >
      <NodePreview node={node} />

      {selected && !node.locked && (
        <>
          {/* 리사이즈 핸들 8개 */}
          {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((h) => (
            <div
              key={h}
              onPointerDown={(e) => onDown(e, "resize", h)}
              className="absolute w-3 h-3 bg-white border-2 border-brand-500 rounded-sm"
              style={{
                ...handlePos(h),
                cursor: handleCursor(h),
                touchAction: "none",
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

export function NodePreview({ node }: { node: CanvasNode }) {
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
            fontStyle: d.fontStyle ?? "normal",
            textDecoration: d.textDecoration ?? "none",
            textTransform: d.textTransform ?? "none",
            fontFamily:
              d.fontFamily ||
              (d.family === "num"
                ? "var(--font-inter), Inter, sans-serif"
                : d.family === "mono"
                  ? "var(--font-jetbrains-mono), monospace"
                  : undefined),
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
    case "shape":
      return (
        <div className="w-full h-full pointer-events-none">
          <ShapeSVG data={node.data} />
        </div>
      );
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
    case "chart":
      return (
        <div className="w-full h-full bg-white pointer-events-none">
          <ChartNodeView node={node} />
        </div>
      );
    case "icon":
      return (
        <div className="w-full h-full pointer-events-none" style={{ color: node.data.color ?? "var(--brand-500)" }}>
          <IconNodeView node={node} />
        </div>
      );
    case "component": {
      // (deprecated) 옛 페이지가 가진 component 노드 — 백워드 호환만.
      // 어드민에서 더 이상 새로 추가 불가. 인스펙터에서 삭제만 가능.
      const meta = COMPONENT_META_DEPRECATED[node.componentKind];
      return (
        <div className="w-full h-full bg-ink-50 border-2 border-dashed border-ink-300 rounded p-3 pointer-events-none overflow-hidden">
          <div className="font-num text-[10px] uppercase tracking-widest text-ink-500 font-bold">
            (구) 컴포넌트 — {meta?.label ?? node.componentKind}
          </div>
          <div className="text-[10.5px] text-ink-500 mt-1.5 leading-snug">
            더 이상 지원하지 않습니다. 삭제 후 텍스트·이미지 등으로 새로 만드세요.
          </div>
        </div>
      );
    }
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
      <Field label="배경 이미지 파일 업로드">
        <PageBgUploader
          current={page.bgImageUrl ?? ""}
          onChange={(url) => onChange({ ...page, bgImageUrl: url })}
        />
      </Field>
      <Field label="또는 배경 이미지 URL">
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

function PageBgUploader({
  current,
  onChange,
}: {
  current: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <label
      className={
        "block w-full px-3 py-2.5 rounded-btn border-[1.5px] border-dashed text-[12px] font-semibold text-center cursor-pointer transition-colors " +
        (uploading
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-ink-300 text-ink-500 hover:border-ink-900 hover:text-ink-900")
      }
    >
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          setProgress(0);
          try {
            const path = buildStoragePath("landing/canvas-page-bg", file.name);
            const { url } = await uploadFile(file, path, (p) => setProgress(p));
            onChange(url);
          } catch (err) {
            alert(
              "업로드 실패: " +
                (err instanceof Error ? err.message : String(err))
            );
          } finally {
            setUploading(false);
            setProgress(0);
            e.target.value = "";
          }
        }}
      />
      {uploading
        ? `업로드 중… ${progress}%`
        : current
          ? "다른 이미지로 교체 (클릭)"
          : "배경 이미지 파일 선택 (클릭)"}
    </label>
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
        {node.type === "chart" && (
          <ChartNodeInspector node={node} onUpdateData={onUpdateData} />
        )}
        {node.type === "icon" && (
          <IconNodeInspector node={node} onUpdateData={onUpdateData} />
        )}
        {node.type === "component" && (
          <ComponentNodeInspector node={node} onUpdateData={onUpdateData} />
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
      <Field label="폰트 패밀리 (프리셋)">
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
      <Field label="폰트 자유 입력 (CSS font-family)">
        <input
          type="text"
          value={d.fontFamily ?? ""}
          onChange={(e) =>
            onUpdateData({ fontFamily: e.target.value || undefined })
          }
          placeholder="예: 'Noto Serif KR', serif / 'Roboto' / Georgia, serif"
          className={inputCls() + " font-mono text-[11px]"}
        />
        <div className="text-[10px] text-ink-500 mt-1 leading-tight">
          비우면 프리셋 사용. 입력 시 CSS font-family 그대로 적용 — Google
          Fonts·시스템 폰트 가능.
        </div>
      </Field>

      <Field label="텍스트 스타일">
        <div className="flex gap-1.5">
          {[
            { label: "기울임", value: "italic", current: d.fontStyle },
            { label: "밑줄", value: "underline", current: d.textDecoration },
            {
              label: "취소선",
              value: "line-through",
              current: d.textDecoration,
            },
          ].map((opt) => {
            const isOn = opt.current === opt.value;
            const fieldName =
              opt.value === "italic" ? "fontStyle" : "textDecoration";
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() =>
                  onUpdateData({
                    [fieldName]: isOn
                      ? opt.value === "italic"
                        ? "normal"
                        : "none"
                      : opt.value,
                  })
                }
                className={
                  "flex-1 px-2 py-1.5 rounded border text-[11px] font-semibold transition-colors " +
                  (isOn
                    ? "bg-ink-900 border-ink-900 text-white"
                    : "border-ink-100 text-ink-700 hover:border-ink-900")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="대소문자 변환">
        <select
          value={d.textTransform ?? "none"}
          onChange={(e) => onUpdateData({ textTransform: e.target.value })}
          className={inputCls()}
        >
          <option value="none">변환 없음</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize</option>
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
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <div className="space-y-3">
      <Field label="파일 업로드 (PC에서)">
        <label
          className={
            "block w-full px-3 py-2.5 rounded-btn border-[1.5px] border-dashed text-[12px] font-semibold text-center cursor-pointer transition-colors " +
            (uploading
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-ink-300 text-ink-500 hover:border-ink-900 hover:text-ink-900")
          }
        >
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setProgress(0);
              try {
                const path = buildStoragePath(
                  "landing/canvas-upload",
                  file.name
                );
                const { url } = await uploadFile(file, path, (p) =>
                  setProgress(p)
                );
                onUpdateData({ url });
              } catch (err) {
                alert(
                  "업로드 실패: " +
                    (err instanceof Error ? err.message : String(err))
                );
              } finally {
                setUploading(false);
                setProgress(0);
                // 같은 파일 재선택 가능하도록 초기화
                e.target.value = "";
              }
            }}
          />
          {uploading
            ? `업로드 중… ${progress}%`
            : d.url
              ? "다른 이미지로 교체 (클릭)"
              : "이미지 파일 선택 (클릭)"}
        </label>
      </Field>
      <Field label="또는 이미지 URL 직접 입력">
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
  node: CanvasShapeNode;
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const d = node.data;
  const fill = normalizeShapeFill(d.fill);

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
          <option value="triangle">삼각형</option>
          <option value="polygon">다각형</option>
          <option value="star">별</option>
          <option value="arrow">화살표</option>
          <option value="line">선</option>
        </select>
      </Field>

      {/* polygon 변 수 / star 점 수 */}
      {d.shape === "polygon" && (
        <NumberField
          label="변 수 (3~12)"
          value={d.sides ?? 6}
          onChange={(v) => onUpdateData({ sides: Math.max(3, Math.min(12, v)) })}
        />
      )}
      {d.shape === "star" && (
        <NumberField
          label="점 수 (3~12)"
          value={d.points ?? 5}
          onChange={(v) => onUpdateData({ points: Math.max(3, Math.min(12, v)) })}
        />
      )}

      {/* ── Fill ── */}
      <div>
        <span className="text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold block mb-1.5">
          채움
        </span>
        <div className="inline-flex bg-ink-50 border border-ink-100 rounded-btn p-0.5 mb-2">
          {(["solid", "gradient", "image"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === "solid")
                  onUpdateData({ fill: { kind: "solid", color: "#DB0711" } });
                else if (k === "gradient")
                  onUpdateData({
                    fill: {
                      kind: "gradient",
                      gradient: {
                        kind: "linear",
                        angle: 90,
                        stops: [
                          { offset: 0, color: "#DB0711" },
                          { offset: 1, color: "#83000A" },
                        ],
                      },
                    },
                  });
                else
                  onUpdateData({
                    fill: { kind: "image", url: "", fit: "cover" },
                  });
              }}
              className={
                "px-2.5 py-1 rounded text-[11px] font-semibold " +
                (fill.kind === k
                  ? "bg-ink-900 text-white"
                  : "text-ink-500 hover:text-ink-900")
              }
            >
              {k === "solid" ? "단색" : k === "gradient" ? "그라디언트" : "이미지"}
            </button>
          ))}
        </div>

        {fill.kind === "solid" && (
          <div className="flex gap-1">
            <input
              type="color"
              value={fill.color === "transparent" ? "#DB0711" : fill.color}
              onChange={(e) =>
                onUpdateData({ fill: { kind: "solid", color: e.target.value } })
              }
              className="w-10 h-8 rounded-btn border border-ink-100 cursor-pointer"
            />
            <input
              type="text"
              value={fill.color}
              onChange={(e) =>
                onUpdateData({ fill: { kind: "solid", color: e.target.value } })
              }
              className={inputCls() + " font-mono text-[11px]"}
              placeholder="#hex 또는 transparent"
            />
          </div>
        )}

        {fill.kind === "gradient" && (
          <GradientEditor
            gradient={fill.gradient}
            onChange={(g) =>
              onUpdateData({ fill: { kind: "gradient", gradient: g } })
            }
          />
        )}

        {fill.kind === "image" && (
          <div className="space-y-1.5">
            <input
              type="text"
              value={fill.url}
              onChange={(e) =>
                onUpdateData({
                  fill: { kind: "image", url: e.target.value, fit: fill.fit },
                })
              }
              placeholder="이미지 URL"
              className={inputCls() + " font-mono text-[11px]"}
            />
            <select
              value={fill.fit ?? "cover"}
              onChange={(e) =>
                onUpdateData({
                  fill: {
                    kind: "image",
                    url: fill.url,
                    fit: e.target.value as "cover" | "contain",
                  },
                })
              }
              className={inputCls()}
            >
              <option value="cover">덮기 (cover)</option>
              <option value="contain">포함 (contain)</option>
            </select>
          </div>
        )}
      </div>

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

      {/* 그림자 */}
      <ShadowEditor
        shadow={d.shadow}
        onChange={(s) => onUpdateData({ shadow: s })}
      />
    </div>
  );
}

function normalizeShapeFill(
  fill: CanvasShapeNode["data"]["fill"]
): ShapeFill {
  if (!fill) return { kind: "solid", color: "transparent" };
  if (typeof fill === "string") return { kind: "solid", color: fill };
  return fill;
}

function GradientEditor({
  gradient,
  onChange,
}: {
  gradient: Gradient;
  onChange: (g: Gradient) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="inline-flex bg-ink-50 border border-ink-100 rounded-btn p-0.5">
        {(["linear", "radial"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              if (k === "linear") {
                onChange({
                  kind: "linear",
                  angle: 90,
                  stops: gradient.stops,
                });
              } else {
                onChange({ kind: "radial", stops: gradient.stops });
              }
            }}
            className={
              "px-2.5 py-1 rounded text-[11px] font-semibold " +
              (gradient.kind === k
                ? "bg-ink-900 text-white"
                : "text-ink-500 hover:text-ink-900")
            }
          >
            {k === "linear" ? "선형" : "원형"}
          </button>
        ))}
      </div>
      {gradient.kind === "linear" && (
        <NumberField
          label="각도 (°)"
          value={gradient.angle}
          onChange={(v) =>
            onChange({ kind: "linear", angle: v, stops: gradient.stops })
          }
        />
      )}
      <div className="space-y-1.5">
        {gradient.stops.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="color"
              value={s.color}
              onChange={(e) => {
                const next = [...gradient.stops];
                next[i] = { ...s, color: e.target.value };
                onChange({ ...gradient, stops: next });
              }}
              className="w-8 h-7 rounded-btn border border-ink-100 cursor-pointer"
            />
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={s.offset}
              onChange={(e) => {
                const next = [...gradient.stops];
                next[i] = { ...s, offset: parseFloat(e.target.value) || 0 };
                onChange({ ...gradient, stops: next });
              }}
              className={inputCls() + " font-mono text-[11px] w-16"}
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...gradient,
                  stops: gradient.stops.filter((_, j) => j !== i),
                })
              }
              disabled={gradient.stops.length <= 2}
              className="w-6 h-6 grid place-items-center text-ink-500 hover:text-red-700 disabled:opacity-30"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...gradient,
              stops: [...gradient.stops, { offset: 0.5, color: "#FFFFFF" }],
            })
          }
          className="w-full py-1 rounded-btn border border-dashed border-ink-300 text-[11px] text-ink-500 hover:border-ink-900 hover:text-ink-900"
        >
          + stop
        </button>
      </div>
    </div>
  );
}

function ShadowEditor({
  shadow,
  onChange,
}: {
  shadow: { x: number; y: number; blur: number; color: string } | undefined;
  onChange: (s: { x: number; y: number; blur: number; color: string } | undefined) => void;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-[11px] uppercase tracking-wide font-bold text-ink-700">
        그림자
      </summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
          <input
            type="checkbox"
            checked={!!shadow}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? {
                      x: 0,
                      y: 8,
                      blur: 24,
                      color: "rgba(0,0,0,0.25)",
                    }
                  : undefined
              )
            }
            className="accent-ink-900"
          />
          그림자 사용
        </label>
        {shadow && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <NumberField
                label="X"
                value={shadow.x}
                onChange={(v) => onChange({ ...shadow, x: v })}
              />
              <NumberField
                label="Y"
                value={shadow.y}
                onChange={(v) => onChange({ ...shadow, y: v })}
              />
              <NumberField
                label="흐림"
                value={shadow.blur}
                onChange={(v) => onChange({ ...shadow, blur: v })}
              />
            </div>
            <input
              type="text"
              value={shadow.color}
              onChange={(e) =>
                onChange({ ...shadow, color: e.target.value })
              }
              className={inputCls() + " font-mono text-[11px]"}
              placeholder="rgba(0,0,0,0.25)"
            />
          </>
        )}
      </div>
    </details>
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

// ──────────────────────────────────────────────────────────────────────────
// Chart 노드 인스펙터 — 카테고리·시리즈 데이터 편집
// ──────────────────────────────────────────────────────────────────────────

function ChartNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasChartNode;
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const d = node.data;
  const updateSeries = (idx: number, patch: Partial<ChartSeriesLike>) => {
    const next = [...d.series];
    next[idx] = { ...next[idx], ...patch };
    onUpdateData({ series: next });
  };
  const removeSeries = (idx: number) => {
    onUpdateData({ series: d.series.filter((_, i) => i !== idx) });
  };
  const addSeries = () => {
    onUpdateData({
      series: [
        ...d.series,
        {
          name: `시리즈 ${d.series.length + 1}`,
          data: d.categories.map(() => 0),
        },
      ],
    });
  };

  return (
    <div className="space-y-3">
      <Field label="차트 종류">
        <select
          value={d.kind}
          onChange={(e) => onUpdateData({ kind: e.target.value })}
          className={inputCls()}
        >
          <option value="line">선 차트</option>
          <option value="bar">막대 차트</option>
          <option value="area">면적 차트</option>
          <option value="mixed">혼합 (시리즈별)</option>
        </select>
      </Field>

      <Field label="차트 배경색 (비우면 투명)">
        <div className="flex gap-1.5">
          <input
            type="color"
            value={d.background ?? "#FFFFFF"}
            onChange={(e) => onUpdateData({ background: e.target.value })}
            className="w-9 h-9 rounded border border-ink-100 cursor-pointer p-0"
          />
          <input
            type="text"
            value={d.background ?? ""}
            onChange={(e) =>
              onUpdateData({ background: e.target.value || undefined })
            }
            placeholder="투명"
            className={inputCls() + " font-mono text-[11px] flex-1"}
          />
          {d.background && (
            <button
              type="button"
              onClick={() => onUpdateData({ background: undefined })}
              className="px-2 rounded border border-ink-100 text-[10.5px] text-ink-500 hover:text-ink-900 hover:border-ink-900"
              title="배경 지우기"
            >
              ✕
            </button>
          )}
        </div>
      </Field>

      <Field label="카테고리 (쉼표 구분, x축 라벨)">
        <input
          type="text"
          value={d.categories.join(",")}
          onChange={(e) => {
            const cats = e.target.value.split(",").map((s) => s.trim());
            const series = d.series.map((s) => ({
              ...s,
              data: cats.map((_, i) => s.data[i] ?? 0),
            }));
            onUpdateData({ categories: cats, series });
          }}
          className={inputCls()}
        />
      </Field>

      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide font-bold text-ink-700">
        <span>시리즈</span>
        <button
          type="button"
          onClick={addSeries}
          className="text-[10.5px] font-semibold text-brand-500 hover:underline"
        >
          + 추가
        </button>
      </div>

      {d.series.map((s, i) => (
        <div
          key={i}
          className="rounded border border-ink-100 p-2 space-y-1.5 bg-ink-50"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={s.name}
              onChange={(e) => updateSeries(i, { name: e.target.value })}
              className={inputCls() + " flex-1"}
              placeholder="시리즈 이름"
            />
            <input
              type="color"
              value={normalizeColorForInput(s.color)}
              onChange={(e) => updateSeries(i, { color: e.target.value })}
              className="w-7 h-7 rounded border border-ink-100 cursor-pointer p-0"
            />
            <button
              type="button"
              onClick={() => removeSeries(i)}
              className="w-7 h-7 grid place-items-center rounded hover:bg-red-50 text-ink-400 hover:text-red-700"
              title="삭제"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          {d.kind === "mixed" && (
            <select
              value={s.kind ?? "line"}
              onChange={(e) =>
                updateSeries(i, {
                  kind: e.target.value as "line" | "bar" | "area",
                })
              }
              className={inputCls() + " text-[11px]"}
            >
              <option value="line">선</option>
              <option value="bar">막대</option>
              <option value="area">면적</option>
            </select>
          )}
          <input
            type="text"
            value={s.data.join(",")}
            onChange={(e) =>
              updateSeries(i, {
                data: e.target.value
                  .split(",")
                  .map((v) => Number(v.trim()) || 0),
              })
            }
            className={inputCls() + " font-mono text-[11px]"}
            placeholder="값 (쉼표 구분)"
          />
          <div className="flex gap-2 text-[10.5px] text-ink-500">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={s.showLabels ?? false}
                onChange={(e) =>
                  updateSeries(i, { showLabels: e.target.checked })
                }
                className="accent-ink-900"
              />
              값 표시
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={s.showDots ?? true}
                onChange={(e) =>
                  updateSeries(i, { showDots: e.target.checked })
                }
                className="accent-ink-900"
              />
              점 표시
            </label>
          </div>
        </div>
      ))}

      <hr className="border-ink-100" />
      <div className="grid grid-cols-2 gap-2 text-[10.5px]">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={d.showLegend ?? true}
            onChange={(e) => onUpdateData({ showLegend: e.target.checked })}
            className="accent-ink-900"
          />
          범례
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={d.showGrid ?? true}
            onChange={(e) => onUpdateData({ showGrid: e.target.checked })}
            className="accent-ink-900"
          />
          그리드
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={d.showAxes ?? true}
            onChange={(e) => onUpdateData({ showAxes: e.target.checked })}
            className="accent-ink-900"
          />
          축 라벨
        </label>
      </div>

      <hr className="border-ink-100" />
      <div className="space-y-1.5">
        <div className="text-[10.5px] uppercase tracking-wide font-bold text-ink-500">
          PNG 추출
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => void downloadChartPng(node.id, 2, false)}
            className="px-2 py-1.5 rounded border border-ink-100 text-[11px] font-semibold hover:border-ink-900 hover:bg-ink-50"
          >
            배경 포함
          </button>
          <button
            type="button"
            onClick={() => void downloadChartPng(node.id, 2, true)}
            className="px-2 py-1.5 rounded border border-ink-100 text-[11px] font-semibold hover:border-ink-900 hover:bg-ink-50"
          >
            투명 배경
          </button>
        </div>
        <p className="text-[10.5px] text-ink-500 leading-snug">
          2배 해상도로 다운로드. 투명 배경은 차트 위에 다른 디자인 얹을 때 사용.
        </p>
      </div>
    </div>
  );
}

type ChartSeriesLike = CanvasChartNode["data"]["series"][number];

function normalizeColorForInput(c: string | undefined): string {
  if (!c) return "#DB0711";
  if (c.startsWith("#")) return c;
  // CSS var or named → fallback
  return "#DB0711";
}

/**
 * 차트 노드 PNG 추출 — DOM 에 렌더링된 차트 SVG 를 캔버스로 변환해 다운로드.
 * 투명 배경 옵션: data.background 가 비어있으면 자동으로 투명.
 */
async function downloadChartPng(
  nodeId: string,
  scale = 2,
  transparent = false
): Promise<void> {
  // 캔버스 안의 해당 노드 element 안에서 SVG 찾기
  // 가장 안전: 임시로 chartNode 의 ChartNodeView 를 새 SVG 로 렌더 → serialize
  // 여기서는 페이지에 이미 렌더된 SVG 를 잡아 변환.
  const all = document.querySelectorAll(`[data-node-id="${nodeId}"] svg`);
  const svgEl = all[0] as SVGSVGElement | undefined;
  if (!svgEl) {
    alert("차트 SVG 를 찾지 못했습니다. 캔버스에 보이는 상태에서 시도해주세요.");
    return;
  }
  // 사이즈 추정 (viewBox 우선)
  const vb = svgEl.viewBox.baseVal;
  const W = vb && vb.width > 0 ? vb.width : svgEl.clientWidth || 1000;
  const H = vb && vb.height > 0 ? vb.height : svgEl.clientHeight || 600;

  // SVG 직렬화
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns"))
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // 투명 배경 옵션: 첫 rect (배경) 가 있으면 제거
  if (transparent) {
    const firstRect = clone.querySelector("rect");
    if (
      firstRect &&
      firstRect.getAttribute("x") === "0" &&
      firstRect.getAttribute("y") === "0" &&
      firstRect.getAttribute("width") === String(W) &&
      firstRect.getAttribute("height") === String(H)
    ) {
      firstRect.remove();
    }
  }
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  // <img> → canvas → PNG
  await new Promise<void>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = W * scale;
        canvas.height = H * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context 실패"));
          return;
        }
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, W, H);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("toBlob 실패"));
            return;
          }
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = `chart-${nodeId.slice(0, 6)}${transparent ? "-transparent" : ""}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
          resolve();
        }, "image/png");
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("SVG 로드 실패"));
    img.src = url;
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Icon 노드 인스펙터 — lucide 이름 + 색·두께 / emoji 모드
// ──────────────────────────────────────────────────────────────────────────

function IconNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasIconNode;
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const d = node.data;
  return (
    <div className="space-y-2">
      <Field label="아이콘 세트">
        <select
          value={d.set}
          onChange={(e) => onUpdateData({ set: e.target.value })}
          className={inputCls()}
        >
          <option value="lucide">Lucide (선 아이콘)</option>
          <option value="emoji">Emoji</option>
        </select>
      </Field>
      {d.set === "lucide" ? (
        <>
          <Field
            label="아이콘 이름 (예: Star, Pin, Award, MapPin, Flag, BarChart3)"
          >
            <input
              type="text"
              value={d.name}
              onChange={(e) => onUpdateData({ name: e.target.value })}
              className={inputCls() + " font-mono text-[11px]"}
              placeholder="Star"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2 items-center">
            <Field label="색">
              <input
                type="color"
                value={normalizeColorForInput(d.color)}
                onChange={(e) => onUpdateData({ color: e.target.value })}
                className="w-full h-8 rounded border border-ink-100 cursor-pointer p-0"
              />
            </Field>
            <Field label="선 두께">
              <input
                type="number"
                step={0.25}
                min={0.5}
                max={4}
                value={d.strokeWidth ?? 1.5}
                onChange={(e) =>
                  onUpdateData({ strokeWidth: Number(e.target.value) })
                }
                className={inputCls()}
              />
            </Field>
          </div>
          <div className="text-[10.5px] text-ink-500 leading-snug">
            아이콘 검색 →{" "}
            <a
              href="https://lucide.dev/icons/"
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 underline"
            >
              lucide.dev
            </a>{" "}
            (PascalCase 그대로 입력)
          </div>
          <div className="grid grid-cols-6 gap-1 mt-2">
            {ICON_PRESETS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onUpdateData({ name })}
                className={
                  "aspect-square grid place-items-center rounded border text-ink-700 " +
                  (d.name === name
                    ? "border-brand-500 bg-brand-50"
                    : "border-ink-100 hover:border-ink-900 hover:bg-ink-50")
                }
                title={name}
              >
                <IconNodeView
                  node={{
                    ...node,
                    data: { ...d, name, set: "lucide" },
                  }}
                />
              </button>
            ))}
          </div>
        </>
      ) : (
        <Field label="Emoji (한 글자)">
          <input
            type="text"
            value={d.name}
            onChange={(e) => onUpdateData({ name: e.target.value })}
            className={inputCls() + " text-[20px] text-center"}
            placeholder="📌"
          />
        </Field>
      )}
    </div>
  );
}

const ICON_PRESETS = [
  "Pin",
  "Star",
  "Award",
  "MapPin",
  "Flag",
  "Sparkles",
  "Bookmark",
  "Trophy",
  "Target",
  "Crown",
  "Heart",
  "Zap",
  "TrendingUp",
  "Check",
  "ArrowRight",
  "ChevronRight",
  "Circle",
  "Square",
];

// ──────────────────────────────────────────────────────────────────────────
// Component 노드 인스펙터 — kind 별 텍스트 필드 노출
// ──────────────────────────────────────────────────────────────────────────

function ComponentNodeInspector({
  node,
  onUpdateData,
}: {
  node: CanvasComponentNode;
  onUpdateData: (p: Record<string, unknown>) => void;
}) {
  const meta = COMPONENT_META_DEPRECATED[node.componentKind] ?? {
    label: node.componentKind,
    desc: "(구) 컴포넌트 — 더 이상 지원하지 않습니다. 삭제 후 새로 만드세요.",
  };
  const d = node.data as Record<string, unknown>;

  return (
    <div className="space-y-3">
      <div className="bg-brand-50 border border-brand-500 rounded-btn px-3 py-2 text-[11px]">
        <div className="font-num font-bold text-brand-500 uppercase tracking-widest text-[10px] mb-1">
          ★ {meta.label}
        </div>
        <div className="text-ink-700">{meta.desc}</div>
      </div>

      {/* 공통 텍스트 필드 (있는 경우만) */}
      {"eyebrow" in d && (
        <StringField
          label="상단 라벨 (eyebrow)"
          value={(d.eyebrow as string) ?? ""}
          onChange={(v) => onUpdateData({ eyebrow: v })}
        />
      )}
      {"title" in d && (
        <StringField
          label="제목"
          value={(d.title as string) ?? ""}
          onChange={(v) => onUpdateData({ title: v })}
        />
      )}
      {"subtitle" in d && (
        <StringField
          label="부제"
          value={(d.subtitle as string) ?? ""}
          onChange={(v) => onUpdateData({ subtitle: v })}
        />
      )}
      {"headline" in d && (
        <StringField
          label="헤드라인"
          value={(d.headline as string) ?? ""}
          onChange={(v) => onUpdateData({ headline: v })}
        />
      )}
      {"description" in d && (
        <StringField
          label="설명"
          value={(d.description as string) ?? ""}
          onChange={(v) => onUpdateData({ description: v })}
          multiline
        />
      )}
      {"footnote" in d && (
        <StringField
          label="각주"
          value={(d.footnote as string) ?? ""}
          onChange={(v) => onUpdateData({ footnote: v })}
          multiline
        />
      )}

      {/* bigStat */}
      {node.componentKind === "bigStat" && (
        <>
          <StringField
            label="큰 숫자"
            value={(d.value as string) ?? ""}
            onChange={(v) => onUpdateData({ value: v })}
          />
          <StringField
            label="단위"
            value={(d.valueSuffix as string) ?? ""}
            onChange={(v) => onUpdateData({ valueSuffix: v })}
          />
          <StringField
            label="라벨"
            value={(d.label as string) ?? ""}
            onChange={(v) => onUpdateData({ label: v })}
          />
        </>
      )}

      {/* textHero / cta — lines */}
      {(node.componentKind === "textHero" || node.componentKind === "cta") && (
        <StringField
          label="줄별 (한 줄에 1행, * 시작 = 빨강 강조)"
          value={((d.lines as string[]) ?? []).join("\n")}
          onChange={(v) => onUpdateData({ lines: v.split("\n") })}
          multiline
        />
      )}

      {/* cta 버튼 */}
      {node.componentKind === "cta" && (
        <>
          <StringField
            label="기본 버튼 라벨"
            value={(d.primaryLabel as string) ?? ""}
            onChange={(v) => onUpdateData({ primaryLabel: v })}
          />
          <StringField
            label="기본 버튼 링크"
            value={(d.primaryHref as string) ?? ""}
            onChange={(v) => onUpdateData({ primaryHref: v })}
            mono
          />
          <StringField
            label="보조 버튼 라벨"
            value={(d.secondaryLabel as string) ?? ""}
            onChange={(v) => onUpdateData({ secondaryLabel: v })}
          />
          <StringField
            label="보조 버튼 링크"
            value={(d.secondaryHref as string) ?? ""}
            onChange={(v) => onUpdateData({ secondaryHref: v })}
            mono
          />
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input
              type="checkbox"
              checked={(d.showContact as boolean) ?? false}
              onChange={(e) =>
                onUpdateData({ showContact: e.target.checked })
              }
              className="accent-ink-900"
            />
            사무국 연락처 노출
          </label>
        </>
      )}

      {/* slotsTeaser */}
      {node.componentKind === "slotsTeaser" && (
        <>
          <StringField
            label="카테고리 slug (콤마 구분)"
            value={((d.categorySlugs as string[]) ?? []).join(", ")}
            onChange={(v) =>
              onUpdateData({
                categorySlugs: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            mono
          />
          <Field label="레이아웃">
            <select
              value={(d.layout as string) ?? "grid"}
              onChange={(e) => onUpdateData({ layout: e.target.value })}
              className={inputCls()}
            >
              <option value="grid">그리드</option>
              <option value="row">가로 스크롤</option>
            </select>
          </Field>
        </>
      )}

      {/* richText */}
      {node.componentKind === "richText" && (
        <StringField
          label="본문"
          value={(d.body as string) ?? ""}
          onChange={(v) => onUpdateData({ body: v })}
          multiline
        />
      )}

      {/* 배열형 (cards / steps / years) — JSON 편집 */}
      {(["cards", "steps", "years"] as const).map((k) =>
        Array.isArray(d[k]) ? (
          <div key={k}>
            <Field
              label={
                k === "cards" ? "카드 (JSON)" : k === "steps" ? "단계 (JSON)" : "연도 (JSON)"
              }
            >
              <textarea
                defaultValue={JSON.stringify(d[k], null, 2)}
                onBlur={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) onUpdateData({ [k]: parsed });
                  } catch {
                    alert("JSON 파싱 실패. 형식을 확인하세요.");
                  }
                }}
                className={inputCls() + " font-mono text-[11px] min-h-[180px]"}
              />
            </Field>
          </div>
        ) : null
      )}

      <p className="text-[10.5px] text-ink-500 leading-snug pt-2 border-t border-ink-100">
        💡 컴포넌트는 노드 크기 안에 자동 맞춤. 더 큰 디자인이 필요하면 노드를
        리사이즈하세요.
      </p>
    </div>
  );
}

function StringField({
  label,
  value,
  onChange,
  multiline,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  mono?: boolean;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            inputCls() +
            " min-h-[60px] " +
            (mono ? "font-mono text-[11px]" : "")
          }
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls() + (mono ? " font-mono text-[11px]" : "")}
        />
      )}
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

function AlignBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-7 h-7 grid place-items-center rounded hover:bg-ink-100 text-ink-700 text-[14px] font-bold"
    >
      {children}
    </button>
  );
}

function LayerRow({
  node,
  selected,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onForward,
  onBackward,
}: {
  node: CanvasNode;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onForward: () => void;
  onBackward: () => void;
}) {
  const label =
    node.name ||
    (node.type === "text"
      ? (node as CanvasTextNode).data.content?.slice(0, 14) || "텍스트"
      : NODE_TYPE_LABEL[node.type] || node.type);
  const Icon =
    node.type === "text"
      ? TypeIcon
      : node.type === "image"
        ? ImageIcon
        : node.type === "shape"
          ? Square
          : node.type === "button"
            ? MousePointer
            : node.type === "video"
              ? Video
              : Square;
  return (
    <div
      onClick={(e) => onSelect(e.shiftKey)}
      className={
        "group flex items-center gap-1 px-1.5 py-1 rounded text-[11px] cursor-pointer " +
        (selected ? "bg-brand-50 text-ink-900" : "hover:bg-ink-50 text-ink-700")
      }
      style={{ opacity: node.hidden ? 0.45 : 1 }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleHidden();
        }}
        className="w-5 h-5 grid place-items-center rounded hover:bg-ink-100 text-ink-500"
        title={node.hidden ? "표시" : "숨김"}
      >
        {node.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLocked();
        }}
        className="w-5 h-5 grid place-items-center rounded hover:bg-ink-100 text-ink-500"
        title={node.locked ? "잠금 해제" : "잠금"}
      >
        {node.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 opacity-30" />}
      </button>
      <Icon className="w-3 h-3 text-ink-400 shrink-0" />
      <span className="truncate flex-1 min-w-0">{label}</span>
      <div className="flex opacity-0 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onForward();
          }}
          className="w-5 h-5 grid place-items-center rounded hover:bg-ink-100 text-ink-500"
          title="위로 (앞으로)"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBackward();
          }}
          className="w-5 h-5 grid place-items-center rounded hover:bg-ink-100 text-ink-500"
          title="아래로 (뒤로)"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
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
  chart: "차트",
  icon: "아이콘",
  component: "컴포넌트",
};

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/**
 * 드래그 중 다른 노드의 가장자리·중심·캔버스 중앙에 자석 스냅.
 * 임계값(threshold) 안이면 좌표를 끌어당기고, 정렬된 라인을 가이드로 반환.
 */
function applySnap(
  rawX: number,
  rawY: number,
  w: number,
  h: number,
  otherNodes: CanvasNode[],
  threshold: number
): { x: number; y: number; guidesV: number[]; guidesH: number[] } {
  // 현재 드래그 중 노드의 후보 라인 (left/centerX/right) × (top/centerY/bottom)
  const myXs = [rawX, rawX + w / 2, rawX + w];
  const myYs = [rawY, rawY + h / 2, rawY + h];

  // 정렬 후보 라인 — 다른 노드들 + 캔버스 좌·중앙·우
  const targetXs: number[] = [0, CANVAS_W / 2, CANVAS_W];
  const targetYs: number[] = [0, CANVAS_H / 2, CANVAS_H];
  for (const n of otherNodes) {
    targetXs.push(n.rect.x, n.rect.x + n.rect.w / 2, n.rect.x + n.rect.w);
    targetYs.push(n.rect.y, n.rect.y + n.rect.h / 2, n.rect.y + n.rect.h);
  }

  // X축 — 가장 가까운 한 쌍 (myXs[i], targetXs[j])
  let bestDx = Infinity;
  let snappedX = rawX;
  const guidesV: number[] = [];
  for (let i = 0; i < myXs.length; i++) {
    for (const t of targetXs) {
      const d = Math.abs(myXs[i] - t);
      if (d <= threshold && d < bestDx) {
        bestDx = d;
        // myXs[i] 가 t에 맞춰지도록 rawX 보정
        snappedX = t - (myXs[i] - rawX);
      }
    }
  }
  // 스냅 발생 시 정렬된 라인을 가이드로 (스냅 후 좌표 기준)
  if (bestDx <= threshold) {
    const myXsAfter = [snappedX, snappedX + w / 2, snappedX + w];
    for (const mx of myXsAfter) {
      for (const t of targetXs) {
        if (Math.abs(mx - t) < 0.5) {
          if (!guidesV.includes(t)) guidesV.push(t);
        }
      }
    }
  }

  // Y축 — 동일 로직
  let bestDy = Infinity;
  let snappedY = rawY;
  const guidesH: number[] = [];
  for (let i = 0; i < myYs.length; i++) {
    for (const t of targetYs) {
      const d = Math.abs(myYs[i] - t);
      if (d <= threshold && d < bestDy) {
        bestDy = d;
        snappedY = t - (myYs[i] - rawY);
      }
    }
  }
  if (bestDy <= threshold) {
    const myYsAfter = [snappedY, snappedY + h / 2, snappedY + h];
    for (const my of myYsAfter) {
      for (const t of targetYs) {
        if (Math.abs(my - t) < 0.5) {
          if (!guidesH.includes(t)) guidesH.push(t);
        }
      }
    }
  }

  return { x: snappedX, y: snappedY, guidesV, guidesH };
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
    case "chart":
      return {
        ...base,
        rect: { ...base.rect, w: 900, h: 540 },
        type: "chart",
        data: {
          kind: "line",
          categories: ["2023", "2024", "2025"],
          series: [
            {
              name: "방문객",
              data: [70163, 70760, 72507],
              showDots: true,
              showLabels: true,
            },
          ],
          showLegend: true,
          showGrid: true,
          showAxes: true,
        },
      };
    case "icon":
      return {
        ...base,
        rect: { ...base.rect, w: 120, h: 120 },
        type: "icon",
        data: { set: "lucide", name: "Star", color: "var(--brand-500)", strokeWidth: 1.5 },
      };
    case "component":
      // (deprecated) makeNode 는 primitives 전용. component 는 어드민에서 더 이상 추가 불가.
      // 옛 데이터 호환을 위해 fallback 만 반환.
      return {
        ...base,
        type: "component",
        componentKind: "cover",
        data: _defaultComponentDataDeprecated("cover"),
      };
  }
}

// ============================================================================
// 슬라이드 템플릿 — 참고 슬라이드 5장 수준의 구도를 한 번에 깔아주는 노드 묶음
// ============================================================================

type SlideTemplateKey =
  | "chartHero"
  | "growthCallout"
  | "benefits4"
  | "process4"
  | "menuGrid"
  | "bigTitle"
  | "introWithVideo"
  | "cover"
  | "coverKimes"
  | "contents"
  | "kprintChartHero"
  | "kprintGrowthCallout"
  | "kprintMenuGrid";

type TemplateGroup = "공통" | "KIMES" | "K-PRINT";

function tplNode<T extends CanvasNode>(n: T): T {
  return { ...n, id: randomId() } as T;
}

const SLIDE_TEMPLATES: ReadonlyArray<{
  key: SlideTemplateKey;
  label: string;
  desc: string;
  group: TemplateGroup;
  make: () => CanvasNode[];
}> = [
  // ─── 공통 (이벤트 무관) ───
  {
    key: "cover",
    label: "표지 / Cover",
    desc: "이벤트 풀네임 + 큰 로고 텍스트 + SPONSORSHIP",
    group: "공통",
    make: () => coverNodes(),
  },
  {
    key: "contents",
    label: "목차 / Contents",
    desc: "좌측 Contents / 우측 섹션·페이지 번호 (Introduction · Application)",
    group: "공통",
    make: () => contentsNodes(),
  },
  {
    key: "introWithVideo",
    label: "히어로 카피 + 폰 영상",
    desc: "좌측 브랜드 로고 + 큰 타이틀 + 설명 / 우측 휴대폰 mockup + 영상 자리",
    group: "공통",
    make: () => introWithVideoNodes(),
  },
  {
    key: "bigTitle",
    label: "타이틀 + 부제",
    desc: "중앙 큰 헤드라인 한 줄",
    group: "공통",
    make: () => [
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 200, y: 400, w: 1520, h: 160 },
        type: "text",
        data: { content: "큰 타이틀을 입력하세요", fontSize: 96, fontWeight: 800, align: "center", color: "#0A0A0A" },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 200, y: 580, w: 1520, h: 80 },
        type: "text",
        data: { content: "부제 텍스트", fontSize: 28, fontWeight: 500, align: "center", color: "#737373" },
      }),
    ],
  },
  {
    key: "benefits4",
    label: "혜택 카드 2×2",
    desc: "좌측 큰 타이틀 / 우측 4개 카드",
    group: "공통",
    make: () => [
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 100, y: 380, w: 700, h: 100 },
        type: "text",
        data: { content: "Sponsors Benefits", fontSize: 72, fontWeight: 800, color: "#0A0A0A" },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 100, y: 500, w: 700, h: 100 },
        type: "text",
        data: { content: "스폰서십 리뉴얼 기념\n신청 기업 대상 특별 이벤트!", fontSize: 22, fontWeight: 500, lineHeight: 1.6, color: "#737373" },
      }),
      ...benefitCards(),
    ],
  },
  {
    key: "process4",
    label: "신청 절차 4단계",
    desc: "01 02 03 04 카드 4개",
    group: "공통",
    make: () => [
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 100, y: 120, w: 1720, h: 100 },
        type: "text",
        data: { content: "신청 절차", fontSize: 64, fontWeight: 800, align: "center", color: "#0A0A0A" },
      }),
      ...processCards(),
    ],
  },
  // ─── KIMES 전용 ───
  {
    key: "chartHero",
    label: "방문객 차트 + 헤드라인 (KIMES)",
    desc: "원본 Figma 픽셀 좌표 그대로 — 전체 참관객 라인 + 해외바이어 막대 + 잠재/유망고객 카드",
    group: "KIMES",
    make: () => chartHeroNodes(),
  },
  {
    key: "growthCallout",
    label: "스폰서십 진행 기업 차트 (KIMES)",
    desc: "상단 큰 헤드라인 + 좌측 카피 / 하단 풀폭 라인 차트 + 회색 칩 vline + 끝 라벨 + 빨간 브래킷",
    group: "KIMES",
    make: () => [
      // 큰 헤드라인 (Pretendard 800, 검정)
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 100, y: 90, w: 1500, h: 100 },
        type: "text",
        data: {
          content: "스폰서십 진행 기업 고객 유입데이터",
          fontSize: 64,
          fontWeight: 800,
          lineHeight: 1.3,
          color: "#0A0A0A",
        },
      }),
      // 설명 카피 (좌측, 회색)
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 100, y: 230, w: 800, h: 160 },
        type: "text",
        data: {
          content:
            "스폰서십의 효과에 대해 고민하고 계신가요?\n참가업체 검색 페이지 내 상위 고정을 통해\n타기업 대비 14배의 노출 효과를 누리실 수 있습니다.",
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.6,
          color: "#0A0A0A",
        },
      }),
      // "비활용 기업 대비 14배 상승" — 차트 위쪽 굵은 글씨 (별도 텍스트 노드로)
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 1050, y: 410, w: 770, h: 60, z: 5 },
        type: "text",
        data: {
          content: "비활용 기업 대비 14배 상승",
          fontSize: 32,
          fontWeight: 700,
          align: "right",
          color: "#0A0A0A",
        },
      }),
      // 차트 자체 — 풀폭, 어노테이션은 vline + bracket + 시리즈 끝 라벨
      tplNode<CanvasChartNode>({
        id: "",
        rect: { x: 80, y: 470, w: 1760, h: 480 },
        type: "chart",
        data: {
          kind: "line",
          categories: ["", "", "", "", "", "", "", "", ""],
          series: [
            {
              name: "진행 기업",
              color: "#DB0711",
              kind: "area",
              data: [2, 3, 4, 5, 40, 75, 92, 94, 95],
              showDots: false,
              endLabel: true,
            },
            {
              name: "미진행 기업",
              color: "#0A0A0A",
              kind: "line",
              data: [2, 3, 4, 5, 7, 9, 11, 13, 15],
              showDots: false,
              endLabel: true,
            },
          ],
          showLegend: false,
          showGrid: true,
          showAxes: false,
          annotations: [
            { kind: "vline", at: 3, text: "스폰서십 진행 시점" },
            { kind: "bracket", from: 3, to: 8, text: "스폰서십 광고 진행 이후 유입" },
          ],
        },
      }),
      // 출처 (우하단)
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 1620, y: 1020, w: 240, h: 30, z: 5 },
        type: "text",
        data: {
          content: "Source: KIMES Internal data",
          fontSize: 13,
          fontWeight: 300,
          align: "right",
          color: "#808080",
        },
      }),
    ],
  },
  {
    key: "coverKimes",
    label: "표지 / Cover (KIMES BUSAN)",
    desc: "KIMES BUSAN 톤 — 빨간 KIMES BUSAN 로고 + SPONSORSHIP",
    group: "KIMES",
    make: () => coverKimesNodes(),
  },
  {
    key: "menuGrid",
    label: "스폰서십 메뉴 3×4 (KIMES)",
    desc: "탭 헤더 + 12개 메뉴 칩 (전광판, 천장배너, 참관객 목걸이 등)",
    group: "KIMES",
    make: () => [
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 100, y: 80, w: 1720, h: 100 },
        type: "text",
        data: { content: "KIMES 스폰서십 한눈에 보기", fontSize: 48, fontWeight: 800, align: "center", color: "#0A0A0A" },
      }),
      ...tabHeaders(),
      ...menuGridChips(),
    ],
  },

  // ─── K-PRINT 전용 ───
  {
    key: "kprintChartHero",
    label: "방문객 차트 + 헤드라인 (K-PRINT)",
    desc: "K-PRINT 데이터 — 인쇄·출판 산업 참관객 추이",
    group: "K-PRINT",
    make: () => kprintChartHeroNodes(),
  },
  {
    key: "kprintGrowthCallout",
    label: "스폰서십 진행 기업 차트 (K-PRINT)",
    desc: "K-PRINT 검색 페이지 상위 고정 — 14배 노출 효과",
    group: "K-PRINT",
    make: () => kprintGrowthCalloutNodes(),
  },
  {
    key: "kprintMenuGrid",
    label: "스폰서십 메뉴 3×4 (K-PRINT)",
    desc: "K-PRINT 스폰서십 광고 메뉴 12종",
    group: "K-PRINT",
    make: () => [
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: 100, y: 80, w: 1720, h: 100 },
        type: "text",
        data: { content: "K-PRINT 스폰서십 한눈에 보기", fontSize: 48, fontWeight: 800, align: "center", color: "#0A0A0A" },
      }),
      ...tabHeaders(),
      ...kprintMenuGridChips(),
    ],
  },
];

// 원본 Figma "Slide 16:9 - 446" 픽셀 좌표 그대로 옮긴 차트 슬라이드
function chartHeroNodes(): CanvasNode[] {
  const brand = "#DB0711";
  const dashGray = "#989898";
  const out: CanvasNode[] = [];

  // ─── 메인 헤드라인 (우상단, 빨간 굵은 글씨) ───
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 1155, y: 219, w: 632, h: 154, z: 10 },
      type: "text",
      data: {
        content: "매년 70,000명 이상이 방문하는\nKIMES에서 브랜드를 홍보하세요!",
        fontSize: 48,
        fontWeight: 700,
        lineHeight: 1.6,
        color: brand,
      },
    }),
  );

  // ─── 범례 (좌상단 — 전체 참관객 / 해외바이어) ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 156, y: 167, w: 12, h: 12, z: 10 },
      type: "shape",
      data: { shape: "ellipse", fill: "#F6F6F6", stroke: brand, strokeWidth: 2 },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 203, y: 158, w: 180, h: 28, z: 10 },
      type: "text",
      data: { content: "전체 참관객", fontSize: 20, fontWeight: 400, color: "#0A0A0A" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 143, y: 217, w: 40, h: 40, z: 10 },
      type: "shape",
      data: { shape: "rect", fill: "#DADADA" },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 203, y: 222, w: 180, h: 28, z: 10 },
      type: "text",
      data: { content: "해외바이어", fontSize: 20, fontWeight: 400, color: "#0A0A0A" },
    }),
  );

  // ─── 점선 세로선 (각 라인 포인트에서 baseline 까지) ───
  // 2023: x=185.55, 길이 482, top=451.86 → y 범위 451.86 → 933.86
  // 2024: x=444.55, 길이 523, top=410.86 → y 범위 410.86 → 933.86
  // 2025: x=722.55, 길이 662, top=271.86 → y 범위 271.86 → 933.86
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 184, y: 451, w: 2, h: 482, z: 1 },
      type: "shape",
      data: { shape: "rect", fill: dashGray, strokeDasharray: "0", strokeWidth: 0 },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 444, y: 410, w: 2, h: 523, z: 1 },
      type: "shape",
      data: { shape: "rect", fill: dashGray, strokeWidth: 0 },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 722, y: 271, w: 2, h: 662, z: 1 },
      type: "shape",
      data: { shape: "rect", fill: dashGray, strokeWidth: 0 },
    }),
  );
  // 점선 가로 (72,507명 점에서 우측 스택바까지)
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 723, y: 269, w: 117, h: 2, z: 1 },
      type: "shape",
      data: { shape: "rect", fill: dashGray, strokeWidth: 0 },
    }),
  );

  // ─── 회색 막대 (해외바이어 — 2023/2024/2025) ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 170, y: 823, w: 32, h: 110, z: 3 },
      type: "shape",
      data: { shape: "rect", fill: "#DADADA" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 430, y: 729, w: 32, h: 204, z: 3 },
      type: "shape",
      data: { shape: "rect", fill: "#DADADA" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 707, y: 651, w: 32, h: 282, z: 3 },
      type: "shape",
      data: { shape: "rect", fill: "#DADADA" },
    }),
  );

  // ─── 라인 차트 선분 (라인은 shape line 으로 구현 못하므로 좁고 긴 사각형으로 근사)
  // 70,163 (185,451) → 70,760 (445,410) : 가로 거리 260, 세로 거리 -41 → 각도 -9°
  // 70,760 (445,410) → 72,507 (723,271) : 가로 거리 278, 세로 거리 -139 → 각도 -27°
  // 단순화: 가로 막대 + rotate
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 185, y: 430, w: 264, h: 2, z: 4, rotate: -9 },
      type: "shape",
      data: { shape: "rect", fill: brand },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 445, y: 340, w: 312, h: 2, z: 4, rotate: -26.5 },
      type: "shape",
      data: { shape: "rect", fill: brand },
    }),
  );

  // ─── 라인 차트 포인트 (흰 원 + 빨간 테두리) ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 180, y: 444, w: 12, h: 12, z: 5 },
      type: "shape",
      data: { shape: "ellipse", fill: "#F6F6F6", stroke: brand, strokeWidth: 2 },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 439, y: 402, w: 12, h: 12, z: 5 },
      type: "shape",
      data: { shape: "ellipse", fill: "#F6F6F6", stroke: brand, strokeWidth: 2 },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 717, y: 265, w: 12, h: 12, z: 5 },
      type: "shape",
      data: { shape: "ellipse", fill: "#F6F6F6", stroke: brand, strokeWidth: 2 },
    }),
  );

  // ─── 빨간 테두리 박스 (3 라인 포인트를 감싸는 사각형) ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 185, y: 269, w: 538, h: 182, z: 2 },
      type: "shape",
      data: { shape: "rect", fill: "transparent", stroke: brand, strokeWidth: 2 },
    }),
  );

  // ─── 데이터 값 라벨 ───
  const dataLabel = (x: number, y: number, text: string) =>
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x, y, w: 100, h: 29, z: 6 },
      type: "text",
      data: { content: text, fontSize: 18, fontWeight: 400, color: "#0A0A0A" },
    });
  out.push(
    dataLabel(156, 403, "70,163명"),
    dataLabel(153, 788, "3,029명"),
    dataLabel(415, 356, "70,760명"),
    dataLabel(412, 694, "4,274명"),
    dataLabel(693, 215, "72,507명"),
    dataLabel(701, 622, "4,941명"),
  );

  // ─── x축 라벨 (2023 / 2024 / 2025 / KIMES 방문객 현황) ───
  // x축 라인
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 84, y: 935, w: 1724, h: 2, z: 1 },
      type: "shape",
      data: { shape: "rect", fill: "#A9A9A9" },
    }),
  );
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 171, y: 952, w: 60, h: 29, z: 6 },
      type: "text",
      data: { content: "2023", fontSize: 18, fontWeight: 400, color: "#0A0A0A" },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 422, y: 952, w: 60, h: 29, z: 6 },
      type: "text",
      data: { content: "2024", fontSize: 18, fontWeight: 400, color: "#0A0A0A" },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 701, y: 952, w: 60, h: 29, z: 6 },
      type: "text",
      data: { content: "2025", fontSize: 18, fontWeight: 400, color: "#0A0A0A" },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 438, y: 1008, w: 200, h: 32, z: 6 },
      type: "text",
      data: { content: "KIMES 방문객 현황", fontSize: 20, fontWeight: 500, color: "#0A0A0A" },
    }),
  );

  // ─── 스택 바 (오른쪽, 의료/제조/언론 3색) ───
  out.push(
    // 의료/병원 — 어두운 빨강 (top)
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 839, y: 270, w: 12, h: 252, z: 3 },
      type: "shape",
      data: { shape: "rect", fill: "#AA0008" },
    }),
    // 제조/무역/유통 — 브랜드 빨강 (middle)
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 839, y: 522, w: 12, h: 268, z: 3 },
      type: "shape",
      data: { shape: "rect", fill: brand },
    }),
    // 언론/기관/일반 — 회색 (bottom)
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 839, y: 790, w: 12, h: 145, z: 3 },
      type: "shape",
      data: { shape: "rect", fill: "#A9A9A9" },
    }),
  );

  // ─── 스택 바 옆 빨간 짧은 라인 (구분 마커) ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 851, y: 663, w: 31, h: 2, z: 4 },
      type: "shape",
      data: { shape: "rect", fill: brand },
    }),
  );

  // ─── 70% 텍스트 ───
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 915, y: 617, w: 242, h: 93, z: 10 },
      type: "text",
      data: {
        content: "전체방문객의 70% 이상\nB2B 참관객",
        fontSize: 24,
        fontWeight: 400,
        lineHeight: 1.6,
        color: "#0A0A0A",
      },
    }),
  );

  // ─── 서브 범례 (의료/제조/언론) ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 908, y: 836, w: 8, h: 8, z: 10 },
      type: "shape",
      data: { shape: "rect", fill: "#AA0008" },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 933, y: 829, w: 200, h: 20, z: 10 },
      type: "text",
      data: { content: "의료/병원 종사자", fontSize: 14, fontWeight: 500, color: "#443105" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 908, y: 862, w: 8, h: 8, z: 10 },
      type: "shape",
      data: { shape: "rect", fill: brand },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 933, y: 855, w: 200, h: 20, z: 10 },
      type: "text",
      data: { content: "제조/무역/유통 관계자", fontSize: 14, fontWeight: 500, color: "#443105" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 908, y: 888, w: 8, h: 8, z: 10 },
      type: "shape",
      data: { shape: "rect", fill: "#A9A9A9" },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 933, y: 881, w: 200, h: 20, z: 10 },
      type: "text",
      data: { content: "언론/기관/일반/기타", fontSize: 14, fontWeight: 500, color: "#443105" },
    }),
  );

  // ─── 우측 흰 알약 카드 — 잠재고객 ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 1243, y: 498, w: 455, h: 110, z: 8 },
      type: "shape",
      data: {
        shape: "rect",
        fill: "#FFFFFF",
        radius: 50,
        shadow: { x: 0, y: 4, blur: 10, color: "rgba(0,0,0,0.25)" },
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 1263, y: 528, w: 415, h: 51, z: 9 },
      type: "text",
      data: {
        content: "잠재고객 발굴 업체당 66.2건",
        fontSize: 32,
        fontWeight: 400,
        align: "right",
        color: "#0A0A0A",
      },
    }),
  );
  // 화살표 (잠재고객 → 유망고객)
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 1465, y: 612, w: 2, h: 34, z: 8 },
      type: "shape",
      data: { shape: "rect", fill: "#000000" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 1458, y: 638, w: 16, h: 12, z: 8, rotate: 45 },
      type: "shape",
      data: { shape: "triangle", fill: "#000000" },
    }),
  );
  // ─── 우측 흰 알약 카드 — 유망고객 ───
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: 1243, y: 682, w: 455, h: 110, z: 8 },
      type: "shape",
      data: {
        shape: "rect",
        fill: "#FFFFFF",
        radius: 50,
        shadow: { x: 0, y: 4, blur: 10, color: "rgba(0,0,0,0.25)" },
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 1263, y: 712, w: 415, h: 51, z: 9 },
      type: "text",
      data: {
        content: "유망고객 확보 업체당 30.1건",
        fontSize: 32,
        fontWeight: 400,
        align: "right",
        color: "#0A0A0A",
      },
    }),
  );

  // ─── 출처 (우하단) ───
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 1331, y: 999, w: 477, h: 36, z: 10 },
      type: "text",
      data: {
        content:
          "Source: Certified data by Association of Korea Exhibition Industry (AKEI)\nSource: Exhibition & Convention Institute. Economic Impact Analysis of KIMES 2025.",
        fontSize: 13,
        fontWeight: 300,
        align: "right",
        lineHeight: 1.4,
        color: "#808080",
      },
    }),
  );

  return out;
}

function benefitCards(): CanvasNode[] {
  const items = [
    { tag: "혜택 1", title: "참가업체 검색 페이지\n상위 고정", icon: "Pin" },
    { tag: "혜택 2", title: "스폰서 참가업체\n뱃지 표기", icon: "Award", sub: "참가업체 검색 페이지" },
    { tag: "혜택 3", title: "도면 내 로고 표기", icon: "MapPin" },
    { tag: "혜택 3", title: "홈페이지 배너", icon: "Flag", sub: "참가업체 검색 또는 전시품 검색 페이지\n(선착순 5개사)" },
  ];
  const out: CanvasNode[] = [];
  const startX = 900;
  const startY = 100;
  const cardW = 440;
  const cardH = 400;
  const gap = 40;
  items.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    out.push(
      tplNode<CanvasShapeNode>({
        id: "",
        rect: { x, y, w: cardW, h: cardH },
        type: "shape",
        data: { shape: "rect", fill: "#F4F4F4", radius: 16 },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: x + 32, y: y + 32, w: cardW - 64, h: 30, z: 1 },
        type: "text",
        data: { content: it.tag, fontSize: 16, fontWeight: 600, color: "#9CA3AF" },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: x + 32, y: y + 64, w: cardW - 64, h: 100, z: 1 },
        type: "text",
        data: { content: it.title, fontSize: 30, fontWeight: 800, lineHeight: 1.3, color: "#0A0A0A" },
      }),
      ...(it.sub
        ? [
            tplNode<CanvasTextNode>({
              id: "",
              rect: { x: x + 32, y: y + 170, w: cardW - 64, h: 60, z: 1 },
              type: "text",
              data: { content: it.sub, fontSize: 14, fontWeight: 500, color: "#737373", lineHeight: 1.5 },
            }),
          ]
        : []),
      tplNode<CanvasIconNode>({
        id: "",
        rect: { x: x + cardW - 160, y: y + cardH - 160, w: 120, h: 120, z: 1 },
        type: "icon",
        data: { set: "lucide", name: it.icon, color: "var(--brand-500)", strokeWidth: 1.5 },
      }),
    );
  });
  return out;
}

function processCards(): CanvasNode[] {
  const items = [
    { num: "01", title: "신청상담", body: "사무국과 상담을 통해 스폰서십 진행에 대한\n혜택 및 견적 관련 상세 안내", footer: "문의\n02-551-0102\nkprint@kprintshow.com" },
    { num: "02", title: "체크리스트 신청", body: "참가업체 체크리스트 로그인\n↓\n선택제출 - 온/오프라인 광고 신청\n↓\n희망 스폰서십 항목 신청", footer: "*일부 항목은 조기 마감될 수 있습니다" },
    { num: "03", title: "입금", body: "견적서 발송\n체크리스트 내 신청 후 사무국 문의\n\n입금 마감\n2026년 2월 28일(토)\n\n계산서 발행\n전시회 개막 1개월 전", footer: "" },
    { num: "04", title: "디자인 파일 제출", body: "제출기한: 스폰서십별 상이", footer: "* 전달 주시는 이미지와 영상 등이 산업 분야와\n상이하다고 판단할 경우 파일을\n재요청 드릴 수 있습니다." },
  ];
  const out: CanvasNode[] = [];
  const startX = 110;
  const cardW = 420;
  const cardH = 700;
  const gap = 16;
  const y = 260;
  items.forEach((it, i) => {
    const x = startX + i * (cardW + gap);
    out.push(
      tplNode<CanvasShapeNode>({
        id: "",
        rect: { x, y, w: cardW, h: cardH },
        type: "shape",
        data: { shape: "rect", fill: "#FFFFFF", radius: 24, shadow: { x: 0, y: 4, blur: 24, color: "rgba(0,0,0,0.06)" } },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: x + 24, y: y + 40, w: cardW - 48, h: 50, z: 1 },
        type: "text",
        data: { content: it.num, fontSize: 28, fontWeight: 700, align: "center", color: "var(--brand-500)" },
      }),
      tplNode<CanvasShapeNode>({
        id: "",
        rect: { x: x + cardW / 2 - 24, y: y + 90, w: 48, h: 2, z: 1 },
        type: "shape",
        data: { shape: "rect", fill: "var(--brand-500)" },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: x + 24, y: y + 110, w: cardW - 48, h: 50, z: 1 },
        type: "text",
        data: { content: it.title, fontSize: 28, fontWeight: 800, align: "center", color: "#0A0A0A" },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: x + 24, y: y + 200, w: cardW - 48, h: 360, z: 1 },
        type: "text",
        data: { content: it.body, fontSize: 16, fontWeight: 500, align: "center", lineHeight: 1.7, color: "#404040" },
      }),
      ...(it.footer
        ? [
            tplNode<CanvasTextNode>({
              id: "",
              rect: { x: x + 24, y: y + cardH - 130, w: cardW - 48, h: 100, z: 1 },
              type: "text",
              data: { content: it.footer, fontSize: 14, fontWeight: 500, align: "center", lineHeight: 1.6, color: "#737373" },
            }),
          ]
        : []),
    );
  });
  return out;
}

function tabHeaders(): CanvasNode[] {
  const tabs = ["브랜드 확산형", "현장 방문객 유도형", "신제품 홍보형", "맞춤형 타겟팅 광고"];
  const startX = 420;
  const y = 240;
  const gap = 220;
  const out: CanvasNode[] = [];
  tabs.forEach((t, i) => {
    const x = startX + i * gap;
    out.push(
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x, y, w: 220, h: 40 },
        type: "text",
        data: { content: t, fontSize: 20, fontWeight: i === 0 ? 800 : 500, align: "center", color: i === 0 ? "#0A0A0A" : i === 3 ? "#D4D4D4" : "#737373" },
      }),
    );
    if (i === 0) {
      out.push(
        tplNode<CanvasShapeNode>({
          id: "",
          rect: { x: x + 30, y: y + 50, w: 160, h: 3 },
          type: "shape",
          data: { shape: "rect", fill: "#0A0A0A" },
        }),
      );
    }
  });
  return out;
}

function menuGridChips(): CanvasNode[] {
  const items = [
    { label: "전광판 광고(XPACE)", off: true },
    { label: "천장배너", off: true },
    { label: "참관객 목걸이", off: true },
    { label: "등록대(출입증 발급대)", off: true },
    { label: "현장 쇼가이드", off: true },
    { label: "참관등록 페이지 배너", off: false },
    { label: "참가업체 검색 페이지 배너", off: false },
    { label: "국내 뉴스레터 배너", off: false },
    { label: "해외 뉴스레터 배너", off: false },
    { label: "경품이벤트 LED 광고", off: true },
    { label: "도면 내 참가기업 로고 표기", off: true },
    { label: "APP 메인 페이지 팝업", off: false },
  ];
  const startX = 260;
  const startY = 380;
  const cardW = 460;
  const cardH = 76;
  const gapX = 28;
  const gapY = 24;
  const out: CanvasNode[] = [];
  items.forEach((it, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    out.push(
      tplNode<CanvasShapeNode>({
        id: "",
        rect: { x, y, w: cardW, h: cardH },
        type: "shape",
        data: { shape: "rect", fill: "#FFFFFF", radius: 999, shadow: { x: 0, y: 2, blur: 14, color: "rgba(0,0,0,0.05)" } },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: x + 32, y, w: cardW - 80, h: cardH, z: 1 },
        type: "text",
        data: { content: it.label, fontSize: 18, fontWeight: 700, align: "center", lineHeight: cardH / 18, color: "#0A0A0A" },
      }),
      tplNode<CanvasShapeNode>({
        id: "",
        rect: { x: x + cardW - 36, y: y + cardH / 2 - 6, w: 12, h: 12, z: 1 },
        type: "shape",
        data: { shape: "ellipse", fill: it.off ? "var(--brand-500)" : "#FBCFD2" },
      }),
    );
  });
  return out;
}

// ============================================================================
// 표지 / Cover — 큰 빨간 이벤트명 + SPONSORSHIP (K-PRINT 기본)
// ============================================================================
function coverNodes(): CanvasNode[] {
  return [
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 256, w: 1720, h: 30 },
      type: "text",
      data: {
        content: "2026 KOREA INTERNATIONAL PRINTING & PUBLISHING EXHIBITION",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 2,
        color: "#0A0A0A",
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 310, w: 1720, h: 220 },
      type: "text",
      data: {
        content: "K-PRINT 2026",
        fontSize: 200,
        fontWeight: 800,
        letterSpacing: -4,
        color: "#DB0711",
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 680, w: 1720, h: 90 },
      type: "text",
      data: {
        content: "SPONSORSHIP",
        fontSize: 56,
        fontWeight: 700,
        letterSpacing: 12,
        align: "center",
        color: "#0A0A0A",
      },
    }),
  ];
}

// KIMES BUSAN 전용 표지 (옛 KIMES BUSAN 톤)
function coverKimesNodes(): CanvasNode[] {
  return [
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 256, w: 1720, h: 30 },
      type: "text",
      data: {
        content: "THE 14TH KIMES BUSAN INTERNATIONAL MEDICAL & HOSPITAL EQUIPMENT SHOW",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 2,
        color: "#0A0A0A",
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 310, w: 1720, h: 200 },
      type: "text",
      data: {
        content: "KIMES BUSAN",
        fontSize: 180,
        fontWeight: 800,
        letterSpacing: -4,
        color: "#DB0711",
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 680, w: 1720, h: 90 },
      type: "text",
      data: {
        content: "SPONSORSHIP",
        fontSize: 56,
        fontWeight: 700,
        letterSpacing: 12,
        align: "center",
        color: "#0A0A0A",
      },
    }),
  ];
}

// ============================================================================
// 목차 / Contents
// ============================================================================
function contentsNodes(): CanvasNode[] {
  const out: CanvasNode[] = [];
  const rightX = 800; // 우측 섹션 시작 x
  const rightW = 1010;
  const grayLine = "#0A0A0A";
  const gray = "#808080";
  const brand = "#DB0711";

  // 좌측 "Contents"
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 110, w: 600, h: 110 },
      type: "text",
      data: { content: "Contents", fontSize: 84, fontWeight: 800, color: "#0A0A0A" },
    }),
  );

  // 우측 — Introduction 섹션
  out.push(
    // 섹션 헤더
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: rightX, y: 250, w: rightW, h: 56 },
      type: "text",
      data: { content: "Introduction", fontSize: 36, fontWeight: 500, color: "#0A0A0A" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: rightX, y: 308, w: rightW, h: 1 },
      type: "shape",
      data: { shape: "rect", fill: grayLine },
    }),
  );
  // Introduction 항목 3개
  const intro = [
    { label: "KIMES 소개", page: "3" },
    { label: "Why KIMES?", page: "4" },
    { label: "스폰서십 리뉴얼 기념 이벤트", page: "6" },
  ];
  intro.forEach((it, i) => {
    const y = 340 + i * 72;
    out.push(
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: rightX, y, w: rightW - 100, h: 48 },
        type: "text",
        data: { content: it.label, fontSize: 24, fontWeight: 300, color: gray },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: rightX + rightW - 100, y, w: 100, h: 48 },
        type: "text",
        data: { content: it.page, fontSize: 24, fontWeight: 300, align: "right", color: brand },
      }),
    );
  });

  // Application 섹션
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: rightX, y: 600, w: rightW, h: 56 },
      type: "text",
      data: { content: "Application", fontSize: 36, fontWeight: 500, color: "#0A0A0A" },
    }),
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: rightX, y: 658, w: rightW, h: 1 },
      type: "shape",
      data: { shape: "rect", fill: grayLine },
    }),
  );
  const app = [
    { label: "신청절차", page: "7" },
    { label: "스폰서십 한눈에 보기", page: "8" },
    { label: "스폰서십 리스트", page: "9" },
  ];
  app.forEach((it, i) => {
    const y = 690 + i * 72;
    out.push(
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: rightX, y, w: rightW - 100, h: 48 },
        type: "text",
        data: { content: it.label, fontSize: 24, fontWeight: 300, color: gray },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: rightX + rightW - 100, y, w: 100, h: 48 },
        type: "text",
        data: { content: it.page, fontSize: 24, fontWeight: 300, align: "right", color: brand },
      }),
    );
  });

  return out;
}

// ============================================================================
// 히어로 카피 + 폰 영상 (intro slide) — KIMES "Step into the Show" 류
// 좌측: 브랜드 로고 + 큰 영문 타이틀 + 한글 설명
// 우측: iPhone mockup (둥근 사각형 + 노치) + 안쪽 영상 placeholder
// ============================================================================
function introWithVideoNodes(): CanvasNode[] {
  const out: CanvasNode[] = [];

  // ─── 좌측 카피 ───
  // 브랜드 로고 (빨간 텍스트 — 이벤트명 그대로)
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 220, w: 800, h: 90 },
      type: "text",
      data: {
        content: "K-PRINT",
        fontSize: 64,
        fontWeight: 800,
        color: "#DB0711",
        letterSpacing: -2,
      },
    }),
  );
  // 큰 영문 타이틀
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 360, w: 900, h: 240 },
      type: "text",
      data: {
        content: "Step into the Show,\nLive and Real",
        fontSize: 80,
        fontWeight: 500,
        lineHeight: 1.25,
        color: "#0A0A0A",
      },
    }),
  );
  // 설명
  out.push(
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 660, w: 800, h: 160 },
      type: "text",
      data: {
        content:
          "1980년부터 축적해온 인쇄·출판 산업 데이터와 인사이트.\nK-PRINT 는 이를 바탕으로 인쇄 기업의 글로벌 확장을 돕고 있습니다.\n스폰서십을 통해 당신의 브랜드도 함께하세요.",
        fontSize: 22,
        fontWeight: 300,
        lineHeight: 1.55,
        color: "#0A0A0A",
      },
    }),
  );

  // ─── 우측 휴대폰 mockup ───
  // 폰 좌상단 기준 좌표: x=1180, y=80, w=580, h=920 (16:9 슬라이드 안에서 우측 절반)
  const phoneX = 1180;
  const phoneY = 80;
  const phoneW = 580;
  const phoneH = 920;
  const bezel = 14;

  // 외부 케이스 (어두운 회색 + 그림자)
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: { x: phoneX, y: phoneY, w: phoneW, h: phoneH, z: 1 },
      type: "shape",
      data: {
        shape: "rect",
        fill: "#1A1A1A",
        radius: 56,
        shadow: { x: 0, y: 20, blur: 80, color: "rgba(0,0,0,0.18)" },
      },
    }),
  );
  // 내부 화면 영역 (살짝 옅은 검정)
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: {
        x: phoneX + bezel,
        y: phoneY + bezel,
        w: phoneW - bezel * 2,
        h: phoneH - bezel * 2,
        z: 2,
      },
      type: "shape",
      data: { shape: "rect", fill: "#0A0A0A", radius: 44 },
    }),
  );
  // 노치 (검은 알약)
  out.push(
    tplNode<CanvasShapeNode>({
      id: "",
      rect: {
        x: phoneX + phoneW / 2 - 60,
        y: phoneY + 26,
        w: 120,
        h: 32,
        z: 4,
      },
      type: "shape",
      data: { shape: "rect", fill: "#000000", radius: 16 },
    }),
  );

  // ─── 영상 placeholder ───
  // 화면 안쪽 영역에 video 노드 — 사용자가 인스펙터에서 URL 입력
  out.push(
    tplNode({
      id: "",
      rect: {
        x: phoneX + bezel + 12,
        y: phoneY + bezel + 12,
        w: phoneW - bezel * 2 - 24,
        h: phoneH - bezel * 2 - 24,
        z: 3,
      },
      type: "video",
      data: { url: "" },
    } as CanvasNode),
  );

  return out;
}

// ============================================================================
// K-PRINT 차트 헤로 — chartHero 구조에 K-PRINT 데이터 적용
// ============================================================================
function kprintChartHeroNodes(): CanvasNode[] {
  // chartHeroNodes 의 데이터 라벨 + 우측 헤드라인만 K-PRINT 용으로 교체
  // 막대 비율은 유지 (사용자가 데이터 라벨만 수정해도 시각적 일치 가능)
  const out = chartHeroNodes();
  // 헤드라인 노드 (가장 첫 노드) 텍스트 교체
  out.forEach((n) => {
    if (n.type === "text" && n.data.content?.includes("매년 70,000명")) {
      n.data.content =
        "매년 50,000명 이상이 방문하는\nK-PRINT 에서 브랜드를 홍보하세요!";
    }
    if (n.type === "text" && n.data.content === "70,163명") n.data.content = "48,234명";
    if (n.type === "text" && n.data.content === "70,760명") n.data.content = "50,118명";
    if (n.type === "text" && n.data.content === "72,507명") n.data.content = "52,961명";
    if (n.type === "text" && n.data.content === "3,029명") n.data.content = "2,418명";
    if (n.type === "text" && n.data.content === "4,274명") n.data.content = "3,102명";
    if (n.type === "text" && n.data.content === "4,941명") n.data.content = "3,847명";
    if (n.type === "text" && n.data.content === "KIMES 방문객 현황")
      n.data.content = "K-PRINT 방문객 현황";
    if (
      n.type === "text" &&
      n.data.content?.startsWith("Source: Certified data")
    ) {
      n.data.content =
        "Source: Certified data by Association of Korea Exhibition Industry (AKEI)\nSource: K-PRINT Internal data";
    }
    if (
      n.type === "text" &&
      n.data.content?.includes("전체방문객의 70%")
    ) {
      n.data.content = "전체방문객의 65% 이상\nB2B 참관객";
    }
    if (n.type === "text" && n.data.content === "잠재고객 발굴 업체당 66.2건")
      n.data.content = "잠재고객 발굴 업체당 48.7건";
    if (n.type === "text" && n.data.content === "유망고객 확보 업체당 30.1건")
      n.data.content = "유망고객 확보 업체당 22.4건";
    if (n.type === "text" && n.data.content === "의료/병원 종사자")
      n.data.content = "인쇄·출판 종사자";
    if (n.type === "text" && n.data.content === "제조/무역/유통 관계자")
      n.data.content = "패키징·라벨·후가공";
    if (n.type === "text" && n.data.content === "언론/기관/일반/기타")
      n.data.content = "사인·디지털인쇄·기타";
  });
  return out;
}

// ============================================================================
// K-PRINT growthCallout — 같은 구조, K-PRINT 카피
// ============================================================================
function kprintGrowthCalloutNodes(): CanvasNode[] {
  return [
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 90, w: 1500, h: 100 },
      type: "text",
      data: {
        content: "K-PRINT 스폰서십 진행 기업 고객 유입데이터",
        fontSize: 64,
        fontWeight: 800,
        lineHeight: 1.3,
        color: "#0A0A0A",
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 100, y: 230, w: 800, h: 160 },
      type: "text",
      data: {
        content:
          "스폰서십의 효과에 대해 고민하고 계신가요?\nK-PRINT 참가업체 검색 페이지 내 상위 고정을 통해\n타기업 대비 14배의 노출 효과를 누리실 수 있습니다.",
        fontSize: 22,
        fontWeight: 400,
        lineHeight: 1.6,
        color: "#0A0A0A",
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 1050, y: 410, w: 770, h: 60, z: 5 },
      type: "text",
      data: {
        content: "비활용 기업 대비 14배 상승",
        fontSize: 32,
        fontWeight: 700,
        align: "right",
        color: "#0A0A0A",
      },
    }),
    tplNode<CanvasChartNode>({
      id: "",
      rect: { x: 80, y: 470, w: 1760, h: 480 },
      type: "chart",
      data: {
        kind: "line",
        categories: ["", "", "", "", "", "", "", "", ""],
        series: [
          {
            name: "진행 기업",
            color: "#DB0711",
            kind: "area",
            data: [2, 3, 4, 5, 40, 75, 92, 94, 95],
            showDots: false,
            endLabel: true,
          },
          {
            name: "미진행 기업",
            color: "#0A0A0A",
            kind: "line",
            data: [2, 3, 4, 5, 7, 9, 11, 13, 15],
            showDots: false,
            endLabel: true,
          },
        ],
        showLegend: false,
        showGrid: true,
        showAxes: false,
        annotations: [
          { kind: "vline", at: 3, text: "스폰서십 진행 시점" },
          { kind: "bracket", from: 3, to: 8, text: "스폰서십 광고 진행 이후 유입" },
        ],
      },
    }),
    tplNode<CanvasTextNode>({
      id: "",
      rect: { x: 1620, y: 1020, w: 240, h: 30, z: 5 },
      type: "text",
      data: {
        content: "Source: K-PRINT Internal data",
        fontSize: 13,
        fontWeight: 300,
        align: "right",
        color: "#808080",
      },
    }),
  ];
}

// ============================================================================
// K-PRINT 메뉴 그리드 — 인쇄·출판 산업에 맞는 12개 메뉴
// ============================================================================
function kprintMenuGridChips(): CanvasNode[] {
  const items = [
    { label: "전광판 광고", off: true },
    { label: "천장배너", off: true },
    { label: "참관객 목걸이", off: true },
    { label: "등록대(출입증)", off: true },
    { label: "현장 쇼가이드", off: true },
    { label: "참관등록 페이지 배너", off: false },
    { label: "참가업체 검색 페이지", off: false },
    { label: "국내 뉴스레터 배너", off: false },
    { label: "해외 뉴스레터 배너", off: false },
    { label: "샘플북 광고", off: true },
    { label: "도면 내 로고 표기", off: true },
    { label: "APP 메인 페이지 팝업", off: false },
  ];
  const startX = 260;
  const startY = 380;
  const cardW = 460;
  const cardH = 76;
  const gapX = 28;
  const gapY = 24;
  const out: CanvasNode[] = [];
  items.forEach((it, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    out.push(
      tplNode<CanvasShapeNode>({
        id: "",
        rect: { x, y, w: cardW, h: cardH },
        type: "shape",
        data: { shape: "rect", fill: "#FFFFFF", radius: 999, shadow: { x: 0, y: 2, blur: 14, color: "rgba(0,0,0,0.05)" } },
      }),
      tplNode<CanvasTextNode>({
        id: "",
        rect: { x: x + 32, y, w: cardW - 80, h: cardH, z: 1 },
        type: "text",
        data: { content: it.label, fontSize: 18, fontWeight: 700, align: "center", lineHeight: cardH / 18, color: "#0A0A0A" },
      }),
      tplNode<CanvasShapeNode>({
        id: "",
        rect: { x: x + cardW - 36, y: y + cardH / 2 - 6, w: 12, h: 12, z: 1 },
        type: "shape",
        data: { shape: "ellipse", fill: it.off ? "#DB0711" : "#FBCFD2" },
      }),
    );
  });
  return out;
}

export function resolveBg(bg?: string): string | undefined {
  if (!bg) return undefined;
  if (bg === "canvas") return "#F6F6F6";
  if (bg === "surface") return "#FFFFFF";
  if (bg === "ink") return "#0A0A0A";
  if (bg === "brand") return "var(--brand-500)";
  return bg;
}

/** 이미지 URL에서 원본 해상도 측정 */
function loadImageDims(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ w: 800, h: 450 });
      return;
    }
    const img = new window.Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 450 });
    img.src = url;
  });
}

