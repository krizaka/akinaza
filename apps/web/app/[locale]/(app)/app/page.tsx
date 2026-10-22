// @template: app-dashboard
import { visitMinutes, vocabularyOf } from "@akinaza/core";
import { clientBookings, clientFilesOf, dayVisits, dependantsOf, shopDay,type ShopRole } from "@akinaza/db";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import type { Metadata } from "next";

import { ClientHome } from "@/components/app/ClientHome";
import { TodayDay } from "@/components/app/TodayDay";
import { WalkerDay } from "@/components/app/WalkerDay";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { formatLongDay } from "@/lib/format";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { currentMember, may } from "@/lib/member-shop";
import { todayView } from "@/lib/today";
import { consoleFor } from "@/lib/vocabulary";

type MemberShop = NonNullable<Awaited<ReturnType<typeof currentMember>>>["shop"];

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.today };
}

/**
 * The signed-in home. The owner of a service shop (a dog walker…) lands on their day: the walks, the dogs, the check-in
 * and the reports. A client lands on their bookings. A shop of another kind keeps the salon-style day below.
 */
export default async function Home({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ day?: string; appointment?: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const member = await currentMember(session.account.id);
  if (!member) return <ClientSpace locale={locale} accountId={session.account.id} />;
  const { shop, role } = member;
  const query = await searchParams;
  // A dog walker's day is built around the walk (check-in, the report); every other business reads its day as an agenda.
  if (vocabularyOf(shop.businessType).dependants) return <ServiceDay locale={locale} shop={shop} day={query.day} />;
  return <ShopToday locale={locale} shop={shop} role={role} staffAccountId={role === "staff" ? session.account.id : undefined} query={query} />;
}

async function ServiceDay({ locale, shop, day: requested }: { locale: "en" | "fr"; shop: MemberShop; day: string | undefined }) {
  const t = consoleFor(locale, shop.businessType);
  const today = await shopDay(db(), shop.id, new Date());
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const visits = await dayVisits(db(), shop.id, day);
  const step = (n: number) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return `/${locale}/app?day=${d.toISOString().slice(0, 10)}`;
  };
  const lang = locale === "fr" ? "fr-CA" : "en-CA";
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{shop.name}</h1>
        <p className="text-fg-secondary">{format(t.walker.dayLine, { date: new Date(`${day}T12:00:00Z`).toLocaleDateString(lang, { dateStyle: "full", timeZone: "UTC" }), count: visits.length })}</p>
      </header>
      <WalkerDay
        visits={visits.map((v) => ({ ...v, minutes: v.checkedInAt && v.checkedOutAt ? visitMinutes(new Date(v.checkedInAt), new Date(v.checkedOutAt)) : null }))}
        timeZone={shop.timezone}
        nav={{ prev: step(-1), next: step(1), today: `/${locale}/app`, isToday: day === today }}
      />
    </div>
  );
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
          now,
          timeZone: f.timezone,
        })),
      )}
    />
  );
}

/**
 * The agenda day: the strip of days, the three figures of the day and its appointments. The day and the open appointment are
 * in the address, so a link, back and refresh all land on the same screen. A staff member sees their own appointments.
 */
async function ShopToday({ locale, shop, role, staffAccountId, query }: { locale: Locale; shop: MemberShop; role: ShopRole; staffAccountId: string | undefined; query: { day?: string; appointment?: string } }) {
  const view = await todayView(shop, { day: query.day, staffAccountId });
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{view.shop.name}</h1>
        <p className="text-fg-secondary">{formatLongDay(view.day, locale)}</p>
      </header>
      <TodayDay appointments={view.appointments} shop={view.shop} day={view.day} today={view.today} nowIso={new Date().toISOString()} selectedId={query.appointment ?? null} allow={{ clients: may(role, "clients"), revenue: may(role, "invoices") }} />
    </div>
  );
}
