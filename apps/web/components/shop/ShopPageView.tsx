import type { FramePaper } from "@akinaza/core";
import { Badge } from "@krizaka/ui/badge";
import { OpeningHours } from "@krizaka/ui/opening-hours";
import { PaperGrain } from "@krizaka/ui/page";
import type { ShopPage } from "@krizaka/ui/shop";
import { ShopFrame, ShopSection } from "@krizaka/ui/shop";
import { BookingSection, type BookingTime } from "@krizaka/ui/shop/booking";
import { BulletinSection } from "@krizaka/ui/shop/bulletin";
import { FaqSection } from "@krizaka/ui/shop/faq";
import { GallerySection } from "@krizaka/ui/shop/gallery";
import { HeroSection } from "@krizaka/ui/shop/hero";
import { PoliciesSection } from "@krizaka/ui/shop/policies";
import { ServicesSection } from "@krizaka/ui/shop/services";
import { SocialSection } from "@krizaka/ui/shop/social";
import { StorySection } from "@krizaka/ui/shop/story";
import { TeamSection } from "@krizaka/ui/shop/team";
import { VideoSection } from "@krizaka/ui/shop/video";
import { VisitSection } from "@krizaka/ui/shop/visit";
import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { preload } from "react-dom";

import { ButtonLink } from "@/components/ButtonLink";
import { MapSetup } from "@/components/shop/MapSetup";
import { ShopMosaic } from "@/components/shop/ShopMosaic";
import { ShopReviews } from "@/components/shop/ShopReviews";
import { ShopVideoLazy } from "@/components/shop/ShopVideoLazy";
import { coverPhoneSet, coverSizes, coverSrcSet, PHONE_MEDIA } from "@/lib/cover-renditions";
import { type Locale, translator } from "@/lib/i18n";
import { defaultBanner, defaultPicture } from "@/lib/org-defaults";
import { photoLedger, type PhotoPool, planPhotos } from "@/lib/shop-page-media";
import type { StorefrontView } from "@/lib/storefront";

const PLATFORMS = ["tiktok", "youtube-shorts", "instagram"] as const;
type Platform = (typeof PLATFORMS)[number];
const isPlatform = (value: string): value is Platform => (PLATFORMS as readonly string[]).includes(value);

/** The accent the owner chose within the look, else the look's own. */
/** The « Book » button of every section that offers it, made outside the page component (a render function, not a component defined in its render). */
function bookButton(href: string, label: string) {
  return function renderBook(size: "md" | "lg" = "lg") {
    return (
      <ButtonLink href={href} size={size} variant="primary">
        {label}
      </ButtonLink>
    );
  };
}

export interface ShopPageViewProps {
  page: ShopPage;
  view: StorefrontView;
  locale: Locale;
  /** The preset's paper and its tested accents are the frame's own: the page only names the preset and the density. */
  accent?: string;
  /** The paper under the page (the applied template's, when the notebook storefront is on); none = the look's own. */
  paper?: FramePaper;
  /** The shop's day (`2026-10-27`) for the bulletin board. */
  today: string;
  /** The closing call's next free time (`nextFreeTime`), when the page has one and a time is free. */
  nextTime?: BookingTime;
}

type Section = ShopPage["sections"][number];
type Args<K extends Section["type"]> = { section: Extract<Section, { type: K }>; c: Ctx };
type Ctx = {
  view: StorefrontView;
  t: ReturnType<typeof translator>;
  text: (value: { fr?: string | undefined; en?: string | undefined } | undefined) => string | undefined;
  titleOf: (section: Section, fallback: string) => string;
  plan: ReturnType<typeof planPhotos>;
  claim: ReturnType<typeof photoLedger>;
  book: (size?: "md" | "lg") => ReactNode;
  contact: StorefrontView["contact"];
  community: StorefrontView["community"];
  today: string;
  nextTime: BookingTime | undefined;
  playLabels: Record<Platform, string>;
  notice: string;
  locale: Locale;
  platformName: (p: Platform) => string;
};
const commonOf = (section: Section) => ({ id: section.key, "data-shop-key": section.key }) as const;


/**
 * A fact on the hero is drawn over the shop's photo: it wears the `scrim` tone (white on a 60 % black veil, whatever the theme and the photo), never a
 * tinted tone whose text follows the theme (green on a dark photo was unreadable in the light theme, akinaza#567).
 */
function heroFact(b: NonNullable<Args<"hero">["section"]["blocks"]>[number], { view, community }: Pick<Ctx, "view" | "community">): ReactNode {
  if (b.settings.kind === "open-now" && view.status) return <Badge key={b.key} tone="scrim" dot={view.status.open} size="md">{view.status.label}{view.status.detail ? ` · ${view.status.detail}` : ""}</Badge>;
  if (b.settings.kind === "area" && view.area) return <Badge key={b.key} tone="scrim" size="md">{view.area}</Badge>;
  if (b.settings.kind === "score" && community?.reviews) return <Badge key={b.key} tone="scrim" size="md">{community.reviews.scoreText}</Badge>;
  return null;
}

/** A shop with no photo for its hero wears the org JSON's default banner for its name, like its logo (a decorative picture: no alt). */
function bannerOf(id: string) {
  const banner = defaultBanner(id);
  return banner ? { src: banner.src, alt: "", srcSet: banner.srcSet } : undefined;
}

function heroSection({ section, c }: Args<"hero">): ReactNode {
  const { view, text, plan, book } = c;
  const common = commonOf(section);
  const logo = c.claim(view.logoUrl ?? defaultPicture("shop", view.name, 256)?.src ?? null) ?? null;
  const facts = [
    logo ? <Image key="logo" src={logo} alt={view.name} width={64} height={64} unoptimized className="rounded-lg object-cover" /> : null,
    ...(section.blocks ?? []).map((b) => heroFact(b, c)),
  ];
  return <HeroSection {...common} variant={section.variant === "tv" ? "poster" : section.variant} focus={section.settings.focus} title={view.name} lead={text(section.text?.lead) ?? view.tagline ?? undefined} facts={facts} actions={book()} cover={plan.cover ? { src: plan.cover.src, alt: plan.cover.alt, video: plan.cover.video, srcSet: coverSrcSet(plan.cover.src), phone: coverPhoneSet(plan.cover.src) } : bannerOf(view.name)} />;
}

function servicesSection({ section, c }: Args<"services">): ReactNode {
  const { view, t, text } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const lead = text(section.text?.lead);
  const common = commonOf(section);
  const chosen = new Set(section.settings.source === "pick" ? (section.blocks ?? []).flatMap((b) => (b.type === "service" ? [b.settings.serviceId] : [])) : []);
  const services = view.services.filter((s) => section.settings.source === "all" || chosen.has(s.id)).slice(0, section.variant === "cards" ? 6 : undefined).map((s) => ({ id: s.id, name: s.name, price: s.price, priceFrom: s.priceFrom ?? undefined, duration: s.duration, capacity: s.capacity ?? undefined, description: s.description ?? undefined, included: s.included, popular: Boolean(s.tag), href: s.href }));
  if (!services.length) return null;
  const aside = section.settings.aside === "hours" ? <OpeningHours label={t("console.shopPage.hours")} days={view.hours.days} today={view.hours.today} status={view.hours.status} /> : undefined;
  return <ServicesSection {...common} variant={section.variant} services={services} title={title(t("console.shopPage.servicesTitle"))} lead={lead ?? t("console.shopPage.servicesLead")} groupBy={section.settings.groupBy} columns={section.settings.columns} aside={aside} chooseLabel={t("console.shopPage.choose")} popularLabel={t("console.shopPage.popular")} listLabel={t("console.shopPage.servicesLabel")} linkAs={Link} />;
}

function bookingSection({ section, c }: Args<"booking">): ReactNode {
  const { view, t, plan, contact } = c;
  const common = commonOf(section);
  const base = { ...common, variant: section.variant, label: t("console.shopPage.book"), href: view.bookHref, actionLabel: t("console.shopPage.book"), title: t("console.shopPage.closingTitle"), body: t("console.shopPage.closingBody"), linkAs: Link };
  if (section.variant !== "closing") return <BookingSection {...base} />;
  const photo = plan.sections[section.key]?.[0];
  // The mark stands in for a photo, once: the logo the hero already shows is not drawn again.
  const logo = c.claim(view.logoUrl ?? defaultPicture("shop", view.name, 256)?.src ?? null);
  return (
    <BookingSection
      {...base}
      photo={photo ? { src: photo.src, alt: photo.alt, srcSet: coverSrcSet(photo.src) } : undefined}
      mark={logo ? <Image src={logo} alt="" width={64} height={64} unoptimized className="rounded-lg object-cover" /> : undefined}
      nextTime={c.nextTime}
      nextTimeLabel={t("console.shopPage.nextFreeTime")}
      secondary={contact?.phoneHref ? { label: t("console.shopPage.call"), href: contact.phoneHref } : undefined}
    />
  );
}

function teamSection({ section, c }: Args<"team">): ReactNode {
  const { view, t, text } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const lead = text(section.text?.lead);
  const common = commonOf(section);
  return view.team.length ? <TeamSection {...common} variant={section.variant} members={view.team.map((m) => ({ id: m.id, name: m.name, role: m.state ?? undefined }))} title={title(t("console.journey.team"))} lead={lead ?? t("console.journey.teamLead")} /> : null;
}

function visitSection({ section, c }: Args<"visit">): ReactNode {
  const { view, t, contact } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const common = commonOf(section);
  const mapped = section.variant !== "card" && view.map ? { label: t("console.shopPage.mapLabel"), center: view.map.center, zoom: view.map.zoom, places: view.map.places.map((p) => ({ position: p.position, label: p.name })), showLabel: t("console.shopPage.mapLabel") } : undefined;
  // A map section with no place to draw is not a second card of the hours.
  if (section.variant !== "card" && !mapped) return null;
  return <VisitSection {...common} variant={mapped ? section.variant : "card"} title={title(mapped ? t("console.shopPage.zones") : t("console.shopPage.hours"))} hours={view.hours.days} today={view.hours.today} status={view.hours.status} hoursLabel={t("console.shopPage.hours")} phone={section.settings.showPhone && contact?.phone && contact.phoneHref ? { href: contact.phoneHref, label: contact.phone } : undefined} map={mapped} />;
}

function storySection({ section, c }: Args<"story">): ReactNode {
  const { view, t, text, contact } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const common = commonOf(section);
  const body = text(section.settings.body) ?? view.about?.text;
  if (!body) return null;
  const actions = contact ? <>{contact.phone && contact.phoneHref ? <ButtonLink href={contact.phoneHref} variant="secondary" size="md">{t("console.shopPage.call")} · {contact.phone}</ButtonLink> : null}{contact.email ? <ButtonLink href={`mailto:${contact.email}`} variant="ghost" size="md">{t("console.shopPage.write")}</ButtonLink> : null}</> : undefined;
  return <StorySection {...common} variant={section.variant} title={title(t("console.shopPage.about"))} body={body} owner={view.about ? { name: view.about.name } : undefined} actions={actions} />;
}

function policiesSection({ section, c }: Args<"policies">): ReactNode {
  const { view, t } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const common = commonOf(section);
  const byId = Object.fromEntries(view.policies.map((p) => [p.id, p]));
  const map = { cancellation: "cancellation", prices: "taxes", "booking-window": "horizon" } as const;
  const items = section.settings.show.flatMap((k) => (byId[map[k]] ? [{ id: map[k], term: byId[map[k]]!.term, details: byId[map[k]]!.value }] : []));
  return <PoliciesSection {...common} title={title(t("console.shopPage.good"))} items={items} />;
}

const wallNotes = (pieces: readonly { kind: string; id: string; text?: string; signature?: string }[]) =>
  pieces.flatMap((p) => (p.kind === "note" ? [{ id: p.id, text: p.text ?? "", signature: p.signature || undefined }] : []));

function galleryLead(view: StorefrontView, variant: string, t: Ctx["t"]): string | undefined {
  if (variant === "wall") return t("console.shopPage.wallLead");
  return view.galleryIllustrative ? t("console.shopPage.galleryIllustrativeNote") : undefined;
}

function galleryLabel(view: StorefrontView, variant: string, t: Ctx["t"]): string {
  return view.galleryIllustrative && variant !== "wall" ? t("console.shopPage.galleryIllustrativeLabel") : t("console.shopPage.galleryLabel", { shop: view.name });
}

/**
 * The mosaic is the package's `ShopGallery` (akinaza#481): a bento on a desktop, a snap strip on a phone, the lightbox a lazy chunk opened by a tile (no script before). Every tile has a fixed ratio
 * (CLS 0); the `srcset` is the photo's width variants when it has some (`coverSrcSet`), else the file as it is.
 */
function mosaicSection({ section, c, common, label, lead }: Args<"gallery"> & { common: ReturnType<typeof commonOf>; label: string; lead: string | undefined }): ReactNode {
  const photos = (c.plan.sections[section.key] ?? []).map((p) => ({ id: p.id, src: p.src, alt: p.alt, srcSet: coverSrcSet(p.src) }));
  return (
    <ShopSection {...common} title={c.titleOf(section, label)} lead={lead} data-variant="mosaic">
      <ShopMosaic photos={photos} label={label} locale={c.locale} />
    </ShopSection>
  );
}

function gallerySection({ section, c }: Args<"gallery">): ReactNode {
  const { view, t, text, plan, community } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const lead = text(section.text?.lead);
  const common = commonOf(section);
  const photos = (plan.sections[section.key] ?? []).map((p) => ({ id: p.id, photo: { src: p.src, alt: p.alt }, caption: p.caption, video: p.video }));
  const pieces = section.variant === "wall" ? (community?.wall?.pieces ?? []) : [];
  const notes = wallNotes(pieces);
  if (!photos.length && !notes.length) return null;
  const label = galleryLabel(view, section.variant, t);
  if (section.variant === "mosaic") {
    return mosaicSection({ section, c, common, label, lead: lead ?? galleryLead(view, section.variant, t) });
  }
  return <GallerySection {...common} variant={section.variant} photos={photos} notes={notes} sign={pieces.find((p) => p.kind === "sign")?.text || undefined} texture={community?.wall?.texture ?? section.settings.texture} title={title(section.variant === "wall" ? t("console.shopPage.wallTitle") : label)} lead={lead ?? galleryLead(view, section.variant, t)} label={label} />;
}

const shortsOf = (community: Ctx["community"], claim: Ctx["claim"]) => (community?.elsewhere ?? []).flatMap((v) => (v.platform && v.externalUrl ? [{ id: v.id, platform: v.platform, url: v.externalUrl, title: v.title, poster: claim(v.poster) }] : []));

function videoSection({ section, c }: Args<"video">): ReactNode {
  const { view, t, text, claim, community, playLabels, notice } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const lead = text(section.text?.lead);
  const common = commonOf(section);
  const tv = section.variant === "tv" ? community?.tv : null;
  const reels = section.variant === "shorts" ? shortsOf(community, claim) : [];
  if (!tv && !reels.length) return null;
  const Video = section.variant === "tv" ? ShopVideoLazy : VideoSection;
  return <Video {...common} variant={section.variant} title={title(t("console.shopPage.reelsTitle"))} lead={lead} reels={reels} clip={tv ? { src: tv.mp4 ?? tv.webm ?? undefined, poster: claim(tv.poster), title: t("console.shopPage.tvTitle", { shop: view.name }) } : undefined} playLabels={playLabels} notice={notice} cabinet={section.settings.cabinet} channel={t("console.shopPage.tvChannel")} />;
}

function socialSection({ section, c }: Args<"social">): ReactNode {
  const { t, community, playLabels, notice, platformName } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const common = commonOf(section);
  const links = (section.blocks?.length ? section.blocks.map((b) => ({ id: b.key, platform: b.settings.platform, url: b.settings.url })) : (community?.links ?? []).flatMap((l) => (isPlatform(l.platform) ? [{ id: l.platform, platform: l.platform, url: l.url }] : [])));
  return <SocialSection {...common} variant={section.variant} title={title(t("console.shopPage.socialTitle"))} links={links} labels={Object.fromEntries(PLATFORMS.map((p) => [p, platformName(p)]))} playLabels={playLabels} notice={notice} />;
}

function bulletinSection({ section, c }: Args<"bulletin">): ReactNode {
  const { t, community, today } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const common = commonOf(section);
  const flyers = (community?.flyers ?? []).map((f) => ({ id: f.id, text: f.until ? `${f.text} - ${f.until}` : f.text }));
  return flyers.length ? <BulletinSection {...common} variant={section.variant} flyers={flyers} today={today} title={title(t("console.shopPage.announcementsTitle"))} /> : null;
}

function reviewsSection({ section, c }: Args<"reviews">): ReactNode {
  const { view, t, community } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  return community?.reviews ? <ShopReviews variant={section.variant} count={section.settings.count} title={title(t("console.shopPage.reviewsTitle"))} reviews={community.reviews} starText={t("console.shopPage.reviewStars", { stars: "{stars}", count: "{count}" })} replyLabel={t("console.shopPage.reviewReply")} ownerName={view.about?.name ?? view.name} /> : null;
}

function faqSection({ section, c }: Args<"faq">): ReactNode {
  const { t, text } = c;
  const title = (fallback: string) => c.titleOf(section, fallback);
  const common = commonOf(section);
  const questions = (section.blocks ?? []).flatMap((b) => { const q = text(b.settings.question); const a = text(b.settings.answer); return q && a ? [{ id: b.key, question: q, answer: a }] : []; });
  return <FaqSection {...common} title={title(t("console.shopPage.faqTitle"))} questions={questions} />;
}

/** One renderer per section type of the document; a type with no renderer draws nothing. */
const SECTIONS: Partial<Record<Section["type"], (args: { section: never; c: Ctx }) => ReactNode>> = {
  hero: heroSection as never,
  services: servicesSection as never,
  booking: bookingSection as never,
  team: teamSection as never,
  visit: visitSection as never,
  story: storySection as never,
  policies: policiesSection as never,
  gallery: gallerySection as never,
  video: videoSection as never,
  social: socialSection as never,
  bulletin: bulletinSection as never,
  reviews: reviewsSection as never,
  faq: faqSection as never,
};
const renderSection = (section: Section, c: Ctx): ReactNode => SECTIONS[section.type]?.({ section: section as never, c }) ?? null;

/**
 * A shop's public page, drawn from its DOCUMENT (akinaza#401): `ShopFrame` and the `@krizaka/ui/shop/*` sections, in the document's order. The data (services, times,
 * team, hours, reviews) is the page's view, resolved by `buildStorefront`; the document says which sections, which variants and which settings. A section with nothing
 * to show is not drawn. The cover is the LCP (preloaded, a fixed ratio in the hero); every photo appears once (`planPhotos`); embeds stay behind their facade.
 */
export function ShopPageView({ page, view, locale, accent, paper, today, nextTime }: Readonly<ShopPageViewProps>) {
  const t = translator(locale);
  const community = view.community;
  const pool: PhotoPool = {
    cover: view.cover,
    gallery: view.gallery.map((g) => ({ id: g.id, src: g.src, alt: g.alt, caption: g.caption, video: g.video })),
    wall: (community?.wall?.pieces ?? []).flatMap((p) => (p.kind === "polaroid" && p.imageUrl ? [{ id: p.id, src: p.imageUrl, alt: p.alt, caption: p.caption }] : [])),
  };
  const plan = planPhotos(page, pool);
  const claim = photoLedger(plan);
  // The LCP: the hero's cover is asked for first, with a high priority.
  // The exact `srcset` candidate the hero's <img> will pick: same set, same sizes (a mismatch would download the cover twice).
  if (plan.cover) {
    const srcSet = coverSrcSet(plan.cover.src);
    const phone = coverPhoneSet(plan.cover.src);
    const heroVariant = page.sections.find((s) => s.type === "hero" && !s.disabled)?.variant;
    const poster = heroVariant === "poster" || heroVariant === "tv" || heroVariant === undefined;
    if (poster && phone) {
      // The poster hero swaps its source on a phone: ask for that candidate there, the full file elsewhere.
      preload(plan.cover.src, { as: "image", fetchPriority: "high", imageSrcSet: phone, imageSizes: "100vw", media: PHONE_MEDIA });
      preload(plan.cover.src, { as: "image", fetchPriority: "high", media: `not ${PHONE_MEDIA}` });
    } else {
      preload(plan.cover.src, { as: "image", fetchPriority: "high", ...(srcSet ? { imageSrcSet: srcSet, imageSizes: coverSizes(heroVariant) } : {}) });
    }
  }

  const text: Ctx["text"] = (value) => (value ? value[locale] || value.fr || value.en || undefined : undefined);
  const platformName = (p: Platform) => t(`console.shopPage.platform.${p}`);
  const ctx: Ctx = {
    view,
    t,
    text,
    titleOf: (section, fallback) => text(section.text?.title) ?? fallback,
    plan,
    claim,
    book: bookButton(view.bookHref, t("console.shopPage.book")),
    contact: view.contact,
    community,
    today,
    nextTime,
    playLabels: Object.fromEntries(PLATFORMS.map((p) => [p, t("console.shopPage.facadePlay", { platform: platformName(p) })])) as Record<Platform, string>,
    notice: t("console.shopPage.facadeNotice", { platform: PLATFORMS.map(platformName).join(" · ") }),
    platformName,
    locale,
  };

  const accentOf = { ...(accent ? { accent } : {}), ...(paper ? { paper } : {}) };
  return (
    <ShopFrame preset={page.preset.id} density={page.density} {...accentOf} data-testid="shop-page">
      {paper === "kraft" ? <PaperGrain /> : null}
      <MapSetup />
      {page.sections.filter((s) => !s.disabled).map((s) => <Fragment key={s.key}>{renderSection(s, ctx)}</Fragment>)}
    </ShopFrame>
  );
}
