import { CheckIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { ChipLink } from "@krizaka/ui/chip-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ButtonLink";
import { JourneyFrame } from "@/components/journey/JourneyFrame";
import { searchValue } from "@/lib/booking-defaults";
import { asLocale, translator } from "@/lib/i18n";
import { serviceStep } from "@/lib/journey";
import { loadPublicShopOrMove, queryString } from "@/lib/shop-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Step 2 — a service: duration, price to the cent, what is included, the cancellation rule, who takes it. The address keeps the choices. */
export default async function ServicePage({ params, searchParams }: { params: Promise<{ locale: string; slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: raw, slug, id } = await params;
  const query = await searchParams;
  const locale = asLocale(raw);
  const t = translator(locale);
  const page = await loadPublicShopOrMove(locale, slug, `/service/${id}${queryString(query)}`);
  const step = page ? serviceStep({ page, locale, serviceId: id, staffId: searchValue(query.staff), zoneId: searchValue(query.zone) }) : null;
  if (!page || !step) notFound();
  return (
    <JourneyFrame locale={locale} head={{ shop: page.shop.name, step: t("console.journey.stepOf", { step: 1, total: 4, label: t("console.journey.stepService") }) }} path={`/${locale}/s/${slug}/service/${id}`} back={{ href: step.backHref, label: t("console.journey.allServices") }} title={step.name} lead={step.description ?? undefined}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {step.team.length ? (
            <nav aria-label={t("console.journey.withWhom")} className="flex flex-col gap-2">
              <p className="m-0 text-sm font-semibold text-fg">{t("console.journey.withWhom")}</p>
              <div className="flex flex-wrap gap-2">
                {step.team.map((m) => (
                  <ChipLink key={m.id || "anyone"} asChild selected={m.selected}>
                    <Link href={m.href} scroll={false}>
                      {m.name}
                    </Link>
                  </ChipLink>
                ))}
              </div>
            </nav>
          ) : null}
          {step.zones.length ? (
            <nav aria-label={t("console.shopPage.zoneLabel")} className="flex flex-col gap-2">
              <p className="m-0 text-sm font-semibold text-fg">{t("console.shopPage.zoneLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {step.zones.map((z) => (
                  <ChipLink key={z.id} asChild selected={z.selected}>
                    <Link href={z.href} scroll={false}>
                      {z.name}
                    </Link>
                  </ChipLink>
                ))}
              </div>
            </nav>
          ) : null}
          {step.included.length ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-sm font-semibold text-fg">{t("console.journey.included")}</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {step.included.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-fg-secondary">
                    <CheckIcon size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-fg-accent" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <aside className="flex flex-col gap-3 self-start rounded-xl border border-border-default bg-surface-1 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="m-0 font-display text-2xl font-bold text-fg">{step.price}</p>
            <Badge tone="neutral" size="md">
              {step.duration}
            </Badge>
          </div>
          {step.taxLine ? (
            <p className="m-0 text-sm text-fg-secondary">
              {step.taxLine}
              <span className="block text-xs text-fg-muted">{t("console.journey.taxNote")}</span>
            </p>
          ) : null}
          <p className="m-0 text-sm text-fg-secondary">{step.cancelRule}</p>
          <ButtonLink href={step.timesHref} size="lg" variant="primary" className="w-full">
            {t("console.journey.seeTimes")}
          </ButtonLink>
        </aside>
      </div>
    </JourneyFrame>
  );
}
