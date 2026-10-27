import type { DayVisit } from "@akinaza/core";
import { Badge, Txt } from "@krizaka/ui/native";
import * as React from "react";
import { Pressable, View } from "react-native";

import { timeOf } from "@/domain/day";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

export const STATUS_TONE = { booked: "accent", done: "success", cancelled: "neutral", noShow: "warning" } as const;

/** One appointment in the day's list: the time and the service, who is booked, its state; a press opens it (list to detail). */
export function VisitRow({ visit, timeZone, selected, onOpen }: { visit: DayVisit; timeZone: string; selected: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  const { locale } = useLocale();
  const who = visit.bookings.map((b) => b.dependant.name).join(", ");
  return (
    <Pressable role="button" aria-selected={selected} accessibilityLabel={`${timeOf(visit.startsAt, timeZone, locale)} ${visit.service[locale]}`} onPress={onOpen} style={{ paddingVertical: 12, paddingHorizontal: 16, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Txt variant="label">{`${timeOf(visit.startsAt, timeZone, locale)} · ${visit.service[locale]}`}</Txt>
        <Badge tone={STATUS_TONE[visit.status]}>{t(`today.${visit.status}`)}</Badge>
      </View>
      {who ? <Txt tone="secondary" variant="caption">{who}</Txt> : null}
    </Pressable>
  );
}
