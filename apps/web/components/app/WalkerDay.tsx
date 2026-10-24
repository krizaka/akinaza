"use client";

import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import Link from "next/link";

import { type DayVisitView, VisitBookings, VisitProgress } from "@/components/app/VisitDetail";
import { formatTime } from "@/lib/format";
import { useSay, useVocabulary } from "@/lib/i18n-client";

export type { DayVisitView } from "@/components/app/VisitDetail";

/** The walker's day, built for a phone in the street: big buttons, one thing at a time, the report right under the walk. Staff see it; the owner reads the agenda. */
export function WalkerDay({ visits, timeZone, nav }: { visits: DayVisitView[]; timeZone: string; nav: { prev: string; next: string; today: string; isToday: boolean } }) {
  const { say } = useSay();
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap items-center gap-2" aria-label={say("walker.title")}>
        <Button asChild size="sm" variant="secondary">
          <Link href={nav.prev}>← {say("walker.previous")}</Link>
        </Button>
        {nav.isToday ? null : (
          <Button asChild size="sm" variant="outline">
            <Link href={nav.today}>{say("walker.today")}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="secondary">
          <Link href={nav.next}>{say("walker.next")} →</Link>
        </Button>
      </nav>
      {visits.length === 0 ? <p className="text-fg-secondary">{say("walker.none")}</p> : null}
      {visits.map((visit) => (
        <VisitCard key={visit.appointmentId} visit={visit} timeZone={timeZone} />
      ))}
    </div>
  );
}

function VisitCard({ visit, timeZone }: { visit: DayVisitView; timeZone: string }) {
  const { say, locale } = useSay();
  const { dependants } = useVocabulary();
  const live = visit.checkedInAt && !visit.checkedOutAt;
  const done = !!visit.checkedOutAt;
  return (
    <Card.Root className="p-4" aria-labelledby={`visit-${visit.appointmentId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`visit-${visit.appointmentId}`} className="font-display text-lg font-bold text-fg">
            <span className="font-mono">
              {formatTime(visit.startsAt, locale, timeZone)}–{formatTime(visit.endsAt, locale, timeZone)}
            </span>{" "}
            · {visit.service[locale]}
          </h2>
          {dependants ? <p className="text-sm text-fg-secondary">{visit.service.capacity > 1 ? say("walker.dogsOf", { count: visit.bookings.length, max: visit.service.capacity }) : say("walker.dogs", { count: visit.bookings.length })}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {visit.zone ? <Badge tone="accent">{visit.zone}</Badge> : null}
          <Badge tone={done ? "success" : live ? "warning" : "neutral"}>{say(done ? "walker.statusDone" : live ? "walker.statusLive" : "walker.statusBooked")}</Badge>
        </div>
      </div>
      <div className="mt-3">
        <VisitBookings visit={visit} timeZone={timeZone} />
      </div>
      <div className="mt-2">
        <VisitProgress visit={visit} timeZone={timeZone} wide />
      </div>
    </Card.Root>
  );
}
