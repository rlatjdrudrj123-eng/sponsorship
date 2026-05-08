"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { SiteSettings } from "@/lib/types";
import { Footer } from "@/components/public/Footer";

export default function ContactDonePage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "siteSettings", "main"));
        if (snap.exists()) setSettings(snap.data() as SiteSettings);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <>
      <main className="min-h-screen bg-white grid place-items-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-mint-50 border border-mint-100 grid place-items-center mb-6">
            <Check className="w-8 h-8 text-mint-700" />
          </div>
          <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-tight mb-3">
            문의가 접수됐어요
          </h1>
          <p className="text-[14px] text-ink-700 leading-relaxed">
            사무국이 1영업일 내 회신드립니다. 입력하신 이메일과 전화번호로 연락드릴
            예정이니 확인 부탁드려요.
          </p>
          {settings?.contact && (
            <div className="mt-6 text-[12px] text-ink-500 space-y-0.5">
              <div>{settings.contact.phone}</div>
              <a
                href={`mailto:${settings.contact.email}`}
                className="text-mint-700 hover:underline"
              >
                {settings.contact.email}
              </a>
            </div>
          )}
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-btn border border-ink-100 text-[13px] font-semibold hover:bg-ink-50"
            >
              홈으로
            </Link>
            <Link
              href="/sponsorships"
              className="px-5 py-2.5 rounded-btn bg-mint-500 text-ink-900 font-semibold text-[13px] hover:bg-mint-700 hover:text-white"
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
