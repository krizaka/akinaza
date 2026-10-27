import { localDay } from "@akinaza/core";
import { useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { DayStrip, ListDetail, Screen } from "@krizaka/ui/native";
import { List } from "@krizaka/ui/native/list";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";

import { akinaza, queries } from "@/config";
import { DEFAULT_TIMEZONE, isDay, LANGUAGE_TAG, stripWindow } from "@/domain/day";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { QueryStates } from "@/ui/QueryStates";
import { VisitDetail } from "@/ui/VisitDetail";
import { VisitRow } from "@/ui/VisitRow";
import { useLocale } from "@/use-locale";
import { useShop } from "@/use-shop";

/**
 * Aujourd'hui (`/fr/app/<shop>/aujourdhui?day=2026-10-20`, today by default), as the web's: the day strip holds the calendar —
 * two weeks, the days with appointments marked — and the day's agenda, with the two moves of a visit (start, finish).
 * The day's appointments are a list that opens into a detail (`?visit=`, the URL is the state): two panes on a tablet, one at a time on a phone.
 * TODO(krizaka-ui#628): the agenda becomes the native `Agenda` when it ships; until then, a row per visit.
 */
export default function Today() {
  const { day: asked, visit: openId } = useLocalSearchParams<{ day?: string; visit?: string }>();
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
    <Screen header={<AppHeader title={t("today.title")} />} scroll={false}>
      <DayStrip label={t("today.strip")} style={{ flexGrow: 0 }} locale={LANGUAGE_TAG[locale]} value={shown} start={strip.start} today={today} isDateMarked={(d) => marked.has(d)} markedLabel={t("today.marked")} onValueChange={(next) => router.setParams({ day: next, visit: undefined })} />
      <QueryStates query={day} isEmpty={(d) => d.visits.length === 0} empty={{ title: t("today.empty"), description: t("today.emptyLead") }}>
        {(d) => {
          const open = d.visits.find((v) => v.appointmentId === openId);
          return (
            <ListDetail
              listTitle={t("today.detail.list")}
              list={<List label={t("today.detail.list")} data={d.visits} keyExtractor={(v) => v.appointmentId} renderItem={(v) => <VisitRow visit={v} timeZone={d.timezone} selected={v.appointmentId === openId} onOpen={() => router.setParams({ visit: v.appointmentId })} />} />}
              detailTitle={open ? open.service[locale] : t("today.detail.detailTitle")}
              detail={open ? <VisitDetail visit={open} timeZone={d.timezone} busy={move.isPending} onCheckIn={() => move.mutate({ id: open.appointmentId, kind: "in" })} onCheckOut={() => move.mutate({ id: open.appointmentId, kind: "out" })} /> : undefined}
              empty={t("today.detail.select")}
              backLabel={t("today.detail.back")}
              onBack={() => router.setParams({ visit: undefined })}
            />
          );
        }}
      </QueryStates>
    </Screen>
  );
}
