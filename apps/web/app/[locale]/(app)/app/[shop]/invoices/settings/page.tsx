// @template: app-settings
import { invoiceMailSettings } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";

import { InvoiceMailSettings } from "@/components/app/InvoiceMailSettings";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.invoices.settings.title };
}

/**
 * The e-mail defaults of the invoices, on their own address for who may set the shop up (docs/ux/2026-10-full-review.md
 * D2: a setting never sits under a list). Boutique's hub (K4) folds this page in as its « Factures » section.
 */
export default async function InvoiceSettingsPage({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale: raw, shop: shopId } = await params;
  const locale = asLocale(raw);
  const { shop } = await memberShop(shopId, "settings");
  const t = getDictionary(locale).console.invoices.settings;
  const mail = await invoiceMailSettings(db(), shop.id);
  return (
    <div className="flex flex-col gap-5">
      <Link className="text-sm text-fg-accent underline" href={shopRoutes(locale, shop.id).invoices}>
        ← {t.back}
      </Link>
      <PageHeader title={t.title} description={t.lead} />
      {mail ? <InvoiceMailSettings initial={mail.shop} /> : null}
    </div>
  );
}
