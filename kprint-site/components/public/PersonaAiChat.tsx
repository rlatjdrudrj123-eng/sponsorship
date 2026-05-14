"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MessageSquare, Send, ShoppingBag, Sparkles, X } from "lucide-react";
import type {
  Category,
  Package,
  Persona,
  Slot,
  Subcategory,
} from "@/lib/types";
import { useCartStore } from "@/lib/cart/cartStore";
import { derivePurposes } from "@/lib/purposes";

/**
 * AI 대화형 페르소나 추천.
 *
 * - 사용자가 짧은 질문 3~5턴 답하면 → AI가 페르소나 + 콤보 추천
 * - 추천에는 categorySlugs + packageIds 가 포함되어 "한 번에 카트 담기" 가능
 * - API: /api/persona-chat (서버 Anthropic)
 */
export function PersonaAiChat({
  open,
  onClose,
  eventName,
  eventId,
  personas,
  categories,
  subcategories,
  slots,
  packages,
}: {
  open: boolean;
  onClose: () => void;
  eventName: string;
  eventId: string;
  personas: Persona[];
  categories: Category[];
  subcategories: Subcategory[];
  slots: Slot[];
  packages: Package[];
}) {
  type Msg = { role: "user" | "assistant"; content: string };
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "안녕하세요. 어떤 회사에서 오셨고, 이번 행사에서 어떤 효과를 가장 원하세요? 예산 대략적인 범위도 함께 알려주시면 한 번에 추천해드릴게요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<{
    personaId?: string;
    categorySlugs?: string[];
    packageIds?: string[];
    rationale?: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => {
    return {
      eventName,
      personas: personas
        .filter((p) => p.isActive)
        .map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          budgetMin: p.budgetMin,
          budgetMax: p.budgetMax,
          purposes: p.purposes,
        })),
      categories: categories.slice(0, 60).map((c) => {
        const subs = subcategories.filter((s) => s.categoryId === c.id);
        const prices = subs.map((s) => s.priceKRW).filter((p) => p > 0);
        const catSlots = slots.filter((s) => s.categoryId === c.id);
        return {
          slug: c.slug,
          name: c.name.ko,
          type: c.type,
          channel: c.channel,
          minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
          purposes: derivePurposes(c),
          available: catSlots.filter((s) => s.status === "available").length,
          total: catSlots.length,
        };
      }),
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name.ko,
        tier: p.tier,
        price: p.discountPrice || p.originalPrice,
      })),
    };
  }, [eventName, personas, categories, subcategories, slots, packages]);

  // ESC 닫기 + 자동 스크롤
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const r = await fetch("/api/persona-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context }),
      });
      const data = (await r.json()) as {
        reply?: string;
        recommendation?: {
          personaId?: string;
          categorySlugs?: string[];
          packageIds?: string[];
          rationale?: string;
        };
        error?: string;
      };
      if (!r.ok || data.error) {
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      if (data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
      }
      if (data.recommendation) setRecommendation(data.recommendation);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-ink-900/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full md:max-w-2xl h-[90vh] md:h-[85vh] md:rounded-card shadow-2xl overflow-hidden flex flex-col"
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between shrink-0 bg-canvas">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand-500 grid place-items-center shadow-glow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-num text-[10px] uppercase tracking-[0.3em] text-brand-500 font-bold">
                ai 추천
              </div>
              <h3 className="text-[15px] font-bold text-ink-900 leading-tight">
                대화로 스폰서십 찾기
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-btn hover:bg-ink-100 text-ink-500"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 메시지 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                "flex " +
                (m.role === "user" ? "justify-end" : "justify-start")
              }
            >
              <div
                className={
                  "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap " +
                  (m.role === "user"
                    ? "bg-ink-900 text-white"
                    : "bg-canvas border border-ink-100 text-ink-900")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-2xl bg-canvas border border-ink-100 text-[13px] text-ink-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                생각 중…
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-btn p-3 text-[12.5px] text-red-700">
              {error}
            </div>
          )}

          {/* 추천 결과 카드 */}
          {recommendation && (
            <RecommendationCard
              rec={recommendation}
              personas={personas}
              categories={categories}
              subcategories={subcategories}
              slots={slots}
              packages={packages}
              eventId={eventId}
              onClose={onClose}
            />
          )}
        </div>

        {/* 입력 */}
        <footer className="border-t border-ink-100 px-3 py-3 shrink-0 bg-surface">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="예: 부스 방문 더 끌고 싶고 예산은 1500만원 정도예요"
              rows={2}
              className="flex-1 px-3.5 py-2.5 text-[14px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white resize-none"
              disabled={busy}
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="px-4 h-[46px] rounded-btn bg-brand-500 text-white font-bold disabled:opacity-40 hover:bg-brand-700 flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              보내기
            </button>
          </div>
          <p className="text-[10.5px] text-ink-500 mt-1.5 px-1">
            💡 AI 답변은 참고용입니다. 정식 견적은 사무국 검토 후 회신됩니다.
          </p>
        </footer>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  personas,
  categories,
  subcategories,
  slots,
  packages,
  eventId,
  onClose,
}: {
  rec: {
    personaId?: string;
    categorySlugs?: string[];
    packageIds?: string[];
    rationale?: string;
  };
  personas: Persona[];
  categories: Category[];
  subcategories: Subcategory[];
  slots: Slot[];
  packages: Package[];
  eventId: string;
  onClose: () => void;
}) {
  const addSlot = useCartStore((s) => s.addSlot);
  const addPackage = useCartStore((s) => s.addPackage);
  const hasSlot = useCartStore((s) => s.hasSlot);
  const hasPackage = useCartStore((s) => s.hasPackage);

  const persona = personas.find((p) => p.id === rec.personaId);
  type Pick = {
    key: string;
    kind: "slot" | "package";
    label: string;
    sublabel?: string;
    code: string;
    price: number;
    slotId?: string;
    categoryId?: string;
    subcategoryId?: string;
    packageId?: string;
    eventId: string;
  };
  const picks: Pick[] = [];

  for (const slug of rec.categorySlugs ?? []) {
    const cat = categories.find((c) => c.slug === slug);
    if (!cat) continue;
    const subs = subcategories
      .filter((s) => s.categoryId === cat.id)
      .sort((a, b) => a.priceKRW - b.priceKRW);
    const sub = subs[0];
    const slot = slots.find(
      (s) => s.subcategoryId === sub?.id && s.status === "available"
    );
    if (!slot || !sub) continue;
    picks.push({
      key: `slot:${slot.id}`,
      kind: "slot",
      label: cat.name.ko,
      sublabel: sub.name.ko,
      code: slot.code,
      price: sub.priceKRW,
      slotId: slot.id,
      categoryId: cat.id,
      subcategoryId: sub.id,
      eventId: cat.eventId,
    });
  }
  for (const pid of rec.packageIds ?? []) {
    const pkg = packages.find((p) => p.id === pid);
    if (!pkg) continue;
    picks.push({
      key: `pkg:${pkg.id}`,
      kind: "package",
      label: pkg.name.ko,
      sublabel: pkg.tier === "signature" ? "Signature" : "Standard",
      code: pkg.code,
      price: pkg.discountPrice || pkg.originalPrice,
      packageId: pkg.id,
      eventId,
    });
  }

  if (picks.length === 0 && !persona) return null;

  const total = picks.reduce((sum, p) => sum + p.price, 0);
  const allInCart = picks.every((p) =>
    p.kind === "slot" && p.slotId
      ? hasSlot(p.slotId)
      : p.kind === "package" && p.packageId
        ? hasPackage(p.packageId)
        : false
  );

  const addAll = () => {
    for (const p of picks) {
      if (p.kind === "slot" && p.slotId && p.categoryId && p.subcategoryId) {
        if (!hasSlot(p.slotId)) {
          addSlot({
            type: "slot",
            eventId: p.eventId,
            slotId: p.slotId,
            categoryId: p.categoryId,
            subcategoryId: p.subcategoryId,
            code: p.code,
            price: p.price,
          });
        }
      } else if (p.kind === "package" && p.packageId) {
        if (!hasPackage(p.packageId)) {
          addPackage({
            type: "package",
            eventId: p.eventId,
            packageId: p.packageId,
            code: p.code,
            price: p.price,
          });
        }
      }
    }
  };

  return (
    <div className="mt-4 bg-surface border-2 border-brand-500 rounded-card overflow-hidden shadow-glow-sm">
      <div className="bg-brand-grad text-white px-4 py-3">
        <div className="font-num text-[10px] uppercase tracking-[0.3em] text-white/80 font-bold flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          AI 추천
        </div>
        {persona && (
          <h4 className="text-[16px] font-bold mt-1 leading-tight">
            {persona.emoji} {persona.title}
          </h4>
        )}
        {rec.rationale && (
          <p className="text-[12px] text-white/85 mt-1.5">{rec.rationale}</p>
        )}
      </div>
      {picks.length > 0 && (
        <div className="px-4 py-3">
          <ul className="space-y-2 text-[12.5px]">
            {picks.map((p) => (
              <li
                key={p.key}
                className="flex items-center gap-2 border-b border-ink-100 pb-2 last:border-b-0"
              >
                <span className="font-num text-[10px] text-ink-300 w-12 shrink-0">
                  {p.code}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-bold text-ink-900">{p.label}</span>
                  {p.sublabel && (
                    <span className="text-ink-500 ml-1.5">· {p.sublabel}</span>
                  )}
                </span>
                <span className="font-num text-[12px] font-bold text-ink-900 shrink-0">
                  {p.price.toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between gap-2">
            <div className="font-num text-[14px] font-bold text-ink-900">
              합계 {total.toLocaleString()}원
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/${eventId}/compare?ids=${encodeURIComponent(
                  picks.map((p) => p.key).join(",")
                )}`}
                onClick={onClose}
                className="text-[11.5px] text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline"
              >
                비교 →
              </Link>
              <button
                type="button"
                onClick={addAll}
                disabled={allInCart}
                className={
                  "px-3.5 py-2 rounded-pill text-[12px] font-bold flex items-center gap-1.5 transition-all " +
                  (allInCart
                    ? "bg-ink-100 text-ink-500"
                    : "bg-brand-500 text-white hover:bg-brand-700 hover:shadow-glow-sm")
                }
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {allInCart ? "담겨있어요" : "한 번에 담기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 페르소나 코스 상단에 띄우는 AI 채팅 시작 버튼.
 */
export function PersonaAiChatTrigger({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full md:w-auto bg-ink-900 text-white px-5 py-3 rounded-pill text-[13px] font-bold hover:bg-brand-500 transition-colors flex items-center gap-2 shadow-glow-sm hover:shadow-glow"
    >
      <Sparkles className="w-4 h-4" />
      AI 에게 추천 받기
      <span className="text-[11px] font-num text-white/70 group-hover:text-white">
        대화로
      </span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}

// 미사용 import 안전망
void MessageSquare;
