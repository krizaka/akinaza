import type { invoiceDetail } from "@akinaza/db";
import Link from "next/link";

import { format, getDictionary, type Locale } from "@/lib/i18n";
import { formatQuantity } from "@/lib/quantity";

export type InvoiceView = NonNullable<Awaited<ReturnType<typeof invoiceDetail>>>;

/**
 * One invoice as the client reads it: in the language of the invoice (not of the screen), with the supplier's GST and QST
 * numbers (what a buyer needs to claim the input tax credits), every line, the taxes to the cent and, for an invoice that
 * is due, its payment terms and due date (krizaka/akinaza#113: a buyer needs them from $500, DORS/91-45 art. 3).
 * Each label and its value are plain text, so the document reads the same as a PDF text layer or a screen reader.
 */
export function InvoiceDocument({ invoice, locale, backHref }: { invoice: InvoiceView; locale: Locale; backHref: string }) {
  const t = getDictionary(invoice.language).console.invoiceDoc;
  const back = getDictionary(locale).console.invoices.back;
  const lang = invoice.language === "fr" ? "fr-CA" : "en-CA";
  const money = (cents: number) => new Intl.NumberFormat(lang, { style: "currency", currency: "CAD" }).format(cents / 100);
  const date = new Date(`${invoice.issuedOn}T12:00:00Z`).toLocaleDateString(lang, { dateStyle: "long", timeZone: "UTC" });
  const due = invoice.dueOn && invoice.termsDays !== null ? new Date(`${invoice.dueOn}T12:00:00Z`).toLocaleDateString(lang, { dateStyle: "long", timeZone: "UTC" }) : null;
  const terms = invoice.termsDays === 0 ? t.termsOnReceipt : invoice.termsDays === 1 ? t.termsNetOne : format(t.termsNet, { days: invoice.termsDays ?? 0 });
  return (
    <article lang={invoice.language} className="flex max-w-3xl flex-col gap-5 rounded-lg border border-border-default bg-surface-1 p-5 sm:p-8" aria-labelledby="invoice-title">
      <p>
        <Link className="text-sm text-fg-accent underline" href={backHref} lang={locale}>
          ← {back}
        </Link>
      </p>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 id="invoice-title" className="font-display text-2xl font-bold text-fg">
          {invoice.creditOf ? t.credit : t.title}
        </h1>
        <dl className="text-right text-sm text-fg-secondary">
          <dt className="sr-only">{t.number}</dt>
          <dd className="font-mono text-base font-semibold text-fg">{invoice.number}</dd>
          <dt className="sr-only">{t.date}</dt>
          <dd>{date}</dd>
        </dl>
      </header>
      {invoice.creditOf ? <p className="text-sm text-fg-secondary">{t.creditOf}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-label={t.issuedBy}>
          <h2 className="text-xs font-semibold text-fg-muted">{t.issuedBy}</h2>
          <p className="font-semibold text-fg">{invoice.shop.legalName}</p>
          <p className="text-sm text-fg-secondary">{invoice.shop.address}</p>
          {invoice.shop.registrant ? (
            <p className="text-sm text-fg-secondary">
              {t.gstNumber} : <span className="font-mono">{invoice.shop.gstNumber}</span>
              <br />
              {t.qstNumber} : <span className="font-mono">{invoice.shop.qstNumber}</span>
            </p>
          ) : (
            <p className="text-sm text-fg-secondary">{t.unregistered}</p>
          )}
        </section>
        {invoice.client ? (
          <section aria-label={t.billedTo}>
            <h2 className="text-xs font-semibold text-fg-muted">{t.billedTo}</h2>
            <p className="font-semibold text-fg">{invoice.client.fullName}</p>
            <p className="text-sm text-fg-secondary">{[invoice.client.email, invoice.client.phone].filter(Boolean).join(" · ")}</p>
          </section>
        ) : null}
      </div>
      {due ? (
        <dl aria-label={t.terms} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-fg-secondary">{t.terms}</dt>
          <dd className="text-fg">{terms}</dd>
          <dt className="text-fg-secondary">{t.dueOn}</dt>
          <dd className="font-semibold text-fg">{due}</dd>
        </dl>
      ) : null}
      <ul aria-label={t.description} className="flex flex-col divide-y divide-border-default">
        {invoice.lines.map((l) => (
          <li key={l.id} className="grid grid-cols-[1fr_auto] gap-x-4 py-2">
            <span className="text-fg">{l.description}</span>
            <span className="text-right font-mono text-fg">{money(l.amountCents)}</span>
            <span className="text-sm text-fg-muted">
              {t.quantity} {formatQuantity(l.quantityHundredths / 100, invoice.language)} × {money(l.unitPriceCents)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-secondary">{t.subtotal}</dt>
        <dd className="text-right font-mono">{money(invoice.subtotalCents)}</dd>
        <dt className="text-fg-secondary">{t.gst}</dt>
        <dd className="text-right font-mono">{money(invoice.gstCents)}</dd>
        <dt className="text-fg-secondary">{t.qst}</dt>
        <dd className="text-right font-mono">{money(invoice.qstCents)}</dd>
        <dt className="border-t border-border-default pt-1 font-semibold text-fg">{t.total}</dt>
        <dd className="border-t border-border-default pt-1 text-right font-mono font-semibold text-fg">{money(invoice.totalCents)}</dd>
      </dl>
      <p className="text-xs text-fg-muted">{t.footer}</p>
    </article>
  );
}
