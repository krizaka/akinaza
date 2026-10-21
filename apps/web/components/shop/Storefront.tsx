import { Avatar } from "@krizaka/ui/avatar";
import { Badge } from "@krizaka/ui/badge";
import { CardGrid } from "@krizaka/ui/card-grid";
import { ChipLink } from "@krizaka/ui/chip-link";
import { CoverHero } from "@krizaka/ui/cover-hero";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { DescriptionList } from "@krizaka/ui/description-list";
import { MediaGallery } from "@krizaka/ui/media-gallery";
import { OpeningHours } from "@krizaka/ui/opening-hours";
import { Section } from "@krizaka/ui/page";
import { ServiceCard } from "@krizaka/ui/service-card";
import { StickyAction } from "@krizaka/ui/sticky-action";
import Link from "next/link";

import { ButtonLink } from "@/components/ButtonLink";
import { ShopSlots } from "@/components/shop/ShopSlots";
import { ZoneMap } from "@/components/shop/ZoneMap";
import { type Locale, translator } from "@/lib/i18n";
import type { StorefrontView } from "@/lib/storefront";

/**
 * A shop's public page, drawn from its view (lib/storefront.ts): the cover and what it promises, the services as cards,
 * the next free times, the hours, the areas on a map, who you will meet and the rules, a look inside, the way in.
 * Every section exists only when the shop has what it shows — a salon has no map, a new shop no gallery.
 */
export function Storefront({ view, locale }: { view: StorefrontView; locale: Locale }) {
  const t = translator(locale);
  const book = (
    <>
      <ButtonLink href={view.bookHref} size="lg" variant="primary" className="hidden md:inline-flex">
        {t("console.shopPage.book")}
      </ButtonLink>
      {view.services.length ? (
        <ButtonLink href="#reserver" size="lg" variant="secondary" className="hidden md:inline-flex">
          {t("console.shopPage.seeTimes")}
        </ButtonLink>
      ) : null}
    </>
  );
  const selected = view.booking.services.find((s) => s.selected);
  return (
    <main id="content">
      <CoverHero
        cover={view.cover ?? undefined}
        eyebrow={view.eyebrow}
        title={view.name}
        lead={view.tagline ?? undefined}
        facts={
          <>
            {view.status ? (
              <Badge tone={view.status.open ? "success" : "neutral"} dot={view.status.open} size="md" className={view.cover ? "bg-scrim text-fg-on-media ring-0" : undefined}>
                {view.status.label}
                {view.status.detail ? ` · ${view.status.detail}` : ""}
              </Badge>
            ) : null}
            {view.zones.slice(0, 3).map((z) => (
              <Badge key={z.id} tone={view.cover ? "scrim" : "neutral"} size="md">
                {z.name}
              </Badge>
            ))}
          </>
        }
        actions={book}
      />

      {view.services.length ? (
        <Section id="services" eyebrow={t("console.shopPage.services")} title={t("console.shopPage.servicesTitle")} lead={t("console.shopPage.servicesLead")} reveal>
          <CardGrid min={250} fit="fit" as="ul" aria-label={t("console.shopPage.servicesLabel")}>
            {view.services.map((s) => (
              <ServiceCard
                key={s.id}
                name={s.name}
                price={s.price}
                priceFrom={s.priceFrom ?? undefined}
                duration={s.duration}
                capacity={s.capacity ?? undefined}
                description={s.description ?? undefined}
                included={s.included}
                tag={s.tag ?? undefined}
                selected={selected?.id === s.id}
                actionLabel={t("console.shopPage.choose")}
                href={s.href}
                linkAs={Link}
              />
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {view.services.length ? (
        <Section id="reserver" divider eyebrow={t("console.shopPage.book")} title={t("console.shopPage.bookTitle")} lead={t("console.shopPage.bookLead")} reveal>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              <nav aria-label={t("console.shopPage.serviceLabel")} className="flex flex-wrap gap-2">
                {view.booking.services.map((s) => (
                  <ChipLink key={s.id} asChild selected={s.selected}>
                    <Link href={s.href} scroll={false}>
                      {s.name}
                    </Link>
                  </ChipLink>
                ))}
              </nav>
              {view.booking.zones.length ? (
                <nav aria-label={t("console.shopPage.zoneLabel")} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-fg-secondary">{t("console.shopPage.zoneLabel")}</span>
                  {view.booking.zones.map((z) => (
                    <ChipLink key={z.id} asChild size="sm" selected={z.selected}>
                      <Link href={z.href} scroll={false}>
                        {z.name}
                      </Link>
                    </ChipLink>
                  ))}
                </nav>
              ) : null}
              <ShopSlots key={`${selected?.id}-${view.booking.zones.find((z) => z.selected)?.id ?? ""}`} days={view.booking.days} label={t("console.shopPage.timesLabel")} emptyLabel={t("console.shopPage.noTimes")} />
              <div>
                <ButtonLink href={view.bookHref} variant="ghost" size="md">
                  {t("console.shopPage.moreTimes")} →
                </ButtonLink>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <OpeningHours label={t("console.shopPage.hours")} days={view.hours.days} today={view.hours.today} status={view.hours.status} />
            </div>
          </div>
        </Section>
      ) : null}

      {view.map ? (
        <Section id="zones" divider eyebrow={view.eyebrow} title={t("console.shopPage.zones")} lead={t("console.shopPage.zonesLead")} reveal>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {view.zones.map((z) => (
                <li key={z.id}>
                  <Badge tone="accent" size="md">
                    {z.name}
                  </Badge>
                </li>
              ))}
            </ul>
            <ZoneMap map={view.map} label={t("console.shopPage.mapLabel")} locale={locale} />
          </div>
        </Section>
      ) : null}

      <Section id="trust" divider eyebrow={view.about ? t("console.shopPage.good") : undefined} title={view.about ? t("console.shopPage.about") : t("console.shopPage.good")} reveal>
        <div className={view.about || view.contact ? "grid items-start gap-6 lg:grid-cols-2" : "max-w-2xl"}>
          {view.about || view.contact ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-1 p-5">
              {view.about ? (
                <div className="flex items-start gap-4">
                  <Avatar size="lg" defaultAvatar={{ brand: "akinaza", seed: view.name }} alt="" fallback={view.about.name.slice(0, 1)} />
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="m-0 font-display text-lg font-bold text-fg">{view.about.name}</p>
                    <p className="m-0 text-sm leading-relaxed text-fg-secondary">{view.about.text}</p>
                  </div>
                </div>
              ) : null}
              {view.contact ? (
                <div className="flex flex-wrap gap-2">
                  {view.contact.phone && view.contact.phoneHref ? (
                    <ButtonLink href={view.contact.phoneHref} variant="secondary" size="md">
                      {t("console.shopPage.call")} · {view.contact.phone}
                    </ButtonLink>
                  ) : null}
                  {view.contact.email ? (
                    <ButtonLink href={`mailto:${view.contact.email}`} variant="ghost" size="md">
                      {t("console.shopPage.write")}
                    </ButtonLink>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-xl border border-border-default bg-surface-1 p-5">
            <DescriptionList layout="inline" items={view.policies.map((p) => ({ id: p.id, term: p.term, details: p.value }))} />
          </div>
        </div>
      </Section>

      {view.gallery.length ? (
        <Section id="gallery" divider eyebrow={t("console.shopPage.gallery")} title={t("console.shopPage.galleryLabel", { shop: view.name })} reveal>
          <MediaGallery label={t("console.shopPage.galleryLabel", { shop: view.name })} items={view.gallery} />
        </Section>
      ) : null}

      <Section spacing="lg">
        <CtaPanel title={t("console.shopPage.closingTitle")} body={t("console.shopPage.closingBody")} reveal>
          <ButtonLink href={view.bookHref} size="lg" variant="primary">
            {t("console.shopPage.book")}
          </ButtonLink>
        </CtaPanel>
      </Section>

      <StickyAction>
        <ButtonLink href={view.bookHref} size="lg" variant="primary">
          {t("console.shopPage.book")}
        </ButtonLink>
      </StickyAction>
    </main>
  );
}
