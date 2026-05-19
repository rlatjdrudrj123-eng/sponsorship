"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { ArrowLeft, X } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { useCartStore } from "@/lib/cart/cartStore";
import type {
  CartItem,
  Category,
  Package,
  SiteSettings,
  Slot,
  Subcategory,
} from "@/lib/types";
import { Footer } from "@/components/public/Footer";

const schema = z.object({
  companyName: z.string().min(1, "회사명을 입력하세요"),
  contactName: z.string().min(1, "담당자명을 입력하세요"),
  email: z.string().email("올바른 이메일을 입력하세요"),
  phone: z.string().min(7, "전화번호를 입력하세요"),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center text-sm text-ink-500">
          불러오는 중…
        </div>
      }
    >
      <ContactPageInner />
    </Suspense>
  );
}

function ContactPageInner() {
  const router = useRouter();
  const params = useParams<{ eventSlug: string }>();
  const search = useSearchParams();
  const eventId = params.eventSlug;
  const idsParam = search.get("ids") ?? "";
  const allItems = useCartStore((s) => s.items);
  const removeSlot = useCartStore((s) => s.removeSlot);
  const removePackage = useCartStore((s) => s.removePackage);
  const hydrated = useCartStore((s) => s.hasHydrated);

  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [subcategories, setSubcategories] = useState<Map<string, Subcategory>>(
    new Map()
  );
  const [slots, setSlots] = useState<Map<string, Slot>>(new Map());
  const [packages, setPackages] = useState<Map<string, Package>>(new Map());
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // idsParam (compare → contact) 모드: idsParam 만으로 CartItem 합성.
  // 일반 (카트 → contact) 모드: cart store 항목 그대로.
  const items = useMemo<CartItem[]>(() => {
    if (idsParam) {
      const ids = idsParam.split(",");
      const result: CartItem[] = [];
      for (const raw of ids) {
        if (!raw) continue;
        let id = raw;
        if (id.startsWith("slot-cat:")) id = "cat:" + id.slice("slot-cat:".length);
        else if (id.startsWith("slot:cat:")) id = "cat:" + id.slice("slot:cat:".length);

        if (id.startsWith("slot:")) {
          const slotId = id.slice(5);
          const slot = slots.get(slotId);
          if (!slot) continue;
          const sub = subcategories.get(slot.subcategoryId);
          result.push({
            type: "slot",
            eventId,
            slotId: slot.id,
            categoryId: slot.categoryId,
            subcategoryId: slot.subcategoryId,
            code: slot.code,
            price: sub?.priceKRW ?? 0,
          });
        } else if (id.startsWith("cat:")) {
          const catId = id.slice(4);
          const cat = categories.get(catId);
          if (!cat) continue;
          const catSubs = Array.from(subcategories.values())
            .filter((s) => s.categoryId === catId)
            .sort((a, b) => a.priceKRW - b.priceKRW);
          const sub = catSubs[0];
          if (!sub) continue;
          const slot = Array.from(slots.values()).find(
            (s) => s.categoryId === catId && s.subcategoryId === sub.id
          );
          if (!slot) continue;
          result.push({
            type: "slot",
            eventId,
            slotId: slot.id,
            categoryId: slot.categoryId,
            subcategoryId: slot.subcategoryId,
            code: slot.code,
            price: sub.priceKRW,
          });
        } else if (id.startsWith("pkg:")) {
          const pkgId = id.slice(4);
          const pkg = packages.get(pkgId);
          if (!pkg) continue;
          result.push({
            type: "package",
            eventId,
            packageId: pkg.id,
            code: pkg.code,
            price: pkg.discountPrice,
          });
        }
      }
      return result;
    }
    return allItems.filter((it) => it.eventId === eventId);
  }, [idsParam, allItems, eventId, slots, subcategories, categories, packages]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.price, 0),
    [items]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        // 행사·published 필터
        const [catSnap, subSnap, slotSnap, pkgSnap, settingsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "categories"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDocs(
            query(collection(db, "subcategories"), where("eventId", "==", eventId))
          ),
          getDocs(
            query(collection(db, "slots"), where("eventId", "==", eventId))
          ),
          getDocs(
            query(
              collection(db, "packages"),
              where("eventId", "==", eventId),
              where("isPublished", "==", true)
            )
          ),
          getDoc(doc(db, "siteSettings", eventId)),
        ]);
        const cm = new Map<string, Category>();
        catSnap.docs.forEach((d) =>
          cm.set(d.id, { ...(d.data() as Category), id: d.id })
        );
        const sm = new Map<string, Subcategory>();
        subSnap.docs.forEach((d) =>
          sm.set(d.id, { ...(d.data() as Subcategory), id: d.id })
        );
        const slm = new Map<string, Slot>();
        slotSnap.docs.forEach((d) =>
          slm.set(d.id, { ...(d.data() as Slot), id: d.id })
        );
        const pm = new Map<string, Package>();
        pkgSnap.docs.forEach((d) =>
          pm.set(d.id, { ...(d.data() as Package), id: d.id })
        );
        setCategories(cm);
        setSubcategories(sm);
        setSlots(slm);
        setPackages(pm);
        if (settingsSnap.exists())
          setSettings(settingsSnap.data() as SiteSettings);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [eventId]);

  const vat = useMemo(() => Math.round(subtotal * 0.1), [subtotal]);
  const total = subtotal + vat;

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await addDoc(collection(getDb(), "inquiries"), {
        eventId,
        companyName: values.companyName,
        contactName: values.contactName,
        email: values.email,
        phone: values.phone,
        message: values.message ?? "",
        cartItems: items,
        cartSubtotal: subtotal,
        cartVat: vat,
        cartTotal: total,
        status: "new",
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      // 카트 모드일 때만 카트에서 제거 (idsParam 모드는 cart 와 무관)
      if (!idsParam) {
        items.forEach((it) => {
          if (it.type === "slot") removeSlot(it.slotId);
          else removePackage(it.packageId);
        });
      }
      router.push(`/${eventId}/contact/done`);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "문의 전송에 실패했습니다."
      );
    }
  };

  return (
    <>
      <main className="min-h-screen bg-canvas">
        <header className="px-6 md:px-16 pt-16 md:pt-20 pb-8 md:pb-10 border-b border-ink-100 bg-surface">
          <div className="max-w-5xl mx-auto">
            <Link
              href={`/${eventId}/cart`}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-500 mb-4 font-num font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              관심 항목으로
            </Link>
            <div className="font-num text-[11px] md:text-[12px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-px bg-brand-500" />
              contact
            </div>
            <h1 className="text-[36px] md:text-[64px] font-bold tracking-tight leading-[1.05] text-ink-900">
              문의하기
            </h1>
            <p className="text-[14px] md:text-[16px] text-ink-500 mt-3 leading-relaxed max-w-xl">
              카트에 담은 항목과 함께 보내주시면 사무국에서 1영업일 내 정식 견적을 회신드립니다.
            </p>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 md:px-12 py-10 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Field label="회사명" error={errors.companyName?.message} required>
              <input
                {...register("companyName")}
                placeholder="(주) 인쇄출판"
                className="w-full px-3.5 py-2.5 text-[14px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
              />
            </Field>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="담당자명" error={errors.contactName?.message} required>
                <input
                  {...register("contactName")}
                  placeholder="홍길동"
                  className="w-full px-3.5 py-2.5 text-[14px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
                />
              </Field>
              <Field label="전화번호" error={errors.phone?.message} required>
                <input
                  {...register("phone")}
                  placeholder="010-0000-0000"
                  className="w-full px-3.5 py-2.5 text-[14px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
                />
              </Field>
            </div>
            <Field label="이메일" error={errors.email?.message} required>
              <input
                type="email"
                {...register("email")}
                placeholder="contact@company.com"
                className="w-full px-3.5 py-2.5 text-[14px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
              />
            </Field>
            <Field label="메시지 (선택)" error={errors.message?.message}>
              <textarea
                {...register("message")}
                rows={6}
                placeholder="협의하고 싶은 내용을 적어주세요. 어떤 채널이 우선인지, 예산 범위, 일정 등."
                className="w-full px-3.5 py-2.5 text-[14px] border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white resize-y"
              />
            </Field>

            {submitError && (
              <div className="bg-red-50 border border-red-100 rounded-btn p-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Link
                href={`/${eventId}/sponsorships`}
                className="text-[13px] text-ink-500 hover:text-ink-900"
              >
                둘러보기로 돌아가기
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-7 py-3.5 rounded-pill bg-brand-500 text-white font-bold hover:bg-brand-700 hover:shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? "전송 중…" : "문의 보내기"}
              </button>
            </div>
          </form>

          {/* Wishlist sidebar */}
          <aside className="bg-surface border border-ink-100 rounded-card p-5 lg:sticky lg:top-6 shadow-card">
            <div className="font-num text-[10px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3 flex items-center gap-2">
              <span className="w-4 h-px bg-brand-500" />
              첨부될 관심 항목 ({items.length}건)
            </div>
            {!hydrated ? (
              <div className="text-[12px] text-ink-500">불러오는 중…</div>
            ) : items.length === 0 ? (
              <div className="text-[12px] text-ink-500 py-2">
                관심 항목이 없어도 문의는 보낼 수 있어요.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {items.map((item) => {
                  if (item.type === "slot") {
                    const cat = categories.get(item.categoryId);
                    const sub = subcategories.get(item.subcategoryId);
                    return (
                      <li
                        key={`slot-${item.slotId}`}
                        className="flex items-start gap-2 text-[12px]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-ink-900 truncate">
                            {cat?.name.ko ?? "(삭제됨)"}
                          </div>
                          <div className="text-ink-500 font-mono text-[11px]">
                            {item.code}
                            {sub?.name.ko ? ` · ${sub.name.ko}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(item.slotId)}
                          className="w-5 h-5 text-ink-300 hover:text-red-700 shrink-0"
                          aria-label="빼기"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  }
                  const pkg = packages.get(item.packageId);
                  return (
                    <li
                      key={`pkg-${item.packageId}`}
                      className="flex items-start gap-2 text-[12px]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-ink-900 truncate">
                          {pkg?.name.ko ?? "(삭제됨)"}
                        </div>
                        <div className="text-ink-500 font-mono text-[11px]">
                          {item.code} · 패키지
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePackage(item.packageId)}
                        className="w-5 h-5 text-ink-300 hover:text-red-700 shrink-0"
                        aria-label="빼기"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 pt-3 border-t border-ink-100 text-[11px] text-ink-500 leading-relaxed">
              정식 견적 금액·VAT은 사무국에서 검토 후 회신드립니다.
            </p>
          </aside>
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">
        {label}
        {required && <span className="text-brand-700 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-700 mt-1">{error}</p>}
    </div>
  );
}

