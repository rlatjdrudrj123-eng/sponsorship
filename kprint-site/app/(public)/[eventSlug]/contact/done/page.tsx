"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { SiteSettings } from "@/lib/types";
import { Footer } from "@/components/public/Footer";

export default function ContactDonePage() {
  const params = useParams<{ eventSlug: string }>();
  const eventId = params.eventSlug;
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "siteSettings", eventId));
        if (snap.exists()) setSettings(snap.data() as SiteSettings);
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
            문의가 접수됐어요
          </h1>
          <p className="text-[14px] md:text-[15px] text-ink-500 leading-relaxed">
            사무국이 1영업일 내 회신드립니다. 입력하신 이메일과 전화번호로 연락드릴
            예정이니 확인 부탁드려요.
          </p>
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
              href={`/${eventId}`}
              className="px-5 py-3 rounded-pill border border-ink-100 text-[13px] font-bold hover:border-ink-900 hover:bg-surface transition-colors"
            >
              홈으로
            </Link>
            <Link
              href={`/${eventId}/sponsorships`}
              className="px-5 py-3 rounded-pill bg-brand-500 text-white font-bold text-[13px] hover:bg-brand-700 hover:shadow-glow-sm transition-all"
            >
              추가 둘러보기
            </Link>
          </div>
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}
