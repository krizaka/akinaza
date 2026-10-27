import { type FigureAnswer, isStale, LEXICON } from "@akinaza/core";
import { Badge, Button, Card, Txt } from "@krizaka/ui/native";
import * as React from "react";
import { ScrollView } from "react-native";

import { LANGUAGE_TAG } from "@/domain/day";
import { formulaText, meaningText, type Say, sourcesText, toneOf, valueText } from "@/domain/figures";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

const ACCOUNTANT = new Set<string>(LEXICON.filter((term) => term.accountant).map((term) => term.id));

/**
 * One figure opened (`figures?figure=<id>`): its value and state, what it means, how it is computed here, where it comes from,
 * how fresh it is, and the lexique's words it uses — the same wording as the web's console (`console.lexicon`).
 */
export function FigureDetail({ figure, now, onBack }: { figure: FigureAnswer; now: string; onBack: () => void }) {
  const { t: typed } = useI18n();
  const t = typed as unknown as Say;
  const { locale } = useLocale();
  const terms = figure.lexicon.filter((id) => LEXICON.some((term) => term.id === id));
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Button variant="ghost" label={t("figures.backToList")} onPress={onBack} />
      <Txt variant="label">{t(`figures.${figure.id}.name`)}</Txt>
      <Txt variant="title">{valueText(figure, locale)}</Txt>
      <Badge tone={toneOf(figure.state)}>{t(`figures.state.${figure.state}`)}</Badge>
      <Txt>{meaningText(figure, t)}</Txt>
      <Txt variant="label">{t("figures.howComputed")}</Txt>
      <Txt tone="secondary">{formulaText(figure, t, locale)}</Txt>
      <Txt variant="label">{t("figures.whereFrom")}</Txt>
      <Txt tone="secondary">{sourcesText(figure, t)}</Txt>
      <Txt tone="muted" variant="caption">{t("figures.updated", { when: new Date(figure.computedAt).toLocaleString(LANGUAGE_TAG[locale], { dateStyle: "medium", timeStyle: "short" }) })}</Txt>
      {isStale(figure, now) ? <Txt tone="muted" variant="caption">{t("figures.stale")}</Txt> : null}
      {terms.length > 0 ? <Txt variant="label">{t("figures.lexiconTitle")}</Txt> : null}
      {terms.map((id) => (
        <Card.Root key={id}>
          <Card.Body>
            <Txt variant="label">{t(`lexicon.terms.${id}.term`)}</Txt>
            <Txt>{t(`lexicon.terms.${id}.definition`)}</Txt>
            {ACCOUNTANT.has(id) ? <Txt tone="muted" variant="caption">{t("lexicon.accountant")}</Txt> : null}
          </Card.Body>
        </Card.Root>
      ))}
    </ScrollView>
  );
}
