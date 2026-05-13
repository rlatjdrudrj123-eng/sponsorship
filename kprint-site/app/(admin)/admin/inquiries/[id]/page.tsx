"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileText,
  Handshake,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import type {
  Category,
  Inquiry,
  Package,
  Subcategory,
} from "@/lib/types";

const STATUS_LABELS: Record<Inquiry["status"], string> = {
  new: "신규",
  in_progress: "진행 중",
  closed: "종료",
};

export default function InquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const [noteSaveStatus, setNoteSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const u = onSnapshot(doc(getDb(), "inquiries", id), (s) => {
      if (!s.exists()) {
        setNotFound(true);
        return;
      }
      const data = { ...(s.data() as Inquiry), id: s.id };
      setInquiry(data);
      setAdminNote(data.adminNote ?? "");
    });
    return () => u();
  }, [id]);

  // Load context for cart resolution
  useEffect(() => {
    (async () => {
      try {
        const [c, s, p] = await Promise.all([
          getDocs(collection(getDb(), "categories")),
          getDocs(collection(getDb(), "subcategories")),
          getDocs(collection(getDb(), "packages")),
        ]);
        setCategories(c.docs.map((d) => ({ ...(d.data() as Category), id: d.id })));
        setSubcategories(s.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id })));
        setPackages(p.docs.map((d) => ({ ...(d.data() as Package), id: d.id })));
      } catch {
        // ignore
      }
    })();
  }, []);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const subById = useMemo(() => new Map(subcategories.map((s) => [s.id, s])), [subcategories]);
  const pkgById = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);

  const updateStatus = async (status: Inquiry["status"]) => {
    try {
      await updateDoc(doc(getDb(), "inquiries", id), {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (e) {
      alert(`상태 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const saveNote = async () => {
    setNoteSaveStatus("saving");
    try {
      await updateDoc(doc(getDb(), "inquiries", id), {
        adminNote: adminNote || undefined,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      setNoteSaveStatus("saved");
      setTimeout(() => setNoteSaveStatus("idle"), 2000);
    } catch (e) {
      setNoteSaveStatus("error");
      alert(`메모 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (notFound) {
    return (
      <div className="bg-white border border-ink-100 rounded-card p-12 text-center">
        <p className="text-sm text-ink-500">문의를 찾을 수 없습니다.</p>
        <Link
          href="/admin/inquiries"
          className="text-brand-700 font-semibold mt-4 inline-block hover:underline"
        >
          목록으로
        </Link>
      </div>
    );
  }

  if (!inquiry) {
    return <div className="text-sm text-ink-500 text-center py-16">불러오는 중…</div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/inquiries"
            className="w-8 h-8 rounded-btn border border-ink-100 grid place-items-center text-ink-700 hover:bg-ink-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-ink-900 leading-tight">
              {inquiry.companyName}
            </h1>
            <div className="text-[12px] text-ink-500 mt-0.5">
              {fmtDate(inquiry.createdAt)} 접수
              {inquiry.updatedAt &&
                inquiry.updatedAt.toMillis() !== inquiry.createdAt.toMillis() && (
                  <> · {fmtDate(inquiry.updatedAt)} 수정</>
                )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/admin/quotes/print/inquiry/${inquiry.id}`}
            target="_blank"
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            견적서 추출
          </Link>
          <Link
            href={`/admin/sponsors/new?inquiryId=${inquiry.id}`}
            className="px-3.5 py-2 rounded-btn bg-brand-500 text-ink-900 text-[13px] font-bold hover:bg-brand-700 hover:text-white flex items-center gap-1.5"
          >
            <Handshake className="w-4 h-4" />
            스폰서로 전환
          </Link>
          <a
            href={`mailto:${inquiry.email}?subject=K-PRINT 2026 문의 답변 (${inquiry.companyName})`}
            className="px-3.5 py-2 rounded-btn border border-ink-100 text-[13px] font-semibold text-ink-900 hover:bg-ink-50 flex items-center gap-1.5"
          >
            <Mail className="w-4 h-4" />
            이메일 답장
          </a>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_320px] gap-5 items-start">
        {/* Left */}
        <div className="space-y-4 min-w-0">
          {/* Contact */}
          <Section title="연락처">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={<User className="w-3.5 h-3.5" />} label="담당자" value={inquiry.contactName} />
              <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="이메일" value={inquiry.email} mono />
              <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="전화" value={inquiry.phone} mono />
            </div>
          </Section>

          {/* Cart */}
          <Section title={`카트 항목 (${inquiry.cartItems.length}건)`}>
            {inquiry.cartItems.length === 0 ? (
              <div className="text-sm text-ink-500 py-6 text-center bg-ink-50 rounded-btn">
                카트 항목이 없습니다.
              </div>
            ) : (
              <div className="overflow-hidden border border-ink-100 rounded-btn">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-ink-50 text-[10px] uppercase tracking-wide text-ink-700">
                      <th className="text-left px-3 py-2 font-semibold">유형</th>
                      <th className="text-left px-3 py-2 font-semibold">코드</th>
                      <th className="text-left px-3 py-2 font-semibold">카테고리·소분류</th>
                      <th className="text-right px-3 py-2 font-semibold">가격</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiry.cartItems.map((item, i) => {
                      if (item.type === "slot") {
                        const cat = catById.get(item.categoryId);
                        const sub = subById.get(item.subcategoryId);
                        return (
                          <tr key={i} className="border-t border-ink-100">
                            <td className="px-3 py-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-100 font-semibold">
                                슬롯
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-ink-900">{item.code}</td>
                            <td className="px-3 py-2">
                              {cat?.name.ko ?? "(삭제됨)"}{" "}
                              <span className="text-ink-500">·</span>{" "}
                              {sub?.name.ko || "(기본)"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {item.price.toLocaleString()}원
                            </td>
                          </tr>
                        );
                      }
                      const pkg = pkgById.get(item.packageId);
                      return (
                        <tr key={i} className="border-t border-ink-100">
                          <td className="px-3 py-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 font-semibold">
                              패키지
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-ink-900">{item.code}</td>
                          <td className="px-3 py-2">
                            {pkg?.name.ko ?? "(삭제됨)"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {item.price.toLocaleString()}원
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 max-w-md ml-auto">
              <SumRow label="소계" value={inquiry.cartSubtotal} />
              <SumRow label="VAT (10%)" value={inquiry.cartVat} />
              <SumRow label="합계" value={inquiry.cartTotal} accent />
            </div>
          </Section>

          {/* Message */}
          <Section title="메시지">
            <div className="text-[13px] text-ink-700 whitespace-pre-wrap leading-relaxed bg-ink-50/60 rounded-btn p-4 border border-ink-100">
              {inquiry.message || <span className="text-ink-300">(메시지 없음)</span>}
            </div>
          </Section>
        </div>

        {/* Right */}
        <div className="space-y-4 sticky top-[72px]">
          <Section title="상태">
            <select
              value={inquiry.status}
              onChange={(e) => updateStatus(e.target.value as Inquiry["status"])}
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white"
            >
              <option value="new">신규</option>
              <option value="in_progress">진행 중</option>
              <option value="closed">종료</option>
            </select>
            <p className="text-[11px] text-ink-500 mt-2">
              현재:{" "}
              <strong className={statusColor(inquiry.status)}>
                {STATUS_LABELS[inquiry.status]}
              </strong>
            </p>
          </Section>

          <Section title="어드민 메모 (내부)">
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="상담 진행 메모 (사무국 내부용)"
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500 bg-white min-h-[120px] resize-y"
            />
            <div className="mt-2 flex items-center justify-between">
              <NoteStatus status={noteSaveStatus} />
              <button
                type="button"
                onClick={saveNote}
                disabled={
                  noteSaveStatus === "saving" || adminNote === (inquiry.adminNote ?? "")
                }
                className="px-3 py-1.5 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                메모 저장
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function statusColor(s: Inquiry["status"]): string {
  return s === "new" ? "text-red-700" : s === "in_progress" ? "text-amber-700" : "text-ink-700";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-ink-100 rounded-card p-5">
      <h2 className="text-[15px] font-bold text-ink-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-ink-500 mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className={"text-[13px] text-ink-900 " + (mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}

function SumRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <>
      <div className={"text-[12px] text-right " + (accent ? "text-ink-900 font-bold" : "text-ink-500")}>
        {label}
      </div>
      <div className={"text-right font-mono " + (accent ? "text-[16px] text-brand-700 font-bold" : "text-[12px] text-ink-700")}>
        {value.toLocaleString()}원
      </div>
    </>
  );
}

function NoteStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") return <span className="text-[11px] text-ink-500">저장 중…</span>;
  if (status === "saved") {
    return (
      <span className="text-[11px] text-brand-700 flex items-center gap-1">
        <Check className="w-3 h-3" /> 저장됨
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-[11px] text-red-700 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" /> 실패
      </span>
    );
  }
  return null;
}

function fmtDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
