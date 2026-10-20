"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import { AccessNotes } from "@/components/app/AccessNotes";
import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { shrinkImage } from "@/lib/shrink-image";

export interface DayVisitView {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "done" | "cancelled" | "noShow";
  service: { fr: string; en: string; capacity: number };
  zone: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  /** Whole minutes between check-in and check-out, once the walk is over. */
  minutes: number | null;
  bookings: {
    bookingId: string;
    clientId: string;
    clientName: string;
    clientPhone: string | null;
    dependant: { name: string; kind: "dog" | "cat" | "other"; profile: { breed?: string; size?: "small" | "medium" | "large"; temperament?: string } };
    hasAccessNotes: boolean;
    report: { id: string; note: string; hasPhoto: boolean; durationMinutes: number; sentAt: string | null } | null;
  }[];
}

const MAX_PHOTO_BEFORE_SHRINK = 25_000_000; // @fixed: a phone camera's raw file; the redraw brings it under the server's 1.5 MB.

/** The walker's day, built for a phone in the street: big buttons, one thing at a time, the report right under the walk. */
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
  const call = useCall();
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === "fr" ? "fr-CA" : "en-CA", { hour: "2-digit", minute: "2-digit", timeZone });
  const live = visit.checkedInAt && !visit.checkedOutAt;
  const done = !!visit.checkedOutAt;
  return (
    <Card.Root className="p-4" aria-labelledby={`visit-${visit.appointmentId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`visit-${visit.appointmentId}`} className="font-display text-lg font-bold text-fg">
            <span className="font-mono">
              {time(visit.startsAt)}–{time(visit.endsAt)}
            </span>{" "}
            · {visit.service[locale]}
          </h2>
          <p className="text-sm text-fg-secondary">{visit.service.capacity > 1 ? say("walker.dogsOf", { count: visit.bookings.length, max: visit.service.capacity }) : say("walker.dogs", { count: visit.bookings.length })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visit.zone ? <Badge tone="accent">{visit.zone}</Badge> : null}
          <Badge tone={done ? "success" : live ? "warning" : "neutral"}>{say(done ? "walker.statusDone" : live ? "walker.statusLive" : "walker.statusBooked")}</Badge>
        </div>
      </div>

      <ul className="mt-3 flex flex-col divide-y divide-border-default">
        {visit.bookings.map((b) => (
          <li key={b.bookingId} className="flex flex-col gap-2 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-semibold text-fg">
                {b.dependant.name}
                <span className="ml-2 text-sm font-normal text-fg-secondary">{[b.dependant.profile.breed, b.dependant.profile.size ? say(`clients.sizes.${b.dependant.profile.size}`) : null].filter(Boolean).join(" · ")}</span>
              </p>
              <p className="text-sm text-fg-secondary">
                {say("walker.owner", { name: b.clientName })}
                {b.clientPhone ? (
                  <>
                    {" · "}
                    <a className="font-semibold text-fg-accent underline" href={`tel:${b.clientPhone.replace(/[^0-9+]/g, "")}`}>
                      {say("walker.call")} {b.clientPhone}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
            {b.dependant.profile.temperament ? <p className="text-sm text-fg-secondary">{b.dependant.profile.temperament}</p> : null}
            {b.hasAccessNotes ? <AccessNotes clientId={b.clientId} clientName={b.clientName} /> : null}
            {done ? <ReportBox booking={b} /> : null}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-col gap-3">
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        {visit.checkedInAt ? <p className="text-sm text-fg-secondary">{say("walker.startedAt", { time: time(visit.checkedInAt) })}</p> : null}
        {done ? <p className="text-sm text-fg-secondary">{say("walker.endedAt", { time: time(visit.checkedOutAt!), minutes: visit.minutes ?? 0 })}</p> : null}
        {!visit.checkedInAt ? (
          <Button size="lg" variant="primary" className="w-full" loading={call.pending} onClick={() => call.run(`/api/walker/visits/${visit.appointmentId}/check-in`)}>
            {say("walker.checkIn")}
          </Button>
        ) : null}
        {live ? (
          <Button size="lg" variant="primary" className="w-full" loading={call.pending} onClick={() => call.run(`/api/walker/visits/${visit.appointmentId}/check-out`)}>
            {say("walker.checkOut")}
          </Button>
        ) : null}
      </div>
    </Card.Root>
  );
}

const reportForm = createKrizakaForm({
  schema: z.object({ note: z.string().trim().min(1).max(1000), photos: z.array(z.instanceof(File)).max(1) }),
  defaultValues: { note: "", photos: [] as File[] },
});

function ReportBox({ booking }: { booking: DayVisitView["bookings"][number] }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [notice, setNotice] = useState<{ tone: "success" | "info" | "danger"; text: string } | null>(null);
  const report = booking.report;
  const owner = booking.clientName.split(" ")[0] ?? booking.clientName;
  const form = reportForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: { note: report?.note ?? "", photos: [] },
    onSubmit: async (values) => {
      setNotice(null);
      const body = new FormData();
      body.set("note", values.note);
      if (values.photos[0]) body.set("photo", await shrinkImage(values.photos[0]), "walk.jpg");
      if ((await call.run(`/api/walker/bookings/${booking.bookingId}/report`, { body })) !== null) setNotice({ tone: "success", text: say("walker.saved") });
    },
  });
  const send = async () => {
    setNotice(null);
    const result = await call.run<{ status: "sent" | "pending" | "failed" }>(`/api/walker/bookings/${booking.bookingId}/report/send`);
    if (!result) return;
    setNotice(result.status === "sent" ? { tone: "success", text: say("walker.sentNow", { owner }) } : result.status === "pending" ? { tone: "info", text: say("walker.queued") } : { tone: "danger", text: say("walker.failed") });
  };
  return (
    <div className="rounded-lg border border-border-default bg-surface-1 p-3">
      <h3 className="mb-2 font-display text-sm font-bold text-fg">{say("walker.reportTitle", { dog: booking.dependant.name })}</h3>
      <form.Form aria-label={say("walker.reportTitle", { dog: booking.dependant.name })} className="flex flex-col gap-3">
        <form.TextArea name="note" label={say("walker.note")} placeholder={say("walker.notePlaceholder")} rows={3} maxLength={1000} />
        <form.FileUpload
          name="photos"
          label={say("walker.photo")}
          title={say("walker.photoTitle")}
          browseLabel={say("walker.photoBrowse")}
          hint={report?.hasPhoto ? `${say("walker.photoAttached")} ${say("walker.photoHint")}` : say("walker.photoHint")}
          accept="image/*"
          maxSize={MAX_PHOTO_BEFORE_SHRINK}
          maxFiles={1}
          removeLabel={(name) => say("walker.photoRemove", { name })}
          refusalLabel={(r) => say("walker.photoTooBig", { name: r.file.name })}
        />
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
        <div className="flex flex-wrap items-center gap-2">
          <form.Submit size="md" variant="secondary">
            {say("walker.save")}
          </form.Submit>
          {report ? (
            <Button size="md" variant="primary" loading={call.pending} onClick={send}>
              {report.sentAt ? say("walker.sendAgain") : say("walker.send", { owner })}
            </Button>
          ) : null}
          {report?.sentAt ? <span className="text-sm text-fg-secondary">{say("walker.sentOn", { date: new Date(report.sentAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium" }) })}</span> : null}
        </div>
      </form.Form>
    </div>
  );
}
