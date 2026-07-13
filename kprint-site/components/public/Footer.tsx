"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, FileText, Layers, Mail, Phone } from "lucide-react";
import type { SiteSettings } from "@/lib/types";
import { useLocale, localizedField } from "@/lib/i18n/locale";
import { getFullPdfHref, isDirectPdfHref } from "@/lib/pdf";
import * as clarity from "@/lib/clarity";

export function Footer({ settings }: { settings: SiteSettings | null }) {
  const params = useParams<{ eventSlug?: string }>();
  const eventId = params?.eventSlug ?? "";
  const locale = useLocale((s) => s.locale);
  const isEn = locale === "en";
  // base — 영문 페이지에서 /en/ 세그먼트 자동 포함. 옛 `/${eventId}` 단순 prefix
  // 는 footer 의 sponsorships / contact 링크가 KO 로 가던 버그를 일으킴.
  const base = eventId ? (isEn ? `/${eventId}/en` : `/${eventId}`) : "";

  const eventName = isEn
    ? settings?.event.nameEn || settings?.event.nameKo || ""
    : settings?.event.nameKo ?? "";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink-900 text-white pt-16 pb-10 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        {/* 메인 그리드 — 4 컬럼 */}
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 text-[13px]">
          {/* 행사 정보 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-brand-500 shadow-glow-sm" />
              <span className="font-bold text-[15px] tracking-tight">
                {eventName || "K-PRINT 2026"}
              </span>
            </div>
            <p className="text-ink-300 leading-relaxed text-[12.5px]">
              {localizedField(
                settings?.event.dateRange,
                settings?.event.dateRangeEn,
                locale
              )}
              {settings?.event.venue ? (
                <>
                  <br />
                  {localizedField(
                    settings.event.venue,
                    settings.event.venueEn,
                    locale
                  )}
                </>
              ) : null}
            </p>
            <p className="mt-4 text-[12px] text-ink-500 leading-relaxed max-w-sm">
              {isEn
                ? "Korea's largest exhibition gathering professionals across the print · label · packaging industries."
                : "인쇄·라벨·패키징 산업 종사자를 한 자리에 모으는 국내 최대 규모 전시회."}
            </p>
          </div>

          {/* 사무국 연락처 */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-[0.2em] text-brand-500 mb-3 font-num">
              {isEn ? "Secretariat" : "사무국 연락처"}
            </h4>
            <ul className="text-ink-300 leading-relaxed space-y-2">
              {settings?.contact.phone && (
                <li className="flex items-center gap-2 font-num">
                  <Phone className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                  <a
                    href={`tel:${settings.contact.phone}`}
                    className="hover:text-brand-500"
                  >
                    {settings.contact.phone}
                  </a>
                </li>
              )}
              {settings?.contact.email && (
                <li className="flex items-center gap-2 font-num">
                  <Mail className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                  <a
                    href={`mailto:${settings.contact.email}`}
                    className="hover:text-brand-500 truncate"
                  >
                    {settings.contact.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* 바로가기 */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-[0.2em] text-brand-500 mb-3 font-num">
              {isEn ? "Links" : "바로가기"}
            </h4>
            <ul className="text-ink-300 space-y-2">
              <li>
                <Link
                  href={`${base}/sponsorships`}
                  className="hover:text-brand-500 flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5 text-ink-500" />
                  {isEn ? "Sponsorship catalog" : "스폰서십 카탈로그"}
                </Link>
              </li>
              <li>
                <Link
                  href={`${base}/contact`}
                  className="hover:text-brand-500 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-ink-500" />
                  {isEn ? "Sponsorship inquiry" : "스폰서십 문의"}
                </Link>
              </li>
            </ul>
          </div>

          {/* 자료 */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-[0.2em] text-brand-500 mb-3 font-num">
              {isEn ? "Resources" : "자료"}
            </h4>
            <ul className="text-ink-300 space-y-2">
              <li>
                {(() => {
                  const pdfHref = eventId ? getFullPdfHref(eventId, settings, locale) : "#";
                  const direct = isDirectPdfHref(settings, locale);
                  return (
                    <a
                      href={pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...(direct ? { download: "" } : {})}
                      onClick={() => clarity.event("pdf_full_downloaded")}
                      className="hover:text-brand-500 flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5 text-ink-500" />
                      {isEn ? "Full sponsorship PDF" : "전체 스폰서십 PDF"}
                    </a>
                  );
                })()}
              </li>
              <li>
                <Link
                  href={`${base}/landing/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => clarity.event("pdf_overview_downloaded")}
                  className="hover:text-brand-500 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-ink-500" />
                  {isEn ? "Overview PDF" : "소개 자료 PDF"}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* 하단 메타 — 회사 법적 정보 (사업자등록·대표이사·주소). 주소는 1회만. */}
        <div className="mt-12 pt-6 border-t border-white/10 grid md:grid-cols-2 gap-4 text-[11px] text-ink-500">
          <div className="space-y-1">
            <div className="text-ink-300 font-bold">
              {isEn ? "Korea E&EX Co., Ltd." : "㈜한국이앤엑스 (Korea E&EX)"}
            </div>
            <div className="font-num text-ink-500/80 leading-relaxed">
              {isEn
                ? "Biz Reg. No. 120-81-81311 · CEOs Chung-han Kim, Jeong-jo Kim"
                : "사업자등록번호 120-81-81311 · 대표이사 김충한·김정조"}
              {(() => {
                const addr = localizedField(
                  settings?.contact.address,
                  settings?.contact.addressEn,
                  locale
                );
                return addr ? (
                  <>
                    <br />
                    {addr}
                  </>
                ) : null;
              })()}
            </div>
          </div>
          <div className="md:text-right flex md:items-end md:justify-end">
            <span className="text-ink-500/70">
              © {year} {eventName || "K-PRINT"}{" "}
              {isEn ? "Secretariat. All rights reserved." : "사무국. All rights reserved."}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
