import { listSlots } from "@akinaza/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JourneyFrame } from "@/components/journey/JourneyFrame";
import { ShopSlots } from "@/components/shop/ShopSlots";
import { searchValue } from "@/lib/booking-defaults";
import { db } from "@/lib/db";
import { asLocale, translator } from "@/lib/i18n";
import { resolveChoice, timesStep } from "@/lib/journey";
import { loadPublicShopOrMove, queryString } from "@/lib/shop-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Step 3 — the times: only those the engine really offers, for this person (or anyone), each a link that opens the booking. */
export default async function TimesPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: raw, slug, id } = await params;
  const query = await searchParams;
  const locale = asLocale(raw);
  const t = translator(locale);
  const page = await loadPublicShopOrMove(locale, slug, `/service/${id}/creneau${queryString(query)}`);
  if (!page || !page.services.some((s) => s.id === id)) notFound();
  const now = new Date();
  const choice = resolveChoice(page, { staff: searchValue(query.staff), zone: searchValue(query.zone) });
  const slots = await listSlots(db(), { shopId: page.shop.id, serviceId: id, zoneId: choice.zoneId, staffId: choice.staffId, now, days: 14 });
  const step = timesStep({ page, locale, now, serviceId: id, staffId: choice.staffId, zoneId: choice.zoneId, slots });
  if (!step) notFound();
  return (
    <JourneyFrame locale={locale} path={`/${locale}/s/${slug}/service/${id}/creneau`} back={{ href: step.backHref, label: step.title }} title={t("console.journey.pickTime")} lead={[step.who, t("console.journey.pickTimeLead")].filter(Boolean).join(" · ")}>
      <ShopSlots days={step.days} label={t("console.shopPage.timesLabel")} emptyLabel={t("console.journey.noTimes")} />
      {step.changeHref ? (
        <p className="m-0">
          <Link href={step.changeHref} className="text-sm font-semibold text-fg-accent underline underline-offset-4">
            {t("console.journey.changePerson")}
          </Link>
        </p>
      ) : null}
    </JourneyFrame>
  );
}
