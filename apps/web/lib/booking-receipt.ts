import { bookingDetail, enqueueMail, mailById } from "@akinaza/db";
import { renderEmail } from "@krizaka/email";

import { systemClock } from "@/app/system-clock";
import { db } from "@/lib/db";
import { mailSettings } from "@/lib/env";
import type { Locale } from "@/lib/i18n";
import { confirmationStep } from "@/lib/journey";
import { deliver } from "@/lib/mail";

export interface ReceiptRecipient {
  accountId: string;
  email: string;
  locale: Locale;
}

/**
 * The receipt of a booking, by e-mail: the template is @krizaka/email's `bookingReceipt`, the words are the confirmation page's own
 * (`confirmationStep`: the same tax line, the same cancellation rule for that visit), so the screen and the mail cannot disagree.
 * One attempt now, the outbox keeps it; a failed mail never undoes a booking.
 */
export async function sendBookingReceipt(recipient: ReceiptRecipient, bookingId: string): Promise<void> {
  const now = systemClock.now();
  const settings = mailSettings();
  const detail = await bookingDetail(db(), recipient.accountId, bookingId, now);
  if (!detail) {
    return;
  }
  const step = confirmationStep({ detail, locale: recipient.locale });
  const manageUrl = `${(settings.appUrl ?? "").replace(/\/$/, "")}/${recipient.locale}/s/${detail.shop.slug}/service/${detail.service.id}/confirmation?booking=${detail.id}`;
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
