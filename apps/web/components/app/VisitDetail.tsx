"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useState } from "react";
import { z } from "zod";

import { AccessNotes } from "@/components/app/AccessNotes";
import { useCall } from "@/components/app/useCall";
import { formatDate, formatTime } from "@/lib/format";
import { useSay, useVocabulary } from "@/lib/i18n-client";
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

/**
 * What a visit holds, the same in the walker's card (a phone in the street) and in the owner's side sheet (the agenda):
 * each booking with its dog (breed · size · temperament), its owner and a way to call, the access notes folded, and the
 * report once the visit is done.
 */
export function VisitBookings({ visit, timeZone }: Readonly<{ visit: DayVisitView; timeZone: string }>) {
  const { say } = useSay();
  const { dependants, visitReports } = useVocabulary();
  const done = !!visit.checkedOutAt;
  return (
    <ul className="flex flex-col divide-y divide-border-default">
      {visit.bookings.map((b) => (
        <li key={b.bookingId} className="flex flex-col gap-2 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {dependants ? (
              <p className="text-base font-semibold text-fg">
                {b.dependant.name}
                <span className="ml-2 text-sm font-normal text-fg-secondary">{[b.dependant.profile.breed, b.dependant.profile.size ? say(`clients.sizes.${b.dependant.profile.size}`) : null].filter(Boolean).join(" · ")}</span>
              </p>
            ) : null}
            <p className={dependants ? "text-sm text-fg-secondary" : "text-base font-semibold text-fg"}>
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
          {dependants && b.dependant.profile.temperament ? <p className="text-sm text-fg-secondary">{b.dependant.profile.temperament}</p> : null}
          {dependants && b.hasAccessNotes ? <AccessNotes clientId={b.clientId} clientName={b.clientName} /> : null}
          {done && visitReports ? <ReportBox booking={b} timeZone={timeZone} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Where the visit stands — started at, ended at — and its next step: start it, then end it. `wide` fills a phone's card. */
export function VisitProgress({ visit, timeZone, wide = false }: Readonly<{ visit: DayVisitView; timeZone: string; wide?: boolean }>) {
  const { say, locale } = useSay();
  const call = useCall();
  const live = visit.checkedInAt && !visit.checkedOutAt;
  const done = !!visit.checkedOutAt;
  const size = wide ? "lg" : "md";
  const className = wide ? "w-full" : undefined;
  return (
    <div className="flex flex-col gap-3">
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {visit.checkedInAt ? <p className="text-sm text-fg-secondary">{say("walker.startedAt", { time: formatTime(visit.checkedInAt, locale, timeZone) })}</p> : null}
      {done ? <p className="text-sm text-fg-secondary">{say("walker.endedAt", { time: formatTime(visit.checkedOutAt!, locale, timeZone), minutes: visit.minutes ?? 0 })}</p> : null}
      {!visit.checkedInAt ? (
        <Button size={size} variant="primary" className={className} loading={call.pending} onClick={() => call.run(`/api/walker/visits/${visit.appointmentId}/check-in`)}>
          {say("walker.checkIn")}
        </Button>
      ) : null}
      {live ? (
        <Button size={size} variant="primary" className={className} loading={call.pending} onClick={() => call.run(`/api/walker/visits/${visit.appointmentId}/check-out`)}>
          {say("walker.checkOut")}
        </Button>
      ) : null}
    </div>
  );
}

const reportForm = createKrizakaForm({
  schema: z.object({ note: z.string().trim().min(1).max(1000), photos: z.array(z.instanceof(File)).max(1) }),
  defaultValues: { note: "", photos: [] as File[] },
});

/** The report of a visit for one dog: a note and a photo, saved, then sent to the owner. */
export function ReportBox({ booking, timeZone }: Readonly<{ booking: DayVisitView["bookings"][number]; timeZone: string }>) {
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
    const notices = {
      sent: { tone: "success", text: say("walker.sentNow", { owner }) },
      pending: { tone: "info", text: say("walker.queued") },
      failed: { tone: "danger", text: say("walker.failed") },
    } as const;
    setNotice(notices[result.status]);
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
          {report?.sentAt ? <span className="text-sm text-fg-secondary">{say("walker.sentOn", { date: formatDate(report.sentAt, locale, timeZone) })}</span> : null}
        </div>
      </form.Form>
    </div>
  );
}
