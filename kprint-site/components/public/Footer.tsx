"use client";

import Link from "next/link";
import type { SiteSettings } from "@/lib/types";

export function Footer({ settings }: { settings: SiteSettings | null }) {
  return (
    <footer className="bg-ink-900 text-white py-12 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 text-[13px]">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <span className="font-bold text-[14px]">K-PRINT 2026</span>
          </div>
          <p className="text-ink-300 leading-relaxed">
            {settings?.event.dateRange ?? ""}
            <br />
            {settings?.event.venue ?? ""}
          </p>
        </div>
        <div>
          <h4 className="font-bold text-[12px] uppercase tracking-widest text-brand-500 mb-3">
            사무국 연락처
          </h4>
          <div className="text-ink-300 leading-relaxed space-y-1">
            {settings?.contact.phone && <div>{settings.contact.phone}</div>}
            {settings?.contact.email && (
              <a
                href={`mailto:${settings.contact.email}`}
                className="hover:text-brand-500"
              >
                {settings.contact.email}
              </a>
            )}
            {settings?.contact.address && <div className="text-[12px] text-ink-500">{settings.contact.address}</div>}
          </div>
        </div>
        <div>
          <h4 className="font-bold text-[12px] uppercase tracking-widest text-brand-500 mb-3">
            바로가기
          </h4>
          <ul className="text-ink-300 space-y-1.5">
            <li>
              <Link href="/sponsorships" className="hover:text-brand-500">
                전체 스폰서십
              </Link>
            </li>
            <li>
              <Link href="/packages" className="hover:text-brand-500">
                패키지
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-brand-500">
                문의하기
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/10 text-[11px] text-ink-500">
        © K-PRINT 2026 사무국. All rights reserved.
      </div>
    </footer>
  );
}
