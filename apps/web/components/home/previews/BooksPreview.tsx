import { PreviewFrame } from "@/components/home/previews/PreviewFrame";
import { formatMoney } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/i18n";
import { DEMO_RETURN } from "@/lib/landing-demo";

type LineId = (typeof DEMO_RETURN)[number]["line"];

/** « Your tax report, ready »: the lines of the return (FPZ-500) with the labels of the books screen, on the demo invoice. Prepared for the merchant to file; never filed by Akinaza. */
export function BooksPreview({ locale }: Readonly<{ locale: Locale }>) {
  const d = getDictionary(locale);
  const books = d.console.books;
  const label = (line: LineId) => books.lines[line].label;
  return (
    <PreviewFrame alt={d.landing.screens.books.alt} demo={d.landing.preview.demo}>
      <p className="m-0 mb-2 text-sm font-semibold text-fg">{books.table.caption}</p>
      <dl className="m-0 grid grid-cols-[auto_1fr_auto] gap-x-3 text-sm">
        {DEMO_RETURN.map((r) => (
          <div key={r.line} className="col-span-3 grid grid-cols-subgrid border-t border-border-default py-1.5">
            <dt className="font-mono text-fg-muted">{r.line}</dt>
            <dd className="m-0 text-fg">{label(r.line)}</dd>
            <dd className="m-0 text-right tabular-nums text-fg">{formatMoney(r.cents, locale)}</dd>
          </div>
        ))}
      </dl>
    </PreviewFrame>
  );
}
