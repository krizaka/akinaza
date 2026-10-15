import { formatCents } from "@akinaza/core";
import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";

import { TodayTable } from "@/components/app/TodayTable";
import { pageSession } from "@/lib/access";
import { asLocale, format, getDictionary, type Locale } from "@/lib/i18n";
import { todayView } from "@/lib/today";

const INTL: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };

/**
 * The shop's day: today's appointments, and an invoice with its GST (5 %) and QST (9.975 %) lines — the latest issued one,
 * or a preview of the next. Bilingual by design: the invoice is drawn in its own language (French by default, as the
 * Charter of the French language asks), whatever the language of the page.
 */
export default async function Today({ params }: { params: Promise<{ locale: string }> }) {
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
