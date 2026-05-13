"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import {
  collection,
  getCountFromServer,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  AlarmClock,
  ArrowUpRight,
  FolderKanban,
  MessageSquare,
  Package,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type Counts = {
  newInquiries: number;
  categories: number;
  packages: number;
  deadlineSoon: number;
};

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDb();
        const now = Timestamp.fromDate(new Date());
        const sevenDaysFromNow = Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        );

        const [inquirySnap, categorySnap, packageSnap, soonSnap] = await Promise.all([
          getCountFromServer(
            query(collection(db, "inquiries"), where("status", "==", "new"))
          ),
          getCountFromServer(collection(db, "categories")),
          getCountFromServer(collection(db, "packages")),
          getCountFromServer(
            query(
              collection(db, "categories"),
              where("deadline", ">=", now),
              where("deadline", "<=", sevenDaysFromNow)
            )
          ),
        ]);

        if (cancelled) return;
        setCounts({
          newInquiries: inquirySnap.data().count,
          categories: categorySnap.data().count,
          packages: packageSnap.data().count,
          deadlineSoon: soonSnap.data().count,
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setCounts({ newInquiries: 0, categories: 0, packages: 0, deadlineSoon: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-ink-900 leading-tight">대시보드</h1>
        <p className="text-[13px] text-ink-700 mt-1">
          오늘의 문의·운영 현황. 데이터는 STEP 5 엑셀 임포트 후 채워집니다.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="신규 문의"
          value={counts?.newInquiries}
          accent
          Icon={MessageSquare}
          href="/admin/inquiries"
          hint="status='new'"
        />
        <StatCard
          label="카테고리"
          value={counts?.categories}
          Icon={FolderKanban}
          href="/admin/categories"
        />
        <StatCard
          label="패키지"
          value={counts?.packages}
          Icon={Package}
          href="/admin/packages"
        />
        <StatCard
          label="마감 임박"
          value={counts?.deadlineSoon}
          Icon={AlarmClock}
          href="/admin/categories"
          hint="7일 이내"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-card p-4 text-sm text-red-700">
          데이터 불러오기 실패:{" "}
          <span className="font-mono text-xs">{error}</span>
        </div>
      )}

      <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-3">
          <h2 className="font-bold text-ink-900 text-[15px]">최근 활동</h2>
          <span className="text-xs text-ink-500">최근 임포트 / 신규 문의</span>
        </div>
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-ink-500">아직 활동이 없습니다.</p>
          <p className="text-xs text-ink-300 mt-1">
            STEP 5(엑셀 임포트) · STEP 10(문의 관리)이 구현되면 자동으로 채워집니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  Icon,
  href,
  hint,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
  Icon: IconType;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-ink-100 rounded-card p-5 hover:border-brand-500 transition-colors block"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-ink-500">{label}</span>
        <Icon className="w-4 h-4 text-ink-300 group-hover:text-brand-500 transition-colors" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div
          className={
            "text-[32px] font-bold leading-none " +
            (accent ? "text-brand-700" : "text-ink-900")
          }
        >
          {value === undefined ? "—" : value}
        </div>
        <ArrowUpRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 transition-colors mb-1" />
      </div>
      {hint && (
        <div className="text-[11px] text-ink-500 mt-2 font-mono">{hint}</div>
      )}
    </Link>
  );
}
