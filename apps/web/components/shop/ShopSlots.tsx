"use client";

import { SlotPicker } from "@krizaka/ui/slot-picker";
import Link from "next/link";
import { useMemo, useState } from "react";

import { shiftDay } from "@/lib/day";
import { mondayOf, weekDays } from "@/lib/slot-weeks";
import type { DayView } from "@/lib/storefront";

export interface ShopSlotsLabels {
  label: string;
  empty: string;
  previous: string;
  today: string;
  next: string;
}

/** The week in words (`19 – 25 oct.`), on the calendar days themselves (no time zone: they are dates). */
const weekWords = (monday: string, locale: string) => {
  const part = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" });
  return `${part.format(new Date(`${monday}T12:00:00Z`))} – ${part.format(new Date(`${shiftDay(monday, 6)}T12:00:00Z`))}`;
};

/**
 * The next free times, by week (`SlotPicker` with ← Today →) and by part of the day: each time a link to the booking with the service,
 * the area and the time already chosen. The server read two weeks; the weeks are cut here, on the days it returned.
 */
export function ShopSlots({ days, labels, locale, footer }: Readonly<{ days: DayView[]; labels: ShopSlotsLabels; locale: string; footer?: string }>) {
  const first = days[0] ? mondayOf(days[0].id) : undefined;
  const last = days.length ? mondayOf(days[days.length - 1]!.id) : first;
  const [week, setWeek] = useState(first);
  const shown = useMemo(() => {
    const inWeek = new Set(week ? weekDays(week) : []);
    return days.filter((d) => inWeek.has(d.id));
  }, [days, week]);
  if (!first || !last || !week) return <SlotPicker days={[]} label={labels.label} emptyLabel={labels.empty} />;
  return (
    <SlotPicker
      days={shown}
      label={labels.label}
      emptyLabel={labels.empty}
      linkAs={Link}
      week={week}
      onWeekChange={setWeek}
      minWeek={first}
      maxWeek={last}
      todayWeek={first}
      weekLabel={weekWords(week, locale)}
      weekButtons={{ previous: labels.previous, today: labels.today, next: labels.next }}
      footer={footer}
    />
  );
}
