import { useQuery } from "@krizaka/query";
import { Button, Card, EmptyState, Screen, SearchField, Txt } from "@krizaka/ui/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";

import { queries } from "@/config";
import { matchesClient } from "@/domain/clients";
import { routes } from "@/domain/links";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { useLocale } from "@/use-locale";

/** The client files (`?q=` filters them, so back, a refresh and a shared link keep the search): a client opens a new invoice for them. */
export default function Clients() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { t } = useI18n();
  const { locale } = useLocale();
  const router = useRouter();
  const clients = useQuery(queries.clients());
  const shown = (clients.data ?? []).filter((client) => matchesClient(client, q ?? ""));
  return (
    <Screen header={<AppHeader title={t("clients.title")} />}>
      <SearchField label={t("clients.search")} clearLabel={t("clients.clear")} value={q ?? ""} onValueChange={(next) => router.setParams({ q: next || undefined })} />
      {clients.data && shown.length === 0 ? <EmptyState title={t("clients.empty")} /> : null}
      {clients.isError ? <Txt tone="danger">{t("common.offline")}</Txt> : null}
      {shown.map((client) => (
        <Card.Root key={client.id}>
          <Card.Body>
            <Txt variant="label">{client.fullName}</Txt>
            {client.phone ? <Txt tone="secondary">{client.phone}</Txt> : null}
            {client.email ? <Txt tone="secondary">{client.email}</Txt> : null}
            {client.dependants.length ? <Txt tone="muted" variant="caption">{`${t("clients.dependants", { count: client.dependants.length })} : ${client.dependants.map((d) => d.name).join(", ")}`}</Txt> : null}
            <Button size="sm" variant="secondary" label={t("clients.invoice")} onPress={() => router.navigate(routes.newInvoice(locale, client.id) as never)} />
          </Card.Body>
        </Card.Root>
      ))}
    </Screen>
  );
}
