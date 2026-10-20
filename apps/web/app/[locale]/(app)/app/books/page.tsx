import { prepareShopReturn, shopDay, shopOfOwner } from "@akinaza/db";
import { Alert } from "@krizaka/ui/alert";
import { Stat } from "@krizaka/ui/stat";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BooksLines } from "@/components/app/BooksLines";
import { pageSession } from "@/lib/access";
import { booksView, periodChoices, periodFor } from "@/lib/books";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary } from "@/lib/i18n";

const CHIP = "rounded-full border border-border-default px-3 py-1 text-sm text-fg-secondary";
const CHIP_ON = "rounded-full border border-border-accent bg-surface-2 px-3 py-1 text-sm font-semibold text-fg";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.books };
}

/**
 * « Vos livres »: the GST/QST return of a period, prepared from the shop's invoices and expenses, every figure with its
 * sources. It prepares; the merchant reviews and files it themselves with Revenu Québec — nothing is sent from here.
 */
export default async function Books({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ period?: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  const t = getDictionary(locale).console.books;
  const today = await shopDay(db(), shop.id, new Date());
  const period = periodFor((await searchParams).period, today);
  const prepared = await prepareShopReturn(db(), shop.id, period.start, period.end);
  const view = booksView(prepared);
  const lang = locale === "fr" ? "fr-CA" : "en-CA";
  const money = (cents: number) => new Intl.NumberFormat(lang, { style: "currency", currency: "CAD" }).format(cents / 100);
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang, { dateStyle: "long", timeZone: "UTC" });
  const nets = [
    { key: "gst", net: view.gst },
    { key: "qst", net: view.qst },
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{t.title}</h1>
        <p className="text-fg-secondary">{format(t.period, { from: day(period.start), to: day(period.end) })}</p>
      </header>
      <nav aria-label={t.periodNav} className="flex flex-wrap gap-2">
        {periodChoices(today).map((p) => (
          <Link key={p.id} href={`/${locale}/app/books?period=${p.id}`} aria-current={p.id === period.id ? "page" : undefined} className={p.id === period.id ? CHIP_ON : CHIP}>
            {p.id.replace("-", " ")}
          </Link>
        ))}
      </nav>
      <Alert tone="info" title={t.notFiled.title}>
        {t.notFiled.body}
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        {nets.map(({ key, net }) => (
          <Stat key={key} label={t.net[key]} value={money(net.netCents)} hint={t.outcome[net.outcome]} />
        ))}
      </div>
      <BooksLines lines={view.lines} />
      <p className="text-sm text-fg-muted">{t.footnote}</p>
    </div>
  );
}
