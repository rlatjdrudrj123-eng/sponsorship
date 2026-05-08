"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  FolderKanban,
  Grid2x2,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Tags,
  Upload,
} from "lucide-react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";

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
        { href: "/admin/import", label: "엑셀 업로드", Icon: Upload },
      ],
    },
    {
      label: "콘텐츠",
      items: [
        { href: "/admin/categories", label: "카테고리", Icon: FolderKanban },
        { href: "/admin/packages", label: "패키지", Icon: Package },
        { href: "/admin/slots", label: "슬롯 관리", Icon: Grid2x2 },
      ],
    },
    {
      label: "고객",
      items: [
        {
          href: "/admin/inquiries",
          label: "문의",
          Icon: MessageSquare,
          badge: newInquiries > 0 ? newInquiries : undefined,
        },
      ],
    },
    {
      label: "설정",
      items: [
        { href: "/admin/settings", label: "사이트 설정", Icon: Settings, exact: true },
        { href: "/admin/settings/taxonomy", label: "분류·태그", Icon: Tags },
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
        <span className="w-2 h-2 rounded-full bg-mint-500" />
        <span className="font-bold text-white tracking-tight text-[15px]">k·print</span>
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
                          ? "bg-mint-500 text-ink-900 font-semibold"
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
      </nav>

      <div className="pt-4 border-t border-white/10 px-2.5 text-[11px] text-ink-500 flex items-center gap-1.5">
        <HelpCircle className="w-3.5 h-3.5" aria-hidden />
        <span>K-PRINT 2026 운영 콘솔</span>
      </div>
    </aside>
  );
}
