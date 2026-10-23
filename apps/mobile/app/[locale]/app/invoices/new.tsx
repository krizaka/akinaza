import { type InvoiceLine, previewTotals } from "@akinaza/client";
import { useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Button, Card, Chip, Header, Screen, TextField, Txt } from "@krizaka/ui/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { akinaza, queries } from "@/config";
import { routes } from "@/domain/links";
import { dollars } from "@/domain/money";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

/** A quick invoice: pick services and quantities, see GST and QST to the cent, issue it. The server's tax code decides; this previews it. */
export default function NewInvoice() {
  const { client } = useLocalSearchParams<{ client?: string }>();
  const { t } = useI18n();
  const { locale } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const shop = useQuery(queries.shop());
  const clients = useQuery(queries.clients());
  const [lines, setLines] = React.useState<InvoiceLine[]>([]);
  const [serviceId, setServiceId] = React.useState<string | null>(null);
  const [quantity, setQuantity] = React.useState("1");
  const services = shop.data?.services ?? [];
  const registrant = shop.data?.shop.registrant ?? true;
  const totals = previewTotals(lines, services, registrant);
  const clientName = clients.data?.find((c) => c.id === client)?.fullName;

  const issue = useMutation({
    mutationFn: () => akinaza.issueInvoice({ clientId: client ?? null, language: locale, issuedOn: new Date().toISOString().slice(0, 10), lines }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queries.invoices().queryKey });
      router.replace(routes.invoices(locale) as never);
    },
  });

  const addLine = () => {
    const units = Number(quantity.replace(",", "."));
    if (!serviceId || !(units > 0)) return;
    setLines((current) => [...current, { serviceId, quantity: units }]);
    setServiceId(null);
    setQuantity("1");
  };

  return (
    <Screen header={<Header title={t("invoices.new")} backLabel={t("common.back")} onBack={() => router.back()} size="inline" />}>
      <Txt tone="secondary">{`${t("invoices.client")} : ${clientName ?? t("invoices.noClient")}`}</Txt>
      <Txt variant="label">{t("invoices.service")}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {services.map((service) => (
          <Chip key={service.id} selected={serviceId === service.id} onSelectedChange={() => setServiceId(service.id)}>
            {`${locale === "fr" ? service.nameFr : service.nameEn} · ${dollars(service.priceCents, locale)}`}
          </Chip>
        ))}
      </View>
      <TextField label={t("invoices.quantity")} value={quantity} onValueChange={setQuantity} keyboardType="decimal-pad" />
      <Button variant="secondary" label={t("invoices.addLine")} disabled={!serviceId} onPress={addLine} />
      {lines.length ? (
        <Card.Root>
          <Card.Body>
            <Txt variant="label">{t("invoices.lines")}</Txt>
            {lines.map((line, index) => (
              <Txt key={index}>{"serviceId" in line ? `${line.quantity} × ${locale === "fr" ? services.find((s) => s.id === line.serviceId)?.nameFr : services.find((s) => s.id === line.serviceId)?.nameEn}` : line.description}</Txt>
            ))}
          </Card.Body>
        </Card.Root>
      ) : null}
      {totals ? (
        <Card.Root>
          <Card.Body>
            <Txt>{`${t("invoices.subtotal")} ${dollars(totals.subtotalCents, locale)}`}</Txt>
            {registrant ? <Txt>{`${t("invoices.gst")} ${dollars(totals.gstCents, locale)}`}</Txt> : <Txt tone="muted">{t("invoices.smallSupplier")}</Txt>}
            {registrant ? <Txt>{`${t("invoices.qst")} ${dollars(totals.qstCents, locale)}`}</Txt> : null}
            <Txt variant="label">{`${t("invoices.total")} ${dollars(totals.totalCents, locale)}`}</Txt>
          </Card.Body>
        </Card.Root>
      ) : null}
      {issue.isError ? <Txt tone="danger">{t("invoices.failed")}</Txt> : null}
      <Button variant="primary" label={t("invoices.issue")} disabled={!lines.length} loading={issue.isPending} onPress={() => issue.mutate()} />
      <Txt tone="muted" variant="caption">{t("disclaimer")}</Txt>
    </Screen>
  );
}
