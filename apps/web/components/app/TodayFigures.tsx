import type { Figure, FigureId } from "@akinaza/core";

import { getDictionary, type Locale } from "@/lib/i18n";
import type { ShopRoutes } from "@/lib/routes";

import { FiguresPanel } from "./FiguresPanel";

/** The three figures a day starts from: what is owed, how many appointments, how many did not come. The rest lives on the books and the Monday brief. */
export const TODAY_FIGURES = ["toCollect", "appointments", "noShows"] as const satisfies readonly FigureId[];

/** The figure cards of Today (#260): the same explained figures as the books, a heading above, nothing fetched here. */
export function TodayFigures({ figures, locale, routes, timeZone, now }: Readonly<{ figures: Record<FigureId, Figure>; locale: Locale; routes: ShopRoutes; timeZone: string; now: string }>) {
  const t = getDictionary(locale).console.figures;
  return (
    <section aria-labelledby="today-figures" className="flex flex-col gap-2" data-testid="today-figures">
      <h2 id="today-figures" className="text-lg font-semibold">{t.todayTitle}</h2>
      <p className="text-sm text-fg-muted">{t.todayLead}</p>
      <FiguresPanel ids={TODAY_FIGURES} figures={figures} locale={locale} routes={routes} timeZone={timeZone} now={now} />
    </section>
  );
}
