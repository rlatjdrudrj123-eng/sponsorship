"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { receiptNo } from "@/lib/receiptNo";
import { cachedFetch } from "@/lib/firebase/cache";
import type { SiteSettings } from "@/lib/types";
import { Footer } from "@/components/public/Footer";
import { useLocale, localeHref } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

export default function ContactDonePage() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;
  const locale = useLocale((s) => s.locale);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const data = await cachedFetch(`pub:settings:${eventId}`, async () => {
          const snap = await getDoc(doc(getDb(), "siteSettings", eventId));
          return snap.exists() ? (snap.data() as SiteSettings) : null;
        });
        if (data) setSettings(data);
      } catch {
        // ignore
      }
    })();
  }, [eventId]);

  return (
    <>
      <main className="min-h-screen bg-canvas grid place-items-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-brand-500 grid place-items-center mb-8 shadow-glow">
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
          <div className="font-num text-[11px] uppercase tracking-[0.3em] text-brand-500 font-bold mb-3">
            inquiry received
          </div>
          <h1 className="text-[32px] md:text-[44px] font-bold tracking-tight leading-tight mb-4 text-ink-900">
            {t("contact.doneTitle", locale)}
          </h1>
          <p className="text-[14px] md:text-[15px] text-ink-500 leading-relaxed">
            {locale === "en"
              ? "We'll review and reply shortly to the email and phone you provided."
              : "사무국에서 확인 후 빠르게 회신드릴게요. 입력하신 이메일과 전화번호로 연락드릴 예정이니 확인 부탁드려요."}
          </p>
          {/* useSearchParams 는 정적 렌더 시 Suspense 경계가 필요 — 이 부분만 감싼다 */}
          <Suspense fallback={null}>
            <ReceiptNumber isEn={locale === "en"} />
          </Suspense>
          {settings?.contact && (
            <div className="mt-8 pt-6 border-t border-ink-100 text-[12px] text-ink-500 space-y-1 font-num">
              {settings.contact.phone && <div>{settings.contact.phone}</div>}
              {settings.contact.email && (
                <a
                  href={`mailto:${settings.contact.email}`}
                  className="text-brand-500 font-bold hover:underline"
                >
                  {settings.contact.email}
                </a>
              )}
            </div>
          )}
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href={localeHref(eventId, "", locale)}
              className="px-5 py-3 rounded-pill border border-ink-100 text-[13px] font-bold hover:border-ink-900 hover:bg-surface transition-colors"
            >
              {t("contact.toHome", locale)}
            </Link>
            <Link
              href={localeHref(eventId, "/sponsorships", locale)}
              className="px-5 py-3 rounded-pill bg-brand-500 text-white font-bold text-[13px] hover:bg-brand-700 hover:shadow-glow-sm transition-all"
            >
              {t("contact.browseMore", locale)}
            </Link>
          </div>
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

/**
 * 접수번호 — 문의 제출 후 ?no={inquiries 문서 id} 로 넘어온 값의 앞 8자리(대문자).
 * Firestore 자동 id 는 영문·숫자뿐이라 그 외 문자는 버린다 (URL 로 임의 문구 노출 방지).
 */
function ReceiptNumber({ isEn }: { isEn: boolean }) {
  const search = useSearchParams();
  const no = receiptNo(search.get("no") ?? "");
  if (!no) return null;

  return (
    <div className="mt-6 rounded-card border border-ink-100 bg-surface px-5 py-4">
      <p className="text-[13px] text-ink-700">
        {isEn ? "Reference no." : "접수번호"}{" "}
        <strong className="font-mono text-[18px] font-bold tracking-[0.08em] text-ink-900 align-middle select-all">
          {no}
        </strong>
      </p>
      <p className="text-[12px] text-ink-700 mt-1">
        {isEn
          ? "Please keep this number until you hear back from us."
          : "회신 받을 때까지 접수번호를 보관해 주세요."}
      </p>
    </div>
  );
}
