"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ShieldCheck, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { getDb } from "@/lib/firebase/firestore";
import { isAdminAccess, useAccess } from "@/lib/admin/access";
import { BOOTSTRAP_ADMIN_EMAILS } from "@/lib/firebase/config";
import type { Event as EventDoc, Member, MemberRole } from "@/lib/types";

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

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: "관리자",
  manager: "담당자",
};

function formatDate(ts: unknown): string {
  const t = ts as { toDate?: () => Date } | null | undefined;
  if (!t?.toDate) return "-";
  const d = t.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * 멤버 관리 — 관리자 전용.
 * 가입 신청 승인(역할·담당 전시회 배정), 역할·전시회 변경, 사용 중지.
 * 실제 권한 차단은 보안 규칙(members 문서 기반)이 한다.
 */
export default function MembersPage() {
  const access = useAccess();
  const isAdmin = isAdminAccess(access);
  const myUid = access.state === "active" ? access.user.uid : "";
  const myEmail = access.state === "active" ? access.user.email ?? "" : "";

  const [members, setMembers] = useState<Member[] | null>(null);
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const u1 = onSnapshot(
      collection(getDb(), "members"),
      (s) => {
        setMembers(s.docs.map((d) => ({ ...(d.data() as Member), uid: d.id })));
        setError(null);
      },
      (e) => setError(`멤버 목록을 불러오지 못했습니다: ${e.message}`)
    );
    const u2 = onSnapshot(
      query(collection(getDb(), "events"), orderBy("order", "asc")),
      (s) => setEvents(s.docs.map((d) => ({ ...(d.data() as EventDoc), id: d.id })))
    );
    return () => {
      u1();
      u2();
    };
  }, [isAdmin]);

  const groups = useMemo(() => {
    const list = (members ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return {
      pending: list.filter((m) => m.status === "pending"),
      active: list.filter((m) => m.status === "active"),
      disabled: list.filter((m) => m.status === "disabled"),
    };
  }, [members]);

  if (!isAdmin) {
    return (
      <div className="bg-white border border-ink-100 rounded-card p-8 text-center text-sm text-ink-700">
        멤버 관리는 관리자만 볼 수 있습니다.
      </div>
    );
  }

  const save = async (uid: string, patch: Partial<Member>, approve = false) => {
    try {
      await updateDoc(doc(getDb(), "members", uid), {
        ...patch,
        updatedAt: serverTimestamp(),
        ...(approve ? { approvedBy: myEmail, approvedAt: serverTimestamp() } : {}),
      });
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const remove = async (m: Member) => {
    if (!confirm(`${m.name}(${m.email}) 의 신청서를 삭제할까요?\n같은 계정으로 다시 신청할 수 있습니다.`)) return;
    try {
      await deleteDoc(doc(getDb(), "members", m.uid));
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <header>
        <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-700" />
          멤버 관리
        </h1>
        <p className="text-[13px] text-ink-700 mt-1 break-keep">
          담당자는 배정된 전시회만 보고 수정합니다. 관리자는 모든 전시회와 멤버를 관리합니다.
          최초 관리자({BOOTSTRAP_ADMIN_EMAILS.join(", ")})는 이 목록과 관계없이 관리자입니다.
        </p>
      </header>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-btn p-3">
          {error}
        </div>
      )}

      <Group
        title={`승인 대기 ${groups.pending.length}`}
        empty="승인을 기다리는 신청이 없습니다."
        loading={members === null}
      >
        {groups.pending.map((m) => (
          <PendingRow
            key={m.uid}
            member={m}
            events={events}
            onApprove={(role, ev) =>
              save(m.uid, { status: "active", role, events: role === "admin" ? [] : ev }, true)
            }
            onReject={() => save(m.uid, { status: "disabled" })}
          />
        ))}
      </Group>

      <Group
        title={`사용 중 ${groups.active.length}`}
        empty="사용 중인 멤버가 없습니다."
        loading={members === null}
      >
        {groups.active.map((m) => (
          <ActiveRow
            key={m.uid}
            member={m}
            events={events}
            isSelf={m.uid === myUid}
            onChange={(patch) => save(m.uid, patch)}
          />
        ))}
      </Group>

      {groups.disabled.length > 0 && (
        <Group title={`사용 중지 ${groups.disabled.length}`} empty="" loading={false}>
          {groups.disabled.map((m) => (
            <div key={m.uid} className="flex items-center gap-3 px-4 py-3">
              <Who member={m} />
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => save(m.uid, { status: "active" }, true)}
                className="px-3 py-1.5 rounded-btn border border-ink-100 text-[12px] font-semibold text-ink-900 hover:bg-ink-50"
              >
                다시 사용
              </button>
              <button
                type="button"
                onClick={() => remove(m)}
                className="p-1.5 rounded text-ink-500 hover:text-red-700 hover:bg-red-50"
                title="신청서 삭제"
                aria-label={`${m.name} 신청서 삭제`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  title,
  empty,
  loading,
  children,
}: {
  title: string;
  empty: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="bg-white border border-ink-100 rounded-card">
      <h2 className="px-4 py-3 border-b border-ink-100 text-[13.5px] font-bold text-ink-900">
        {title}
      </h2>
      {loading ? (
        <div className="px-4 py-6 text-sm text-ink-500">불러오는 중…</div>
      ) : hasChildren ? (
        <div className="divide-y divide-ink-100">{children}</div>
      ) : (
        <div className="px-4 py-6 text-sm text-ink-500">{empty}</div>
      )}
    </section>
  );
}

function Who({ member }: { member: Member }) {
  return (
    <div className="min-w-0">
      <div className="text-[13.5px] font-semibold text-ink-900 truncate">
        {member.name || "(이름 없음)"}
      </div>
      <div className="text-[12px] text-ink-500 truncate">
        {member.email} · 신청 {formatDate(member.createdAt)}
      </div>
    </div>
  );
}

function EventChips({
  events,
  value,
  onToggle,
  disabled,
}: {
  events: EventDoc[];
  value: string[];
  onToggle: (eventId: string) => void;
  disabled?: boolean;
}) {
  if (events.length === 0) {
    return <span className="text-[12px] text-ink-500">등록된 전시회 없음</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {events.map((e) => {
        const on = value.includes(e.id);
        return (
          <button
            key={e.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onToggle(e.id)}
            className={
              "px-2.5 py-1 rounded-full border text-[12px] font-semibold transition-colors disabled:opacity-50 " +
              (on
                ? "bg-brand-50 border-brand-500 text-brand-700"
                : "bg-white border-ink-100 text-ink-500 hover:text-ink-900")
            }
          >
            {nameOf(e.name) || e.id}
          </button>
        );
      })}
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: MemberRole;
  onChange: (r: MemberRole) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as MemberRole)}
      className="px-2 py-1.5 text-[12.5px] border border-ink-100 rounded-btn bg-white disabled:opacity-50"
      aria-label="역할"
    >
      <option value="manager">{ROLE_LABEL.manager}</option>
      <option value="admin">{ROLE_LABEL.admin}</option>
    </select>
  );
}

function PendingRow({
  member,
  events,
  onApprove,
  onReject,
}: {
  member: Member;
  events: EventDoc[];
  onApprove: (role: MemberRole, events: string[]) => void;
  onReject: () => void;
}) {
  const [role, setRole] = useState<MemberRole>("manager");
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const canApprove = role === "admin" || picked.length > 0;

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-3">
        <Who member={member} />
        <div className="flex-1" />
        <RoleSelect value={role} onChange={setRole} />
      </div>
      {role === "manager" ? (
        <div className="flex items-start gap-2">
          <span className="text-[12px] text-ink-700 font-semibold shrink-0 pt-1">담당 전시회</span>
          <EventChips events={events} value={picked} onToggle={toggle} />
        </div>
      ) : (
        <p className="text-[12px] text-ink-700">관리자는 모든 전시회와 멤버를 관리합니다.</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canApprove}
          onClick={() => onApprove(role, picked)}
          className="px-3 py-1.5 rounded-btn bg-brand-500 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 flex items-center gap-1.5"
          title={canApprove ? "승인" : "담당 전시회를 1개 이상 고르세요"}
        >
          <UserCheck className="w-3.5 h-3.5" />
          승인
        </button>
        <button
          type="button"
          onClick={onReject}
          className="px-3 py-1.5 rounded-btn border border-ink-100 text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50 flex items-center gap-1.5"
        >
          <UserX className="w-3.5 h-3.5" />
          거절
        </button>
        {!canApprove && (
          <span className="text-[11.5px] text-ink-500">담당 전시회를 1개 이상 고르세요</span>
        )}
      </div>
    </div>
  );
}

function ActiveRow({
  member,
  events,
  isSelf,
  onChange,
}: {
  member: Member;
  events: EventDoc[];
  isSelf: boolean;
  onChange: (patch: Partial<Member>) => void;
}) {
  const ev = member.events ?? [];
  const toggle = (id: string) => {
    const next = ev.includes(id) ? ev.filter((x) => x !== id) : [...ev, id];
    onChange({ events: next });
  };

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-3">
        <Who member={member} />
        {member.role === "admin" && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-ink-900 text-white font-semibold shrink-0">
            <ShieldCheck className="w-3 h-3" />
            관리자
          </span>
        )}
        {isSelf && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 font-semibold shrink-0">
            나
          </span>
        )}
        <div className="flex-1" />
        <RoleSelect
          value={member.role}
          disabled={isSelf}
          onChange={(r) => {
            if (
              confirm(
                `${member.name} 님의 역할을 '${ROLE_LABEL[r]}'(으)로 바꿀까요?` +
                  (r === "admin" ? "\n관리자는 모든 전시회와 멤버를 관리할 수 있습니다." : "")
              )
            ) {
              onChange({ role: r });
            }
          }}
        />
        <button
          type="button"
          disabled={isSelf}
          onClick={() => {
            if (confirm(`${member.name} 님의 사용을 중지할까요? (바로 접근이 막힙니다)`)) {
              onChange({ status: "disabled" });
            }
          }}
          className="px-3 py-1.5 rounded-btn border border-ink-100 text-[12px] font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          title={isSelf ? "본인 계정은 중지할 수 없습니다" : "사용 중지"}
        >
          사용 중지
        </button>
      </div>
      {member.role === "manager" && (
        <div className="flex items-start gap-2">
          <span className="text-[12px] text-ink-700 font-semibold shrink-0 pt-1">담당 전시회</span>
          <EventChips events={events} value={ev} onToggle={toggle} />
        </div>
      )}
      {member.role === "manager" && ev.length === 0 && (
        <p className="text-[11.5px] text-amber-700">배정된 전시회가 없어 아무것도 볼 수 없습니다.</p>
      )}
    </div>
  );
}
