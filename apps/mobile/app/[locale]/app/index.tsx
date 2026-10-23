import { useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Button, EmptyState, Screen, Txt } from "@krizaka/ui/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { akinaza, queries } from "@/config";
import { isDay, shiftDay } from "@/domain/day";
import { routes } from "@/domain/links";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { useLocale } from "@/use-locale";
import { VisitCard } from "@/ui/VisitCard";

/** The owner's day (`?date=2026-10-20`, today by default): its visits, and the two moves of a visit. */
export default function Today() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { t } = useI18n();
  const { locale } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const asked = isDay(date) ? date : undefined;
  const shop = useQuery(queries.shop());
  const day = useQuery(queries.day(asked));
  const timeZone = shop.data?.shop.timezone ?? "America/Toronto";
  const move = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "in" | "out" }) => (kind === "in" ? akinaza.checkIn(id) : akinaza.checkOut(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queries.day(asked).queryKey }),
  });
  const shown = day.data?.day ?? asked;
  return (
    <Screen header={<AppHeader title={t("today.title")} />}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="ghost" label={t("today.previous")} disabled={!shown} onPress={() => shown && router.setParams({ date: shiftDay(shown, -1) })} />
        <Txt variant="label">{shown ?? ""}</Txt>
        <Button variant="ghost" label={t("today.next")} disabled={!shown} onPress={() => shown && router.setParams({ date: shiftDay(shown, 1) })} />
      </View>
      {day.data?.visits.length === 0 ? <EmptyState title={t("today.empty")} /> : null}
      {day.isError ? <Txt tone="danger">{t("common.offline")}</Txt> : null}
      {(day.data?.visits ?? []).map((visit) => (
        <VisitCard key={visit.appointmentId} visit={visit} timeZone={timeZone} busy={move.isPending} onCheckIn={() => move.mutate({ id: visit.appointmentId, kind: "in" })} onCheckOut={() => move.mutate({ id: visit.appointmentId, kind: "out" })} />
      ))}
      <Button variant="ghost" label={t("tabs.calendar")} onPress={() => router.navigate(routes.calendar(locale, (shown ?? "").slice(0, 7) || undefined) as never)} />
    </Screen>
  );
}
