import { describePrices } from "@krizaka/settings";

import { systemClock } from "@/app/system-clock";
import { PriceEntryAdmin } from "@/components/admin/PriceEntryAdmin";
import { asLocale, translator } from "@/lib/i18n";
import { appPrices } from "@/lib/price-catalogue";

export const dynamic = "force-dynamic";

/** The administrator's catalogue of prices (akinaza#371, ADR-009): each entry in force, a change from a date, the history. */
export default async function AdminPrices({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const t = translator(asLocale((await params).locale));
  const catalogue = appPrices();
  const described = await describePrices(catalogue, systemClock.now());
  const histories = await Promise.all(described.entries.map((e) => catalogue.history(e.key)));
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{t("console.admin.prices.title")}</h1>
        <p className="max-w-prose text-fg-secondary">{t("console.admin.prices.lead")}</p>
      </header>
      {described.entries.map((entry, i) => (
        <PriceEntryAdmin key={entry.key} entry={entry} history={histories[i] ?? []} availabilities={described.availabilities} />
      ))}
    </div>
  );
}
