import { bookingDetail, clientFilesOf } from "@akinaza/db";
import { Alert } from "@krizaka/ui/alert";
import { DescriptionList } from "@krizaka/ui/description-list";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ButtonLink } from "@/components/ButtonLink";
import { CancelBooking } from "@/components/journey/CancelBooking";
import { JourneyFrame } from "@/components/journey/JourneyFrame";
import { pageSession } from "@/lib/access";
import { searchValue } from "@/lib/booking-defaults";
import { db } from "@/lib/db";
import { asLocale, translator } from "@/lib/i18n";
import { confirmationStep, journeyBase } from "@/lib/journey";
import { backToHere } from "@/lib/next-url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Step 4 — the confirmation of a booking: when, with whom, where, the price, add to calendar, cancel while the window is open. For its own client only. */
export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: raw, slug, id } = await params;
  const query = await searchParams;
  const locale = asLocale(raw);
  const t = translator(locale);
  const session = await pageSession();
  const here = backToHere(`/${locale}/s/${slug}/service/${id}/confirmation`, query);
  if (!session) redirect(`/${locale}/sign-in?next=${encodeURIComponent(here)}`);
  const bookingId = searchValue(query.booking);
  const detail = bookingId ? await bookingDetail(db(), session.account.id, bookingId, new Date()) : null;
  if (!detail) notFound();
  const file = (await clientFilesOf(db(), session.account.id)).find((f) => f.shopSlug === detail.shop.slug);
  const step = confirmationStep({ detail, locale });
  const cancelled = step.cancelled;
  return (
    <JourneyFrame locale={locale} path={`/${locale}/s/${slug}/service/${id}/confirmation`} back={{ href: journeyBase(locale, detail.shop.slug), label: detail.shop.name }} eyebrow={detail.shop.name} title={cancelled ? t("console.journey.cancelled") : t("console.journey.bookedTitle")} lead={cancelled ? undefined : t("console.journey.bookedLead")}>
      <div className="max-w-2xl rounded-xl border border-border-default bg-surface-1 p-5">
        <h2 className="m-0 mb-3 font-display text-xl font-bold text-fg">{step.title}</h2>
        <DescriptionList
          layout="inline"
          items={[
            { id: "when", term: t("console.journey.when"), details: step.when },
            { id: "who", term: t("console.journey.who"), details: step.who },
            { id: "where", term: t("console.journey.where"), details: step.where },
            { id: "price", term: t("console.journey.price"), details: step.price },
          ]}
        />
      </div>
      {!cancelled ? (
        <div className="flex flex-wrap items-start gap-3">
          <ButtonLink href={step.calendarHref} variant="primary" size="md">
            {t("console.journey.addToCalendar")}
          </ButtonLink>
          {step.cancellable && file ? <CancelBooking bookingId={detail.id} clientId={file.id} words={{ cancel: t("console.journey.cancelBooking"), confirm: t("console.journey.cancelBooking"), cancelling: t("console.journey.cancelling") }} /> : null}
          {step.phone && step.phoneHref ? (
            <ButtonLink href={step.phoneHref} variant="ghost" size="md">
              {t("console.journey.callShop", { phone: step.phone })}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
      {!cancelled && !step.cancellable ? <Alert tone="info">{t("console.journey.cancelTooLate")}</Alert> : <p className="m-0 text-sm text-fg-secondary">{step.cancelRule}</p>}
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/${locale}/app`} variant="secondary" size="md">
          {t("console.journey.myBookings")}
        </ButtonLink>
        <ButtonLink href={journeyBase(locale, detail.shop.slug)} variant="ghost" size="md">
          {t("console.journey.bookAnother")}
        </ButtonLink>
      </div>
    </JourneyFrame>
  );
}
