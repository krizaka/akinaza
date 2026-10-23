import { invoiceDetail } from "@akinaza/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InvoiceDocument } from "@/components/app/InvoiceDocument";
import { ButtonLink } from "@/components/ButtonLink";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/**
 * One invoice as the client reads it: in the language of the invoice (not of the screen), with the supplier's GST and QST
 * numbers (what a buyer needs to claim the input tax credits), every line, and the taxes to the cent.
 */
export default async function InvoicePage({ params }: { params: Promise<{ locale: string; shop: string; id: string }> }) {
  const { locale: raw, shop: shopId, id } = await params;
  const locale = asLocale(raw);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { shop } = await memberShop(shopId, "invoices");
  const invoice = await invoiceDetail(db(), shop.id, id);
  if (!invoice) notFound();
  const routes = shopRoutes(locale, shop.id);
  const t = getDictionary(locale).console.invoices;
  // An invoice that still stands can be corrected (#207); a credit note or an already credited invoice cannot.
  const correctable = !invoice.creditOf && !invoice.creditedBy;
  const chain = [
    invoice.replaces ? { href: routes.invoice(invoice.replaces.id), text: format(t.chain.replaces, { number: invoice.replaces.number }) } : null,
    invoice.replacedBy ? { href: routes.invoice(invoice.replacedBy.id), text: format(t.chain.replacedBy, { number: invoice.replacedBy.number }) } : null,
    invoice.creditedBy && !invoice.replacedBy ? { href: routes.invoice(invoice.creditedBy.id), text: format(t.chain.creditedBy, { number: invoice.creditedBy.number }) } : null,
  ].filter((c): c is { href: string; text: string } => c !== null);
  return (
    <div className="flex flex-col gap-3">
      {correctable || chain.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul className="flex flex-col gap-1 text-sm text-fg-secondary">
            {chain.map((c) => (
              <li key={c.href}>
                <Link className="text-fg-accent underline" href={c.href}>
                  {c.text}
                </Link>
              </li>
            ))}
          </ul>
          {correctable ? (
            <ButtonLink href={routes.invoiceCorrect(invoice.id)} variant="secondary" size="sm">
              {t.actions.correct}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
      <InvoiceDocument invoice={invoice} locale={locale} backHref={routes.invoices} />
    </div>
  );
}
