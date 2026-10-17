import { slugSchema } from "@akinaza/core";
import { publicShop } from "@akinaza/db";
import { Card } from "@krizaka/ui/card";
import { Page } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ButtonLink";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary, otherLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? publicShop(db(), parsed.data) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await load(slug);
  const l = asLocale(locale);
  return { title: page?.shop.name ?? getDictionary(l).console.shopPage.notFound, description: (l === "fr" ? page?.shop.taglineFr : page?.shop.taglineEn) ?? undefined, robots: { index: false, follow: false } };
}

const money = (cents: number, locale: "en" | "fr") => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

/** A shop's public page: who, which services at which prices, which zones, when — and the way to book. */
export default async function ShopPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  const page = await load(slug);
  if (!page) notFound();
  const t = getDictionary(locale).console;
  const tagline = locale === "fr" ? page.shop.taglineFr : page.shop.taglineEn;
  const days = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ d, windows: page.windows.filter((w) => w.weekday === d) })).filter((x) => x.windows.length);
  const book = `/${locale}/s/${slug}/book`;
  return (
    <>
      <SiteHeader locale={locale} current="home" switchHref={`/${otherLocale(locale)}/s/${slug}`} />
      <main id="content" className="pt-20">
        <PageHero eyebrow={t.shopPage.by} title={page.shop.name} lead={tagline ?? undefined} linkAs={Link}>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={book} size="lg" shape="cut" variant="primary">
              {t.shopPage.book}
            </ButtonLink>
          </div>
        </PageHero>
        <Page className="flex flex-col gap-10 pb-8">
          <section aria-labelledby="services" className="flex flex-col gap-4">
            <h2 id="services" className="font-display text-xl font-bold text-fg">{t.shopPage.services}</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {page.services.map((s) => (
                <li key={s.id}>
                  <Card.Root className="h-full p-4">
                    <p className="font-display text-lg font-bold text-fg">{locale === "fr" ? s.nameFr : s.nameEn}</p>
                    <p className="text-2xl font-bold text-fg">{money(s.priceCents, locale)}</p>
                    <p className="text-sm text-fg-secondary">
                      {format(t.shopPage.from, { minutes: s.durationMinutes })} · {s.capacity > 1 ? format(t.shopPage.capacity, { count: s.capacity }) : t.shopPage.solo}
                    </p>
                  </Card.Root>
                </li>
              ))}
            </ul>
            <p className="text-sm text-fg-muted">
              {t.shopPage.taxes} {format(t.shopPage.cancellation, { hours: page.rules.cancellationHours })}
            </p>
          </section>
          {page.zones.length ? (
            <section aria-labelledby="zones" className="flex flex-col gap-3">
              <h2 id="zones" className="font-display text-xl font-bold text-fg">{t.shopPage.zones}</h2>
              <ul className="flex flex-wrap gap-2">
                {page.zones.map((z) => (
                  <li key={z.id} className="rounded-full border border-border-default bg-surface-2 px-3 py-1 text-sm text-fg">
                    {z.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-labelledby="hours" className="flex flex-col gap-3">
            <h2 id="hours" className="font-display text-xl font-bold text-fg">{t.shopPage.hours}</h2>
            <ul className="flex flex-col gap-1 text-fg-secondary">
              {days.map(({ d, windows }) => (
                <li key={d}>
                  <span className="inline-block w-28 font-semibold text-fg">{t.shopSetup.weekdays[String(d) as "0"]}</span>
                  <span className="font-mono">{windows.map((w) => `${w.startsAt.slice(0, 5)}–${w.endsAt.slice(0, 5)}`).join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
          <div>
            <ButtonLink href={book} size="lg" shape="cut" variant="primary">
              {t.shopPage.book}
            </ButtonLink>
          </div>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
