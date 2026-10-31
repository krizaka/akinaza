import { bookingPreselect, slugSchema } from "@akinaza/core";
import { clientFilesOf, dependantsOf, publicShop } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requestNow } from "@/app/request-now";
import { BookingFlow } from "@/components/app/BookingFlow";
import { SpaceChrome } from "@/components/app/SpaceChrome";
import { ConsoleProviders } from "@/components/console/ConsoleProviders";
import { BookingSummary } from "@/components/journey/BookingSummary";
import { GuestBooking } from "@/components/journey/GuestBooking";
import { JourneyFrame } from "@/components/journey/JourneyFrame";
import { pageSession } from "@/lib/access";
import { searchValue } from "@/lib/booking-defaults";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary, translator } from "@/lib/i18n";
import { VocabularyProvider } from "@/lib/i18n-client";
import { guestStep, resolveChoice, timesHref } from "@/lib/journey";
import { backToHere } from "@/lib/next-url";
import { accountRoutes } from "@/lib/routes";
import { consoleFor } from "@/lib/vocabulary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Step 4 of the one booking path (akinaza#381): service → person → time → confirm. The sign-in happens here, at the last step, and the person
 * comes back to it with the service, the person, the area and the time still chosen in the address.
 */
export default async function ConfirmPage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const { locale: raw, slug, id } = await params;
  const query = await searchParams;
  const locale = asLocale(raw);
  const session = await pageSession();
  const here = backToHere(`/${locale}/s/${slug}/service/${id}/confirm`, query);
  const parsed = slugSchema.safeParse(slug);
  const page = parsed.success ? await publicShop(db(), parsed.data) : null;
  if (!page || !page.services.some((service) => service.id === id)) notFound();
  if (!session) {
    return guestView({ locale, slug, id, page, query, here });
  }
  const file = (await clientFilesOf(db(), session.account.id)).find((f) => f.shopId === page.shop.id) ?? null;
  const dogs = file ? await dependantsOf(db(), file.id) : [];
  const t = consoleFor(locale, page.shop.businessType).book;
  const tr = translator(locale);
  const choice = resolveChoice(page, { staff: searchValue(query.staff), zone: searchValue(query.zone) });
  const chosen = bookingPreselect({ service: id, zone: choice.zoneId, start: searchValue(query.start) }, page.services, page.zones);
  const summary = chosen.startsAt ? guestStep({ page, locale, serviceId: id, startsAt: new Date(chosen.startsAt), now: requestNow(), staffId: choice.staffId, zoneId: choice.zoneId }) : null;
  return (
    <ConsoleProviders locale={locale} messages={{ console: getDictionary(locale).console }}>
    <SpaceChrome locale={locale} account={session.account} member={null}>
      <div className="flex flex-col gap-4">
        <PageHeader title={format(t.title, { shop: page.shop.name })} />
        <VocabularyProvider type={page.shop.businessType}>
        {summary ? <BookingSummary step={summary} words={{ when: tr("console.journey.when"), who: tr("console.journey.who"), price: tr("console.journey.price") }} /> : null}
        <BookingFlow
          data={{
            shop: { id: page.shop.id, name: page.shop.name, slug },
            services: page.services.map((s) => ({ id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, durationMinutes: s.durationMinutes, priceCents: s.priceCents, capacity: s.capacity })),
            zones: page.zones.map((z) => ({ id: z.id, name: z.name })),
            client: file ? { id: file.id, fullName: file.fullName } : null,
            dogs: dogs.map((d) => ({ id: d.id, name: d.name })),
            preselect: bookingPreselect({ service: id, zone: searchValue(query.zone), start: searchValue(query.start) }, page.services, page.zones),
            timeZone: page.shop.timezone,
            bookingsHref: accountRoutes(locale).home,
            staffId: page.team.some((m) => m.id === searchValue(query.staff)) ? searchValue(query.staff) : null,
          }}
        />
        </VocabularyProvider>
      </div>
    </SpaceChrome>
    </ConsoleProviders>
  );
}

/**
 * A visitor without an account does not meet a sign-in wall: they see what they chose (the time, the price with its taxes, the cancellation rule)
 * and give their details here; a code mailed to them confirms the address and books (krizaka-internal#1909). Without a chosen time they go back to the times.
 */
function guestView({ locale, slug, id, page, query, here }: Readonly<{ locale: ReturnType<typeof asLocale>; slug: string; id: string; page: NonNullable<Awaited<ReturnType<typeof publicShop>>>; query: Record<string, string | string[] | undefined>; here: string }>) {
  const t = translator(locale);
  const choice = resolveChoice(page, { staff: searchValue(query.staff), zone: searchValue(query.zone) });
  const preselect = bookingPreselect({ service: id, zone: choice.zoneId, start: searchValue(query.start) }, page.services, page.zones);
  if (!preselect.startsAt) {
    redirect(timesHref(locale, slug, id, choice));
  }
  const step = guestStep({ page, locale, serviceId: id, startsAt: new Date(preselect.startsAt), now: requestNow(), staffId: choice.staffId, zoneId: choice.zoneId });
  if (!step) {
    notFound();
  }
  return (
    <ConsoleProviders locale={locale} messages={{ console: getDictionary(locale).console }}>
      <JourneyFrame locale={locale} head={{ shop: page.shop.name, step: t("console.journey.stepOf", { step: 3, total: 4, label: t("console.journey.stepConfirm") }), edit: { href: step.changeHref, label: t("console.journey.edit") } }} path={`/${locale}/s/${slug}/service/${id}/confirm`} back={{ href: step.changeHref, label: step.service }} title={step.service}>
        <VocabularyProvider type={page.shop.businessType}>
          <BookingSummary step={step} words={{ when: t("console.journey.when"), who: t("console.journey.who"), price: t("console.journey.price") }} />
          <GuestBooking data={{ shop: { name: page.shop.name, slug }, serviceId: id, zoneId: choice.zoneId, staffId: choice.staffId, startsAt: preselect.startsAt, signInHref: `/${locale}/sign-in?next=${encodeURIComponent(here)}` }} />
        </VocabularyProvider>
      </JourneyFrame>
    </ConsoleProviders>
  );
}
