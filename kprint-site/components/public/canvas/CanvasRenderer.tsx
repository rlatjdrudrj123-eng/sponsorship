"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type {
  CanvasButtonNode,
  CanvasImageNode,
  CanvasNode,
  CanvasPage,
  CanvasShapeNode,
  CanvasTextNode,
  CanvasVideoNode,
  ShapeFill,
  SiteSettings,
} from "@/lib/types";
import { ComponentNodeRenderer } from "./ComponentNodeRenderer";

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
        {page.nodes.map((n) => (
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
    .filter((n) => !n.mobile?.hidden)
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
