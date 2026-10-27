import type { DayVisit } from "@akinaza/core";
import { Badge, Button, DescriptionList, Txt } from "@krizaka/ui/native";
import * as Linking from "expo-linking";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { timeOf } from "@/domain/day";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

import { STATUS_TONE } from "./VisitRow";

/** One appointment opened: when, where, who (each with a call), its state and the two moves of the owner (start, finish). */
export function VisitDetail({ visit, timeZone, busy, onCheckIn, onCheckOut }: { visit: DayVisit; timeZone: string; busy: boolean; onCheckIn: () => void; onCheckOut: () => void }) {
  const { t } = useI18n();
  const { locale } = useLocale();
  const clock = (instant: string) => timeOf(instant, timeZone, locale);
  const items = [
    { term: t("today.detail.when"), details: `${clock(visit.startsAt)} – ${clock(visit.endsAt)}` },
    ...(visit.zone ? [{ term: t("today.detail.where"), details: visit.zone }] : []),
    ...(visit.checkedInAt ? [{ term: t("today.in", { time: clock(visit.checkedInAt) }), details: visit.checkedOutAt ? t("today.out", { time: clock(visit.checkedOutAt) }) : "" }] : []),
  ];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt variant="title">{visit.service[locale]}</Txt>
        <Badge tone={STATUS_TONE[visit.status]}>{t(`today.${visit.status}`)}</Badge>
      </View>
      <DescriptionList items={items} layout="inline" />
      <Txt variant="label">{t("today.detail.who")}</Txt>
      {visit.bookings.length === 0 ? <Txt tone="muted">{t("today.detail.none")}</Txt> : null}
      {visit.bookings.map((booking) => (
        <View key={booking.bookingId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt>{`${booking.dependant.name} · ${booking.clientName}`}</Txt>
          {booking.clientPhone ? <Button size="sm" variant="ghost" label={t("today.call", { name: booking.clientName })} onPress={() => void Linking.openURL(`tel:${booking.clientPhone}`)} /> : null}
        </View>
      ))}
      {visit.status === "booked" && !visit.checkedInAt ? <Button variant="primary" label={t("today.checkIn")} loading={busy} onPress={onCheckIn} /> : null}
      {visit.status === "booked" && visit.checkedInAt && !visit.checkedOutAt ? <Button variant="primary" label={t("today.checkOut")} loading={busy} onPress={onCheckOut} /> : null}
    </ScrollView>
  );
}
