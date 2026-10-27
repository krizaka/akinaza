import type { Figure, FigureId } from "@akinaza/core";
import { GlossaryTerm } from "@krizaka/ui/glossary-term";
import { KpiExplained } from "@krizaka/ui/kpi-explained";
import Link from "next/link";

import { kpiView } from "@/lib/figures-view";
import { INTL_LOCALE } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { ShopRoutes } from "@/lib/routes";

/**
 * The owner's figures, each one a `KpiExplained` (#260): its plain meaning, its formula with the numbers read from the ledger, where it comes from
 * (a link to the rows), when it was computed and its state against the thresholds the administrator set. The lexique's words used by a figure
 * follow it as glossary terms, the ones that need an accountant marked. Server-rendered: nothing here fetches.
 */
export function FiguresPanel({ ids, figures, locale, routes, timeZone, now }: { ids: readonly FigureId[]; figures: Record<FigureId, Figure>; locale: Locale; routes: ShopRoutes; timeZone: string; now: string }) {
  const t = getDictionary(locale).console;
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="figures">
      {ids.map((id) => {
        const view = kpiView(figures[id], locale, routes);
        return (
          <div key={id} className="flex min-w-0 flex-col gap-2">
            <KpiExplained
              label={view.label}
              value={view.value}
              format={view.kind === "money" ? { type: "money", currency: "CAD" } : { type: "number" }}
              locale={INTL_LOCALE[locale]}
              timeZone={timeZone}
              meaning={view.meaning}
              formulaLabel={t.figures.howComputed}
              formula={view.formula}
              sourceLabel={t.figures.source}
              source={<Link href={view.href} className="underline underline-offset-2">{view.sources}</Link>}
              thresholds={view.thresholds}
              stateLabels={view.stateWords}
              freshness={{ lastRead: view.freshness.lastRead, expectedAt: view.freshness.expectedAt, now, lastReadLabel: t.figures.updatedLabel, staleLabel: t.figures.stale }}
              maskedLabel={view.label}
            />
            {view.lexicon.length ? (
              <p className="text-sm text-fg-muted">
                <span>{t.figures.learnMore} </span>
                {view.lexicon.map((term, i) => (
                  <span key={term.id}>
                    {i ? " · " : ""}
                    <GlossaryTerm term={term.term} definition={term.accountant ? `${term.definition} ${t.lexicon.accountant}` : term.definition} />
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
