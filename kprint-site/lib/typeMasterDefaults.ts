/**
 * 유형별 기본 마스터 슬라이드 시드.
 *
 * /admin/settings/type-layouts 에서 캔버스 디자인을 시작할 때, 빈 페이지가 아니라
 * 해당 유형의 표준 슬라이드 레이아웃이 미리 깔린 상태로 시작해서 사용자가 그 위에
 * 손보게 한다. (PPT 마스터 슬라이드 패턴.)
 *
 * 1920×1080 절대 좌표. 좌측 60% 텍스트 / 우측 40% 이미지 자리.
 * 텍스트는 {{token}} 표기 — 공개 페이지에서 카테고리 실데이터로 치환.
 */
import type { CanvasNode, CanvasPage, CategoryType, SpecField } from "./types";
import { DEFAULT_TYPE_LAYOUTS, SPEC_FIELD_LABEL } from "./typeLayouts";

// ─── 좌표 상수 ─────────────────────────────────────
const CW = 1920;
const CH = 1080;

const LEFT_PAD = 96;
const TOP_PAD = 96;
const LEFT_W = CW * 0.58 - LEFT_PAD - 24; // 텍스트 영역 폭
const RIGHT_X = CW * 0.58 + 24;
const RIGHT_W = CW - RIGHT_X - LEFT_PAD;
const RIGHT_TOP = TOP_PAD;
const RIGHT_H = CH - TOP_PAD * 2;

// ─── 토큰 (텍스트 노드 안에 박는다) ─────────────────────
// 공개 페이지는 이걸 카테고리 실데이터로 치환.
const TOKEN_BY_FIELD: Record<SpecField, string> = {
  location: "{{location}}",
  size: "{{size}}",
  fileFormat: "{{fileFormat}}",
  deadline: "{{deadline}}",
  detail: "{{detail}}",
  slots: "{{slotsLabel}}",
  video: "{{video}}",
  mailing: "{{mailing}}",
  content: "{{content}}",
};

// 짧은 id (서버 시드 시점에는 crypto.randomUUID 없어도 OK)
let _seq = 0;
function nid(prefix: string): string {
  _seq++;
  return `${prefix}-${_seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function reset() {
  _seq = 0;
}

// ─── 노드 빌더 ───────────────────────────────────

function textNode(opts: {
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  fontWeight?: 300 | 400 | 500 | 600 | 700 | 800 | 900;
  color?: string;
  family?: "sans" | "num" | "mono";
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  accent?: boolean;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  z?: number;
}): CanvasNode {
  return {
    id: nid("text"),
    type: "text",
    rect: { x: opts.x, y: opts.y, w: opts.w, h: opts.h, z: opts.z ?? 1 },
    data: {
      content: opts.content,
      fontSize: opts.fontSize ?? 24,
      fontWeight: opts.fontWeight ?? 500,
      color: opts.color,
      align: opts.align ?? "left",
      lineHeight: opts.lineHeight,
      letterSpacing: opts.letterSpacing,
      family: opts.family,
      accent: opts.accent,
      textTransform: opts.textTransform,
    },
  };
}

function shapeRect(opts: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  radius?: number;
  z?: number;
}): CanvasNode {
  return {
    id: nid("shape"),
    type: "shape",
    rect: { x: opts.x, y: opts.y, w: opts.w, h: opts.h, z: opts.z ?? 0 },
    data: {
      shape: "rect",
      fill: opts.fill ?? "transparent",
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
      strokeDasharray: opts.strokeDasharray,
      radius: opts.radius,
    },
  };
}

// ─── 메인: 유형별 기본 마스터 시드 ─────────────────────

export function buildDefaultMasterPage(type: CategoryType): CanvasPage {
  reset();
  const nodes: CanvasNode[] = [];
  const specFields = DEFAULT_TYPE_LAYOUTS[type]?.specFields ?? [];

  // ── 좌측 텍스트 영역 ──────────────────────────

  // 1) 해시태그 (작은 액센트)
  nodes.push(
    textNode({
      content: "#오프라인 #등록 #입구",
      x: LEFT_PAD,
      y: TOP_PAD,
      w: LEFT_W,
      h: 40,
      fontSize: 22,
      fontWeight: 700,
      accent: true,
      family: "num",
      letterSpacing: 1,
      textTransform: "uppercase",
    })
  );

  // 2) 제목 — {{title}}
  nodes.push(
    textNode({
      content: "{{title}}",
      x: LEFT_PAD,
      y: TOP_PAD + 56,
      w: LEFT_W,
      h: 200,
      fontSize: 80,
      fontWeight: 700,
      lineHeight: 1.08,
      letterSpacing: -0.5,
    })
  );

  // 3) 구분선 (얇은 사각형)
  nodes.push(
    shapeRect({
      x: LEFT_PAD,
      y: TOP_PAD + 260,
      w: 64,
      h: 4,
      fill: "var(--brand-500)",
    })
  );

  // 4) 스펙 행들 (라벨 + 값) — 유형별로 다름
  const SPEC_LABEL_W = 180;
  const SPEC_ROW_H = 56;
  const SPEC_GAP = 12;
  let specY = TOP_PAD + 300;
  for (const field of specFields) {
    // 라벨
    nodes.push(
      textNode({
        content: SPEC_FIELD_LABEL[field],
        x: LEFT_PAD,
        y: specY,
        w: SPEC_LABEL_W,
        h: SPEC_ROW_H,
        fontSize: 20,
        fontWeight: 600,
        color: "#808080",
        letterSpacing: 0.5,
      })
    );
    // 값 (토큰)
    nodes.push(
      textNode({
        content: TOKEN_BY_FIELD[field],
        x: LEFT_PAD + SPEC_LABEL_W,
        y: specY,
        w: LEFT_W - SPEC_LABEL_W,
        h: SPEC_ROW_H,
        fontSize: 24,
        fontWeight: 700,
      })
    );
    specY += SPEC_ROW_H + SPEC_GAP;
  }

  // 5) 가격 (좌측 하단)
  nodes.push(
    textNode({
      content: "최저가",
      x: LEFT_PAD,
      y: CH - 200,
      w: 200,
      h: 32,
      fontSize: 18,
      fontWeight: 600,
      color: "#808080",
      letterSpacing: 0.5,
    })
  );
  nodes.push(
    textNode({
      content: "{{minPrice}}원",
      x: LEFT_PAD,
      y: CH - 162,
      w: LEFT_W,
      h: 96,
      fontSize: 72,
      fontWeight: 800,
      family: "num",
      letterSpacing: -1,
    })
  );

  // ── 우측 이미지 자리 (placeholder shape) ──────────────
  nodes.push(
    shapeRect({
      x: RIGHT_X,
      y: RIGHT_TOP,
      w: RIGHT_W,
      h: RIGHT_H,
      fill: "#F6F6F6",
      stroke: "#D9D9D9",
      strokeWidth: 2,
      strokeDasharray: "8 8",
      radius: 24,
    })
  );
  nodes.push(
    textNode({
      content: "이미지\n(어드민에서 교체)",
      x: RIGHT_X,
      y: RIGHT_TOP + RIGHT_H / 2 - 48,
      w: RIGHT_W,
      h: 96,
      fontSize: 24,
      fontWeight: 500,
      color: "#808080",
      align: "center",
      lineHeight: 1.4,
    })
  );

  return {
    id: "master-" + type,
    name: `${type} 마스터`,
    nodes,
  };
}

// ─── 유형별 미세 조정 — 일부 유형은 다르게 ─────────────
// floor_plan / xpace: location 강조 (지금 기본 시드에 이미 있음 — 첫 spec row)
// package: 우측 이미지 대신 패키지 포함 항목 리스트가 어울리지만, 일단 동일 템플릿.
// content: 콘텐츠 스펙이 한 줄로 길어질 수 있음 — fontSize 줄임.
//
// 향후 사용자가 직접 손볼 영역. 지금은 공통 템플릿으로 충분.
