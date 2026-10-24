import { useQuery } from "@krizaka/query";
import { Button, Card, EmptyState, Screen, Txt } from "@krizaka/ui/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { queries } from "@/config";
import { routes } from "@/domain/links";
import { isMonth, monthOf, monthRange, shiftMonth } from "@/domain/month";
import { localDay } from "@akinaza/core";
import { DEFAULT_TIMEZONE } from "@/domain/day";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { useLocale } from "@/use-locale";

/** The owner's calendar (`?month=2026-10`): the days of the month that have visits; a day opens the day screen. */
export default function Calendar() {
  const { month: asked } = useLocalSearchParams<{ month?: string }>();
  const { t } = useI18n();
  const { locale } = useLocale();
  const router = useRouter();
  // The default month is the shop's, from its own day (a Montréal evening is still October when UTC is November).
  const shop = useQuery(queries.shop());
  const month = isMonth(asked) ? asked : monthOf(localDay(new Date(), shop.data?.shop.timezone ?? DEFAULT_TIMEZONE));
  const { from, to } = monthRange(month);
  const days = useQuery(queries.calendar(from, to));
  return (
    <Screen header={<AppHeader title={t("calendar.title")} />}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="ghost" label={t("calendar.previous")} onPress={() => router.setParams({ month: shiftMonth(month, -1) })} />
        <Txt variant="label">{month}</Txt>
        <Button variant="ghost" label={t("calendar.next")} onPress={() => router.setParams({ month: shiftMonth(month, 1) })} />
      </View>
      {days.data?.length === 0 ? <EmptyState title={t("calendar.empty")} /> : null}
      {days.isError ? <Txt tone="danger">{t("common.offline")}</Txt> : null}
      {(days.data ?? []).map((day) => (
        <Card.Root key={day.day} onPress={() => router.navigate(routes.today(locale, day.day) as never)}>
          <Card.Body>
            <Txt variant="label">{day.day}</Txt>
            <Txt tone="secondary">{`${t("calendar.visits", { count: day.visits })} · ${t("calendar.bookings", { count: day.bookings })}`}</Txt>
          </Card.Body>
        </Card.Root>
      ))}
    </Screen>
  );
}
