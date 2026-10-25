// @template: app-dashboard
import { BOARD_PERIODS, type BoardPeriod, localDay, visitMinutes, vocabularyOf } from "@akinaza/core";
import { dayVisits, offOn, shopDay, type ShopRole, todayBoard } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";

import { BriefBanner } from "@/components/app/BriefBanner";
import { TodayDay } from "@/components/app/TodayDay";
import { type DayVisitView, WalkerDay } from "@/components/app/WalkerDay";
import { loadShopBrief } from "@/lib/brief";
import { dayView } from "@/lib/day";
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

const withMinutes = (v: Omit<DayVisitView, "minutes">): DayVisitView => ({ ...v, minutes: v.checkedInAt && v.checkedOutAt ? visitMinutes(new Date(v.checkedInAt), new Date(v.checkedOutAt)) : null });

/**
 * A shop's day (docs/ux/2026-10-full-review.md § 4.2, decided on #289): the owner and a manager read the agenda in every trade
 * — the figures, the rows, the « now » line, a side sheet with the appointment (for a walk: the dogs, the owners, the report)
 * — with the Monday brief announced above it and the last invoices beside. A dog walker's staff keep the card view built for a
 * phone in the street. The shop is the address's: a deep link opens it whatever the cookie remembers.
 */
export default async function Today({ params, searchParams }: { params: Promise<{ locale: string; shop: string }>; searchParams: Promise<{ day?: string; appointment?: string; period?: string }> }) {
  const { locale: raw, shop: shopId } = await params;
  const locale = asLocale(raw);
  const { session, shop, role } = await memberShop(shopId, "agenda");
  const query = await searchParams;
  const { dependants } = vocabularyOf(shop.businessType);
  if (dayView(role, dependants) === "cards") return <StaffDay locale={locale} shop={shop} day={query.day} />;
  const today = localDay(new Date(), shop.timezone);
  const period: BoardPeriod = BOARD_PERIODS.find((p) => String(p) === query.period) ?? BOARD_PERIODS[0];
  // The board (the binder, the activity, « À encaisser ») is the shop's money: loaded only for who may see the invoices.
  const board = may(role, "invoices") ? await todayBoard(db(), shop.id, { day: today, period }) : null;
  return <OwnerDay locale={locale} shop={shop} role={role} staffAccountId={role === "staff" ? session.account.id : undefined} query={query} dependants={dependants} board={board} period={period} />;
}

/** The agenda day of the owner (and a manager), for every trade; a staff member of another trade sees their own appointments here. */
async function OwnerDay({ locale, shop, role, staffAccountId, query, dependants, board, period }: { locale: Locale; shop: MemberShop; role: ShopRole; staffAccountId: string | undefined; query: { day?: string; appointment?: string }; dependants: boolean; /** Null for who may not see the shop's money. */ board: Awaited<ReturnType<typeof todayBoard>> | null; period: BoardPeriod }) {
  const t = getDictionary(locale).console;
  const routes = shopRoutes(locale, shop.id);
  const view = await todayView(shop, { day: query.day, staffAccountId });
  // Who is off that day (akinaza#208): a name and the last day of their time off, never the reason.
  const [off, brief, visits] = await Promise.all([
    offOn(db(), shop.id, view.day),
    may(role, "reports") ? loadShopBrief(shop, new Date()) : null,
    dependants ? dayVisits(db(), shop.id, view.day) : [],
  ]);
  const offLine = off.length ? format(t.today.offToday, { names: off.map((o) => format(t.today.offUntil, { name: o.name, until: formatLongDay(o.until, locale) })).join(", ") }) : null;
  return (
    <TodayDay
      appointments={view.appointments}
      shop={view.shop}
      day={view.day}
      today={view.today}
      nowIso={new Date().toISOString()}
      selectedId={query.appointment ?? null}
      allow={{ clients: may(role, "clients"), revenue: board !== null }}
      title={t.meta.today}
      description={offLine ?? ""}
      dependants={dependants}
      board={board}
      period={period}
      publicPageHref={shop.published && shop.slug ? `/${locale}/s/${shop.slug}` : null}
      visits={dependants ? Object.fromEntries(visits.map((v) => [v.appointmentId, withMinutes(v)])) : undefined}
      banner={brief ? <BriefBanner count={brief.items.length} href={routes.brief} /> : null}
      newInvoiceHref={board ? routes.newInvoice : null}
    />
  );
}

/** The walker's day on a phone: one card per walk, the check-in the biggest thing on it (docs/UX_DECISIONS.md § 4). */
async function StaffDay({ locale, shop, day: requested }: { locale: Locale; shop: MemberShop; day: string | undefined }) {
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
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t.meta.today} description={format(t.walker.dayLine, { date: formatLongDay(day, locale), count: visits.length })} />
      <WalkerDay visits={visits.map(withMinutes)} timeZone={shop.timezone} nav={{ prev: step(-1), next: step(1), today: routes.today(), isToday: day === today }} />
    </div>
  );
}
