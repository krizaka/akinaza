import { InvoiceDocument } from "@/components/app/InvoiceDocument";
import { PreviewFrame } from "@/components/home/previews/PreviewFrame";
import { getDictionary, type Locale } from "@/lib/i18n";
import { demoInvoice } from "@/lib/landing-demo";

/** « The invoice, taxes included »: the app's own invoice document (`InvoiceDocument`), GST and QST to the cent, on a demo invoice. */
export function InvoicePreview({ locale }: Readonly<{ locale: Locale }>) {
  const d = getDictionary(locale).landing;
  return (
    <PreviewFrame alt={d.screens.invoice.alt} demo={d.preview.demo}>
      <div className="origin-top-left scale-[0.8] [&_article]:max-w-none [&_article]:border-0 [&_article]:p-2">
        <InvoiceDocument invoice={demoInvoice(locale)} locale={locale} heading="h2" />
      </div>
    </PreviewFrame>
  );
}
