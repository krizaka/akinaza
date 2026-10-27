import { useQuery } from "@krizaka/query";
import { Badge, Button, Card, Grid, Screen, Txt } from "@krizaka/ui/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";

import { queries } from "@/config";
import { actionText, meaningText, type Say, toneOf, valueText } from "@/domain/figures";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { FigureDetail } from "@/ui/FigureDetail";
import { QueryStates } from "@/ui/QueryStates";
import { useLocale } from "@/use-locale";
import { useShop } from "@/use-shop";

// @fixed: a figure's card is a sentence wide at least; the grid puts as many side by side as the screen's size class affords
const CARD_MIN_WIDTH = 280;
const URGENCY_TONE = { now: "danger", soon: "warning", week: "neutral" } as const;

/**
 * Vos chiffres (`/fr/app/<shop>/figures`): « what to do now » and the figures, each saying what it means, how it is computed from the
 * invoices and where it comes from (`GET /api/walker/figures`, #260). Akinaza prepares the figures; the merchant checks them and files
 * the returns themselves. The grid follows the size class: one column on a phone, more on a tablet.
 */
export default function Figures() {
  const { t: typed } = useI18n();
  // The figures speak through keys built from the data (`figures.${id}.name`): the catalogue is checked by its own test.
  const t = typed as unknown as Say;
  const { locale } = useLocale();
  const shop = useShop();
  const { figure: openId } = useLocalSearchParams<{ figure?: string }>();
  const router = useRouter();
  const figures = useQuery(queries.figures(shop));
  return (
    <Screen header={<AppHeader title={t("figures.title")} />} onRefresh={() => void figures.refetch()} refreshing={figures.isRefetching}>
      <QueryStates query={figures}>
        {(f) => {
          const open = f.figures.find((figure) => figure.id === openId);
          if (open) return <FigureDetail figure={open} now={new Date().toISOString()} onBack={() => router.setParams({ figure: undefined })} />;
          return (
          <>
            <Txt tone="secondary">{t("figures.lead")}</Txt>
            <Txt tone="muted" variant="caption">{t("figures.periodLabel", { start: f.period.start, end: f.period.end })}</Txt>
            <Txt variant="label">{t("figures.nextTitle")}</Txt>
            {f.actions.length === 0 ? <Txt tone="muted">{t("figures.nothingToDo")}</Txt> : null}
            {f.actions.map((action) => {
              const words = actionText(action, t, locale);
              return (
                <Card.Root key={`${action.kind}:${action.evidence[0] ?? ""}`}>
                  <Card.Body>
                    <Badge tone={URGENCY_TONE[action.urgency]}>{t(`figures.urgency.${action.urgency}`)}</Badge>
                    <Txt variant="label">{words.title}</Txt>
                    <Txt tone="secondary">{words.why}</Txt>
                  </Card.Body>
                </Card.Root>
              );
            })}
            <Grid minItemWidth={CARD_MIN_WIDTH} aria-label={t("figures.title")}>
              {f.figures.map((figure) => (
                <Card.Root key={figure.id}>
                  <Card.Body>
                    <Txt variant="label" testID={`figure-name-${figure.id}`}>{t(`figures.${figure.id}.name`)}</Txt>
                    <Txt variant="title" testID={`figure-${figure.id}`}>{valueText(figure, locale)}</Txt>
                    <Badge tone={toneOf(figure.state)}>{t(`figures.state.${figure.state}`)}</Badge>
                    <Txt>{meaningText(figure, t)}</Txt>
                    <Button testID={`figure-details-${figure.id}`} variant="ghost" size="sm" label={t("figures.details")} onPress={() => router.setParams({ figure: figure.id })} />
                  </Card.Body>
                </Card.Root>
              ))}
            </Grid>
            <Txt tone="muted" variant="caption">{t("figures.never")}</Txt>
          </>
          );
        }}
      </QueryStates>
    </Screen>
  );
}
