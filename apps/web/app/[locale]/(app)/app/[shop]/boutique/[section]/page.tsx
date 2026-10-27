import { localDay, OWNER_BOUNDS, OWNER_TUNABLE, type OwnerTunable, reviewScore, shopTypeOf, WALL_LIMITS } from "@akinaza/core";
import { announcementsOf, draftShopPage, invoiceMailSettings, loadShop, publishedShopPage, reelsOf, reviewsOf, SHOP_ROLES, shopAccentOf, shopFigureOverrides, shopMediaOf, shopPageConfigOf, shopPageVersionsOf, shopStaff, socialLinksOf, teamTimeOff, translationRows, translationRunsOn,wallOf } from "@akinaza/db";
import { shopPresets } from "@krizaka/tokens/shop-presets";
import { Button } from "@krizaka/ui/button";
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { configuredKinds } from "@/app/calendar-edge";
import { BoardEditor } from "@/components/app/BoardEditor";
import { CalendarSources } from "@/components/app/CalendarSources";
import { DataExports } from "@/components/app/DataExports";
import { FeedLinks } from "@/components/app/FeedLinks";
import { FigureRules } from "@/components/app/FigureRules";
import { InvoiceMailSettings } from "@/components/app/InvoiceMailSettings";
import { ReelsEditor } from "@/components/app/ReelsEditor";
import { ReviewsPanel } from "@/components/app/ReviewsPanel";
import { type LanguagesData, ShopLanguages } from "@/components/app/ShopLanguages";
import { type SetupData, ShopSetupView } from "@/components/app/ShopSetup";
import { TeamPanel } from "@/components/app/TeamPanel";
import { TimeOffCard } from "@/components/app/TimeOffCard";
import { WallEditor } from "@/components/app/WallEditor";
import { BoutiqueHub } from "@/components/boutique/BoutiqueHub";
import { ShopComposerPanel } from "@/components/boutique/ShopComposerPanel";
import { agendaScope, pageSession } from "@/lib/access";
import { BOUTIQUE_NEEDS, type BoutiqueSection, boutiqueSectionsAllowed, isBoutiqueSection, isPageTab, type PageTab, pageTabsAllowed } from "@/lib/boutique";
import { calendarOverview } from "@/lib/calendar/overview";
import { communityLimits, reviewRules } from "@/lib/community";
import { db } from "@/lib/db";
import { proposalsFor } from "@/lib/default-media-proposals";
import { defaultMediaSettings } from "@/lib/default-media-settings";
import { readEnv } from "@/lib/env";
import { feedOverview } from "@/lib/feed-overview";
import { adminFigureRules } from "@/lib/figure-rules";
import { asLocale, getDictionary } from "@/lib/i18n";
import { may, memberShop, shopsOf } from "@/lib/member-shop";
import { type RouteLocale, shopRoutes } from "@/lib/routes";
import { appSettings } from "@/lib/settings";
import { accentsByLook } from "@/lib/shop-accents";
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

/** Boutique › Page › Layout (akinaza#402): the composer on the shop's draft, with what is live for the diff, the history and the accent. */
async function ComposerTab({ locale, shopId }: Readonly<{ locale: RouteLocale; shopId: string }>) {
  const { shop } = await memberShop(shopId, "catalogue");
  const [draft, live, accent, versions, pageConfig] = await Promise.all([draftShopPage(db(), shop.id), publishedShopPage(db(), shop.id), shopAccentOf(db(), shop.id), shopPageVersionsOf(db(), shop.id), shopPageConfigOf(db(), shop.id)]);
  const trade = shopTypeOf(shop.businessType, pageConfig.shopType);
  const looks = shopPresets.filter((p) => p.trades.includes(trade));
  return (
    <ShopComposerPanel
      canWrite
      draft={draft.page}
      published={live.page}
      accent={accent}
      accents={accentsByLook()}
      presets={looks.map((p) => ({ id: p.id, version: p.version, name: p.name, density: p.density, variants: p.variants }))}
      previewUrl={`/${locale}/preview/${shop.id}`}
      versions={versions.map((v) => ({ version: v.version, status: v.status, createdAt: v.createdAt.toISOString() }))}
    />
  );
}

/** The tabs that pin something on the public page: the owner's and the manager's, each with the live preview beside it. */
const COMMUNITY_TABS: ReadonlySet<PageTab> = new Set<PageTab>(["wall", "reels", "board", "reviews"]);

/** Boutique › Page › the shop as a place (B45): the wall, the video and profiles, the bulletin board, the reviews. */
async function CommunityTab({ shopId, tab }: Readonly<{ shopId: string; tab: "wall" | "reels" | "board" | "reviews" }>) {
  const { shop } = await memberShop(shopId, "catalogue");
  const limits = await communityLimits();
  if (tab === "wall") {
    const wall = await wallOf(db(), shop.id);
    return <WallEditor wall={wall} limits={{ wallItems: limits.wallItems, drawn: WALL_LIMITS.drawn }} />;
  }
  if (tab === "reels") {
    const [reels, links] = await Promise.all([reelsOf(db(), shop.id), socialLinksOf(db(), shop.id)]);
    return <ReelsEditor reels={reels.map((r) => ({ id: r.id, kind: r.kind, platform: r.platform, titleFr: r.titleFr, titleEn: r.titleEn, externalUrl: r.externalUrl, seconds: r.seconds }))} links={links} limits={limits} />;
  }
  if (tab === "board") {
    const flyers = await announcementsOf(db(), shop.id);
    return <BoardEditor today={localDay(new Date(), shop.timezone)} flyers={flyers.map((f) => ({ id: f.id, textFr: f.textFr, textEn: f.textEn, photoUrl: f.photoUrl, endsOn: f.endsOn, createdAt: f.createdAt.toISOString() }))} />;
  }
  const [reviews, rules] = await Promise.all([reviewsOf(db(), shop.id), reviewRules()]);
  const score = reviewScore(reviews, rules);
  return <ReviewsPanel minCount={rules.minCount} score={{ count: score.count, score: score.score, shown: score.shown }} reviews={reviews.map((r) => ({ id: r.id, firstName: r.firstName, lastInitial: r.lastInitial, rating: r.rating, body: r.body, serviceName: r.serviceName, verified: r.verified, state: r.state, reply: r.reply, createdAt: r.createdAt.toISOString() }))} />;
}

/** Boutique › Langues: the languages on, each text in each of them (#258). */
async function LanguagesSection({ locale, shopId }: { locale: RouteLocale; shopId: string }) {
  const { shop } = await memberShop(shopId, "settings");
  const [rows, rules, used] = await Promise.all([translationRows(db(), shop.id), translationRules(), translationRunsOn(db(), shop.id, localDay(new Date(), shop.timezone))]);
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

/** Boutique › Agenda: the owner's other calendars (read, to block slots) and the private calendar links of the shop and of each team member (#282, ADR-004). */
async function AgendaSection({ locale, shopId }: { locale: RouteLocale; shopId: string }) {
  const { shop, role, session } = await memberShop(shopId, "bookings");
  const t = getDictionary(locale).console.boutique.agenda;
  const scope = agendaScope(role, session.account.id);
  const [overview, calendars] = await Promise.all([feedOverview(shop.id, scope), calendarOverview(shop.id, scope, configuredKinds())]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader as="h2" title={t.title} description={t.lead} />
      <CalendarSources overview={calendars} />
      <FeedLinks overview={overview} shopName={shop.name} />
    </div>
  );
}

/** Boutique › Seuils des chiffres: when a figure asks for a look or for action, the administrator's usual values and the owner's own (#260). */
async function FiguresSection({ locale, shopId }: { locale: RouteLocale; shopId: string }) {
  const { shop } = await memberShop(shopId, "settings");
  const t = getDictionary(locale).console.boutique.figures;
  const [{ defaults }, tunable, overrides] = await Promise.all([adminFigureRules(), appSettings().get("figures.ownerTunable"), shopFigureOverrides(db(), shop.id)]);
  const usual = Object.fromEntries(OWNER_TUNABLE.map((key) => [key, defaults[key]])) as Record<OwnerTunable, number>;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader as="h2" title={t.title} description={t.lead} />
      <FigureRules tunable={tunable} usual={usual} overrides={overrides} bounds={OWNER_BOUNDS} />
    </div>
  );
}

/** Boutique › Vos données: the owner's appointments, clients and invoices to download (#420, ADR-004 §5). */
async function DataSection({ locale, shopId }: Readonly<{ locale: RouteLocale; shopId: string }>) {
  await memberShop(shopId, "privacy");
  const t = getDictionary(locale).console.boutique.data;
  const enabled = await appSettings().get("exports.data.enabled");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader as="h2" title={t.title} description={t.lead} />
      <DataExports words={t} enabled={enabled} href={(file) => `/api/walker/exports/${file}?shopId=${shopId}&locale=${locale}`} />
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

/** The body of one section of Boutique. */
function boutiqueBody({ section, tab, community, locale, shopId }: Readonly<{ section: BoutiqueSection; tab: PageTab; community: boolean; locale: RouteLocale; shopId: string }>) {
  if (section === "page" && tab === "composer") return <ComposerTab locale={locale} shopId={shopId} />;
  if (section === "page") return community ? <CommunityTab shopId={shopId} tab={tab as "wall" | "reels" | "board" | "reviews"} /> : <PageSection locale={locale} shopId={shopId} tab={tab} />;
  if (section === "languages") return <LanguagesSection locale={locale} shopId={shopId} />;
  if (section === "team") return <TeamSection locale={locale} shopId={shopId} />;
  if (section === "invoices") return <InvoicesSection locale={locale} shopId={shopId} />;
  if (section === "agenda") return <AgendaSection locale={locale} shopId={shopId} />;
  if (section === "figures") return <FiguresSection locale={locale} shopId={shopId} />;
  if (section === "data") return <DataSection locale={locale} shopId={shopId} />;
  return <ShopsSection locale={locale} shopId={shopId} />;
}

/** One section of Boutique, named by the address. A section the role may not open is a 404, whatever the link says. */
export default async function BoutiqueSectionPage({ params, searchParams }: { params: Promise<{ locale: string; shop: string; section: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale: rawLocale, shop: shopId, section: rawSection } = await params;
  const locale = asLocale(rawLocale);
  if (!isBoutiqueSection(rawSection)) notFound();
  const section: BoutiqueSection = rawSection;
  const { tab: rawTab } = await searchParams;
  const { shop, role } = await memberShop(shopId, BOUTIQUE_NEEDS[section]);
  const allowed = boutiqueSectionsAllowed((permission) => may(role, permission));
  // A tab the role may not open is a 404, whatever the link says; without a tab, the first one it may open.
  const tabs = pageTabsAllowed((permission) => may(role, permission));
  const tab: PageTab = isPageTab(rawTab) ? rawTab : (tabs[0] ?? "identity");
  if (section === "page" && !tabs.includes(tab)) notFound();
  const base = readEnv().APP_PUBLIC_URL;
  const header = { name: shop.name, published: shop.published, publicUrl: shop.slug ? `${base}/${locale}/s/${shop.slug}` : null };
  const current = section === "page" ? { section, tab } : { section };
  const community = COMMUNITY_TABS.has(tab);
  const body = boutiqueBody({ section, tab, community, locale, shopId: shop.id });
  return (
    <BoutiqueHub locale={locale} shopId={shop.id} allowed={allowed} tabs={tabs} preview={section === "page" && (community || tab === "look") && shop.slug ? { src: `/${locale}/s/${shop.slug}?preview=1` } : undefined} current={current} shop={header}>
      {body}
    </BoutiqueHub>
  );
}
