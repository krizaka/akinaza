import { AmountRow, PreviewFrame } from "@/components/home/previews/PreviewFrame";
import { formatMoney } from "@/lib/format";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { demoInvoice } from "@/lib/landing-demo";

/** « The invoice, taxes included »: a line billed becomes an invoice with GST and QST worked out to the cent, and its total. */
export function InvoicePreview({ locale }: Readonly<{ locale: Locale }>) {
  const t = getDictionary(locale).landing;
  const invoice = demoInvoice(locale);
  const money = (cents: number) => formatMoney(cents, locale);
  const figures = { line: t.preview.invoiceLine, subtotal: money(invoice.subtotalCents), gst: money(invoice.gstCents), qst: money(invoice.qstCents), total: money(invoice.totalCents) };
  return (
    <PreviewFrame
      alt={format(t.screens.invoice.alt, figures)}
      demo={t.preview.demo}
      action={{ label: t.preview.invoice.action, body: <AmountRow label={figures.line} amount={figures.subtotal} /> }}
      result={{
        label: t.preview.invoice.result,
        body: (
          <div className="flex flex-col gap-1">
            <AmountRow label={t.preview.invoice.gst} amount={figures.gst} />
            <AmountRow label={t.preview.invoice.qst} amount={figures.qst} />
            <AmountRow label={t.preview.invoice.total} amount={figures.total} strong />
          </div>
        ),
      }}
    />
  );
}
