import { ComparisonTable } from "@krizaka/ui/comparison-table";
import { Section } from "@krizaka/ui/page";

import { getDictionary, type Locale } from "@/lib/i18n";
import { COMPARE_ROWS } from "@/lib/landing";

/** Akinaza next to the usual stack (a diary, a spreadsheet, an accountant) — fair: the stack works, the accountant still files. */
export function ComparisonSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.compare;
  const rows = COMPARE_ROWS.map((id) => ({ id, topic: t.rows[id].topic, answers: { akinaza: t.rows[id].akinaza, stack: t.rows[id].stack } }));
  return (
    <Section id="compare" eyebrow={t.eyebrow} title={t.title} lead={t.lead} reveal divider>
      <ComparisonTable label={t.label} topicLabel={t.topic} columns={[{ id: "akinaza", label: t.columns.akinaza }, { id: "stack", label: t.columns.stack }]} highlight="akinaza" rows={rows} />
    </Section>
  );
}
