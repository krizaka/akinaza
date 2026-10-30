import { reportByToken } from "@akinaza/db";
import { Card } from "@krizaka/ui/card";
import { Page } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";
// A private page: its address is the credential. Never indexed, never cached, no referrer to the next site.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The report behind the private link in the e-mail: the dog, the walk, the note and the photo. */
export default async function ReportPage({ params }: Readonly<{ params: Promise<{ locale: string; token: string }> }>) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  const t = getDictionary(locale).console.report;
  const report = await reportByToken(db(), token, requestNow());
  // An unknown or expired link is a 404, with the product's calm not-found page (akinaza#381).
  if (!report) notFound();
  const lang = locale === "fr" ? "fr-CA" : "en-CA";
  return (
    <>
      <SiteHeader locale={locale} current="home" path={`/${locale}/report/${token}`} />
      <main id="content" className="pt-20">
          <>
            <PageHero eyebrow={format(t.by, { shop: report.shopName })} title={format(t.title, { dog: report.dependantName })} lead={format(t.when, { date: new Date(report.startsAt).toLocaleString(lang, { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" }), minutes: report.durationMinutes })} linkAs={Link} />
            <Page className="flex flex-col gap-6 pb-8">
              <Card.Root className="p-4">
                {report.hasPhoto ? <Image className="mb-4 w-full max-w-xl rounded-lg object-cover" src={`/api/report/${token}/photo`} alt={format(t.photoAlt, { dog: report.dependantName })} width={1280} height={960} unoptimized priority /> : null}
                <p className="text-sm font-semibold text-fg-secondary">{report.service[locale]}</p>
                <p className="mt-2 max-w-prose text-lg text-fg">{report.note}</p>
              </Card.Root>
              <p className="text-sm text-fg-muted">{t.private}</p>
            </Page>
          </>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
