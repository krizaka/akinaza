// @template: app-dashboard
import { visitMinutes, vocabularyOf } from "@akinaza/core";
import { dayVisits, shopDay, type ShopRole } from "@akinaza/db";
import type { Metadata } from "next";

import { TodayDay } from "@/components/app/TodayDay";
import { WalkerDay } from "@/components/app/WalkerDay";
import { db } from "@/lib/db";
import { formatLongDay } from "@/lib/format";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { may, memberShop } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";
import { todayView } from "@/lib/today";
import { consoleFor } from "@/lib/vocabulary";

type MemberShop = Awaited<ReturnType<typeof memberShop>>["shop"];

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.today };
}

/**
 * A shop's day. A dog walker's day is built around the walk (check-in, the report); every other business reads its day as an
 * agenda. The shop is the address's: a deep link opens it whatever the cookie remembers.
 */
export default async function Today({ params, searchParams }: { params: Promise<{ locale: string; shop: string }>; searchParams: Promise<{ day?: string; appointment?: string }> }) {
  const { locale: raw, shop: shopId } = await params;
  const locale = asLocale(raw);
  const { session, shop, role } = await memberShop(shopId, "agenda");
  const query = await searchParams;
  if (vocabularyOf(shop.businessType).dependants) return <ServiceDay locale={locale} shop={shop} day={query.day} />;
  return <ShopToday locale={locale} shop={shop} role={role} staffAccountId={role === "staff" ? session.account.id : undefined} query={query} />;
}

async function ServiceDay({ locale, shop, day: requested }: { locale: "en" | "fr"; shop: MemberShop; day: string | undefined }) {
  const t = consoleFor(locale, shop.businessType);
  const routes = shopRoutes(locale, shop.id);
  const today = await shopDay(db(), shop.id, new Date());
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const visits = await dayVisits(db(), shop.id, day);
  const step = (n: number) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return routes.today(d.toISOString().slice(0, 10));
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
        nav={{ prev: step(-1), next: step(1), today: routes.today(), isToday: day === today }}
      />
    </div>
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
