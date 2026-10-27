"use client";

import { BOARD_PERIODS, type BoardPeriod, type TodayBoard } from "@akinaza/core";
import { Sparkline } from "@krizaka/charts/sparkline";
import { Agenda, type AgendaItem } from "@krizaka/ui/agenda";
import { Alert } from "@krizaka/ui/alert";
import { Avatar } from "@krizaka/ui/avatar";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { ChipLink } from "@krizaka/ui/chip-link";
import { DashboardLayout, Widget } from "@krizaka/ui/dashboard-layout";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Dialog } from "@krizaka/ui/dialog";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { Meter } from "@krizaka/ui/meter";
import { getISOWeek } from "date-fns";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SectionError } from "@/components/app/SectionError";
import { useShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { type DayVisitView, VisitBookings, VisitProgress } from "@/components/app/VisitDetail";
import { ButtonLink } from "@/components/ButtonLink";
import { AppointmentStatus, dayHeadline, daySummary, headlineMessage, shiftDay, STATUS_TONE, statusWord } from "@/lib/day";
import { formatLongDay, formatMoney, formatTime, INTL_LOCALE } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";
import type { ShopRoutes } from "@/lib/routes";
import type { TodayAppointment } from "@/lib/today";

type Row = AgendaItem & { appointment: TodayAppointment; visit: DayVisitView | null };

/**
 * The next step of a visit, one quiet button: start it, then finish it (the same calls as the walker's day). The step that
 * succeeded rings once on the button (`data-kz-status="success"`, motion.css, D11); nothing rings on the page's arrival.
 */
function VisitAction({ appointment }: { appointment: TodayAppointment }) {
  const { say } = useSay();
  const call = useCall();
  const [succeeded, setSucceeded] = useState(false);
  if (appointment.status !== AppointmentStatus.Booked) return null;
  const step = appointment.checkedInAt ? "check-out" : "check-in";
  const run = async () => setSucceeded((await call.run(`/api/walker/visits/${appointment.id}/${step}`)) !== null);
  return (
    <Button size="sm" variant="ghost" loading={call.pending} data-kz-status={succeeded ? "success" : undefined} onClick={run}>
      {say(appointment.checkedInAt ? "today.finish" : "today.start")}
    </Button>
  );
}

/** « Facturer ce rendez-vous » (D3): a finished appointment opens « Nouvelle facture » with its client, its service and one unit. */
export function billAppointmentHref(a: TodayAppointment, routes: Pick<ShopRoutes, "newInvoiceFor">, mayInvoice: boolean): string | null {
  if (!mayInvoice || a.status !== AppointmentStatus.Done) return null;
  return routes.newInvoiceFor({ client: a.clientId ?? undefined, service: a.serviceId, quantity: "1", appointment: a.id });
}

const sum = (values: readonly number[]) => values.reduce((n, v) => n + v, 0);

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
  /** The page's words: its name (the eyebrow above the headline) and a line under it (who is off). */
  title: string;
  description: string;
  /** The walks of a trade with dependants, by appointment: the sheet then shows the dogs, the owners, the notes and the report. */
  visits?: Record<string, DayVisitView>;
  /** Announced under the heading: « Le point du lundi » when it has something to say. */
  banner?: React.ReactNode;
  /** The trade reads its appointments by their service (a dog walker's walks): the headline too. */
  dependants: boolean;
  /** The binder, the activity and « À encaisser » (`todayBoard`), or null for who may not see the shop's money. */
  board: TodayBoard | null;
  /** The board failed to load: the side column says so in place, the agenda renders (D6). */
  boardFailed?: boolean;
  /** The activity's period in days (`?period=`). */
  period: BoardPeriod;
  /** The shop's public page, when it is published (« Ma page publique »). */
  publicPageHref?: string | null;
  /** « Nouvelle facture », the day's primary when nobody comes next, for who may issue invoices. */
  newInvoiceHref?: string | null;
}

/**
 * The owner's day, for every trade (docs/ux/2026-10-full-review.md § 4.2): the heading and the strip of days, the three
 * figures, the agenda with its « now » line beside the last invoices, and a side sheet for the open appointment — for a walk,
 * the dogs, the owners, the access notes, the start and the end, the report. The day (`?day=`) and the open appointment
 * (`?appointment=`) are in the address.
 */
export function TodayDay({ appointments, shop, day, today, nowIso, selectedId, allow, title, description, visits, banner, dependants, board, boardFailed = false, period, publicPageHref = null, newInvoiceHref = null }: TodayDayProps) {
  const { say, locale } = useSay();
  const router = useRouter();
  const routes = useShopRoutes();
  const pathname = usePathname();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const isToday = day === today;
  const summary = useMemo(() => daySummary(appointments, shop.registrant, now), [appointments, shop.registrant, now]);

  const address = (next: { day?: string; appointment?: string | null; period?: BoardPeriod }) => {
    const params = new URLSearchParams();
    const shownDay = next.day ?? day;
    if (shownDay !== today) params.set("day", shownDay);
    const shownPeriod = next.period ?? period;
    if (shownPeriod !== BOARD_PERIODS[0]) params.set("period", String(shownPeriod));
    const open = next.appointment === undefined ? selectedId : next.appointment;
    if (open) params.set("appointment", open);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  const time = (iso: string) => formatTime(iso, locale, shop.timezone);
  const dogs = (count: number) => (count === 1 ? say("walker.dog") : say("walker.dogs", { count }));

  const rows: Row[] = appointments.map((a) => {
    const visit = visits?.[a.id] ?? null;
    return {
      appointment: a,
      visit,
      id: a.id,
      start: a.startsAt,
      end: a.endsAt,
      // A walk is read by its service and its dogs; any other appointment by its client.
      title: visit ? a.service[locale] : (a.client ?? say("today.walkIn")),
      description: visit ? `${dogs(visit.bookings.length)} · ${a.staff}` : `${a.service[locale]} · ${a.staff}`,
      tone: STATUS_TONE[statusWord(a)],
      leading: <Avatar alt="" size="sm" defaultAvatar={{ brand: "akinaza", seed: a.staff }} fallback={a.staff.charAt(0)} />,
      status: (
        <span className="flex flex-wrap items-center justify-end gap-1">
          {a.agendaConflict ? <Badge tone="warning">{say("today.conflict", { calendar: a.agendaConflict })}</Badge> : null}
          <Badge tone={STATUS_TONE[statusWord(a)]}>{say(`today.statuses.${statusWord(a)}`)}</Badge>
        </span>
      ),
      href: address({ appointment: a.id }),
    };
  });
  const open = rows.find((r) => r.id === selectedId) ?? null;
  const billing = open ? billAppointmentHref(open.appointment, routes, newInvoiceHref !== null) : null;
  // The day's one primary (D1b): open the next appointment; when nobody comes next, a new invoice. The frame's header yields here.
  const next = summary.next;
  const primary = next ? (
    <Button asChild variant="gradient" size="md" className="font-bold">
      <Link href={address({ appointment: next.id })} data-primary scroll={false}>
        {say("today.nextPrimary", { client: next.client ?? say("today.walkIn"), time: time(next.startsAt) })}
      </Link>
    </Button>
  ) : newInvoiceHref ? (
    <Button asChild variant="gradient" size="md" className="font-bold">
      <Link href={newInvoiceHref} data-primary>
        {say("shell.newInvoice")}
      </Link>
    </Button>
  ) : null;

  const headline = headlineMessage(dayHeadline(appointments, now, isToday), { dependants });
  const words = Object.fromEntries(Object.entries(headline.vars).map(([k, v]) => [k, k === "at" ? time(v as string) : k === "service" ? (v as { fr: string; en: string })[locale] : (v as string | number)]));
  const totals = board ? { invoiced: sum(board.activity.invoicedCents), collected: sum(board.activity.collectedCents), appointments: sum(board.activity.appointments) } : null;
  // A day whose figures are all zero shows its empty state, not a row of zeros (§ 2.5 of the direction).
  const allZero = summary.count === 0 && (!board || (board.week === 0 && board.toBill.length === 0 && board.balance.count === 0 && totals!.invoiced === 0 && totals!.collected === 0 && totals!.appointments === 0));
  const unbilled = board?.toBill[0] ?? null;
  const quick = [
    newInvoiceHref && next ? { href: newInvoiceHref, label: say("shell.newInvoice") } : null,
    unbilled ? { href: routes.newInvoiceFor({ client: unbilled.clientId ?? undefined, service: unbilled.serviceId, quantity: "1", appointment: unbilled.appointmentId }), label: say("today.quick.bill", { client: unbilled.client ?? say("today.walkIn") }) } : null,
    board?.chase ? { href: routes.invoice(board.chase.id), label: say("today.quick.chase", { number: board.chase.number }) } : null,
    publicPageHref ? { href: publicPageHref, label: say("today.quick.page") } : null,
  ].filter((q): q is { href: string; label: string } => q !== null);

  return (
    <>
      <DashboardLayout
        eyebrow={title}
        title={say(headline.key, words)}
        description={description || undefined}
        actions={
          <nav aria-label={say("today.calendar")} className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href={address({ day: shiftDay(day, -1), appointment: null })} aria-label={say("today.earlier")}>‹</Link>
            </Button>
            <span className="text-sm font-semibold tabular-nums text-fg">{say("today.week", { week: getISOWeek(new Date(`${day}T12:00:00Z`)), date: formatLongDay(day, locale) })}</span>
            <Button asChild size="sm" variant="ghost">
              <Link href={address({ day: shiftDay(day, 1), appointment: null })} aria-label={say("today.later")}>›</Link>
            </Button>
            {isToday ? null : (
              <Button asChild size="sm" variant="secondary">
                <Link href={address({ day: today, appointment: null })}>{say("today.goToday")}</Link>
              </Button>
            )}
          </nav>
        }
        toolbar={
          <div className="flex w-full min-w-0 flex-col gap-4">
            {primary ? <div>{primary}</div> : null}
            {banner}
            {board && !allZero ? (
              <nav aria-label={say("today.binder.title")} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-fg-secondary">{say("today.binder.title")}</h2>
                <ul className="flex flex-wrap gap-2">
                  <li><ChipLink href="#agenda">{say("today.binder.appointments", { count: summary.count })}</ChipLink></li>
                  <li><ChipLink href="#quick-access">{say("today.binder.toBill", { count: board.toBill.length })}</ChipLink></li>
                  <li><ChipLink asChild><Link href={routes.invoices}>{say("today.binder.toCollect", { count: board.balance.count })}</Link></ChipLink></li>
                  <li><ChipLink asChild><Link href={address({ day: today, appointment: null })}>{say("today.binder.week", { count: board.week })}</Link></ChipLink></li>
                </ul>
              </nav>
            ) : null}
          </div>
        }
      >
        <Widget span={3} title={say("today.agendaLabel")} id="agenda">
          {/* TODO(krizaka-ui#680): a changed appointment washes once when `Agenda` can mark its row (`data-kz-arrive` on the `li`);
              until then only the step that succeeded rings (VisitAction). */}
          <Agenda
            items={rows}
            aria-label={say("today.agendaLabel")}
            locale={INTL_LOCALE[locale]}
            timeZone={shop.timezone}
            now={isToday ? now : null}
            selectedId={selectedId}
            linkAs={Link}
            action={(row) => <VisitAction appointment={row.appointment} />}
            labels={{ now: (at) => say("today.now", { time: at }) }}
            empty={<EmptyState icon={<Mascot bird="beaver" mood="empty" size={120} />} title={say("today.noneTitle")} description={say(isToday ? "today.none" : "today.noneOtherDay")} />}
          />
        </Widget>
        <div className="flex min-w-0 flex-col gap-4 sm:col-span-2 xl:col-span-1">
          {boardFailed ? <SectionError /> : null}
          {quick.length ? (
            <Widget title={say("today.quick.title")} id="quick-access">
              <ul className="flex flex-col gap-2">
                {quick.map((q) => (
                  <li key={q.href}>
                    <ButtonLink href={q.href} variant="secondary" size="sm" className="w-full justify-start">
                      {q.label}
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Widget>
          ) : null}
          {board && totals && !allZero ? (
            <Widget
              title={say("today.activity.title")}
              action={
                <ul className="flex gap-1" aria-label={say("today.activity.period")}>
                  {BOARD_PERIODS.map((p) => (
                    <li key={p}>
                      <ChipLink size="sm" selected={p === period} asChild>
                        <Link href={address({ period: p, appointment: null })} scroll={false}>{say("today.activity.days", { days: p })}</Link>
                      </ChipLink>
                    </li>
                  ))}
                </ul>
              }
            >
              {/* One discreet row of three figures, never stacked full width (B2). */}
              <dl className="grid grid-cols-3 gap-3">
                {([
                  ["invoiced", formatMoney(totals.invoiced, locale), board.activity.invoicedCents, "line"],
                  ["collected", formatMoney(totals.collected, locale), board.activity.collectedCents, "line"],
                  ["appointments", String(totals.appointments), board.activity.appointments, "bar"],
                ] as const).map(([key, value, series, variant]) => (
                  <div key={key} className="flex min-w-0 flex-col gap-1">
                    <dt className="truncate text-xs text-fg-secondary">{say(`today.activity.${key}`)}</dt>
                    <dd className="truncate text-sm font-semibold tabular-nums text-fg">{value}</dd>
                    <dd>
                      <Sparkline title={say(`today.activity.${key}`)} data={series} categories={board.activity.days} variant={variant} width={72} height={24} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Widget>
          ) : null}
          {board && !allZero ? (
            <Widget title={say("today.balance.title")}>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-fg">{say("today.balance.owed", { amount: formatMoney(board.balance.owedCents, locale) })}</p>
                {board.balance.overdueCount > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-fg-danger">{say("today.balance.overdue", { amount: formatMoney(board.balance.overdueCents, locale) })}</p>
                    <Meter label={say("today.balance.overdue", { amount: formatMoney(board.balance.overdueCents, locale) })} value={board.balance.overdueCents} max={Math.max(board.balance.owedCents, 1)} valueText={formatMoney(board.balance.overdueCents, locale)} />
                  </>
                ) : (
                  <p className="flex items-center gap-3 text-sm text-fg-secondary">
                    <Mascot bird="beaver" mood="success" size={40} />
                    {say("today.balance.noneLate")}
                  </p>
                )}
              </div>
            </Widget>
          ) : null}
        </div>
      </DashboardLayout>

      <Dialog.Root open={open !== null} onOpenChange={(next) => (next ? undefined : router.replace(address({ appointment: null }), { scroll: false }))}>
        {open ? (
          <Dialog.Content placement="right" closeLabel={say("today.detail.close")}>
            <Dialog.Header>
              <Dialog.Title>{open.title}</Dialog.Title>
              <Dialog.Description>{[`${time(open.start)} – ${time(open.end ?? open.start)}`, open.visit?.zone ?? null, open.visit ? dogs(open.visit.bookings.length) : null].filter(Boolean).join(" · ")}</Dialog.Description>
            </Dialog.Header>
            <Dialog.Body className="flex flex-col gap-4">
              {open.appointment.agendaConflict ? <Alert tone="warning">{say("today.conflictDetail", { calendar: open.appointment.agendaConflict })}</Alert> : null}
              {open.visit ? (
                <>
                  <VisitBookings visit={open.visit} timeZone={shop.timezone} />
                  <VisitProgress visit={open.visit} timeZone={shop.timezone} />
                </>
              ) : (
                <DescriptionList
                  items={[
                    { term: say("today.detail.service"), details: open.appointment.service[locale] },
                    { term: say("today.detail.with"), details: open.appointment.staff },
                    { term: say("today.detail.price"), details: <span className="tabular-nums">{formatMoney(open.appointment.priceCents, locale)}</span> },
                    { term: say("today.detail.status"), details: say(`today.statuses.${statusWord(open.appointment)}`) },
                  ]}
                />
              )}
            </Dialog.Body>
            <Dialog.Footer>
              {open.visit ? null : <VisitAction appointment={open.appointment} />}
              {billing ? (
                <Button asChild variant="secondary">
                  <Link href={billing}>{say("today.detail.bill")}</Link>
                </Button>
              ) : null}
              {allow.clients && open.appointment.clientId ? (
                <Button asChild variant="secondary">
                  <Link href={routes.client(open.appointment.clientId)}>{say("today.detail.clientFile")}</Link>
                </Button>
              ) : null}
            </Dialog.Footer>
          </Dialog.Content>
        ) : null}
      </Dialog.Root>
    </>
  );
}
