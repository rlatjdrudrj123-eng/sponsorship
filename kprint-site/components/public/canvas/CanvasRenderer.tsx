"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  CanvasButtonNode,
  CanvasChartNode,
  CanvasIconNode,
  CanvasImageNode,
  CanvasNode,
  CanvasPage,
  CanvasShapeNode,
  CanvasTextNode,
  CanvasVideoNode,
  ChartSeries,
  ShapeFill,
  SiteSettings,
} from "@/lib/types";
import { ComponentNodeRenderer } from "./ComponentNodeRenderer";
import * as LucideIcons from "lucide-react";

/**
 * 캔버스 페이지 렌더러.
 *
 * - 데스크톱: 1920×1080 절대 좌표 그대로, 화면 폭에 맞춰 transform: scale.
 *   좁은 화면에선 min-scale 까지만 축소되고 그 아래선 가로 스크롤.
 * - 모바일 (≤ MOBILE_BP px): 노드를 수직 stack 으로 재배치. mobile.order 가 있으면 그 순서,
 *   없으면 (y, x) 추정. mobile.hidden 인 노드는 숨김.
 * - PDF 출력: forceDesktop=true 로 항상 데스크톱 레이아웃.
 */

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const MOBILE_BP = 640; // px — 이 값 이하면 mobile stack mode 활성화

// 데스크톱 모드에서 좁은 화면 가독성 유지를 위한 최소 스케일.
// 화면 폭이 너무 좁아 일반 contain 스케일이 이 값보다 작아지면, 캔버스가
// viewport 보다 넓어지며 컨테이너에서 가로 스크롤이 허용된다.
const MIN_SCALE = 0.45;

export function CanvasRenderer({
  page,
  eventId,
  settings,
  forceDesktop = false,
}: {
  page: CanvasPage;
  eventId?: string;
  settings?: SiteSettings | null;
  /** PDF 모드 등 강제로 데스크톱 레이아웃을 쓰고 싶을 때 */
  forceDesktop?: boolean;
}) {
  const isMobile = useIsMobile(MOBILE_BP);
  const bg = resolveBg(page.bg) ?? "var(--color-canvas, #F6F6F6)";

  if (isMobile && !forceDesktop) {
    return (
      <CanvasMobileStack
        page={page}
        bg={bg}
        eventId={eventId}
        settings={settings ?? null}
      />
    );
  }

  return (
    <CanvasDesktop
      page={page}
      bg={bg}
      eventId={eventId}
      settings={settings ?? null}
    />
  );
}

function CanvasDesktop({
  page,
  bg,
  eventId,
  settings,
}: {
  page: CanvasPage;
  bg: string;
  eventId?: string;
  settings: SiteSettings | null;
}) {
  // 캔버스 컨테이너:
  // - 일반 화면: 부모 폭에 맞춰 transform: scale 으로 contain
  // - 좁은 화면(모바일): 최소 스케일까지만 축소하고, 그 이하면 가로 스크롤
  return (
    <div
      className="canvas-page-wrap relative w-full h-full overflow-x-auto overflow-y-hidden flex items-center justify-center"
      style={{ background: bg }}
    >
      <div
        className="canvas-page relative shrink-0 overflow-hidden"
        style={{
          width: "var(--canvas-disp-w, 100%)",
          height: "var(--canvas-disp-h, 100%)",
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transformOrigin: "top left",
            transform: `scale(var(--canvas-scale, 1))`,
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
            .map((n) => (
              <NodeRenderer
                key={n.id}
                node={n}
                eventId={eventId}
                settings={settings}
              />
            ))}
        </div>
      </div>
      {/* 화면 크기에 맞춘 scale 자동 보정 */}
      <CanvasScale />
    </div>
  );
}

/**
 * 부모 폭/높이를 측정해 contain 스케일을 계산.
 * - naturalScale = min(부모폭/캔버스폭, 부모높이/캔버스높이) — 비율 유지하며 부모 안에 들어가는 최대 크기
 * - scale = max(naturalScale, MIN_SCALE) — 단, MIN_SCALE 이하로는 떨어지지 않게 클램프
 *   클램프가 걸리면 캔버스가 부모보다 넓어지고, 부모의 overflow-x-auto 가 가로 스크롤 제공
 */
function CanvasScale() {
  useEffect(() => {
    const update = () => {
      document
        .querySelectorAll<HTMLElement>(".canvas-page-wrap")
        .forEach((wrap) => {
          const pw = wrap.clientWidth;
          const ph = wrap.clientHeight;
          if (pw === 0 || ph === 0) return;
          const naturalScale = Math.min(pw / CANVAS_W, ph / CANVAS_H);
          const scale = Math.max(naturalScale, MIN_SCALE);
          const dispW = CANVAS_W * scale;
          const dispH = CANVAS_H * scale;
          wrap.style.setProperty("--canvas-scale", String(scale));
          wrap.style.setProperty("--canvas-disp-w", `${dispW}px`);
          wrap.style.setProperty("--canvas-disp-h", `${dispH}px`);
        });
    };
    update();
    window.addEventListener("resize", update);
    // 폰트 로드·이미지 로드 등으로 레이아웃이 늦게 잡힐 때 한 번 더
    const t = setTimeout(update, 200);
    return () => {
      window.removeEventListener("resize", update);
      clearTimeout(t);
    };
  }, []);
  return null;
}

// ============================================================================
// CanvasMobileStack — 모바일 자동 세로 흐름
// ============================================================================
//
// 핵심 아이디어:
//   - 가로 절대 좌표는 모바일에서 의미가 약함. 노드를 정렬해 vertical flow.
//   - 정렬: mobile.order 있으면 그 순서, 없으면 (y-band, x) 추정.
//   - 각 노드는 자기 비율(rect.w / rect.h)을 유지하면서 컨테이너 폭에 맞춰 스케일.
//     → 안에 들어있는 NodeInner 는 그대로 (1920 좌표계 기준) 렌더되고
//       바깥 박스가 scale 로 줄여 컨테이너 폭에 맞춤.
//   - mobile.fullWidth=true 면 폭의 95%, 아니면 노드 비율에 따라 가로 정렬.
//   - 순수 장식 shape 들이 너무 많으면 노이즈가 되므로, 빈 텍스트/너무 작은 노드는 스킵.

function CanvasMobileStack({
  page,
  bg,
  eventId,
  settings,
}: {
  page: CanvasPage;
  bg: string;
  eventId?: string;
  settings: SiteSettings | null;
}) {
  // 노이즈 컷오프 — 너무 작은 장식 노드는 모바일에서 생략
  const isSignificant = (n: CanvasNode): boolean => {
    if (n.type === "shape") {
      // 작은 장식 도형은 생략 (특정 너비/높이 미만)
      const area = n.rect.w * n.rect.h;
      if (area < 60 * 60) return false;
    }
    if (n.type === "text") {
      const content = (n.data.content ?? "").trim();
      if (!content) return false;
    }
    return true;
  };

  const visible = page.nodes
    .filter((n) => !n.hidden && !n.mobile?.hidden && isSignificant(n));

  const sorted = [...visible].sort((a, b) => {
    const oa = a.mobile?.order;
    const ob = b.mobile?.order;
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    // y-band (50px 단위), 그 안에선 x 순
    const yBandA = Math.floor(a.rect.y / 50);
    const yBandB = Math.floor(b.rect.y / 50);
    if (yBandA !== yBandB) return yBandA - yBandB;
    return a.rect.x - b.rect.x;
  });

  return (
    <div
      className="canvas-page-mobile relative w-full h-full overflow-y-auto overflow-x-hidden"
      style={{ background: bg }}
    >
      {page.bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.bgImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-60"
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-4 py-8 px-4 min-h-full justify-center">
        {sorted.map((node) => (
          <MobileNodeBox
            key={node.id}
            node={node}
            eventId={eventId}
            settings={settings}
          />
        ))}
      </div>
    </div>
  );
}

function MobileNodeBox({
  node,
  eventId,
  settings,
}: {
  node: CanvasNode;
  eventId?: string;
  settings: SiteSettings | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setScale(w / node.rect.w);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [node.rect.w]);

  // 노드 폭 — fullWidth 면 부모 95%, 아니면 원본 비율로 결정
  const widthFrac = node.mobile?.fullWidth
    ? 0.95
    : // 원본 캔버스 폭 대비 비율 (최소 50%, 최대 95%)
      Math.min(Math.max(node.rect.w / CANVAS_W, 0.5), 0.95);

  return (
    <div
      style={{
        width: `${widthFrac * 100}%`,
        maxWidth: node.rect.w,
      }}
    >
      <div
        ref={wrapRef}
        style={{
          width: "100%",
          aspectRatio: `${node.rect.w} / ${node.rect.h}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: node.rect.w,
            height: node.rect.h,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            opacity: node.opacity ?? 1,
          }}
        >
          <NodeInner node={node} eventId={eventId} settings={settings} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 데스크톱 노드 렌더
// ============================================================================

function NodeRenderer({
  node,
  eventId,
  settings,
}: {
  node: CanvasNode;
  eventId?: string;
  settings: SiteSettings | null;
}) {
  const baseStyle: CSSProperties = {
    position: "absolute",
    left: node.rect.x,
    top: node.rect.y,
    width: node.rect.w,
    height: node.rect.h,
    opacity: node.opacity ?? 1,
    zIndex: node.rect.z ?? 0,
    transform: node.rect.rotate
      ? `rotate(${node.rect.rotate}deg)`
      : undefined,
  };

  return (
    <div style={baseStyle}>
      <NodeInner node={node} eventId={eventId} settings={settings} />
    </div>
  );
}

function NodeInner({
  node,
  eventId,
  settings,
}: {
  node: CanvasNode;
  eventId?: string;
  settings: SiteSettings | null;
}) {
  switch (node.type) {
    case "text":
      return <TextNodeView node={node} />;
    case "image":
      return <ImageNodeView node={node} />;
    case "shape":
      return <ShapeNodeView node={node} />;
    case "button":
      return <ButtonNodeView node={node} eventId={eventId} />;
    case "video":
      return <VideoNodeView node={node} />;
    case "chart":
      return <ChartNodeView node={node} />;
    case "icon":
      return <IconNodeView node={node} />;
    case "component":
      return (
        <ComponentNodeRenderer
          node={node}
          eventId={eventId ?? ""}
          settings={settings}
        />
      );
  }
}

// (NodeRendererMobile 제거 — 데스크탑 스케일 방식으로 통일)

// ============================================================================
// 노드별 뷰
// ============================================================================

function TextNodeView({ node }: { node: CanvasTextNode }) {
  const {
    content,
    fontSize = 32,
    fontWeight = 500,
    color,
    align = "left",
    lineHeight = 1.3,
    letterSpacing,
    accent,
    family = "sans",
    fontFamily,
    fontStyle,
    textDecoration,
    textTransform,
  } = node.data;
  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color: accent ? "var(--brand-500)" : color ?? "inherit",
        textAlign: align,
        lineHeight,
        letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
        whiteSpace: "pre-wrap",
        wordBreak: "keep-all",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        fontStyle: fontStyle ?? "normal",
        textDecoration: textDecoration ?? "none",
        textTransform: textTransform ?? "none",
        // fontFamily 자유 입력이 있으면 우선, 없으면 family 매핑
        fontFamily:
          fontFamily ||
          (family === "num"
            ? "var(--font-inter), Inter, sans-serif"
            : family === "mono"
              ? "var(--font-jetbrains-mono), monospace"
              : undefined),
      }}
    >
      {content}
    </div>
  );
}

function ImageNodeView({
  node,
  mobile,
}: {
  node: CanvasImageNode;
  mobile?: boolean;
}) {
  const { url, alt, fit = "cover", radius } = node.data;
  if (!url) {
    return (
      <div
        className="w-full h-full grid place-items-center bg-ink-100 text-ink-300 text-xs"
        style={{ borderRadius: radius }}
      >
        이미지
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt ?? ""}
      style={{
        width: mobile ? "100%" : "100%",
        height: mobile ? "auto" : "100%",
        objectFit: fit,
        borderRadius: radius,
        display: "block",
      }}
    />
  );
}

export function ShapeNodeView({ node }: { node: CanvasShapeNode }) {
  return <ShapeSVG data={node.data} />;
}

/** 도형 SVG 렌더러 — fill/stroke/shadow/모든 도형 종류 처리 */
export function ShapeSVG({ data }: { data: CanvasShapeNode["data"] }) {
  const { shape, stroke, strokeWidth = 0, sides = 6, points = 5 } = data;
  // unique id per render (avoids gradient/clip-path collision)
  const uid = useRandomId();
  const fillId = `f-${uid}`;

  const fill = normalizeFill(data.fill);
  const shadow = data.shadow;

  // fill prop for SVG element
  const fillAttr =
    fill.kind === "solid"
      ? fill.color
      : fill.kind === "gradient" || fill.kind === "image"
        ? `url(#${fillId})`
        : "transparent";

  const filterAttr = shadow
    ? `drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color})`
    : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: "block", overflow: "visible", filter: filterAttr }}
    >
      <defs>
        {fill.kind === "gradient" && (
          fill.gradient.kind === "linear" ? (
            <linearGradient
              id={fillId}
              gradientTransform={`rotate(${fill.gradient.angle} 0.5 0.5)`}
            >
              {fill.gradient.stops.map((s, i) => (
                <stop
                  key={i}
                  offset={s.offset}
                  stopColor={s.color}
                />
              ))}
            </linearGradient>
          ) : (
            <radialGradient id={fillId}>
              {fill.gradient.stops.map((s, i) => (
                <stop
                  key={i}
                  offset={s.offset}
                  stopColor={s.color}
                />
              ))}
            </radialGradient>
          )
        )}
        {fill.kind === "image" && (
          <pattern
            id={fillId}
            patternUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <image
              href={fill.url}
              x="0"
              y="0"
              width="100"
              height="100"
              preserveAspectRatio={
                fill.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"
              }
            />
          </pattern>
        )}
      </defs>

      {(() => {
        const strokeAttr = stroke && strokeWidth > 0 ? stroke : undefined;
        const strokeW =
          stroke && strokeWidth > 0 ? strokeWidth * (100 / 100) : 0;
        const dashAttr = data.strokeDasharray;
        switch (shape) {
          case "rect": {
            const r = (data.radius ?? 0) * (100 / 100);
            return (
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                rx={r}
                ry={r}
                fill={fillAttr}
                stroke={strokeAttr}
                strokeWidth={strokeW}
                strokeDasharray={dashAttr}
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          case "ellipse":
            return (
              <ellipse
                cx="50"
                cy="50"
                rx="50"
                ry="50"
                fill={fillAttr}
                stroke={strokeAttr}
                strokeWidth={strokeW}
                vectorEffect="non-scaling-stroke"
              />
            );
          case "line":
            return (
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke={
                  strokeAttr ??
                  (fill.kind === "solid" ? fill.color : "#0A0A0A")
                }
                strokeWidth={Math.max(strokeW, 2)}
                strokeDasharray={dashAttr}
                vectorEffect="non-scaling-stroke"
              />
            );
          case "triangle":
            return (
              <polygon
                points="50,2 98,98 2,98"
                fill={fillAttr}
                stroke={strokeAttr}
                strokeWidth={strokeW}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          case "polygon": {
            const n = Math.max(3, Math.min(12, sides));
            const pts = polygonPoints(n);
            return (
              <polygon
                points={pts}
                fill={fillAttr}
                stroke={strokeAttr}
                strokeWidth={strokeW}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          case "star": {
            const p = Math.max(3, Math.min(12, points));
            const pts = starPoints(p);
            return (
              <polygon
                points={pts}
                fill={fillAttr}
                stroke={strokeAttr}
                strokeWidth={strokeW}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          case "arrow": {
            // 가로 화살표 — viewBox 0,0,100,100 안에서
            return (
              <polygon
                points="0,35 70,35 70,15 100,50 70,85 70,65 0,65"
                fill={fillAttr}
                stroke={strokeAttr}
                strokeWidth={strokeW}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          }
        }
      })()}
    </svg>
  );
}

/** legacy fill (hex 문자열) 도 호환되게 정규화 */
function normalizeFill(
  fill: CanvasShapeNode["data"]["fill"]
): ShapeFill {
  if (!fill) return { kind: "solid", color: "transparent" };
  if (typeof fill === "string") return { kind: "solid", color: fill };
  return fill;
}

function polygonPoints(n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2; // 위로 시작
    const x = 50 + 48 * Math.cos(angle);
    const y = 50 + 48 * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function starPoints(p: number): string {
  const outerR = 48;
  const innerR = outerR * 0.4;
  const pts: string[] = [];
  for (let i = 0; i < p * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * 2 * i) / (p * 2) - Math.PI / 2;
    const x = 50 + r * Math.cos(angle);
    const y = 50 + r * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function useRandomId(): string {
  const [id] = useState(() => Math.random().toString(36).slice(2, 10));
  return id;
}

function ButtonNodeView({
  node,
  eventId,
  mobile,
}: {
  node: CanvasButtonNode;
  eventId?: string;
  mobile?: boolean;
}) {
  const { label, href, variant = "primary", fontSize = 16 } = node.data;
  const resolvedHref = href.startsWith("/") && eventId
    ? href.replace(/^\/(?!\/)/, `/${eventId}/`).replace(`/${eventId}/${eventId}/`, `/${eventId}/`)
    : href;
  const cls =
    variant === "primary"
      ? "bg-brand-500 text-white hover:bg-brand-700 hover:shadow-glow-sm"
      : variant === "outline"
        ? "border-2 border-ink-900 hover:bg-ink-900 hover:text-white"
        : "underline-offset-2 hover:underline";
  return (
    <Link
      href={resolvedHref}
      className={
        "inline-flex items-center justify-center font-bold rounded-pill transition-colors " +
        cls +
        " " +
        (mobile ? "w-full" : "w-full h-full")
      }
      style={{ fontSize }}
    >
      {label}
    </Link>
  );
}

function VideoNodeView({ node }: { node: CanvasVideoNode }) {
  const { url } = node.data;
  const embed = toEmbedUrl(url);
  if (!embed) {
    return (
      <div className="w-full h-full grid place-items-center bg-ink-100 text-ink-300 text-xs">
        동영상
      </div>
    );
  }
  if (embed.kind === "iframe") {
    return (
      <iframe
        src={embed.url}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  return (
    <video
      src={embed.url}
      controls
      className="w-full h-full object-contain bg-black"
    />
  );
}

// ============================================================================
// 차트 노드 — SVG 기반 line / bar / area / mixed
// ============================================================================

const CHART_PALETTE = [
  "var(--brand-500, #DB0711)",
  "#0A0A0A",
  "#9CA3AF",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
];

export function ChartNodeView({ node }: { node: CanvasChartNode }) {
  const d = node.data;
  const W = 1000;
  const H = 600;
  const PAD = { top: 50, right: 80, bottom: 60, left: 70 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const categories = d.categories ?? [];
  const series = d.series ?? [];
  const cw = categories.length > 0 ? innerW / categories.length : innerW;

  // y 범위 계산
  const allY = series.flatMap((s) => s.data);
  const dataMin = allY.length ? Math.min(...allY) : 0;
  const dataMax = allY.length ? Math.max(...allY) : 100;
  const yMin = d.yMin ?? Math.min(0, dataMin);
  const yMax = d.yMax ?? dataMax + (dataMax - dataMin) * 0.15;
  const yRange = Math.max(1, yMax - yMin);
  const yToPx = (v: number) => PAD.top + innerH - ((v - yMin) / yRange) * innerH;
  const xToPx = (idx: number) => PAD.left + idx * cw + cw / 2;

  // y 축 그리드 (5칸)
  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = yMin + (yRange * i) / gridSteps;
    return { v, y: yToPx(v) };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label={d.kind + " chart"}
    >
      {/* 배경색 */}
      {d.background && (
        <rect x={0} y={0} width={W} height={H} fill={d.background} />
      )}
      {/* 그리드 */}
      {(d.showGrid ?? true) &&
        gridLines.map((g, i) => (
          <line
            key={`grid-${i}`}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={g.y}
            y2={g.y}
            stroke="#E5E5E5"
            strokeWidth={1}
          />
        ))}

      {/* y축 라벨 */}
      {(d.showAxes ?? true) &&
        gridLines.map((g, i) => (
          <text
            key={`yl-${i}`}
            x={PAD.left - 10}
            y={g.y + 4}
            textAnchor="end"
            fontSize={14}
            fill="#737373"
          >
            {formatChartNumber(g.v)}
          </text>
        ))}

      {/* x축 라벨 */}
      {(d.showAxes ?? true) &&
        categories.map((c, i) => (
          <text
            key={`xl-${i}`}
            x={xToPx(i)}
            y={H - PAD.bottom + 22}
            textAnchor="middle"
            fontSize={14}
            fill="#737373"
          >
            {c}
          </text>
        ))}

      {/* 시리즈 — 막대 먼저, 라인/면적 나중에 (위에 얹기) */}
      {series.map((s, si) => {
        const kind = s.kind ?? (d.kind === "mixed" ? "line" : d.kind);
        if (kind !== "bar") return null;
        const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
        const barCount = series.filter((ss) => (ss.kind ?? d.kind) === "bar").length;
        const barW = (cw * 0.6) / Math.max(1, barCount);
        const barIdx = series.filter((ss, j) => j < si && (ss.kind ?? d.kind) === "bar").length;
        return (
          <g key={`bar-${si}`}>
            {s.data.map((v, i) => {
              const x = xToPx(i) - (cw * 0.3) + barIdx * barW;
              const y = yToPx(Math.max(v, yMin));
              const h = Math.max(0, yToPx(yMin) - y);
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={h} fill={color} rx={2} />
                  {s.showLabels && (
                    <text
                      x={x + barW / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize={13}
                      fill="#0A0A0A"
                      fontWeight={600}
                    >
                      {formatChartNumber(v)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* area 시리즈 */}
      {series.map((s, si) => {
        const kind = s.kind ?? (d.kind === "mixed" ? "line" : d.kind);
        if (kind !== "area") return null;
        const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
        const pts = s.data.map((v, i) => [xToPx(i), yToPx(v)] as const);
        if (pts.length === 0) return null;
        const linePath = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
        const areaPath =
          linePath +
          ` L ${pts[pts.length - 1][0]} ${yToPx(yMin)} L ${pts[0][0]} ${yToPx(yMin)} Z`;
        return (
          <g key={`area-${si}`}>
            <path d={areaPath} fill={color} fillOpacity={0.15} />
            <path d={linePath} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {(s.showDots ?? true) &&
              pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={4} fill="#fff" stroke={color} strokeWidth={2} />
              ))}
          </g>
        );
      })}

      {/* line 시리즈 */}
      {series.map((s, si) => {
        const kind = s.kind ?? (d.kind === "mixed" ? "line" : d.kind);
        if (kind !== "line") return null;
        const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
        const pts = s.data.map((v, i) => [xToPx(i), yToPx(v)] as const);
        if (pts.length === 0) return null;
        const linePath = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
        return (
          <g key={`line-${si}`}>
            <path d={linePath} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {(s.showDots ?? true) &&
              pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
              ))}
            {s.showLabels &&
              pts.map(([x, y], i) => (
                <text
                  key={`lbl-${i}`}
                  x={x}
                  y={y - 14}
                  textAnchor="middle"
                  fontSize={13}
                  fill="#0A0A0A"
                  fontWeight={600}
                >
                  {formatChartNumber(s.data[i])}
                </text>
              ))}
          </g>
        );
      })}

      {/* 시리즈 끝 라벨 (오른쪽 마지막 데이터 포인트 옆) */}
      {series.map((s, si) => {
        if (!s.endLabel) return null;
        const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
        const lastIdx = s.data.length - 1;
        if (lastIdx < 0) return null;
        return (
          <text
            key={`endlbl-${si}`}
            x={xToPx(lastIdx) + 16}
            y={yToPx(s.data[lastIdx]) + 5}
            fontSize={16}
            fontWeight={500}
            fill={color}
          >
            {s.name}
          </text>
        );
      })}

      {/* 주석 */}
      {(d.annotations ?? []).map((a, i) => {
        if (a.kind === "vline") {
          const x = xToPx(a.at ?? 0);
          const chipColor = a.color ?? "#9CA3AF";
          return (
            <g key={`an-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={PAD.top + 30}
                y2={H - PAD.bottom}
                stroke={chipColor}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {a.text && (
                <>
                  {/* 회색 둥근 칩 */}
                  <rect
                    x={x - (a.text.length * 8 + 24) / 2}
                    y={H - PAD.bottom - 70}
                    width={a.text.length * 8 + 24}
                    height={32}
                    rx={16}
                    fill="#EBEBEB"
                  />
                  {/* 아래 가리키는 작은 삼각형 */}
                  <polygon
                    points={`${x - 6},${H - PAD.bottom - 38} ${x + 6},${H - PAD.bottom - 38} ${x},${H - PAD.bottom - 28}`}
                    fill="#EBEBEB"
                  />
                  <text
                    x={x}
                    y={H - PAD.bottom - 50}
                    textAnchor="middle"
                    fontSize={15}
                    fontWeight={500}
                    fill="#404040"
                    dominantBaseline="middle"
                  >
                    {a.text}
                  </text>
                </>
              )}
            </g>
          );
        }
        if (a.kind === "hline") {
          const y = yToPx(a.at ?? 0);
          return (
            <g key={`an-${i}`}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke={a.color ?? "#9CA3AF"}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              {a.text && (
                <text x={W - PAD.right + 4} y={y + 4} fontSize={13} fontWeight={600} fill={a.color ?? "#0A0A0A"}>
                  {a.text}
                </text>
              )}
            </g>
          );
        }
        if (a.kind === "label" && a.text) {
          // 큰 볼드 텍스트 — chip 배경 없이, 우상단 영역에 배치
          // at 은 카테고리 인덱스 (기준점). 텍스트는 오른쪽 정렬.
          const x = xToPx(a.at ?? categories.length - 1);
          const y = PAD.top + 12;
          return (
            <text
              key={`an-${i}`}
              x={x}
              y={y}
              textAnchor="end"
              fontSize={26}
              fontWeight={700}
              fill={a.color ?? "#0A0A0A"}
            >
              {a.text.split("__BRAND__").map((part, pi, arr) => (
                <tspan key={pi} fill={pi % 2 === 1 ? "#DB0711" : (a.color ?? "#0A0A0A")}>
                  {part}
                  {pi < arr.length - 1 ? "" : ""}
                </tspan>
              ))}
            </text>
          );
        }
        if (a.kind === "bracket" && a.text != null) {
          const x1 = xToPx(a.from ?? 0);
          const x2 = xToPx(a.to ?? categories.length - 1);
          const y = H - PAD.bottom + 38;
          return (
            <g key={`an-${i}`}>
              <line x1={x1} x2={x2} y1={y} y2={y} stroke={a.color ?? "#DB0711"} strokeWidth={1.5} />
              <line x1={x1} x2={x1} y1={y - 6} y2={y + 6} stroke={a.color ?? "#DB0711"} strokeWidth={1.5} />
              <line x1={x2} x2={x2} y1={y - 6} y2={y + 6} stroke={a.color ?? "#DB0711"} strokeWidth={1.5} />
              {/* 작은 화살촉 */}
              <polygon
                points={`${x1},${y} ${x1 + 8},${y - 4} ${x1 + 8},${y + 4}`}
                fill={a.color ?? "#DB0711"}
              />
              <polygon
                points={`${x2},${y} ${x2 - 8},${y - 4} ${x2 - 8},${y + 4}`}
                fill={a.color ?? "#DB0711"}
              />
              {/* 배경 있는 라벨 (선 위에 가리키도록 흰색 배경) */}
              <rect
                x={(x1 + x2) / 2 - (a.text.length * 8 + 20) / 2}
                y={y - 12}
                width={a.text.length * 8 + 20}
                height={24}
                fill="#F6F6F6"
              />
              <text x={(x1 + x2) / 2} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={500} fill={a.color ?? "#DB0711"}>
                {a.text}
              </text>
            </g>
          );
        }
        return null;
      })}

      {/* 범례 */}
      {(d.showLegend ?? true) && series.length > 0 && (
        <g>
          {series.map((s, si) => {
            const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
            const x = PAD.left + si * 140;
            const y = 24;
            const kind = s.kind ?? (d.kind === "mixed" ? "line" : d.kind);
            return (
              <g key={`lg-${si}`}>
                {kind === "bar" ? (
                  <rect x={x} y={y - 7} width={14} height={14} fill={color} rx={2} />
                ) : (
                  <circle cx={x + 7} cy={y} r={6} fill="#fff" stroke={color} strokeWidth={2.5} />
                )}
                <text x={x + 22} y={y + 5} fontSize={14} fill="#404040">
                  {s.name}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

function formatChartNumber(v: number): string {
  if (Math.abs(v) >= 10000) return v.toLocaleString();
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

// ChartSeries 가 import 만 되고 안 쓰여 lint 에러 — 명시적 사용
void (null as unknown as ChartSeries);

// ============================================================================
// 아이콘 노드 — lucide-react 모든 아이콘 또는 emoji 한 글자
// ============================================================================

export function IconNodeView({ node }: { node: CanvasIconNode }) {
  const { set, name, color, strokeWidth } = node.data;
  if (set === "emoji") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          fontSize: "min(100%, 90cqw)",
          lineHeight: 1,
          containerType: "size",
        }}
      >
        <span style={{ fontSize: "0.9em" }}>{name}</span>
      </div>
    );
  }
  // lucide
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ color?: string; strokeWidth?: number; width?: string | number; height?: string | number }>>)[name];
  if (!Icon) {
    return (
      <div className="w-full h-full grid place-items-center bg-ink-50 text-ink-300 text-[10px]">
        {name}?
      </div>
    );
  }
  return (
    <Icon
      width="100%"
      height="100%"
      color={color ?? "currentColor"}
      strokeWidth={strokeWidth ?? 1.5}
    />
  );
}

// ============================================================================
// 유틸
// ============================================================================

function resolveBg(bg?: string): string | undefined {
  if (!bg) return undefined;
  if (bg === "canvas") return "var(--color-canvas, #F6F6F6)";
  if (bg === "surface") return "var(--color-surface, #FFFFFF)";
  if (bg === "ink") return "#0A0A0A";
  if (bg === "brand") return "var(--brand-500)";
  if (bg === "transparent") return "transparent";
  return bg;
}

function toEmbedUrl(
  url: string
): { kind: "iframe" | "video"; url: string } | null {
  if (!url) return null;
  const u = url.trim();

  // YouTube — watch?v= / youtu.be / embed / shorts / live
  const yt = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/
  );
  if (yt) {
    return {
      kind: "iframe",
      url: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`,
    };
  }

  // Vimeo
  const v = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v) {
    return { kind: "iframe", url: `https://player.vimeo.com/video/${v[1]}` };
  }

  // Google Drive — view / preview / open?id=
  const driveView = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (driveView) {
    return {
      kind: "iframe",
      url: `https://drive.google.com/file/d/${driveView[1]}/preview`,
    };
  }
  const driveOpen = u.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);
  if (driveOpen) {
    return {
      kind: "iframe",
      url: `https://drive.google.com/file/d/${driveOpen[1]}/preview`,
    };
  }

  // 직접 영상 파일 — 쿼리스트링 무시하고 확장자 검사
  const pathPart = u.split("?")[0];
  if (/\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(pathPart)) {
    return { kind: "video", url: u };
  }

  // Firebase Storage — 인코딩된 경로 안에 비디오 확장자가 있으면 video 태그로
  if (
    u.includes("firebasestorage.googleapis.com") ||
    u.includes("storage.googleapis.com")
  ) {
    try {
      const decoded = decodeURIComponent(u);
      if (/\.(mp4|webm|mov|m4v|ogg|ogv)/i.test(decoded)) {
        return { kind: "video", url: u };
      }
    } catch {
      // 디코드 실패 시 fall through
    }
    // Firebase Storage 도메인이면 기본적으로 직접 영상 파일로 가정
    return { kind: "video", url: u };
  }

  // 알 수 없는 도메인 — iframe fallback (대부분 X-Frame-Options 로 차단됨)
  return { kind: "iframe", url: u };
}

function useIsMobile(breakpoint: number = MOBILE_BP) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handle = () => setMobile(mq.matches);
    handle();
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [breakpoint]);
  return mobile;
}
