"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  ACTION_LABEL,
  COL_LABEL,
  fieldLabel,
  formatDateTime,
  formatValue,
  logHref,
  summarizeChanges,
  type AuditGroup,
  type AuditLog,
} from "@/lib/admin/audit";

/** 변경 이력 목록 행 — 변경 이력 화면과 문서별 이력 패널이 같이 쓴다 */

export function ActionBadge({ action }: { action: AuditLog["action"] }) {
  const cls =
    action === "create"
      ? "bg-brand-50 text-brand-700 border-brand-100"
      : action === "delete"
        ? "bg-red-50 text-red-700 border-red-100"
        : "bg-ink-50 text-ink-700 border-ink-100";
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${cls}`}>
      {ACTION_LABEL[action]}
    </span>
  );
}

function timeOf(log: AuditLog, withDate: boolean): string {
  if (!log.at?.toDate) return "";
  const s = formatDateTime(log.at.toDate()); // "MM.DD HH:mm"
  return withDate ? s : s.slice(6);
}

export function GroupRow({
  group,
  withDate = false,
  showLink = true,
}: {
  group: AuditGroup;
  withDate?: boolean;
  showLink?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const first = group.logs[0];
  if (group.logs.length === 1) {
    return <LogRow log={first} withDate={withDate} showLink={showLink} />;
  }
  const colName = COL_LABEL[first.col] ?? first.col;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-ink-50"
        aria-expanded={open}
      >
        <span className={"text-[12px] text-ink-500 font-mono shrink-0 " + (withDate ? "w-[84px]" : "w-11")}>
          {timeOf(first, withDate)}
        </span>
        <span className="text-[13px] font-semibold text-ink-900 w-28 truncate shrink-0">
          {first.actorName}
        </span>
        <ActionBadge action={first.action} />
        <span className="text-[13px] text-ink-900 flex-1 min-w-0 truncate">
          {colName} {group.logs.length}건 {ACTION_LABEL[first.action]}
          <span className="text-ink-500"> — 한꺼번에 바뀐 기록</span>
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-ink-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-ink-500 shrink-0" />
        )}
      </button>
      {open && (
        <ul className="border-t border-ink-100 bg-ink-50/50 divide-y divide-ink-100">
          {group.logs.map((l) => (
            <LogRow key={l.id} log={l} nested withDate={withDate} showLink={showLink} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function LogRow({
  log,
  nested = false,
  withDate = false,
  showLink = true,
}: {
  log: AuditLog;
  nested?: boolean;
  withDate?: boolean;
  showLink?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const href = showLink ? logHref(log) : null;
  const summary =
    log.action === "update"
      ? summarizeChanges(log)
      : log.action === "create"
        ? "새로 추가"
        : "삭제됨";
  const expandable = log.action === "update" && log.changes.length > 0;

  return (
    <li className={nested ? "pl-6" : ""}>
      <div className="px-4 py-2.5 flex items-center gap-3">
        <span className={"text-[12px] text-ink-500 font-mono shrink-0 " + (withDate ? "w-[84px]" : "w-11")}>
          {timeOf(log, withDate)}
        </span>
        <span
          className="text-[13px] font-semibold text-ink-900 w-28 truncate shrink-0"
          title={log.actorEmail ?? ""}
        >
          {log.actorName}
        </span>
        <ActionBadge action={log.action} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-ink-900 truncate">
            <span className="text-ink-500">{COL_LABEL[log.col] ?? log.col}</span>{" "}
            <span className="font-semibold">{log.label}</span>
          </div>
          <div className="text-[12px] text-ink-500 truncate">{summary}</div>
        </div>
        {expandable && (
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            className="text-[12px] text-ink-500 hover:text-ink-900 shrink-0"
            aria-expanded={open}
          >
            {open ? "접기" : "자세히"}
          </button>
        )}
        {href && (
          <Link href={href} className="text-[12px] font-semibold text-brand-700 hover:underline shrink-0">
            열기
          </Link>
        )}
      </div>
      {open && expandable && (
        <table className="mx-4 mb-3 w-[calc(100%-2rem)] text-[12px] border border-ink-100 rounded-btn overflow-hidden">
          <tbody>
            {log.changes.map((c) => (
              <tr key={c.field} className="border-t border-ink-100 first:border-t-0">
                <th className="text-left font-semibold text-ink-700 bg-ink-50 px-3 py-1.5 w-36 align-top">
                  {fieldLabel(c.field)}
                </th>
                <td className="px-3 py-1.5 text-ink-500 line-through break-all align-top">
                  {formatValue(c.field, c.before)}
                </td>
                <td className="px-3 py-1.5 text-ink-900 break-all align-top">
                  {formatValue(c.field, c.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
