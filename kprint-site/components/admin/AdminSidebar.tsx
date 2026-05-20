"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  Brain,
  CalendarDays,
  Database,
  ExternalLink,
  FileDown,
  FileText,
  FolderKanban,
  Gift,
  Globe,
  Grid2x2,
  HelpCircle,
  Handshake,
  Layers,
  LayoutDashboard,
  Layout,
  LayoutTemplate,
  MessageSquare,
  Package,
  Settings,
  Tags,
  Upload,
} from "lucide-react";
import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { useAdminEvent } from "@/lib/admin/adminEventStore";
import type { Event as EventDoc } from "@/lib/types";

// 과거 시드 버그로 event.name 이 { ko, en } 객체로 저장된 데이터 호환.
function nameOf(n: unknown): string {
  if (typeof n === "string") return n;
  if (n && typeof n === "object") {
    const obj = n as { ko?: unknown; en?: unknown };
    if (typeof obj.ko === "string") return obj.ko;
    if (typeof obj.en === "string") return obj.en;
  }
  return "";
}

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type MenuItem = {
  href: string;
  label: string;
  Icon: IconType;
  badge?: number;
  exact?: boolean; // /admin 처럼 정확히 일치할 때만 active
};

type Section = { label: string; items: MenuItem[] };

export function AdminSidebar() {
  const pathname = usePathname();
  const [newInquiries, setNewInquiries] = useState<number>(0);
  const selectedEventId = useAdminEvent((s) => s.selectedEventId);
  const [selectedEvent, setSelectedEvent] = useState<EventDoc | null>(null);

  // 선택된 행사 정보 구독 — 좌상단 배지·푸터에 실제 행사명·짧은이름 노출
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null);
      return;
    }
    const u = onSnapshot(
      doc(getDb(), "events", selectedEventId),
      (s) => {
        if (s.exists()) {
          setSelectedEvent({ ...(s.data() as EventDoc), id: s.id });
        } else {
          setSelectedEvent(null);
        }
      }
    );
    return () => u();
  }, [selectedEventId]);

  // 신규 문의 배지
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getCountFromServer(
          query(collection(getDb(), "inquiries"), where("status", "==", "new"))
        );
        if (!cancelled) setNewInquiries(snap.data().count);
      } catch {
        // 데이터 없거나 권한 미준비일 때는 조용히 무시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sections: Section[] = [
    {
      label: "메인",
      items: [
        { href: "/admin", label: "대시보드", Icon: LayoutDashboard, exact: true },
        { href: "/admin/events", label: "행사 관리", Icon: CalendarDays },
      ],
    },
    {
      label: "콘텐츠",
      items: [
        { href: "/admin/categories", label: "스폰서십 매체", Icon: FolderKanban },
        { href: "/admin/packages", label: "패키지", Icon: Package },
        { href: "/admin/slots", label: "구좌 관리", Icon: Grid2x2 },
        { href: "/admin/classification", label: "매체 분류", Icon: Layers },
      ],
    },
    {
      label: "영업",
      items: [
        {
          href: "/admin/inquiries",
          label: "문의",
          Icon: MessageSquare,
          badge: newInquiries > 0 ? newInquiries : undefined,
        },
        { href: "/admin/sponsors", label: "스폰서 관리", Icon: Handshake },
      ],
    },
    {
      label: "사이트",
      items: [
        { href: "/admin/settings", label: "사이트 설정", Icon: Settings, exact: true },
        { href: "/admin/settings/landing", label: "메인 페이지 디자인", Icon: Layout },
        { href: "/admin/settings/type-layouts", label: "유형별 표시 설정", Icon: LayoutTemplate },
        { href: "/admin/settings/perks", label: "추가 혜택", Icon: Gift },
        { href: "/admin/settings/diagnosis", label: "1분 진단 설정", Icon: Brain },
        { href: "/admin/settings/taxonomy", label: "참가 상황·태그", Icon: Tags },
        { href: "/admin/settings/quote", label: "견적서 설정", Icon: FileText },
      ],
    },
    {
      label: "도구",
      items: [
        { href: "/admin/import", label: "엑셀 일괄 등록", Icon: Upload },
        { href: "/admin/seed", label: "샘플 데이터 채우기", Icon: Database },
      ],
    },
  ];

  const isActive = (item: MenuItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <aside className="w-[220px] shrink-0 bg-ink-900 text-ink-100 flex flex-col px-3 py-4 sticky top-0 h-screen overflow-y-auto">
      <div className="flex items-center gap-2 px-2.5 pb-4 mb-2 border-b border-white/10">
        <span className="w-2 h-2 rounded-full bg-brand-500" />
        <span className="font-bold text-white tracking-tight text-[15px] truncate">
          {selectedEvent
            ? nameOf(selectedEvent.shortName) || nameOf(selectedEvent.name) || "(이름 없음)"
            : "행사 미선택"}
        </span>
        <span className="ml-auto text-[11px] text-ink-500 font-mono">admin</span>
      </div>

      <nav className="flex-1">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] tracking-[0.12em] uppercase text-ink-500 px-2.5 pt-3 pb-1.5">
              {section.label}
            </div>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-btn text-[13px] transition-colors " +
                        (active
                          ? "bg-brand-500 text-ink-900 font-semibold"
                          : "text-ink-300 hover:bg-white/5 hover:text-white")
                      }
                    >
                      <item.Icon className="w-4 h-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* 공개 사이트 미리보기 — 현재 선택된 행사 기준 */}
        {selectedEventId && (
          <div>
            <div className="text-[10px] tracking-[0.12em] uppercase text-ink-500 px-2.5 pt-3 pb-1.5">
              공개 사이트
            </div>
            <ul className="flex flex-col gap-0.5">
              <ExternalNav
                href={`/${selectedEventId}`}
                label="행사 홈"
                Icon={Globe}
              />
              <ExternalNav
                href={`/${selectedEventId}/sponsorships`}
                label="스폰서십 카탈로그"
                Icon={Grid2x2}
              />
              <ExternalNav
                href={`/${selectedEventId}/print/full`}
                label="전체 PDF 미리보기"
                Icon={FileDown}
              />
            </ul>
          </div>
        )}
      </nav>

      <div className="pt-4 border-t border-white/10 px-2.5 text-[11px] text-ink-500 flex items-center gap-1.5">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          {selectedEvent ? nameOf(selectedEvent.name) : "행사 미선택"} 운영 콘솔
        </span>
      </div>
    </aside>
  );
}

function ExternalNav({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: IconType;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 px-2.5 py-2 rounded-btn text-[13px] text-ink-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{label}</span>
        <ExternalLink className="w-3 h-3 opacity-60 shrink-0" aria-hidden />
      </a>
    </li>
  );
}
