import { demoLooksOf } from "@akinaza/core";
import Link from "next/link";

import { type Locale, translator } from "@/lib/i18n";

const LOOK_WORDS = { compact: "console.shopPage.looks.compact", editorial: "console.shopPage.looks.editorial", gallery: "console.shopPage.looks.gallery", route: "console.shopPage.looks.route", journal: "console.shopPage.looks.journal" } as const;

/**
 * « See it another way » (akinaza#404): on the demo shops ONLY (`demoLooksOf` is empty for any other shop, and then nothing is drawn), the other
 * compositions of Krizaka UI for the same shop. A plain list of links (`?look=`), so it works without JavaScript and the current look says so.
 */
export function DemoLookSwitch({ slug, current, path, locale }: Readonly<{ slug: string; current: string; path: string; locale: Locale }>) {
  const looks = demoLooksOf(slug);
  if (looks.length < 2) return null;
  const t = translator(locale);
  return (
    <nav aria-label={t("console.shopPage.looks.label")} data-demo-looks className="mx-auto flex w-full max-w-(--kz-page-max,72rem) flex-wrap items-center gap-x-4 gap-y-2 px-(--kz-page-gutter,1rem) pb-3 pt-24 text-sm">
      <span className="font-semibold text-fg">{t("console.shopPage.looks.label")}</span>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {looks.map((look, i) => (
          <li key={look.id}>
            <Link href={i === 0 ? path : `${path}?look=${look.id}`} scroll={false} aria-current={current === look.id ? "true" : undefined} data-look={look.id} className="inline-flex min-h-11 items-center rounded-md border border-border-default px-3 font-semibold text-fg-accent aria-[current=true]:bg-surface-2 aria-[current=true]:text-fg">
              {t(LOOK_WORDS[look.id as keyof typeof LOOK_WORDS])}
            </Link>
          </li>
        ))}
      </ul>
      <span className="text-fg-muted">{t("console.shopPage.looks.note")}</span>
    </nav>
  );
}
