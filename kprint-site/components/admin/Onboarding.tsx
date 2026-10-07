"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Circle, PartyPopper, X } from "lucide-react";
import {
  MAIN_TOUR,
  TASKS,
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
    </>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

function TourOverlay() {
  const tour = useOnboarding((s) => s.activeTour);
  const step = useOnboarding((s) => s.step);
  const next = useOnboarding((s) => s.next);
  const prev = useOnboarding((s) => s.prev);
  const endTour = useOnboarding((s) => s.endTour);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const s = tour?.steps[step];

  // 대상 위치 추적 — 스크롤·창 크기 변경 때, 그리고 화면이 늦게 그려지는 경우를 위해 0.3초마다
  useEffect(() => {
    if (!s) return;
    let scrolled = false;
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      const el = s.target ? document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`) : null;
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: "nearest", inline: "nearest" });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setRect((p) =>
          p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height
            ? p
            : { top: r.top, left: r.left, width: r.width, height: r.height }
        );
      } else {
        setRect(null);
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
  }, [s]);

  // 키보드 — Esc 닫기, ←/→ 이동
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour(false);
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, next, prev, endTour]);

  useEffect(() => {
    nextBtn.current?.focus();
  }, [step, tour]);

  if (!tour || !s) return null;

  const PAD = 6;
  const BUBBLE_W = 300;
  let bubbleStyle: React.CSSProperties;
  if (rect) {
    const below = rect.top + rect.height + PAD + 12;
    const placeBelow = below + 190 < vh;
    const top = placeBelow ? below : Math.max(12, rect.top - PAD - 12 - 190);
    // 사이드바처럼 왼쪽 좁은 요소는 오른쪽에 붙여 보여 준다
    const besideRight = rect.left + rect.width + PAD + 12;
    const narrowLeft = rect.left < 240 && rect.width < 260 && besideRight + BUBBLE_W < vw;
    bubbleStyle = narrowLeft
      ? { top: Math.min(Math.max(12, rect.top - 8), vh - 210), left: besideRight }
      : { top, left: Math.min(Math.max(12, rect.left), vw - BUBBLE_W - 12) };
  } else {
    bubbleStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  const last = step === tour.steps.length - 1;
  return (
    <>
      {/* 바깥 클릭 막기 (투어 중 실수로 다른 걸 누르지 않게) */}
      <div className="fixed inset-0 z-[90]" aria-hidden onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div
          aria-hidden
          className="fixed z-[91] rounded-[10px] ring-2 ring-brand-500 pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 z-[91] bg-ink-900/55 pointer-events-none" />
      )}
      <div
        role="dialog"
        aria-label={`${tour.label} ${step + 1}/${tour.steps.length}`}
        className="fixed z-[92] bg-white rounded-card shadow-xl border border-ink-100 p-4"
        style={{ width: BUBBLE_W, ...bubbleStyle }}
      >
        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <span>
            {tour.label} · {step + 1}/{tour.steps.length}
          </span>
          <button
            type="button"
            onClick={() => endTour(false)}
            className="p-0.5 rounded hover:bg-ink-100"
            aria-label="투어 닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-1.5 text-[14px] font-bold text-ink-900 break-keep">{s.title}</div>
        <p className="mt-1 text-[13px] text-ink-700 leading-relaxed break-keep" aria-live="polite">
          {s.body}
        </p>
        <div className="mt-3 h-1 rounded-full bg-ink-100 overflow-hidden" aria-hidden>
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${((step + 1) / tour.steps.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => endTour(false)}
            className="text-[12px] text-ink-500 hover:text-ink-900"
          >
            건너뛰기
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
              className="px-3 py-1.5 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700"
            >
              {last ? "완료" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StartChecklist() {
  const router = useRouter();
  const saved = useOnboarding((s) => s.saved);
  const loaded = useOnboarding((s) => s.loaded);
  const setCollapsed = useOnboarding((s) => s.setCollapsed);
  const setHidden = useOnboarding((s) => s.setHidden);
  const startTour = useOnboarding((s) => s.startTour);
  const setPendingTour = useOnboarding((s) => s.setPendingTour);

  const go = useCallback(
    (t: ChecklistTask) => {
      if (!t.href) {
        startTour(MAIN_TOUR);
        return;
      }
      if (t.tourId) setPendingTour(t.tourId);
      router.push(t.href);
    },
    [router, startTour, setPendingTour]
  );

  if (!loaded || saved.hidden) return null;
  const doneCount = TASKS.filter((t) => saved.done.includes(t.id)).length;
  const allDone = doneCount === TASKS.length;

  return (
    <section
      data-tour="checklist"
      aria-label="시작하기 체크리스트"
      className="fixed right-5 bottom-5 z-40 w-[264px] bg-white border border-ink-100 rounded-card shadow-lg"
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
              기본 사용법을 모두 둘러봤습니다. 다시 보려면 상단 도움말(?)을 누르세요.
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
                        {t.href ? "바로 가기" : "시작"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/admin/help" className="block mt-2 text-[11.5px] text-ink-500 hover:text-ink-900">
            전체 사용 안내 보기
          </Link>
        </div>
      )}
    </section>
  );
}
