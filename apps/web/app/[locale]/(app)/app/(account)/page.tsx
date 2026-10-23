import { clientBookings, clientFilesOf, clientRequestsOf, dependantsOf, publicShop } from "@akinaza/db";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClientHome } from "@/components/app/ClientHome";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { lastMember } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.today };
}

/**
 * A bare `/app`: someone who works in a shop goes to the last one they worked in (the address of a shop always wins over this);
 * a client lands on their bookings.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { account } = (await pageSession())!;
  const member = await lastMember(account.id);
  if (member) redirect(shopRoutes(locale, member.shop.id).today());
  return <ClientSpace locale={locale} accountId={account.id} />;
}

async function ClientSpace({ locale, accountId }: { locale: "en" | "fr"; accountId: string }) {
  const files = await clientFilesOf(db(), accountId);
  if (files.length === 0) {
    const t = getDictionary(locale).console.client;
    return <EmptyState icon={<Mascot bird="beaver" mood="empty" size={72} />} title={t.title} description={t.none} />;
  }
  const now = new Date().toISOString();
  return (
    <ClientHome
      files={await Promise.all(
        files.map(async (f) => ({
          client: { id: f.id, fullName: f.fullName, shopName: f.shopName, shopSlug: f.shopSlug, businessType: f.businessType },
          dogs: (await dependantsOf(db(), f.id)).map((d) => ({ id: d.id, name: d.name, breed: (d.profile as { breed?: string }).breed ?? null })),
          bookings: (await clientBookings(db(), f.id)).map((b) => ({ ...b, report: b.report ? { id: b.report.id, note: b.report.note, hasPhoto: b.report.hasPhoto, durationMinutes: b.report.durationMinutes } : null })),
          requests: await requestsOf(f.id, f.shopSlug),
          now,
          timeZone: f.timezone,
        })),
      )}
    />
  );
}

/** A client's requests at a shop, and the shop's catalogue to choose from when its page is published (akinaza#210). */
async function requestsOf(clientId: string, shopSlug: string | null) {
  const page = shopSlug ? await publicShop(db(), shopSlug) : null;
  return {
    clientId,
    shopSlug,
    requests: await clientRequestsOf(db(), clientId),
    catalogue: page ? { services: page.services.map((s) => ({ id: s.id, nameFr: s.nameFr, nameEn: s.nameEn })), staff: page.team.map((m) => ({ id: m.id, name: m.name })) } : null,
  };
}
