import { AmountRow, PreviewFrame } from "@/components/home/previews/PreviewFrame";
import { formatMoney } from "@/lib/format";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { DEMO_RETURN } from "@/lib/landing-demo";

/** The three figures a merchant carries to the return: sales, net GST, net QST. */
const KEY_LINES = ["101", "109", "209"] as const;

/** « Your tax report, ready »: the quarter's invoices and expenses become the three figures of the return. Prepared for the merchant to file; never filed by Akinaza. */
export function BooksPreview({ locale }: Readonly<{ locale: Locale }>) {
  const d = getDictionary(locale);
  const t = d.landing;
  const amount = (line: (typeof KEY_LINES)[number]) => formatMoney(DEMO_RETURN.find((r) => r.line === line)?.cents ?? 0, locale);
  const label = (line: (typeof KEY_LINES)[number]) => d.console.books.lines[line].label;
  return (
    <PreviewFrame
      alt={format(t.screens.books.alt, { sales: amount("101"), gst: amount("109"), qst: amount("209") })}
      demo={t.preview.demo}
      action={{ label: t.preview.books.action, body: t.preview.books.input }}
      result={{
        label: t.preview.books.result,
        body: (
          <div className="flex flex-col gap-1">
            {KEY_LINES.map((line) => (
              <AmountRow key={line} label={label(line)} amount={amount(line)} />
            ))}
          </div>
        ),
      }}
    />
  );
}
