import { bookingDetail, enqueueMail, mailById } from "@akinaza/db";
import { renderEmail } from "@krizaka/email";

import { requestNow } from "@/app/request-now";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { confirmationStep } from "@/lib/journey";
import { deliver } from "@/lib/mail";
import type { MailSettings } from "@/lib/mail-settings";
import { SITE_URL } from "@/lib/site";

/** The link in the mail is https (the template refuses anything else): the deployment's own address, else the public site's (a local run is http). */
const manageBase = (appUrl: string | undefined): string => (appUrl?.startsWith("https://") ? appUrl : SITE_URL).replace(/\/$/, "");

export interface ReceiptRecipient {
  accountId: string;
  email: string;
  locale: Locale;
  /** The mail settings, read by the route (the domain never reads the environment). */
  settings: MailSettings;
}

/**
 * The receipt of a booking, by e-mail: the template is @krizaka/email's `bookingReceipt`, the words are the confirmation page's own
 * (`confirmationStep`: the same tax line, the same cancellation rule for that visit), so the screen and the mail cannot disagree.
 * The cancellation window is read at the request's instant (`requestNow`), as the confirmation page does, so a fixed-clock run sees one rule on both.
 * One attempt now, the outbox keeps it; a failed mail never undoes a booking.
 */
export async function sendBookingReceipt(recipient: ReceiptRecipient, bookingId: string): Promise<void> {
  const now = requestNow();
  const { settings } = recipient;
  const detail = await bookingDetail(db(), recipient.accountId, bookingId, now);
  if (!detail) {
    return;
  }
  const step = confirmationStep({ detail, locale: recipient.locale });
  const manageUrl = `${manageBase(settings.appUrl)}/${recipient.locale}/s/${detail.shop.slug}/service/${detail.service.id}/confirmation?booking=${detail.id}`;
  const mail = await renderEmail(
    "bookingReceipt",
    { brand: "akinaza", businessName: detail.shop.name, serviceName: step.title, when: step.when, who: step.who, where: step.where, priceLine: step.price, cancelRule: step.cancelRule, manageUrl },
    { locale: recipient.locale },
  );
  const id = await enqueueMail(db(), { to: recipient.email, locale: recipient.locale, template: "booking-receipt", subject: mail.subject, html: mail.html, text: mail.text, relatedKind: "booking", relatedId: bookingId });
  const queued = await mailById(db(), id);
  if (queued) {
    await deliver(db(), queued, now, settings);
  }
}
