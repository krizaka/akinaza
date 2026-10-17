import { formatCents, visitMinutes } from "@akinaza/core";
import { clientBookings, clientFilesOf, dayVisits, dependantsOf, shopDay, shopOfOwner } from "@akinaza/db";
import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import type { Metadata } from "next";

import { ClientHome } from "@/components/app/ClientHome";
import { TodayTable } from "@/components/app/TodayTable";
import { WalkerDay } from "@/components/app/WalkerDay";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { todayView } from "@/lib/today";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.today };
}

/**
 * The signed-in home. The owner of a service shop (a dog walker…) lands on their day: the walks, the dogs, the check-in
 * and the reports. A client lands on their bookings. A shop of another kind keeps the salon-style day below.
 */
export default async function Home({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ day?: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (shop && shop.kind !== "services") return <SalonToday params={params} />;
  if (shop) return <ServiceDay locale={locale} shop={shop} day={(await searchParams).day} />;
  return <ClientSpace locale={locale} accountId={session.account.id} />;
}

async function ServiceDay({ locale, shop, day: requested }: { locale: "en" | "fr"; shop: NonNullable<Awaited<ReturnType<typeof shopOfOwner>>>; day: string | undefined }) {
  const t = getDictionary(locale).console;
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
          client: { id: f.id, fullName: f.fullName, shopName: f.shopName, shopSlug: f.shopSlug },
          dogs: (await dependantsOf(db(), f.id)).map((d) => ({ id: d.id, name: d.name, breed: (d.profile as { breed?: string }).breed ?? null })),
          bookings: (await clientBookings(db(), f.id)).map((b) => ({ ...b, report: b.report ? { id: b.report.id, note: b.report.note, hasPhoto: b.report.hasPhoto, durationMinutes: b.report.durationMinutes } : null })),
          now,
          timeZone: f.timezone,
        })),
      )}
    />
  );
}

const INTL: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };

/**
 * The salon-style day (a shop that is not a service shop): today's appointments, and an invoice with its GST (5 %) and QST (9.975 %) lines — the latest issued one,
 * or a preview of the next. Bilingual by design: the invoice is drawn in its own language (French by default, as the
 * Charter of the French language asks), whatever the language of the page.
 */
async function SalonToday({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.today;
  const session = (await pageSession())!;
  const view = await todayView(session.account.id);
  if (!view) return <EmptyState icon={<Mascot bird="beaver" mood="empty" size={72} />} title={t.noShopTitle} description={t.noShop} />;
  const money = (cents: number, lang: Locale = locale) => new Intl.NumberFormat(INTL[lang], { style: "currency", currency: "CAD" }).format(cents / 100);
  const inv = view.invoice;
  const doc = inv ? getDictionary(inv.language).console.today.invoice : null;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{view.shop.name}</h1>
        <p className="text-fg-secondary">{format(t.day, { date: new Date(`${view.day}T12:00:00Z`).toLocaleDateString(INTL[locale], { dateStyle: "full", timeZone: "UTC" }), count: view.appointments.length })}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card.Root className="p-4">
          <h2 className="mb-3 font-display text-base font-bold text-fg">{t.appointments}</h2>
          {view.appointments.length ? <TodayTable rows={view.appointments} timeZone={view.shop.timezone} /> : <p className="text-fg-secondary">{t.none}</p>}
        </Card.Root>
        <Card.Root className="p-4" aria-labelledby="invoice-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="invoice-title" className="font-display text-base font-bold text-fg">
              {inv?.kind === "preview" ? t.preview : t.lastInvoice}
            </h2>
            {inv ? <Badge tone={inv.kind === "preview" ? "neutral" : "success"}>{inv.kind === "preview" ? t.notIssued : t.issued}</Badge> : null}
          </div>
          {inv && doc ? (
            <div lang={inv.language} className="flex flex-col gap-3 text-sm">
              <div className="text-fg-secondary">
                <p className="font-semibold text-fg">{view.shop.legalName}</p>
                <p>{view.shop.address}</p>
                {view.shop.registrant ? (
                  <p className="font-mono text-xs">
                    {doc.gstNo} {view.shop.gstNumber} · {doc.qstNo} {view.shop.qstNumber}
                  </p>
                ) : (
                  <p className="text-xs">{doc.smallSupplier}</p>
                )}
                <p className="mt-1">
                  {inv.number ? `${doc.number} ${inv.number} · ` : ""}
                  {doc.date} {inv.issuedOn}
                  {inv.client ? ` · ${inv.client}` : ""}
                </p>
              </div>
              <ul className="flex flex-col gap-1" aria-label={doc.lines}>
                {inv.totals.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-fg">
                      {l.quantity > 1 ? `${l.quantity} × ` : ""}
                      {l.description}
                    </span>
                    <span className="font-mono text-fg">{money(l.amountCents, inv.language)}</span>
                  </li>
                ))}
              </ul>
              <DescriptionList
                items={[
                  { term: doc.subtotal, details: <span className="font-mono">{money(inv.totals.subtotalCents, inv.language)}</span> },
                  { term: doc.gst, details: <span className="font-mono">{money(inv.totals.gstCents, inv.language)}</span> },
                  { term: doc.qst, details: <span className="font-mono">{money(inv.totals.qstCents, inv.language)}</span> },
                  { term: doc.total, details: <strong className="font-mono text-fg">{money(inv.totals.totalCents, inv.language)}</strong> },
                ]}
              />
              <p className="font-mono text-xs text-fg-muted" aria-hidden>
                {formatCents(inv.totals.taxableCents)} × 5 % · × 9,975 %
              </p>
            </div>
          ) : (
            <p className="text-fg-secondary">{t.noInvoice}</p>
          )}
        </Card.Root>
      </div>
    </div>
  );
}
