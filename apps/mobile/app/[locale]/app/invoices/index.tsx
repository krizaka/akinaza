import { useQuery } from "@krizaka/query";
import { Badge, Button, Card, EmptyState, Screen, Txt } from "@krizaka/ui/native";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { queries } from "@/config";
import { dollars } from "@/domain/money";
import { routes } from "@/domain/links";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { useLocale } from "@/use-locale";

/** The shop's invoices, newest first, and the way to a new one. */
export default function Invoices() {
  const { t } = useI18n();
  const { locale } = useLocale();
  const router = useRouter();
  const invoices = useQuery(queries.invoices());
  return (
    <Screen header={<AppHeader title={t("invoices.title")} />}>
      <Button variant="primary" label={t("invoices.new")} onPress={() => router.navigate(routes.newInvoice(locale) as never)} />
      {invoices.data?.length === 0 ? <EmptyState title={t("invoices.empty")} /> : null}
      {invoices.isError ? <Txt tone="danger">{t("common.offline")}</Txt> : null}
      {(invoices.data ?? []).map((invoice) => (
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
      ))}
    </Screen>
  );
}
