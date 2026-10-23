import type { DayVisit } from "@akinaza/core";
import { Badge, Button, Card, Txt } from "@krizaka/ui/native";
import * as Linking from "expo-linking";
import * as React from "react";
import { View } from "react-native";

import { timeOf } from "@/domain/day";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

const STATUS_TONE = { booked: "accent", done: "success", cancelled: "neutral", noShow: "warning" } as const;

/** One visit of the day: when, what, who is booked, and the two moves of the owner (start, finish). */
export function VisitCard({ visit, timeZone, busy, onCheckIn, onCheckOut }: { visit: DayVisit; timeZone: string; busy: boolean; onCheckIn: () => void; onCheckOut: () => void }) {
  const { t } = useI18n();
  const { locale } = useLocale();
  const name = locale === "fr" ? visit.service.fr : visit.service.en;
  return (
    <Card.Root>
      <Card.Body>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt variant="label">{`${timeOf(visit.startsAt, timeZone, locale)} · ${name}`}</Txt>
          <Badge tone={STATUS_TONE[visit.status]}>{t(`today.${visit.status}`)}</Badge>
        </View>
        {visit.zone ? <Txt tone="muted" variant="caption">{visit.zone}</Txt> : null}
        {visit.bookings.map((booking) => (
          <View key={booking.bookingId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt>{`${booking.dependant.name} · ${booking.clientName}`}</Txt>
            {booking.clientPhone ? <Button size="sm" variant="ghost" label={t("today.call", { name: booking.clientName })} onPress={() => void Linking.openURL(`tel:${booking.clientPhone}`)} /> : null}
          </View>
        ))}
        {visit.checkedInAt ? <Txt tone="secondary" variant="caption">{t("today.in", { time: timeOf(visit.checkedInAt, timeZone, locale) })}</Txt> : null}
        {visit.checkedOutAt ? <Txt tone="secondary" variant="caption">{t("today.out", { time: timeOf(visit.checkedOutAt, timeZone, locale) })}</Txt> : null}
        {visit.status === "booked" && !visit.checkedInAt ? <Button variant="primary" label={t("today.checkIn")} loading={busy} onPress={onCheckIn} /> : null}
        {visit.status === "booked" && visit.checkedInAt && !visit.checkedOutAt ? <Button variant="primary" label={t("today.checkOut")} loading={busy} onPress={onCheckOut} /> : null}
      </Card.Body>
    </Card.Root>
  );
}
