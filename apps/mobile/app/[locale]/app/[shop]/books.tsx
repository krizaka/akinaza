import { useQuery } from "@krizaka/query";
import { Button, Card, Chip, Screen, Txt } from "@krizaka/ui/native";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { queries, webUrl } from "@/config";
import { routes } from "@/domain/links";
import { dollars } from "@/domain/money";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { QueryStates } from "@/ui/QueryStates";
import { useLocale } from "@/use-locale";
import { useShop } from "@/use-shop";

/**
 * Livres (`/fr/app/<shop>/books?period=2026-Q3`), as the web's: the period's GST and QST nets, prepared from the ledger, each
 * to remit or to claim. Akinaza prepares; the merchant reviews and files the return themselves — nothing is sent from here.
 * The lines and their sources stay on the web's page (one link).
 */
export default function Books() {
  const { period } = useLocalSearchParams<{ period?: string }>();
  const { t } = useI18n();
  const { locale } = useLocale();
  const shop = useShop();
  const router = useRouter();
  const books = useQuery(queries.books(period, shop));
  return (
    <Screen header={<AppHeader title={t("books.title")} />}>
      <QueryStates query={books}>
        {(b) => (
          <>
            <Txt tone="secondary">{t("books.period", { from: b.period.start, to: b.period.end })}</Txt>
            <View role="radiogroup" aria-label={t("books.periods")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {b.choices.map((id) => (
                <Chip key={id} selected={id === b.period.id} onSelectedChange={() => router.setParams({ period: id })}>
                  {id.replace("-", " ")}
                </Chip>
              ))}
            </View>
            {(["gst", "qst"] as const).map((tax) => (
              <Card.Root key={tax}>
                <Card.Body>
                  <Txt variant="label">{t(`books.${tax}`)}</Txt>
                  <Txt variant="title">{dollars(b[tax].netCents, locale)}</Txt>
                  <Txt tone="secondary">{t(`books.${b[tax].outcome}`)}</Txt>
                </Card.Body>
              </Card.Root>
            ))}
            <Txt tone="muted" variant="caption">{t("books.lead")}</Txt>
            <Button variant="ghost" label={t("books.web")} onPress={() => void Linking.openURL(webUrl(routes.books(locale, shop, b.period.id)))} />
          </>
        )}
      </QueryStates>
    </Screen>
  );
}
