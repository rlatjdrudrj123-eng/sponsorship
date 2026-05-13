"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { SiteSettings } from "@/lib/types";

export function Footer({ settings }: { settings: SiteSettings | null }) {
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const base = eventId ? `/${eventId}` : "";

  const eventName = settings?.event.nameKo ?? "";

  return (
    <footer className="bg-ink-900 text-white py-14 px-6 md:px-12">
      <div className="max-w-7xl mx-auto grid md:grid-cols-[1.4fr_1fr_1fr] gap-10 text-[13px]">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-brand-500 shadow-glow-sm" />
            <span className="font-bold text-[15px] tracking-tight">
              {eventName || "Sponsorship"}
            </span>
          </div>
          <p className="text-ink-300 leading-relaxed text-[12.5px]">
            {settings?.event.dateRange ?? ""}
            {settings?.event.venue ? (
              <>
                <br />
                {settings.event.venue}
              </>
            ) : null}
          </p>
        </div>

        <div>
          <h4 className="font-bold text-[11px] uppercase tracking-[0.2em] text-brand-500 mb-3 font-num">
            사무국 연락처
          </h4>
          <div className="text-ink-300 leading-relaxed space-y-1">
            {settings?.contact.phone && (
              <div className="font-num">{settings.contact.phone}</div>
            )}
            {settings?.contact.email && (
              <a
                href={`mailto:${settings.contact.email}`}
                className="hover:text-brand-500 font-num"
              >
                {settings.contact.email}
              </a>
            )}
            {settings?.contact.address && (
              <div className="text-[12px] text-ink-500 mt-2">
                {settings.contact.address}
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-bold text-[11px] uppercase tracking-[0.2em] text-brand-500 mb-3 font-num">
            바로가기
          </h4>
          <ul className="text-ink-300 space-y-1.5">
            <li>
              <Link
                href={`${base}/sponsorships`}
                className="hover:text-brand-500"
              >
                전체 스폰서십
              </Link>
            </li>
            <li>
              <Link href={`${base}/packages`} className="hover:text-brand-500">
                패키지
              </Link>
            </li>
            <li>
              <Link href={`${base}/contact`} className="hover:text-brand-500">
                문의하기
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/10 text-[11px] text-ink-500 flex items-center justify-between gap-3 flex-wrap">
        <span>© {eventName || "Sponsorship"} 사무국. All rights reserved.</span>
        <span className="font-num text-ink-500/70">
          Powered by 한국이앤엑스
        </span>
      </div>
    </footer>
  );
}
