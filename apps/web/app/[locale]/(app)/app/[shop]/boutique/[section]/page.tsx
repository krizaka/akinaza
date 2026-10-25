import { localDay, shopTypeOf } from "@akinaza/core";
import { invoiceMailSettings, loadShop, SHOP_ROLES, shopMediaOf, shopPageConfigOf, shopStaff, teamTimeOff, translationRows, translationRunsOn } from "@akinaza/db";
import { Button } from "@krizaka/ui/button";
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceMailSettings } from "@/components/app/InvoiceMailSettings";
import { type LanguagesData, ShopLanguages } from "@/components/app/ShopLanguages";
import { type SetupData, ShopSetupView } from "@/components/app/ShopSetup";
import { TeamPanel } from "@/components/app/TeamPanel";
import { TimeOffCard } from "@/components/app/TimeOffCard";
import { BoutiqueHub } from "@/components/boutique/BoutiqueHub";
import { pageSession } from "@/lib/access";
import { BOUTIQUE_NEEDS, type BoutiqueSection, boutiqueSectionsAllowed, isBoutiqueSection, isPageTab, type PageTab } from "@/lib/boutique";
import { db } from "@/lib/db";
import { proposalsFor } from "@/lib/default-media-proposals";
import { defaultMediaSettings } from "@/lib/default-media-settings";
import { readEnv } from "@/lib/env";
import { asLocale, getDictionary } from "@/lib/i18n";
import { may, memberShop, shopsOf } from "@/lib/member-shop";
import { type RouteLocale, shopRoutes } from "@/lib/routes";
import { team } from "@/lib/team";
import { templateChoices } from "@/lib/template-choices";
import { templateRules } from "@/lib/template-rules";
import { translationRules } from "@/lib/translation-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.boutique.title };
}

const line = (m: { url: string; altFr: string; altEn: string; captionFr: string | null; captionEn: string | null; webmUrl: string | null; mp4Url: string | null; wide: boolean }) => ({ url: m.url, altFr: m.altFr, altEn: m.altEn, ...(m.captionFr ? { captionFr: m.captionFr } : {}), ...(m.captionEn ? { captionEn: m.captionEn } : {}), webmUrl: m.webmUrl, mp4Url: m.mp4Url, wide: m.wide });

/** Boutique › Page: the shop as the walker builds its public page (identity, texts, zones, services, hours, rules, media, look, publish). */
async function PageSection({ locale, shopId, tab }: { locale: RouteLocale; shopId: string; tab: PageTab }) {
  const { shop } = await memberShop(shopId, "settings");
  const base = readEnv().APP_PUBLIC_URL;
  const setup = await loadShop(db(), shop);
  const [media, pageConfig] = await Promise.all([shopMediaOf(db(), shop.id), shopPageConfigOf(db(), shop.id)]);
  const [rules, templates] = await Promise.all([defaultMediaSettings(), templateRules()]);
  const proposed = rules.enabled ? { config: pageConfig, shopType: shopTypeOf(shop.businessType, pageConfig.shopType), proposals: proposalsFor(rules.types), media: { cover: media.cover ? line(media.cover) : null, gallery: media.gallery.map(line) } } : null;
  const data: SetupData = {
    proposed,
    templates: templateChoices(templates, shopTypeOf(shop.businessType, pageConfig.shopType), pageConfig),
    shopId: shop.id,
    pageConfig,
    page: { name: shop.name, legalName: shop.legalName, address: shop.address, slug: shop.slug ?? "", ownerName: setup.staff.name, taglineFr: shop.taglineFr ?? "", taglineEn: shop.taglineEn ?? "", published: shop.published, area: shop.area ?? "", bioFr: shop.bioFr ?? "", bioEn: shop.bioEn ?? "", publicPhone: shop.publicPhone ?? "", publicEmail: shop.publicEmail ?? "", seatUnitFr: shop.seatUnitFr ?? "", seatUnitEn: shop.seatUnitEn ?? "", businessType: shop.businessType },
    publicUrl: shop.slug ? `${base}/${locale}/s/${shop.slug}` : null,
    zones: setup.zones.map((z) => ({ id: z.id, name: z.name })),
    services: setup.services.map((s) => ({ id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, durationMinutes: s.durationMinutes, priceCents: s.priceCents, capacity: s.capacity, descriptionFr: s.descriptionFr ?? "", descriptionEn: s.descriptionEn ?? "", includedFr: s.includedFr, includedEn: s.includedEn, priceVaries: s.priceVaries })),
    media: { cover: media.cover ? line(media.cover) : null, gallery: media.gallery.map(line) },
    windows: setup.windows.map((x) => ({ id: x.id, weekday: x.weekday, startsAt: x.startsAt, endsAt: x.endsAt })),
    daysOff: setup.daysOff,
    rules: { cancellationHours: setup.rules.cancellationHours, bookingHorizonDays: setup.rules.bookingHorizonDays, slotStepMinutes: setup.rules.slotStepMinutes, minNoticeMinutes: setup.rules.minNoticeMinutes, reportLinkDays: setup.rules.reportLinkDays, paymentTermsDays: shop.paymentTermsDays },
  };
  return <ShopSetupView data={data} tab={tab} />;
}

/** Boutique › Langues: the languages on, each text in each of them (#258). */
async function LanguagesSection({ locale, shopId }: { locale: RouteLocale; shopId: string }) {
  const { shop } = await memberShop(shopId, "settings");
  const [rows, rules, used] = await Promise.all([translationRows(db(), shop.id), translationRules(), translationRunsOn(db(), shop.id, new Date().toISOString().slice(0, 10))]);
  const data: LanguagesData = { source: rows.source as "fr" | "en", enabled: rows.enabled, allowed: rules.allowed, translationOn: rules.enabled, dailyLimit: rules.dailyLimit, usedToday: used, fields: rows.fields, setupHref: shopRoutes(locale, shop.id).setup };
  return <ShopLanguages data={data} />;
}

/** Boutique › Équipe: the members and the invitations, and the team's time off (a date range). */
async function TeamSection({ locale, shopId }: { locale: RouteLocale; shopId: string }) {
  const { session, shop, role } = await memberShop(shopId, "team");
  const roles = team();
  const now = new Date();
  const [members, invitations, people, timeOff] = await Promise.all([roles.members(shop.id), roles.pendingInvitations(shop.id, now), shopStaff(db(), shop.id), teamTimeOff(db(), shop.id, localDay(now, shop.timezone))]);
  const manages = SHOP_ROLES.manages[role];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader as="h2" title={getDictionary(locale).console.team.title} />
      <TeamPanel
        timeZone={shop.timezone}
        assignable={[...manages]}
        members={members.map((m) => ({ accountId: m.accountId, email: m.email, name: m.name, role: m.role, since: m.since.toISOString(), manageable: manages.includes(m.role), isYou: m.accountId === session.account.id }))}
        invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))}
      />
      {may(role, "schedule") ? <TimeOffCard data={{ staff: people, timeOff }} /> : null}
    </div>
  );
}

/** Boutique › Factures: the e-mail defaults of the invoices the shop sends (the owner's; they moved here from the list, K4). */
async function InvoicesSection({ locale, shopId }: { locale: RouteLocale; shopId: string }) {
  const { shop } = await memberShop(shopId, "settings");
  const t = getDictionary(locale).console.boutique.invoices;
  const mail = await invoiceMailSettings(db(), shop.id);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader as="h2" title={t.title} description={t.lead} />
      {mail ? <InvoiceMailSettings initial={mail.shop} /> : null}
    </div>
  );
}

/** Boutique › Boutiques: the shops the account works in, and « Add a shop » (one more, unpublished). */
async function ShopsSection({ locale, shopId }: { locale: RouteLocale; shopId: string }) {
  await memberShop(shopId, "settings");
  const { account } = (await pageSession())!;
  const t = getDictionary(locale).console.boutique.shops;
  const shops = await shopsOf(account.id);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader as="h2" title={t.title} description={t.lead} />
      <ul className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
        {shops.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="min-w-0 break-words font-semibold text-fg">{s.name}</span>
            {s.id === shopId ? <span className="text-sm text-fg-secondary">{t.current}</span> : <Link className="font-semibold text-fg-accent underline" href={shopRoutes(locale, s.id).setup}>{t.open}</Link>}
          </li>
        ))}
      </ul>
      <div>
        <Button asChild variant="secondary" shape="cut" size="md">
          <Link href={shopRoutes(locale, shopId).addShop}>{t.add}</Link>
        </Button>
      </div>
    </div>
  );
}

/** One section of Boutique, named by the address. A section the role may not open is a 404, whatever the link says. */
export default async function BoutiqueSectionPage({ params, searchParams }: { params: Promise<{ locale: string; shop: string; section: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale: rawLocale, shop: shopId, section: rawSection } = await params;
  const locale = asLocale(rawLocale);
  if (!isBoutiqueSection(rawSection)) notFound();
  const section: BoutiqueSection = rawSection;
  const { tab: rawTab } = await searchParams;
  const tab: PageTab = isPageTab(rawTab) ? rawTab : "identity";
  const { shop, role } = await memberShop(shopId, BOUTIQUE_NEEDS[section]);
  const allowed = boutiqueSectionsAllowed((permission) => may(role, permission));
  const base = readEnv().APP_PUBLIC_URL;
  const header = { name: shop.name, published: shop.published, publicUrl: shop.slug ? `${base}/${locale}/s/${shop.slug}` : null };
  const current = section === "page" ? { section, tab } : { section };
  const body =
    section === "page" ? <PageSection locale={locale} shopId={shop.id} tab={tab} /> : section === "languages" ? <LanguagesSection locale={locale} shopId={shop.id} /> : section === "team" ? <TeamSection locale={locale} shopId={shop.id} /> : section === "invoices" ? <InvoicesSection locale={locale} shopId={shop.id} /> : <ShopsSection locale={locale} shopId={shop.id} />;
  return (
    <BoutiqueHub locale={locale} shopId={shop.id} allowed={allowed} current={current} shop={header}>
      {body}
    </BoutiqueHub>
  );
}
