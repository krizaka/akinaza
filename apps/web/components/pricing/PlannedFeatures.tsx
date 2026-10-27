import { Badge } from "@krizaka/ui/badge";

/**
 * What a plan will include but does not run yet (akinaza#440): under its own heading, each line with a « Soon » chip and no tick —
 * the tick of a plan's list means « this runs today », nothing else. Rendered by the pricing page above each plan's action.
 */
export function PlannedFeatures({ title, soon, items }: Readonly<{ title: string; soon: string; items: readonly string[] }>) {
  if (!items.length) return null;
  return (
    <section aria-label={title} data-planned className="mb-4 border-t border-border-subtle pt-3 text-left">
      <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{title}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-fg-secondary">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Badge tone="neutral" data-soon className="shrink-0">
              {soon}
            </Badge>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
