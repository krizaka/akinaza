import { bookingPreselect, slugSchema } from "@akinaza/core";
import { clientFilesOf, dependantsOf, publicShop } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppFrame } from "@/components/app/AppFrame";
import { BookingFlow } from "@/components/app/BookingFlow";
import { pageSession } from "@/lib/access";
import { searchValue } from "@/lib/booking-defaults";
import { db } from "@/lib/db";
import { asLocale, format } from "@/lib/i18n";
import { VocabularyProvider } from "@/lib/i18n-client";
import { backToHere } from "@/lib/next-url";
import { consoleFor } from "@/lib/vocabulary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Booking needs a sign-in; the person comes back here after it. Join the shop → add a dog → pick a walk. */
export default async function BookPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: raw, slug } = await params;
  const query = await searchParams;
  const locale = asLocale(raw);
  const session = await pageSession();
  const here = backToHere(`/${locale}/s/${slug}/book`, query);
  if (!session) redirect(`/${locale}/sign-in?next=${encodeURIComponent(here)}`);
  const parsed = slugSchema.safeParse(slug);
  const page = parsed.success ? await publicShop(db(), parsed.data) : null;
  if (!page) notFound();
  const file = (await clientFilesOf(db(), session.account.id)).find((f) => f.shopId === page.shop.id) ?? null;
  const dogs = file ? await dependantsOf(db(), file.id) : [];
  const t = consoleFor(locale, page.shop.businessType).book;
  return (
    <AppFrame locale={locale} email={session.account.email} base={`/${locale}/app`} items={["bookings", "profile"]}>
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold text-fg">{format(t.title, { shop: page.shop.name })}</h1>
        <VocabularyProvider type={page.shop.businessType}>
        <BookingFlow
          data={{
            shop: { id: page.shop.id, name: page.shop.name, slug },
            services: page.services.map((s) => ({ id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, durationMinutes: s.durationMinutes, priceCents: s.priceCents, capacity: s.capacity })),
            zones: page.zones.map((z) => ({ id: z.id, name: z.name })),
            client: file ? { id: file.id, fullName: file.fullName } : null,
            dogs: dogs.map((d) => ({ id: d.id, name: d.name })),
            preselect: bookingPreselect({ service: searchValue(query.service), zone: searchValue(query.zone), start: searchValue(query.start) }, page.services, page.zones),
            timeZone: page.shop.timezone,
            bookingsHref: `/${locale}/app`,
          }}
        />
        </VocabularyProvider>
      </div>
    </AppFrame>
  );
}
