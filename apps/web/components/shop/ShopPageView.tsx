import { Badge } from "@krizaka/ui/badge";
import { OpeningHours } from "@krizaka/ui/opening-hours";
import type { ShopPage } from "@krizaka/ui/shop";
import { ShopFrame } from "@krizaka/ui/shop";
import { BookingSection } from "@krizaka/ui/shop/booking";
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
import { ShopReviews } from "@/components/shop/ShopReviews";
import { ShopVideoLazy } from "@/components/shop/ShopVideoLazy";
import { type Locale, translator } from "@/lib/i18n";
import { photoLedger, type PhotoPool, planPhotos } from "@/lib/shop-page-media";
import type { StorefrontView } from "@/lib/storefront";

const PLATFORMS = ["tiktok", "youtube-shorts", "instagram"] as const;
type Platform = (typeof PLATFORMS)[number];
const isPlatform = (value: string): value is Platform => (PLATFORMS as readonly string[]).includes(value);

/** The accent the owner chose within the look, else the look's own. */
export interface ShopPageViewProps {
  page: ShopPage;
  view: StorefrontView;
  locale: Locale;
  /** The preset's paper and its tested accents are the frame's own: the page only names the preset and the density. */
  accent?: string;
  /** The shop's day (`2026-10-27`) for the bulletin board. */
  today: string;
}

/**
 * A shop's public page, drawn from its DOCUMENT (akinaza#401): `ShopFrame` and the `@krizaka/ui/shop/*` sections, in the document's order. The data (services, times,
 * team, hours, reviews) is the page's view, resolved by `buildStorefront`; the document says which sections, which variants and which settings. A section with nothing
 * to show is not drawn. The cover is the LCP (preloaded, a fixed ratio in the hero); every photo appears once (`planPhotos`); embeds stay behind their facade.
 */
export function ShopPageView({ page, view, locale, accent, today }: ShopPageViewProps) {
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
  if (plan.cover) preload(plan.cover.src, { as: "image", fetchPriority: "high" });

  const text = (value: { fr?: string | undefined; en?: string | undefined } | undefined) => (value ? value[locale] || value.fr || value.en || undefined : undefined);
  const platformName = (p: Platform) => t(`console.shopPage.platform.${p}`);
  const playLabels = Object.fromEntries(PLATFORMS.map((p) => [p, t("console.shopPage.facadePlay", { platform: platformName(p) })])) as Record<Platform, string>;
  const notice = t("console.shopPage.facadeNotice", { platform: PLATFORMS.map(platformName).join(" · ") });
  const book = (size: "md" | "lg" = "lg") => <ButtonLink href={view.bookHref} size={size} variant="primary">{t("console.shopPage.book")}</ButtonLink>;
  const contact = view.contact;

  const render = (section: ShopPage["sections"][number]): ReactNode => {
    const title = (fallback: string) => text(section.text?.title) ?? fallback;
    const lead = text(section.text?.lead);
    const common = { id: section.key, "data-shop-key": section.key } as const;
    switch (section.type) {
      case "hero": {
        const facts = [view.logoUrl ? <Image key="logo" src={view.logoUrl} alt={view.name} width={64} height={64} unoptimized className="rounded-lg object-cover" /> : null, ...(section.blocks ?? []).map((b) => {
          if (b.settings.kind === "open-now" && view.status) return <Badge key={b.key} tone={view.status.open ? "success" : "neutral"} dot={view.status.open} size="md">{view.status.label}{view.status.detail ? ` · ${view.status.detail}` : ""}</Badge>;
          if (b.settings.kind === "area" && view.area) return <Badge key={b.key} tone="neutral" size="md">{view.area}</Badge>;
          if (b.settings.kind === "score" && community?.reviews) return <Badge key={b.key} tone="neutral" size="md">{community.reviews.scoreText}</Badge>;
          return null;
        })];
        return <HeroSection {...common} variant={section.variant === "tv" ? "poster" : section.variant} focus={section.settings.focus} title={view.name} lead={text(section.text?.lead) ?? view.tagline ?? undefined} facts={facts} actions={book()} cover={plan.cover ? { src: plan.cover.src, alt: plan.cover.alt, video: plan.cover.video } : undefined} />;
      }
      case "services": {
        const chosen = new Set(section.settings.source === "pick" ? (section.blocks ?? []).flatMap((b) => (b.type === "service" ? [b.settings.serviceId] : [])) : []);
        const services = view.services.filter((s) => section.settings.source === "all" || chosen.has(s.id)).slice(0, section.variant === "cards" ? 6 : undefined).map((s) => ({ id: s.id, name: s.name, price: s.price, priceFrom: s.priceFrom ?? undefined, duration: s.duration, capacity: s.capacity ?? undefined, description: s.description ?? undefined, included: s.included, popular: Boolean(s.tag), href: s.href }));
        if (!services.length) return null;
        const aside = section.settings.aside === "hours" ? <OpeningHours label={t("console.shopPage.hours")} days={view.hours.days} today={view.hours.today} status={view.hours.status} /> : undefined;
        return <ServicesSection {...common} variant={section.variant} services={services} title={title(t("console.shopPage.servicesTitle"))} lead={lead ?? t("console.shopPage.servicesLead")} groupBy={section.settings.groupBy} columns={section.settings.columns} aside={aside} chooseLabel={t("console.shopPage.choose")} popularLabel={t("console.shopPage.popular")} listLabel={t("console.shopPage.servicesLabel")} linkAs={Link} />;
      }
      case "booking":
        return <BookingSection {...common} variant={section.variant} label={t("console.shopPage.book")} href={view.bookHref} actionLabel={t("console.shopPage.book")} title={t("console.shopPage.closingTitle")} body={t("console.shopPage.closingBody")} linkAs={Link} />;
      case "team":
        return view.team.length ? <TeamSection {...common} variant={section.variant} members={view.team.map((m) => ({ id: m.id, name: m.name, role: m.state ?? undefined }))} title={title(t("console.journey.team"))} lead={lead ?? t("console.journey.teamLead")} /> : null;
      case "visit": {
        const mapped = section.variant !== "card" && view.map ? { label: t("console.shopPage.mapLabel"), center: view.map.center, zoom: view.map.zoom, places: view.map.places.map((p) => ({ position: p.position, label: p.name })), showLabel: t("console.shopPage.mapLabel") } : undefined;
        // A map section with no place to draw is not a second card of the hours.
        if (section.variant !== "card" && !mapped) return null;
        return <VisitSection {...common} variant={mapped ? section.variant : "card"} title={title(mapped ? t("console.shopPage.zones") : t("console.shopPage.hours"))} hours={view.hours.days} today={view.hours.today} status={view.hours.status} hoursLabel={t("console.shopPage.hours")} phone={section.settings.showPhone && contact?.phone && contact.phoneHref ? { href: contact.phoneHref, label: contact.phone } : undefined} map={mapped} />;
      }
      case "story": {
        const body = text(section.settings.body) ?? view.about?.text;
        if (!body) return null;
        const actions = contact ? <>{contact.phone && contact.phoneHref ? <ButtonLink href={contact.phoneHref} variant="secondary" size="md">{t("console.shopPage.call")} · {contact.phone}</ButtonLink> : null}{contact.email ? <ButtonLink href={`mailto:${contact.email}`} variant="ghost" size="md">{t("console.shopPage.write")}</ButtonLink> : null}</> : undefined;
        return <StorySection {...common} variant={section.variant} title={title(t("console.shopPage.about"))} body={body} owner={view.about ? { name: view.about.name } : undefined} actions={actions} />;
      }
      case "policies": {
        const byId = Object.fromEntries(view.policies.map((p) => [p.id, p]));
        const map = { cancellation: "cancellation", prices: "taxes", "booking-window": "horizon" } as const;
        const items = section.settings.show.flatMap((k) => (byId[map[k]] ? [{ id: map[k], term: byId[map[k]]!.term, details: byId[map[k]]!.value }] : []));
        return <PoliciesSection {...common} title={title(t("console.shopPage.good"))} items={items} />;
      }
      case "gallery": {
        const photos = (plan.sections[section.key] ?? []).map((p) => ({ id: p.id, photo: { src: p.src, alt: p.alt }, caption: p.caption, video: p.video }));
        const pieces = section.variant === "wall" ? (community?.wall?.pieces ?? []) : [];
        const notes = pieces.flatMap((p) => (p.kind === "note" ? [{ id: p.id, text: p.text, signature: p.signature || undefined }] : []));
        if (!photos.length && !notes.length) return null;
        const label = view.galleryIllustrative && section.variant !== "wall" ? t("console.shopPage.galleryIllustrativeLabel") : t("console.shopPage.galleryLabel", { shop: view.name });
        return <GallerySection {...common} variant={section.variant} photos={photos} notes={notes} sign={pieces.find((p) => p.kind === "sign")?.text || undefined} texture={community?.wall?.texture ?? section.settings.texture} title={title(section.variant === "wall" ? t("console.shopPage.wallTitle") : label)} lead={lead ?? (section.variant === "wall" ? t("console.shopPage.wallLead") : view.galleryIllustrative ? t("console.shopPage.galleryIllustrativeNote") : undefined)} label={label} />;
      }
      case "video": {
        const tv = section.variant === "tv" ? community?.tv : null;
        const reels = section.variant === "shorts" ? (community?.elsewhere ?? []).flatMap((v) => (v.platform && v.externalUrl ? [{ id: v.id, platform: v.platform, url: v.externalUrl, title: v.title, poster: claim(v.poster) }] : [])) : [];
        if (!tv && !reels.length) return null;
        const Video = section.variant === "tv" ? ShopVideoLazy : VideoSection;
        return <Video {...common} variant={section.variant} title={title(t("console.shopPage.reelsTitle"))} lead={lead} reels={reels} clip={tv ? { src: tv.mp4 ?? tv.webm ?? undefined, poster: claim(tv.poster), title: t("console.shopPage.tvTitle", { shop: view.name }) } : undefined} playLabels={playLabels} notice={notice} cabinet={section.settings.cabinet} channel={t("console.shopPage.tvChannel")} />;
      }
      case "social": {
        const links = (section.blocks?.length ? section.blocks.map((b) => ({ id: b.key, platform: b.settings.platform, url: b.settings.url })) : (community?.links ?? []).flatMap((l) => (isPlatform(l.platform) ? [{ id: l.platform, platform: l.platform, url: l.url }] : [])));
        return <SocialSection {...common} variant={section.variant} title={title(t("console.shopPage.socialTitle"))} links={links} labels={Object.fromEntries(PLATFORMS.map((p) => [p, platformName(p)]))} playLabels={playLabels} notice={notice} />;
      }
      case "bulletin": {
        const flyers = (community?.flyers ?? []).map((f) => ({ id: f.id, text: f.until ? `${f.text} - ${f.until}` : f.text }));
        return flyers.length ? <BulletinSection {...common} variant={section.variant} flyers={flyers} today={today} title={title(t("console.shopPage.announcementsTitle"))} /> : null;
      }
      case "reviews":
        return community?.reviews ? <ShopReviews variant={section.variant} count={section.settings.count} title={title(t("console.shopPage.reviewsTitle"))} reviews={community.reviews} starText={t("console.shopPage.reviewStars", { stars: "{stars}", count: "{count}" })} replyLabel={t("console.shopPage.reviewReply")} ownerName={view.about?.name ?? view.name} /> : null;
      case "faq": {
        const questions = (section.blocks ?? []).flatMap((b) => { const q = text(b.settings.question); const a = text(b.settings.answer); return q && a ? [{ id: b.key, question: q, answer: a }] : []; });
        return <FaqSection {...common} title={title(t("console.shopPage.faqTitle"))} questions={questions} />;
      }
      default:
        return null;
    }
  };

  const accentOf = accent ? { accent } : {};
  return (
    <ShopFrame preset={page.preset.id} density={page.density} {...accentOf} data-testid="shop-page">
      <MapSetup />
      {page.sections.filter((s) => !s.disabled).map((s) => <Fragment key={s.key}>{render(s)}</Fragment>)}
    </ShopFrame>
  );
}
