import { localDay } from "@akinaza/core";
import { useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { DayStrip, Screen } from "@krizaka/ui/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";

import { akinaza, queries } from "@/config";
import { DEFAULT_TIMEZONE, isDay, LANGUAGE_TAG, stripWindow } from "@/domain/day";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { QueryStates } from "@/ui/QueryStates";
import { VisitCard } from "@/ui/VisitCard";
import { useLocale } from "@/use-locale";
import { useShop } from "@/use-shop";

/**
 * Aujourd'hui (`/fr/app/<shop>/aujourdhui?day=2026-10-20`, today by default), as the web's: the day strip holds the calendar —
 * two weeks, the days with appointments marked — and the day's agenda, with the two moves of a visit (start, finish).
 * TODO(krizaka-ui#628): the agenda becomes the native `Agenda` when it ships; until then, a card per visit.
 */
export default function Today() {
  const { day: asked } = useLocalSearchParams<{ day?: string }>();
  const { t } = useI18n();
  const { locale } = useLocale();
  const shop = useShop();
  const router = useRouter();
  const queryClient = useQueryClient();
  const wanted = isDay(asked) ? asked : undefined;
  const day = useQuery(queries.day(wanted, shop));
  const today = localDay(new Date(), day.data?.timezone ?? DEFAULT_TIMEZONE);
  const shown = day.data?.day ?? wanted ?? today;
  const strip = stripWindow(shown);
  const marks = useQuery(queries.calendar(strip.start, strip.end, shop));
  const marked = new Set((marks.data ?? []).filter((d) => d.visits > 0).map((d) => d.day));
  const move = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "in" | "out" }) => (kind === "in" ? akinaza.checkIn(id, shop) : akinaza.checkOut(id, shop)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queries.day(wanted, shop).queryKey }),
  });
  return (
    <Screen header={<AppHeader title={t("today.title")} />}>
      <DayStrip label={t("today.strip")} locale={LANGUAGE_TAG[locale]} value={shown} start={strip.start} today={today} isDateMarked={(d) => marked.has(d)} markedLabel={t("today.marked")} onValueChange={(next) => router.setParams({ day: next })} />
      <QueryStates query={day} isEmpty={(d) => d.visits.length === 0} empty={{ title: t("today.empty"), description: t("today.emptyLead") }}>
        {(d) =>
          d.visits.map((visit) => (
            <VisitCard key={visit.appointmentId} visit={visit} timeZone={d.timezone} busy={move.isPending} onCheckIn={() => move.mutate({ id: visit.appointmentId, kind: "in" })} onCheckOut={() => move.mutate({ id: visit.appointmentId, kind: "out" })} />
          ))
        }
      </QueryStates>
    </Screen>
  );
}
