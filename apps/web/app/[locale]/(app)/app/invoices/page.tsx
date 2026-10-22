import { listInvoices, shopOfOwner } from "@akinaza/db";
import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ButtonLink";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.invoices };
}

/** The issued invoices (each opens as a document), and the one primary action: a new invoice, on its own address. */
export default async function Invoices({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  const t = getDictionary(locale).console.invoices;
  const issued = await listInvoices(db(), shop.id);
  const lang = locale === "fr" ? "fr-CA" : "en-CA";
  const money = (cents: number) => new Intl.NumberFormat(lang, { style: "currency", currency: "CAD" }).format(cents / 100);
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang, { dateStyle: "long", timeZone: "UTC" });
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-fg">{t.title}</h1>
        <ButtonLink href={`/${locale}/app/invoices/new`} variant="primary" size="md">
          {t.new.title}
        </ButtonLink>
      </header>
      <section aria-label={t.list.title} className="flex flex-col gap-3">
        {issued.length === 0 ? (
          <p className="text-fg-secondary">{t.list.none}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {issued.map((i) => (
              <li key={i.id}>
                <Card.Root className="flex h-full flex-col gap-1 p-4">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link className="font-mono font-semibold text-fg-accent underline" href={`/${locale}/app/invoices/${i.id}`} aria-label={format(t.list.open, { number: i.number })}>
                      {i.number}
                    </Link>
                    {i.creditOf ? <Badge tone="warning">{t.list.credit}</Badge> : null}
                    <Badge tone="neutral">{i.language.toUpperCase()}</Badge>
                  </p>
                  <p className="text-sm text-fg-secondary">
                    {i.client ?? t.list.noClient} · {day(i.issuedOn)}
                    {i.dueOn ? ` · ${format(t.list.dueOn, { date: day(i.dueOn) })}` : ""}
                  </p>
                  <p className="text-sm text-fg-muted">
                    {money(i.subtotalCents)} + {money(i.gstCents)} + {money(i.qstCents)}
                  </p>
                  <p className="font-semibold text-fg">{format(t.list.total, { amount: money(i.totalCents) })}</p>
                </Card.Root>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
