"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  GraduationCap,
  Minimize2,
  PartyPopper,
  PlayCircle,
  X,
} from "lucide-react";
import {
  GUIDES,
  MAIN_TOUR,
  TASKS,
  firstAdvanceFrom,
  tourById,
  useOnboarding,
  type ChecklistTask,
} from "@/lib/admin/onboarding";

/**
 * 첫 사용 안내 — 어드민 레이아웃(사용 가능 상태)에 한 번만 렌더.
 *  - 처음 로그인하면 화면 투어 자동 시작 (이 브라우저·계정 기준 1회)
 *  - 화면을 열면 체크리스트 항목 자동 완료
 *  - 체크리스트 [바로 가기] 뒤 이어지는 화면 둘러보기 시작
 */
export function OnboardingController({ uid }: { uid: string }) {
  const pathname = usePathname();
  const load = useOnboarding((s) => s.load);
  const loaded = useOnboarding((s) => s.loaded);
  const seenMain = useOnboarding((s) => s.saved.seenMain);
  const markDone = useOnboarding((s) => s.markDone);
  const startTour = useOnboarding((s) => s.startTour);
  const activeTour = useOnboarding((s) => s.activeTour);
  const pendingTourId = useOnboarding((s) => s.pendingTourId);
  const setPendingTour = useOnboarding((s) => s.setPendingTour);

  useEffect(() => {
    if (uid) load(uid);
  }, [uid, load]);

  // 처음이면 화면 투어 자동 시작 (화면이 그려진 뒤)
  useEffect(() => {
    if (!loaded || seenMain || activeTour) return;
    const t = setTimeout(() => startTour(MAIN_TOUR), 800);
    return () => clearTimeout(t);
  }, [loaded, seenMain, activeTour, startTour]);

  // 화면을 열면 해당 항목 완료
  useEffect(() => {
    if (!loaded) return;
    TASKS.forEach((t) => {
      if (t.match?.(pathname)) markDone(t.id);
    });
  }, [loaded, pathname, markDone]);

  // 바로 가기로 온 화면 — 둘러보기 이어서 시작
  useEffect(() => {
    if (!pendingTourId || activeTour) return;
    const tour = tourById(pendingTourId);
    if (!tour) {
      setPendingTour(null);
      return;
    }
    const t = setTimeout(() => {
      setPendingTour(null);
      startTour(tour);
    }, 700);
    return () => clearTimeout(t);
  }, [pendingTourId, activeTour, pathname, startTour, setPendingTour]);

  return (
    <>
      <TourOverlay />
      <StartChecklist />
      <GuidePicker />
    </>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const BUBBLE_W = 320;
const BUBBLE_H = 220; // 위치 계산용 대략 높이

function placeBubble(rect: Rect | null, vw: number, vh: number): React.CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const top = rect.top - PAD;
  const bottom = rect.top + rect.height + PAD;
  const left = rect.left - PAD;
  const right = rect.left + rect.width + PAD;
  const clampX = (x: number) => Math.min(Math.max(12, x), vw - BUBBLE_W - 12);
  const clampY = (y: number) => Math.min(Math.max(12, y), vh - BUBBLE_H - 12);
  // 사이드바처럼 왼쪽의 좁은 요소 → 오른쪽 옆
  if (rect.left < 240 && rect.width < 260 && right + 12 + BUBBLE_W < vw) {
    return { top: clampY(rect.top - 8), left: right + 12 };
  }
  // 아래 → 위 → 오른쪽 → 왼쪽 (화면 밖으로 나가지 않게)
  if (bottom + 12 + BUBBLE_H < vh) return { top: clampY(bottom + 12), left: clampX(rect.left) };
  if (top - 12 - BUBBLE_H > 0) return { top: clampY(top - 12 - BUBBLE_H), left: clampX(rect.left) };
  if (right + 12 + BUBBLE_W < vw) return { top: clampY(rect.top), left: right + 12 };
  if (left - 12 - BUBBLE_W > 0) return { top: clampY(rect.top), left: left - 12 - BUBBLE_W };
  // 화면보다 큰 영역 — 작업 화면을 덜 가리는 왼쪽 아래(사이드바 위)
  return { bottom: 16, left: 16 };
}

/**
 * 대상 영역. 따라하기 단계는 대상 안에서 열린 목록(드롭다운)이 밖으로 삐져나와도 함께 밝힌다.
 */
function targetRect(el: HTMLElement, withPopups: boolean): Rect {
  const r = el.getBoundingClientRect();
  let top = r.top;
  let left = r.left;
  let right = r.right;
  let bottom = r.bottom;
  if (withPopups) {
    el.querySelectorAll<HTMLElement>(".absolute").forEach((c) => {
      const cr = c.getBoundingClientRect();
      if (!cr.width || !cr.height) return;
      if (cr.top >= top && cr.left >= left && cr.right <= right && cr.bottom <= bottom) return;
      const cs = getComputedStyle(c);
      if (cs.visibility === "hidden" || cs.opacity === "0") return;
      top = Math.min(top, cr.top);
      left = Math.min(left, cr.left);
      right = Math.max(right, cr.right);
      bottom = Math.max(bottom, cr.bottom);
    });
  }
  return { top, left, width: right - left, height: bottom - top };
}

/** 화면 위에 열린 다른 창(모달, 메뉴 바깥 클릭 영역). 안내 자체 요소는 제외 */
function openOverlay(): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(".fixed.inset-0");
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (!el.closest("[data-onboarding]") && el.getClientRects().length > 0) return el;
  }
  return null;
}

/** /^\/admin\/settings\/quote$/ 처럼 고정 주소인 단계 → 그 주소 (상세 화면처럼 id 가 들어가면 없음) */
function staticPathOf(path?: RegExp): string | undefined {
  const m = path?.source.match(/^\^((?:\\\/[a-z0-9-]+)+)\$$/);
  return m ? m[1].replace(/\\\//g, "/") : undefined;
}

const sameRect = (a: Rect | null, b: Rect) =>
  !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

function TourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const tour = useOnboarding((s) => s.activeTour);
  const step = useOnboarding((s) => s.step);
  const next = useOnboarding((s) => s.next);
  const prev = useOnboarding((s) => s.prev);
  const endTour = useOnboarding((s) => s.endTour);
  const mini = useOnboarding((s) => s.saved.bubbleMini);
  const setMini = useOnboarding((s) => s.setBubbleMini);
  const [rect, setRect] = useState<Rect | null>(null);
  // 따라하는 중 다른 창이 열림 → 안내는 비켜서 작게
  const [paused, setPaused] = useState(false);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const [missingFor, setMissingFor] = useState(0);
  const nextBtn = useRef<HTMLButtonElement>(null);
  // 지나온 화면 — 다른 화면으로 빠졌을 때 [돌아가기]
  const visited = useRef<string[]>([]);
  const prevPath = useRef(pathname);
  // 안내보다 먼저 누른 '다음 동작 단계' — 지금 단계 화면이 사라지면(창 닫힘 등) 그 뒤로 넘어간다
  const earlyClick = useRef<number | null>(null);
  const s = tour?.steps[step];
  const wrongPage = !!(s?.path && !s.path.test(pathname));

  // 사용자 동작으로 넘어갈 때 — 같은 안내 안에서 앞으로만 (중복·늦게 온 호출 무시)
  const advanceTo = useCallback(
    (i: number) => {
      const st = useOnboarding.getState();
      if (st.activeTour === tour && st.step < i) st.goTo(i);
    },
    [tour]
  );

  useEffect(() => {
    const url = window.location.pathname + window.location.search;
    const v = visited.current;
    if (v[v.length - 1] !== url) visited.current = [...v.slice(-29), url];
  }, [pathname]);

  // 대상 위치 추적 · 'appear' 조건 · 열린 창 확인 — 화면이 늦게 그려지는 경우를 위해 0.3초마다
  useEffect(() => {
    if (!tour || !s) return;
    let scrolled = false;
    let missing = 0;
    setMissingFor(0);
    earlyClick.current = null;
    // 안내보다 먼저 해 버린 경우도 따라잡도록 다음 '동작 단계'까지 확인
    const j = firstAdvanceFrom(tour, step);
    const pending = j >= 0 ? tour.steps[j].advance : undefined;
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      if (pending?.on === "appear" && document.querySelector(`[data-tour="${pending.target}"]`)) {
        advanceTo(j + 1);
        return;
      }
      const el =
        s.target && !wrongPage
          ? document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`)
          : null;
      const overlay = openOverlay();
      setPaused(!!overlay && !(el && overlay.contains(el)));
      if (el) {
        missing = 0;
        setMissingFor(0);
        if (!scrolled) {
          el.scrollIntoView({ block: "nearest", inline: "nearest" });
          scrolled = true;
        }
        const r = targetRect(el, !!s.interactive);
        setRect((p) => (sameRect(p, r) ? p : r));
      } else {
        if (earlyClick.current !== null && !wrongPage) {
          advanceTo(earlyClick.current + 1);
          return;
        }
        setRect(null);
        if (s.target && !wrongPage && !overlay) {
          missing += 1;
          setMissingFor(missing);
        }
      }
    };
    measure();
    const iv = window.setInterval(measure, 300);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tour, step, s, wrongPage, advanceTo]);

  // 'route' 조건 — 단계가 막 바뀌면 이 단계 조건만, 주소가 바뀌면 다음 동작 단계까지 확인
  useEffect(() => {
    const changed = prevPath.current !== pathname;
    prevPath.current = pathname;
    if (!tour || !s) return;
    const j = changed ? firstAdvanceFrom(tour, step) : s.advance ? step : -1;
    const a = j >= 0 ? tour.steps[j].advance : undefined;
    if (a?.on === "route" && a.path.test(pathname)) advanceTo(j + 1);
  }, [tour, step, s, pathname, advanceTo]);

  // 'click' 조건 — 강조된 요소를 누르면 (누른 동작은 그대로 실행).
  // 안내보다 먼저 눌렀으면 바로 건너뛰지 않고, 지금 단계 화면이 사라질 때(창이 닫히는 등) 따라잡는다
  // — 같은 화면의 저장 버튼을 먼저 눌렀다고 남은 확인 단계를 건너뛰지 않게.
  useEffect(() => {
    if (!tour || !s) return;
    const j = firstAdvanceFrom(tour, step);
    const w = j >= 0 ? tour.steps[j] : undefined;
    if (w?.advance?.on !== "click" || !w.target) return;
    const target = w.target;
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
      if (j === step) setTimeout(() => advanceTo(j + 1), 150);
      else earlyClick.current = j;
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [tour, step, s, advanceTo]);

  // 키보드 — 설명 단계만 (따라하는 중에는 Esc·화살표가 화면 조작용이라 가로채지 않음)
  useEffect(() => {
    if (!tour || !s || s.interactive || paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        endTour(false);
        return;
      }
      const t = e.target;
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowRight" && !s.advance) next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, s, paused, next, prev, endTour]);

  useEffect(() => {
    if (s && !s.interactive && !paused && !mini) nextBtn.current?.focus();
  }, [step, tour, s, paused, mini]);

  if (!tour || !s) return null;

  const total = tour.steps.length;
  const last = step === total - 1;
  const waiting = !!s.advance; // 사용자의 동작을 기다리는 단계
  const isGuide = tour.kind === "guide";
  const r = wrongPage ? null : rect;
  const offscreen = !!r && (r.top > vh || r.top + r.height < 0);
  // 다른 화면으로 빠졌을 때 갈 곳 — 지나온 화면 중 맞는 곳(입력 중이던 주소 그대로), 없으면 정해진 주소
  const visitedUrl = wrongPage
    ? [...visited.current].reverse().find((u) => s.path!.test(u.split("?")[0]))
    : undefined;
  const backUrl = visitedUrl ?? (wrongPage ? s.goto ?? staticPathOf(s.path) : undefined);
  const nextLabel = last ? "완료" : waiting ? "넘어가기" : "다음";

  // 접은 말풍선 — 사용자가 펼칠 때까지 접힌 채로. 화면은 막지 않는다
  if (isGuide && mini) {
    return (
      <>
        {r && !paused && <Spotlight r={r} light />}
        <div
          data-onboarding
          role="status"
          className="fixed z-[92] left-4 bottom-4 max-w-[380px] bg-white border border-ink-100 rounded-full shadow-xl pl-3.5 pr-1.5 py-1.5 flex items-center gap-2"
        >
          <span className="text-[11px] font-mono text-ink-500 shrink-0">
            {step + 1}/{total}
          </span>
          <span className="text-[12.5px] font-semibold text-ink-900 truncate">{s.title}</span>
          {backUrl ? (
            <button
              type="button"
              onClick={() => router.push(backUrl)}
              className="px-2.5 py-1 rounded-full bg-brand-500 text-ink-900 text-[11.5px] font-semibold hover:bg-brand-700 hover:text-white shrink-0"
              title="이 단계는 다른 화면에서 합니다"
            >
              {visitedUrl ? "돌아가기" : "그 화면으로"}
            </button>
          ) : (
            !waiting &&
            !paused && (
              <button
                type="button"
                onClick={next}
                className="px-2.5 py-1 rounded-full border border-ink-100 text-[11.5px] font-semibold text-ink-700 hover:bg-ink-50 shrink-0"
              >
                {nextLabel}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setMini(false)}
            className="px-2.5 py-1 rounded-full bg-ink-900 text-white text-[11.5px] font-semibold hover:bg-ink-700 shrink-0"
          >
            펼치기
          </button>
        </div>
      </>
    );
  }

  // 따라하다 연 창(담당자 지정·도면 핀 등) — 창을 가리지 않게 비켜서 작게
  if (paused) {
    return (
      <div
        data-onboarding
        role="status"
        className="fixed z-[92] left-4 bottom-4 w-[300px] bg-ink-900 text-white rounded-card shadow-xl p-3.5"
      >
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>
            {isGuide ? "따라하기 · " : ""}
            {step + 1}/{total}
          </span>
          <button
            type="button"
            onClick={() => endTour(false)}
            className="hover:text-white"
          >
            {isGuide ? "그만하기" : "닫기"}
          </button>
        </div>
        <div className="mt-1 text-[13px] font-bold break-keep">{s.title}</div>
        <p className="mt-1 text-[12px] text-white/80 leading-relaxed break-keep">{s.body}</p>
        <p className="mt-2 text-[11.5px] text-brand-500 font-semibold break-keep">
          창에서 작업을 마치고 닫으면 {isGuide ? "따라하기가" : "안내가"} 이어집니다.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 설명 단계는 바깥 클릭을 막고, 따라하기 단계는 화면을 그대로 쓸 수 있게 둔다 */}
      {!s.interactive && <Blocker style={{ inset: 0 }} />}
      {r ? (
        <Spotlight r={r} light={!!s.interactive} />
      ) : (
        <div
          data-onboarding
          aria-hidden
          className={
            "fixed inset-0 z-[91] pointer-events-none " + (s.interactive ? "bg-ink-900/40" : "bg-ink-900/50")
          }
        />
      )}
      <div
        data-onboarding
        role="dialog"
        aria-label={`${tour.label} ${step + 1}/${total}`}
        className="fixed z-[92] bg-white rounded-card shadow-xl border border-ink-100 p-4"
        style={{ width: BUBBLE_W, ...placeBubble(r, vw, vh) }}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] text-ink-500">
          <span className="truncate">
            {isGuide ? "따라하기 · " : ""}
            {tour.label} · {step + 1}/{total}
          </span>
          <div className="flex items-center shrink-0">
            {isGuide && (
              <button
                type="button"
                onClick={() => setMini(true)}
                className="p-0.5 rounded hover:bg-ink-100"
                aria-label="말풍선 접기"
                title="접기 — 화면을 가리면 접어 두세요"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => endTour(false)}
              className="p-0.5 rounded hover:bg-ink-100"
              aria-label="닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-1.5 text-[14px] font-bold text-ink-900 break-keep">{s.title}</div>
        {wrongPage ? (
          <>
            <p className="mt-1 text-[13px] text-ink-700 leading-relaxed break-keep">
              이 단계는 다른 화면에서 합니다.
              {!backUrl && " 하던 화면으로 돌아가거나 [이전]을 눌러 주세요."}
            </p>
            {backUrl && (
              <button
                type="button"
                onClick={() => router.push(backUrl)}
                className="mt-2 px-3 py-1.5 rounded-btn bg-brand-500 text-ink-900 text-[12px] font-semibold hover:bg-brand-700 hover:text-white"
              >
                {visitedUrl ? "하던 화면으로 돌아가기" : "그 화면으로 이동"}
              </button>
            )}
          </>
        ) : (
          <p className="mt-1 text-[13px] text-ink-700 leading-relaxed break-keep" aria-live="polite">
            {s.body}
          </p>
        )}
        {!wrongPage && s.interactive && s.target && !r && missingFor > 5 && (
          <p className="mt-2 text-[12px] text-amber-700 break-keep">
            짚을 곳이 화면에 없습니다. 창을 닫았다면 [이전]으로 돌아가 다시 해 주세요.
          </p>
        )}
        {offscreen && (
          <button
            type="button"
            onClick={() =>
              document.querySelector(`[data-tour="${s.target}"]`)?.scrollIntoView({ block: "center" })
            }
            className="mt-2 text-[12px] font-semibold text-brand-700 hover:underline"
          >
            강조된 곳으로 이동
          </button>
        )}
        {waiting && !wrongPage && r && (
          <p className="mt-2 text-[12px] text-brand-700 font-semibold break-keep">
            {s.advance?.on === "click"
              ? "강조된 곳을 눌러 주세요"
              : "직접 해 보세요 — 끝나면 자동으로 다음 단계로 넘어갑니다"}
          </p>
        )}
        <div className="mt-3 h-1 rounded-full bg-ink-100 overflow-hidden" aria-hidden>
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => endTour(false)}
            className="text-[12px] text-ink-500 hover:text-ink-900"
          >
            {isGuide ? "그만하기" : "건너뛰기"}
          </button>
          <div className="flex gap-1.5">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="px-3 py-1.5 rounded-btn border border-ink-100 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
              >
                이전
              </button>
            )}
            <button
              ref={nextBtn}
              type="button"
              onClick={next}
              className={
                "px-3 py-1.5 rounded-btn text-[12px] font-semibold " +
                (waiting
                  ? "border border-ink-100 text-ink-500 hover:bg-ink-50"
                  : "bg-ink-900 text-white hover:bg-ink-700")
              }
              title={waiting ? "직접 하지 않고 넘어가기" : undefined}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** 강조 테두리 + 바깥 어둡게 (클릭은 통과) */
function Spotlight({ r, light }: { r: Rect; light: boolean }) {
  return (
    <div
      data-onboarding
      aria-hidden
      className="fixed z-[91] rounded-[10px] ring-2 ring-brand-500 pointer-events-none transition-all duration-200"
      style={{
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
        boxShadow: `0 0 0 9999px rgba(15, 23, 42, ${light ? 0.4 : 0.5})`,
      }}
    />
  );
}

function Blocker({ style }: { style: React.CSSProperties }) {
  return (
    <div
      data-onboarding
      aria-hidden
      className="fixed z-[90]"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}

function StartChecklist() {
  const router = useRouter();
  const saved = useOnboarding((s) => s.saved);
  const loaded = useOnboarding((s) => s.loaded);
  const activeTour = useOnboarding((s) => s.activeTour);
  const setCollapsed = useOnboarding((s) => s.setCollapsed);
  const setHidden = useOnboarding((s) => s.setHidden);
  const startTour = useOnboarding((s) => s.startTour);
  const setPendingTour = useOnboarding((s) => s.setPendingTour);
  const setPickerOpen = useOnboarding((s) => s.setPickerOpen);

  const go = useCallback(
    (t: ChecklistTask) => {
      if (t.guideId) {
        const g = tourById(t.guideId);
        if (g) startTour(g);
        return;
      }
      if (!t.href) {
        startTour(MAIN_TOUR);
        return;
      }
      if (t.tourId) setPendingTour(t.tourId);
      router.push(t.href);
    },
    [router, startTour, setPendingTour]
  );

  // 따라하기 중에는 화면을 가리지 않게 숨김 (투어의 '시작하기' 단계는 예외)
  const touring = !!activeTour && activeTour.id !== "main";
  if (!loaded || saved.hidden || touring) return null;
  const doneCount = TASKS.filter((t) => saved.done.includes(t.id)).length;
  const allDone = doneCount === TASKS.length;

  return (
    <section
      data-tour="checklist"
      data-onboarding
      aria-label="시작하기 체크리스트"
      className="fixed right-5 bottom-5 z-40 w-[276px] bg-white border border-ink-100 rounded-card shadow-lg"
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        {allDone ? (
          <PartyPopper className="w-4 h-4 text-brand-700" aria-hidden />
        ) : (
          <span className="text-[11px] font-mono text-ink-500">
            {doneCount}/{TASKS.length}
          </span>
        )}
        <span className="text-[13px] font-bold text-ink-900 flex-1">
          {allDone ? "준비 완료" : "시작하기"}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(!saved.collapsed)}
          className="p-1 rounded hover:bg-ink-100 text-ink-500"
          aria-label={saved.collapsed ? "펼치기" : "접기"}
          aria-expanded={!saved.collapsed}
        >
          {saved.collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="p-1 rounded hover:bg-ink-100 text-ink-500"
          aria-label="체크리스트 닫기 (도움말에서 다시 열기)"
          title="닫기 — 상단 도움말(?)에서 다시 열 수 있습니다"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="h-1 bg-ink-100 mx-3.5 rounded-full overflow-hidden" aria-hidden>
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${(doneCount / TASKS.length) * 100}%` }}
        />
      </div>
      {!saved.collapsed && (
        <div className="px-3.5 pt-2 pb-3">
          {allDone ? (
            <p className="text-[12.5px] text-ink-700 leading-relaxed break-keep">
              기본 업무를 모두 해 봤습니다. 다른 업무도 상단 도움말(?) → 업무 따라하기에서 언제든 다시 볼 수
              있습니다.
            </p>
          ) : (
            <ul className="space-y-1">
              {TASKS.map((t) => {
                const done = saved.done.includes(t.id);
                return (
                  <li key={t.id} className="flex items-center gap-2 text-[12.5px]">
                    {done ? (
                      <Check className="w-4 h-4 text-brand-700 shrink-0" aria-label="완료" />
                    ) : (
                      <Circle className="w-4 h-4 text-ink-300 shrink-0" aria-label="미완료" />
                    )}
                    <span className={"flex-1 " + (done ? "text-ink-400 line-through" : "text-ink-900")}>
                      {t.label}
                    </span>
                    {!done && (
                      <button
                        type="button"
                        onClick={() => go(t)}
                        className="text-[11.5px] font-semibold text-brand-700 hover:underline shrink-0"
                      >
                        {t.guideId ? "따라하기" : t.href ? "바로 가기" : "시작"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-[11.5px] font-semibold text-ink-700 hover:text-ink-900 flex items-center gap-1"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              업무 따라하기 전체
            </button>
            <Link href="/admin/help" className="text-[11.5px] text-ink-500 hover:text-ink-900">
              사용 안내
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/** 업무 따라하기 고르는 창 — 도움말(?)·체크리스트·사용 안내에서 연다 */
function GuidePicker() {
  const open = useOnboarding((s) => s.pickerOpen);
  const setOpen = useOnboarding((s) => s.setPickerOpen);
  if (!open) return null;
  return (
    <div
      data-onboarding
      className="fixed inset-0 z-[80] bg-ink-900/40 grid place-items-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-label="업무 따라하기"
        className="bg-white rounded-card w-full max-w-lg p-5 shadow-xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-brand-700" />
            업무 따라하기
          </h2>
          <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-ink-100" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12.5px] text-ink-500 mt-1 mb-3 break-keep">
          실제 화면에서 한 단계씩 짚어 드립니다. 강조된 곳을 직접 누르고 입력하면 다음 단계로 넘어갑니다.
        </p>
        <GuideList className="flex-1 overflow-y-auto" />
      </div>
    </div>
  );
}

/** 따라하기 목록 — 고르는 창과 사용 안내 화면에서 같이 쓴다 */
export function GuideList({ className = "" }: { className?: string }) {
  const doneGuides = useOnboarding((s) => s.saved.doneGuides);
  const startTour = useOnboarding((s) => s.startTour);
  return (
    <ul className={"divide-y divide-ink-100 border border-ink-100 rounded-btn bg-white " + className}>
      {GUIDES.map((g) => {
        const done = doneGuides.includes(g.id);
        return (
          <li key={g.id} className="px-3.5 py-2.5 flex items-center gap-3">
            {done ? (
              <Check className="w-4 h-4 text-brand-700 shrink-0" aria-label="해 봄" />
            ) : (
              <Circle className="w-4 h-4 text-ink-300 shrink-0" aria-label="안 해 봄" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-ink-900">{g.label}</div>
              <div className="text-[11.5px] text-ink-500 break-keep">
                {g.summary} · {g.steps.length}단계
              </div>
            </div>
            <button
              type="button"
              onClick={() => startTour(g)}
              className="px-2.5 py-1.5 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 flex items-center gap-1 shrink-0"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {done ? "다시" : "시작"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
