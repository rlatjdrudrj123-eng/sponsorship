/**
 * 새 문의 메일 알림 — 공개 사이트에서 문의가 접수되면 그 행사 담당자에게 메일.
 *
 * 받는 사람: 그 행사에 배정된 '사용 중' 담당자 + 견적서 설정의 '문의 알림 받을 메일'
 * 보내는 계정: 회사 메일(네이버웍스) SMTP — 비밀번호는 Secret Manager(SMTP_PASSWORD)에만 보관.
 *   설정: functions/.env 의 SMTP_HOST·SMTP_PORT·MAIL_FROM,
 *         `firebase functions:secrets:set SMTP_PASSWORD` (담당자가 직접 입력)
 */
import { defineSecret, defineString } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

const SMTP_HOST = defineString("SMTP_HOST", { default: "smtp.worksmobile.com" });
const SMTP_PORT = defineString("SMTP_PORT", { default: "465" });
const MAIL_FROM = defineString("MAIL_FROM");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

const ADMIN_BASE = "https://eandex.cloud/admin";

const receiptNo = (id: string) => id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
const won = (n: unknown) => (typeof n === "number" ? `${n.toLocaleString("ko-KR")}원` : "-");
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function parseEmails(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : "";
  return raw
    .split(/[,\s;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

export const inquiryMail = onDocumentCreated(
  { document: "inquiries/{id}", secrets: [SMTP_PASSWORD] },
  async (event) => {
    const inq = event.data?.data();
    if (!inq) return;
    const id = event.params.id;
    const eventId = typeof inq.eventId === "string" ? inq.eventId : "";
    if (!eventId) return;
    const db = getFirestore();

    const [evSnap, qsSnap, memberSnap] = await Promise.all([
      db.doc(`events/${eventId}`).get(),
      db.doc(`quoteSettings/${eventId}`).get(),
      db.collection("members").where("events", "array-contains", eventId).get(),
    ]);
    const eventName = (evSnap.data()?.name as string) || eventId;

    const to = new Set<string>(parseEmails(qsSnap.data()?.notifyEmails));
    memberSnap.docs.forEach((d) => {
      const m = d.data();
      if (m.status === "active" && typeof m.email === "string") to.add(m.email.toLowerCase());
    });
    if (to.size === 0) {
      logger.info("inquiryMail: 받는 사람 없음", { eventId, id });
      return;
    }

    const no = receiptNo(id);
    const company = String(inq.companyName ?? "");
    const lines: Array<[string, string]> = [
      ["접수번호", no],
      ["회사", company],
      ["담당자", String(inq.contactName ?? "")],
      ["이메일", String(inq.email ?? "")],
      ["전화", String(inq.phone ?? "")],
      ["담은 품목", `${Array.isArray(inq.cartItems) ? inq.cartItems.length : 0}개`],
      ["합계(VAT 포함)", won(inq.cartTotal)],
    ];
    const message = String(inq.message ?? "").slice(0, 2000);
    const link = `${ADMIN_BASE}/inquiries/${id}`;

    const text =
      `${eventName} 새 스폰서십 문의\n\n` +
      lines.map(([k, v]) => `${k}: ${v}`).join("\n") +
      (message ? `\n\n문의 내용:\n${message}` : "") +
      `\n\n어드민에서 보기: ${link}\n`;
    const html =
      `<p><b>${esc(eventName)}</b> 새 스폰서십 문의</p>` +
      `<table cellpadding="4" style="border-collapse:collapse;font-size:14px">` +
      lines
        .map(
          ([k, v]) =>
            `<tr><td style="color:#666;padding-right:12px">${esc(k)}</td><td>${esc(v)}</td></tr>`
        )
        .join("") +
      `</table>` +
      (message ? `<p style="white-space:pre-wrap">${esc(message)}</p>` : "") +
      `<p><a href="${link}">어드민에서 보기</a></p>`;

    const port = Number(SMTP_PORT.value()) || 465;
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port,
      secure: port === 465,
      auth: { user: MAIL_FROM.value(), pass: SMTP_PASSWORD.value() },
    });
    await transporter.sendMail({
      from: `"스폰서십 알림" <${MAIL_FROM.value()}>`,
      to: Array.from(to).join(", "),
      subject: `[${eventName}] 새 스폰서십 문의 — ${company} (${no})`,
      text,
      html,
    });
    logger.info("inquiryMail: 발송", { eventId, id, recipients: to.size });
  }
);
