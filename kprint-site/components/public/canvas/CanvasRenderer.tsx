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
} from "@/lib/types";

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
  forceDesktop = false,
}: {
  page: CanvasPage;
  eventId?: string;
  /** PDF 모드 등 강제로 데스크톱 레이아웃을 쓰고 싶을 때 */
  forceDesktop?: boolean;
}) {
  const isMobile = useIsMobile() && !forceDesktop;

  const bg = resolveBg(page.bg) ?? "var(--color-canvas, #F6F6F6)";

  if (isMobile) {
    return <CanvasMobileStack page={page} bg={bg} eventId={eventId} />;
  }
  return <CanvasDesktop page={page} bg={bg} eventId={eventId} />;
}

function CanvasDesktop({
  page,
  bg,
  eventId,
}: {
  page: CanvasPage;
  bg: string;
  eventId?: string;
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
          <NodeRenderer key={n.id} node={n} eventId={eventId} />
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
}: {
  page: CanvasPage;
  bg: string;
  eventId?: string;
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
            <NodeRendererMobile node={n} eventId={eventId} />
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
}: {
  node: CanvasNode;
  eventId?: string;
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
      <NodeInner node={node} eventId={eventId} />
    </div>
  );
}

function NodeInner({
  node,
  eventId,
}: {
  node: CanvasNode;
  eventId?: string;
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
  }
}

// ============================================================================
// 모바일 노드 렌더 — 폭에 맞춰 자연스럽게
// ============================================================================

function NodeRendererMobile({
  node,
  eventId,
}: {
  node: CanvasNode;
  eventId?: string;
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

function ShapeNodeView({ node }: { node: CanvasShapeNode }) {
  const {
    shape,
    fill,
    stroke,
    strokeWidth = 0,
    radius = 0,
  } = node.data;
  if (shape === "ellipse") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: fill,
          border: stroke ? `${strokeWidth}px solid ${stroke}` : undefined,
          borderRadius: "50%",
        }}
      />
    );
  }
  if (shape === "line") {
    return (
      <div
        style={{
          width: "100%",
          height: strokeWidth,
          background: stroke ?? fill ?? "#0A0A0A",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: fill,
        border: stroke ? `${strokeWidth}px solid ${stroke}` : undefined,
        borderRadius: radius,
      }}
    />
  );
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
