import { loadShop, shopMediaOf, shopOfOwner } from "@akinaza/db";
import type { Metadata } from "next";

import { type SetupData, ShopSetupView } from "@/components/app/ShopSetup";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.shop };
}

const line = (m: { url: string; altFr: string; altEn: string; captionFr: string | null; captionEn: string | null; webmUrl: string | null; mp4Url: string | null; wide: boolean }) => ({ url: m.url, altFr: m.altFr, altEn: m.altEn, ...(m.captionFr ? { captionFr: m.captionFr } : {}), ...(m.captionEn ? { captionEn: m.captionEn } : {}), webmUrl: m.webmUrl, mp4Url: m.mp4Url, wide: m.wide });

/** The walker builds the public page here: the page itself, zones, services, availability and the shop's rules. */
export default async function ShopSetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  const base = readEnv().APP_PUBLIC_URL;
  if (!shop) return <ShopSetupView data={{ page: null, publicUrl: null, zones: [], services: [], windows: [], daysOff: [], rules: null, media: { cover: null, gallery: [] } }} />;
  const setup = await loadShop(db(), shop);
  const media = await shopMediaOf(db(), shop.id);
  const data: SetupData = {
    page: { name: shop.name, legalName: shop.legalName, address: shop.address, slug: shop.slug ?? "", ownerName: setup.staff.name, taglineFr: shop.taglineFr ?? "", taglineEn: shop.taglineEn ?? "", published: shop.published, area: shop.area ?? "", bioFr: shop.bioFr ?? "", bioEn: shop.bioEn ?? "", publicPhone: shop.publicPhone ?? "", publicEmail: shop.publicEmail ?? "", seatUnitFr: shop.seatUnitFr ?? "", seatUnitEn: shop.seatUnitEn ?? "", businessType: shop.businessType },
    publicUrl: shop.slug ? `${base}/${locale}/s/${shop.slug}` : null,
    zones: setup.zones.map((z) => ({ id: z.id, name: z.name })),
    services: setup.services.map((s) => ({ id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, durationMinutes: s.durationMinutes, priceCents: s.priceCents, capacity: s.capacity, descriptionFr: s.descriptionFr ?? "", descriptionEn: s.descriptionEn ?? "", includedFr: s.includedFr, includedEn: s.includedEn, priceVaries: s.priceVaries })),
    media: { cover: media.cover ? line(media.cover) : null, gallery: media.gallery.map(line) },
    windows: setup.windows.map((x) => ({ id: x.id, weekday: x.weekday, startsAt: x.startsAt, endsAt: x.endsAt })),
    daysOff: setup.daysOff,
    rules: { cancellationHours: setup.rules.cancellationHours, bookingHorizonDays: setup.rules.bookingHorizonDays, slotStepMinutes: setup.rules.slotStepMinutes, minNoticeMinutes: setup.rules.minNoticeMinutes, reportLinkDays: setup.rules.reportLinkDays },
  };
  return <ShopSetupView data={data} />;
}
