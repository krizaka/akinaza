import { useQuery } from "@krizaka/query";
import { Badge, Button, Card, Screen, Txt } from "@krizaka/ui/native";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { queries } from "@/config";
import { routes } from "@/domain/links";
import { dollars } from "@/domain/money";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { QueryStates } from "@/ui/QueryStates";
import { useLocale } from "@/use-locale";
import { useShop } from "@/use-shop";

/** Factures: the shop's invoices, newest first, and the screen's one primary — a new invoice. */
export default function Invoices() {
  const { t } = useI18n();
  const { locale } = useLocale();
  const shop = useShop();
  const router = useRouter();
  const invoices = useQuery(queries.invoices(shop));
  return (
    <Screen header={<AppHeader title={t("invoices.title")} />}>
      <Button variant="primary" label={t("invoices.new")} onPress={() => router.navigate(routes.newInvoice(locale, shop) as never)} />
      <QueryStates query={invoices} isEmpty={(all) => all.length === 0} empty={{ title: t("invoices.empty"), description: t("invoices.emptyLead") }}>
        {(all) =>
          all.map((invoice) => (
            <Card.Root key={invoice.id}>
              <Card.Body>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Txt variant="label">{String(invoice.number)}</Txt>
                  {invoice.creditOf ? <Badge tone="warning">{t("invoices.credit")}</Badge> : null}
                </View>
                <Txt tone="secondary">{`${invoice.client ?? t("invoices.noClient")} · ${invoice.issuedOn}`}</Txt>
                <Txt>{`${t("invoices.total")} ${dollars(invoice.totalCents, locale)}`}</Txt>
              </Card.Body>
            </Card.Root>
          ))
        }
      </QueryStates>
    </Screen>
  );
}
