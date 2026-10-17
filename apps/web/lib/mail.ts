import { type Db, enqueueMail, issueReportLink, mailById, markMailAttempt, markMailSent, pendingMail } from "@akinaza/db";

import type { MailSettings } from "./mail-settings";
import { type MailLocale, renderMailTemplate } from "./mail-templates";

/**
 * Outgoing mail. Every mail is rendered from the bilingual templates and written to the outbox first; the provider
 * (Mailgun, by `MAIL_PROVIDER`) then delivers it. Without a provider the mail stays `pending` — fails closed, never lost,
 * and the report remains readable in the client's space. When `@krizaka/email` is published, only this file changes.
 */
// @fixed: after this many failed attempts a mail is given up (`failed`), visible in the outbox — a delivery policy of the code, not a shop setting.
const MAX_ATTEMPTS = 5;

type Pending = NonNullable<Awaited<ReturnType<typeof mailById>>>;

export const mailConfigured = (settings: MailSettings): boolean => settings.provider === "mailgun" && !!settings.apiKey && !!settings.domain;

/** One delivery attempt through the provider: `sent`, or `pending`/`failed` with the reason (never a secret). */
export async function deliver(db: Db, mail: Pending, now: Date, settings: MailSettings, send: typeof fetch = fetch): Promise<"sent" | "pending" | "failed"> {
  if (!mailConfigured(settings)) {
    return markMailAttempt(db, mail.id, "MAIL_NOT_CONFIGURED", MAX_ATTEMPTS);
  }
  // https://documentation.mailgun.com — POST /v3/{domain}/messages, Basic auth `api:<key>`, form fields.
  const form = new URLSearchParams({ from: settings.from || `Akinaza <no-reply@${settings.domain}>`, to: mail.toEmail, subject: mail.subject, text: mail.bodyText, html: mail.html });
  try {
    const response = await send(`${settings.apiUrl.replace(/\/+$/, "")}/v3/${encodeURIComponent(settings.domain!)}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${settings.apiKey}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (response.ok) {
      await markMailSent(db, mail.id, now);
      return "sent";
    }
    return await markMailAttempt(db, mail.id, `PROVIDER_${response.status}`, MAX_ATTEMPTS);
  } catch {
    return markMailAttempt(db, mail.id, "PROVIDER_UNREACHABLE", MAX_ATTEMPTS);
  }
}

/** Tries every pending mail once (the walker's « send again », or a scheduled flush). */
export async function flushOutbox(db: Db, now: Date, settings: MailSettings, send: typeof fetch = fetch) {
  const counts = { sent: 0, pending: 0, failed: 0 };
  for (const mail of await pendingMail(db, 50)) counts[await deliver(db, mail, now, settings, send)] += 1;
  return counts;
}

const formatter = (locale: MailLocale) => ({
  date: new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeZone: "America/Toronto" }),
  time: new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { timeStyle: "short", timeZone: "America/Toronto" }),
});

/**
 * The walk report of one booking, e-mailed to its client: a fresh private link, the template in the client's language,
 * the outbox, one delivery attempt. Refused (a ShopError) when the client erased their file or withdrew the consent.
 */
export async function sendWalkReport(db: Db, shopId: string, bookingId: string, now: Date, settings: MailSettings, send: typeof fetch = fetch) {
  const ctx = await issueReportLink(db, shopId, bookingId, now);
  const appUrl = settings.appUrl;
  const f = formatter(ctx.language);
  const at = new Date(ctx.startsAt);
  const mail = renderMailTemplate(
    "walk-report",
    {
      shop: ctx.shopName,
      dog: ctx.dependantName,
      client: ctx.clientName.split(" ")[0] ?? ctx.clientName,
      service: ctx.service[ctx.language],
      date: f.date.format(at),
      time: f.time.format(at),
      duration: String(ctx.durationMinutes),
      note: ctx.note,
      url: `${appUrl}/${ctx.language}/report/${ctx.token}`,
      photo: ctx.hasPhoto,
    },
    { locale: ctx.language, appUrl, now },
  );
  const id = await enqueueMail(db, { to: ctx.to, locale: mail.locale, template: "walk-report", subject: mail.subject, html: mail.html, text: mail.text, relatedKind: "visit_report", relatedId: ctx.reportId });
  const queued = await mailById(db, id);
  const status = queued ? await deliver(db, queued, now, settings, send) : "pending";
  return { mailId: id, status, reportId: ctx.reportId };
}
