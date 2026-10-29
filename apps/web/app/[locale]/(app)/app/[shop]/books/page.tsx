// @template: app-dashboard
import { prepareShopReturn, shopDay } from "@akinaza/db";
import { ChipLink } from "@krizaka/ui/chip-link";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";
import { Stat, StatGrid } from "@krizaka/ui/stat";
import type { Metadata } from "next";
import Link from "next/link";

import { BooksLines } from "@/components/app/BooksLines";
import { FiguresPanel } from "@/components/app/FiguresPanel";
import { LexiconSection } from "@/components/app/LexiconSection";
import { PrintInvoiceButton } from "@/components/app/PrintInvoiceButton";
import { ButtonLink } from "@/components/ButtonLink";
import { booksIsEmpty, booksView, periodChoices, periodFor } from "@/lib/books";
import { db } from "@/lib/db";
import { loadFigures } from "@/lib/figures";
import { formatLongDay, formatMoney } from "@/lib/format";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.books };
}

/**
 * « Vos livres »: the GST/QST return of a period, prepared from the shop's invoices and expenses, every figure with its
 * sources. It prepares; the merchant reviews and files it themselves with Revenu Québec — nothing is sent from here.
 */
export default async function Books({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; shop: string }>; searchParams: Promise<{ period?: string }> }>) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { shop } = await memberShop(shopId, "reports");
  const t = getDictionary(locale).console.books;
  const today = await shopDay(db(), shop.id, requestNow());
  const period = periodFor((await searchParams).period, today);
  const prepared = await prepareShopReturn(db(), shop.id, period.start, period.end);
  const { figures } = await loadFigures(shop, today, requestNow(), { start: period.start, end: period.end });
  const routes = shopRoutes(locale, shop.id);
  const view = booksView(prepared);
  const money = (cents: number) => formatMoney(cents, locale);
  const nets = [
    { key: "gst", net: view.gst },
    { key: "qst", net: view.qst },
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} description={format(t.period, { from: formatLongDay(period.start, locale), to: formatLongDay(period.end, locale) })} />
      <nav aria-label={t.periodNav} data-no-print className="flex flex-wrap gap-2">
        {periodChoices(today).map((p) => (
          <ChipLink key={p.id} asChild selected={p.id === period.id} current={p.id === period.id ? "page" : undefined}>
            <Link href={shopRoutes(locale, shop.id).books(p.id)}>{p.id.replace("-", " ")}</Link>
          </ChipLink>
        ))}
      </nav>
      <p className="text-sm text-fg-secondary">{t.periodHint}</p>
      <StatGrid>
        {nets.map(({ key, net }) => (
          <Stat key={key} label={t.net[key]} value={money(net.netCents)} hint={t.outcome[net.outcome]} />
        ))}
      </StatGrid>
      <p className="text-sm text-fg-secondary">{t.remitHint}</p>
      <section aria-labelledby="books-figures" className="flex flex-col gap-3">
        <h2 id="books-figures" className="text-lg font-semibold">{t.figuresTitle}</h2>
        <p className="text-sm text-fg-muted">{getDictionary(locale).console.figures.never}</p>
        <FiguresPanel ids={["gstCollected", "qstCollected", "gstToRemit", "qstToRemit"]} figures={figures} locale={locale} routes={routes} timeZone={shop.timezone} now={requestNow().toISOString()} />
      </section>
      {booksIsEmpty(view) ? (
        <EmptyState icon={<Mascot bird="beaver" mood="empty" size={120} />} title={t.empty.title} description={t.empty.body} action={<ButtonLink href={shopRoutes(locale, shop.id).invoices} variant="secondary" size="sm">{t.empty.action}</ButtonLink>} />
      ) : (
        <BooksLines lines={view.lines} />
      )}
      <p className="text-sm text-fg-muted">{t.footnote}</p>
      <div data-no-print className="flex flex-col gap-1">
        <div><PrintInvoiceButton label={getDictionary(locale).console.figures.print} /></div>
        <p className="text-sm text-fg-muted">{getDictionary(locale).console.figures.printHint}</p>
      </div>
      <LexiconSection locale={locale} />
    </div>
  );
}
