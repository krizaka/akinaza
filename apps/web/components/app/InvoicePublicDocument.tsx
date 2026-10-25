import { invoiceState, remainingCents } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import Link from "next/link";

import { InvoiceDocument, type InvoiceView } from "@/components/app/InvoiceDocument";
import { format, getDictionary, type Locale } from "@/lib/i18n";

export function InvoicePublicDocument({ invoice, locale, today, token }: { invoice: InvoiceView & { paidCents: number }; locale: Locale; today: string; token?: string }) {
  const t = getDictionary(locale).console.invoicePublic;
  const balance = remainingCents({ totalCents: invoice.totalCents, paidCents: invoice.paidCents, dueOn: invoice.dueOn, isCredit: !!invoice.creditOf, superseded: !!invoice.replacedBy || !!invoice.creditedBy });
  const state = invoiceState({ totalCents: invoice.totalCents, paidCents: invoice.paidCents, dueOn: invoice.dueOn, isCredit: !!invoice.creditOf, superseded: !!invoice.replacedBy || !!invoice.creditedBy }, today);
  const language = invoice.language === "fr" ? "fr-CA" : "en-CA";
  const money = new Intl.NumberFormat(language, { style: "currency", currency: "CAD" });
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-6 sm:px-8">
      {invoice.replacedBy ? <Alert tone="warning">{format(t.replaced, { number: invoice.replacedBy.number })} {invoice.clientId ? <Link className="text-fg-accent underline" href={token ? `/${locale}/invoice/${token}?replacement=${invoice.replacedBy.id}` : `/${locale}/app/invoices/${invoice.replacedBy.id}`}>{t.openReplacement}</Link> : null}</Alert> : null}
      {invoice.replaces ? <Alert tone="info">{format(t.replaces, { number: invoice.replaces.number })} {invoice.clientId ? <Link className="text-fg-accent underline" href={token ? `/${locale}/invoice/${token}` : `/${locale}/app/invoices/${invoice.replaces.id}`}>{t.openOriginal}</Link> : null}</Alert> : null}
      {invoice.creditedBy ? <Alert tone="warning">{format(t.credited, { number: invoice.creditedBy.number })}</Alert> : null}
      <InvoiceDocument invoice={invoice} locale={locale} />
      <section className="rounded-lg border border-border-default bg-surface-1 p-5" aria-label={t.payment}>
        <h2 className="font-display text-lg font-bold text-fg">{t.payment}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-fg-secondary">{t.received}</dt><dd className="text-right tabular-nums text-fg">{money.format(invoice.paidCents / 100)}</dd>
          <dt className="text-fg-secondary">{t.balance}</dt><dd className="text-right font-semibold tabular-nums text-fg">{money.format(balance / 100)}</dd>
          <dt className="text-fg-secondary">{t.state}</dt><dd className="text-right text-fg">{t.states[state]}</dd>
        </dl>
        <p className="mt-3 text-sm text-fg-secondary">{invoice.termsDays === 0 ? t.payOnReceipt : invoice.termsDays ? format(t.terms, { days: invoice.termsDays }) : t.noTerms}</p>
        {invoice.shop.publicEmail ? <p className="mt-2 text-sm text-fg-secondary">{t.contact} <a className="text-fg-accent underline" href={`mailto:${invoice.shop.publicEmail}`}>{invoice.shop.publicEmail}</a></p> : null}
      </section>
    </main>
  );
}
