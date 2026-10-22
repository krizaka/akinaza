"use client";

import { Agenda, type AgendaItem } from "@krizaka/ui/agenda";
import { Avatar } from "@krizaka/ui/avatar";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DayStrip } from "@krizaka/ui/date-picker";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Dialog } from "@krizaka/ui/dialog";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { Stat, StatGrid } from "@krizaka/ui/stat";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

import { useCall } from "@/components/app/useCall";
import { AppointmentStatus, daySummary, STATUS_TONE, statusWord, stripWindow } from "@/lib/day";
import { formatMoney, formatTime } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";
import type { TodayAppointment } from "@/lib/today";

type Row = AgendaItem & { appointment: TodayAppointment };

/** The next step of a visit, one quiet button: start it, then finish it (the same calls as the walker's day). */
function VisitAction({ appointment }: { appointment: TodayAppointment }) {
  const { say } = useSay();
  const call = useCall();
  if (appointment.status !== AppointmentStatus.Booked) return null;
  const step = appointment.checkedInAt ? "check-out" : "check-in";
  return (
    <Button size="sm" variant="ghost" loading={call.pending} onClick={() => call.run(`/api/walker/visits/${appointment.id}/${step}`)}>
      {say(appointment.checkedInAt ? "today.finish" : "today.start")}
    </Button>
  );
}

export interface TodayDayProps {
  appointments: TodayAppointment[];
  shop: { timezone: string; registrant: boolean };
  day: string;
  today: string;
  /** The server's clock, so the « now » line and the next client are the same on both sides of the page. */
  nowIso: string;
  selectedId: string | null;
  /** What the role may see beside the agenda: the client's file, and what the day will bill. */
  allow: { clients: boolean; revenue: boolean };
}

/**
 * The owner's day: a strip of days, three figures (appointments, what the day will bill, the next client) and the agenda
 * with its « now » line. The day (`?day=`) and the open appointment (`?appointment=`) are in the address.
 */
export function TodayDay({ appointments, shop, day, today, nowIso, selectedId, allow }: TodayDayProps) {
  const { say, locale } = useSay();
  const router = useRouter();
  const pathname = usePathname();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const isToday = day === today;
  const summary = useMemo(() => daySummary(appointments, shop.registrant, now), [appointments, shop.registrant, now]);
  const strip = stripWindow(day, today);

  const address = (next: { day?: string; appointment?: string | null }) => {
    const params = new URLSearchParams();
    const shownDay = next.day ?? day;
    if (shownDay !== today) params.set("day", shownDay);
    const open = next.appointment === undefined ? selectedId : next.appointment;
    if (open) params.set("appointment", open);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  const time = (iso: string) => formatTime(iso, locale, shop.timezone);

  const rows: Row[] = appointments.map((a) => ({
    appointment: a,
    id: a.id,
    start: a.startsAt,
    end: a.endsAt,
    title: a.client ?? say("today.walkIn"),
    description: `${a.service[locale]} · ${a.staff}`,
    tone: STATUS_TONE[statusWord(a)],
    leading: <Avatar alt="" size="sm" defaultAvatar={{ brand: "akinaza", seed: a.staff }} fallback={a.staff.charAt(0)} />,
    status: <Badge tone={STATUS_TONE[statusWord(a)]}>{say(`today.statuses.${statusWord(a)}`)}</Badge>,
    href: address({ appointment: a.id }),
  }));
  const open = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <DayStrip
          className="min-w-0 flex-1"
          label={say("today.dayStrip")}
          locale={locale}
          value={day}
          start={strip.start}
          days={strip.days}
          today={today}
          labels={{ previous: say("today.earlier"), next: say("today.later") }}
          onValueChange={(picked) => router.push(address({ day: picked, appointment: null }))}
        />
        {isToday ? null : (
          <Button asChild size="sm" variant="secondary">
            <Link href={address({ day: today, appointment: null })}>{say("today.goToday")}</Link>
          </Button>
        )}
      </div>

      <StatGrid>
        <Stat label={say("today.stats.appointments")} value={summary.count} />
        {allow.revenue ? <Stat label={say("today.stats.expected")} value={formatMoney(summary.expectedCents, locale)} hint={say(shop.registrant ? "today.stats.withTaxes" : "today.stats.noTaxes")} /> : null}
        <Stat
          label={say("today.stats.next")}
          value={summary.next?.client ?? (summary.next ? say("today.walkIn") : "—")}
          hint={summary.next ? time(summary.next.startsAt) : say(isToday ? "today.stats.nobodyLeft" : "today.stats.nobodyNext")}
        />
      </StatGrid>

      <Agenda
        items={rows}
        aria-label={say("today.agendaLabel")}
        locale={locale === "fr" ? "fr-CA" : "en-CA"}
        timeZone={shop.timezone}
        now={isToday ? now : null}
        selectedId={selectedId}
        linkAs={Link}
        action={(row) => <VisitAction appointment={row.appointment} />}
        labels={{ now: (at) => say("today.now", { time: at }) }}
        empty={<EmptyState icon={<Mascot bird="beaver" mood="empty" size={72} />} title={say("today.noneTitle")} description={say(isToday ? "today.none" : "today.noneOtherDay")} />}
        className="rounded-xl border border-border-default bg-surface-1 px-2"
      />

      <Dialog.Root open={open !== null} onOpenChange={(next) => (next ? undefined : router.replace(address({ appointment: null }), { scroll: false }))}>
        {open ? (
          <Dialog.Content placement="right" closeLabel={say("today.detail.close")}>
            <Dialog.Header>
              <Dialog.Title>{open.title}</Dialog.Title>
              <Dialog.Description>{`${time(open.start)} – ${time(open.end ?? open.start)}`}</Dialog.Description>
            </Dialog.Header>
            <Dialog.Body className="flex flex-col gap-4">
              <DescriptionList
                items={[
                  { term: say("today.detail.service"), details: open.appointment.service[locale] },
                  { term: say("today.detail.with"), details: open.appointment.staff },
                  { term: say("today.detail.price"), details: <span className="font-mono">{formatMoney(open.appointment.priceCents, locale)}</span> },
                  { term: say("today.detail.status"), details: say(`today.statuses.${statusWord(open.appointment)}`) },
                ]}
              />
            </Dialog.Body>
            <Dialog.Footer>
              <VisitAction appointment={open.appointment} />
              {allow.clients && open.appointment.clientId ? (
                <Button asChild variant="secondary">
                  <Link href={`/${locale}/app/clients/${open.appointment.clientId}`}>{say("today.detail.clientFile")}</Link>
                </Button>
              ) : null}
            </Dialog.Footer>
          </Dialog.Content>
        ) : null}
      </Dialog.Root>
    </div>
  );
}
