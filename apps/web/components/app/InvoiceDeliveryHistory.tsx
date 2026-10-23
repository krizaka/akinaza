import type { invoiceDeliveryHistory } from "@akinaza/db";

import { formatDate } from "@/lib/format";
import { format, getDictionary, type Locale } from "@/lib/i18n";

type Delivery = Awaited<ReturnType<typeof invoiceDeliveryHistory>>[number];

export function InvoiceDeliveryHistory({ deliveries, locale }: { deliveries: Delivery[]; locale: Locale }) {
  const t = getDictionary(locale).console.invoices.history;
  if (deliveries.length === 0) return <p className="text-sm text-fg-secondary">{t.none}</p>;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-base font-bold text-fg">{t.title}</h2>
      <ul className="flex flex-col divide-y divide-border-default">
        {deliveries.map((delivery) => (
          <li key={delivery.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
            <span className="text-fg">{delivery.toEmail} · {formatDate(delivery.createdAt.toISOString(), locale, "UTC")}</span>
            <span className="text-fg-secondary">
              {delivery.openedAt ? format(t.opened, { date: formatDate(delivery.openedAt.toISOString(), locale, "UTC") }) : t.notOpened}
              {delivery.revokedAt ? ` · ${t.revoked}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
