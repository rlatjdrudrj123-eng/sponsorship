"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
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
 * - 모바일: 노드를 수직 stack 으로 재배치 (mobile.order 순). mobile.hidden 인 노드는 제거.
 * - PDF 출력: 데스크톱과 동일 (16:9 비율 유지) — 인쇄 시 page-break.
 */

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const MOBILE_BP = 768; // px

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
  const isMobile = useIsMobile() && !forceDesktop;

  const bg = resolveBg(page.bg) ?? "var(--color-canvas, #F6F6F6)";

  if (isMobile) {
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
  // 캔버스를 화면 폭에 맞춰 transform: scale 으로 축소
  // 뷰포트가 1920보다 작아도 1920 그대로 그리고 줄임. 비율 유지.
  return (
    <div
      className="canvas-page relative w-full overflow-hidden"
      style={{
        aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        background: bg,
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
      {/* 화면 폭에 맞춘 scale 자동 보정 */}
      <CanvasScale />
    </div>
  );
}

/** ResizeObserver 로 부모 폭 측정 → --canvas-scale 변수 갱신 */
function CanvasScale() {
  useEffect(() => {
    const update = () => {
      document.querySelectorAll<HTMLElement>(".canvas-page").forEach((el) => {
        const w = el.clientWidth;
        const scale = w / CANVAS_W;
        el.style.setProperty("--canvas-scale", String(scale));
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return null;
}

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
  const visible = page.nodes
    .filter((n) => !n.hidden && !n.mobile?.hidden)
    .sort((a, b) => {
      const ao = a.mobile?.order ?? a.rect.y;
      const bo = b.mobile?.order ?? b.rect.y;
      return ao - bo;
    });

  return (
    <div className="w-full" style={{ background: bg }}>
      <div className="max-w-md mx-auto px-5 py-10 flex flex-col gap-5">
        {page.bgImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.bgImageUrl}
            alt=""
            className="w-full rounded-card object-cover"
          />
        )}
        {visible.map((n) => (
          <div key={n.id}>
            <NodeRendererMobile
              node={n}
              eventId={eventId}
              settings={settings}
            />
          </div>
        ))}
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

// ============================================================================
// 모바일 노드 렌더 — 폭에 맞춰 자연스럽게
// ============================================================================

function NodeRendererMobile({
  node,
  eventId,
  settings,
}: {
  node: CanvasNode;
  eventId?: string;
  settings: SiteSettings | null;
}) {
  switch (node.type) {
    case "text": {
      // 데스크톱 폰트 크기를 모바일에 맞춰 축소
      const desktopSize = node.data.fontSize ?? 32;
      const mobileSize = Math.min(desktopSize, 48); // 너무 큰 건 자름
      return (
        <TextNodeView
          node={{
            ...node,
            data: { ...node.data, fontSize: mobileSize },
          }}
        />
      );
    }
    case "image":
      return (
        <div className="w-full overflow-hidden rounded-card">
          <ImageNodeView node={node} mobile />
        </div>
      );
    case "shape":
      // 모바일에서는 shape 의미가 떨어짐 — divider 정도만 표시
      if (node.data.shape === "line") {
        return (
          <hr
            style={{
              border: 0,
              height: node.data.strokeWidth ?? 1,
              background: node.data.stroke ?? "#0A0A0A",
            }}
          />
        );
      }
      return null;
    case "button":
      return <ButtonNodeView node={node} eventId={eventId} mobile />;
    case "video":
      return (
        <div className="aspect-video w-full overflow-hidden rounded-card">
          <VideoNodeView node={node} />
        </div>
      );
    case "chart":
      return (
        <div className="w-full" style={{ aspectRatio: "16 / 9" }}>
          <ChartNodeView node={node} />
        </div>
      );
    case "icon":
      return <IconNodeView node={node} />;
    case "component":
      // 모바일: 컴포넌트는 자체 레이아웃으로 렌더 (캔버스 좌표 무시)
      return (
        <ComponentNodeRenderer
          node={node}
          eventId={eventId ?? ""}
          settings={settings}
          mobile
        />
      );
  }
}

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
        fontFamily:
          family === "num"
            ? "var(--font-inter), Inter, sans-serif"
            : family === "mono"
              ? "var(--font-jetbrains-mono), monospace"
              : undefined,
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
  const yt = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/
  );
  if (yt) return { kind: "iframe", url: `https://www.youtube.com/embed/${yt[1]}` };
  const v = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v) return { kind: "iframe", url: `https://player.vimeo.com/video/${v[1]}` };
  if (u.endsWith(".mp4") || u.endsWith(".webm"))
    return { kind: "video", url: u };
  return { kind: "iframe", url: u };
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP}px)`);
    const handle = () => setMobile(mq.matches);
    handle();
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  return mobile;
}
