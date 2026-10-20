"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { AlertDialog } from "@krizaka/ui/dialog";
import { createKrizakaForm } from "@krizaka/ui/form";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

export interface ClientFileView {
  client: { id: string; fullName: string; shopName: string; shopSlug: string | null };
  dogs: { id: string; name: string; breed: string | null }[];
  bookings: {
    bookingId: string;
    status: "booked" | "cancelled";
    visitStatus: "booked" | "done" | "cancelled" | "noShow";
    startsAt: string;
    service: { fr: string; en: string };
    zone: string | null;
    dependantName: string;
    report: { id: string; note: string; hasPhoto: boolean; durationMinutes: number } | null;
  }[];
  /** `now` as an ISO string, taken by the server: which bookings are still ahead. */
  now: string;
  timeZone: string;
}

/** The client's space: bookings (cancel, read the report), their dogs, and their rights over their data (Loi 25). */
export function ClientHome({ files }: { files: ClientFileView[] }) {
  const { say } = useSay();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-bold text-fg">{say("client.title")}</h1>
      {files.length === 0 ? <p className="text-fg-secondary">{say("client.none")}</p> : null}
      {files.map((f) => (
        <FileSection key={f.client.id} file={f} />
      ))}
    </div>
  );
}

function FileSection({ file }: { file: ClientFileView }) {
  const { say, locale } = useSay();
  const lang = locale === "fr" ? "fr-CA" : "en-CA";
  const when = (iso: string) => new Date(iso).toLocaleString(lang, { dateStyle: "full", timeStyle: "short", timeZone: file.timeZone });
  const upcoming = file.bookings.filter((b) => b.status === "booked" && b.visitStatus === "booked" && b.startsAt >= file.now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = file.bookings.filter((b) => !upcoming.includes(b));
  return (
    <section className="flex flex-col gap-4" aria-label={file.client.shopName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-fg">{file.client.shopName}</h2>
        {file.client.shopSlug ? (
          <Button asChild size="md" variant="primary">
            <Link href={`/${locale}/s/${file.client.shopSlug}/book`}>{say("client.bookAgain", { shop: file.client.shopName })}</Link>
          </Button>
        ) : null}
      </div>
      <BookingList title={say("client.upcoming")} items={upcoming} file={file} when={when} cancellable />
      <BookingList title={say("client.past")} items={past} file={file} when={when} />
      {file.dogs.length ? (
        <p className="text-sm text-fg-secondary">
          <strong className="text-fg">{say("client.dogsTitle")}</strong> · {file.dogs.map((d) => [d.name, d.breed].filter(Boolean).join(" · ")).join(" · ")}
        </p>
      ) : null}
      <PrivacyCard file={file} />
    </section>
  );
}

function BookingList({ title, items, file, when, cancellable = false }: { title: string; items: ClientFileView["bookings"]; file: ClientFileView; when: (iso: string) => string; cancellable?: boolean }) {
  const { say, locale } = useSay();
  const call = useCall();
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-fg-secondary">{title}</h3>
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      <ul className="flex flex-col gap-3">
        {items.map((b) => (
          <li key={b.bookingId}>
            <Card.Root className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-fg">
                    {b.dependantName} · {when(b.startsAt)}
                  </p>
                  <p className="text-sm text-fg-secondary">{say("client.line", { service: b.service[locale], zone: b.zone ?? "—" })}</p>
                </div>
                {b.status === "cancelled" ? <Badge tone="neutral">{say("client.cancelled")}</Badge> : null}
                {cancellable ? (
                  <AlertDialog
                    trigger={
                      <Button size="sm" variant="outline">
                        {say("client.cancel")}
                      </Button>
                    }
                    title={say("client.cancelConfirm")}
                    description={say("client.cancelDescription", { dog: b.dependantName, date: when(b.startsAt) })}
                    confirmLabel={say("client.cancelYes")}
                    cancelLabel={say("client.keep")}
                    tone="danger"
                    onConfirm={() => call.run(`/api/me/bookings/${b.bookingId}/cancel`, { json: { clientId: file.client.id } })}
                  />
                ) : null}
              </div>
              {b.report ? (
                <div className="mt-3 flex flex-col gap-3 border-t border-border-default pt-3 sm:flex-row">
                  {b.report.hasPhoto ? (
                    <Image className="h-40 w-full rounded-lg object-cover sm:w-56" src={`/api/me/reports/${b.report.id}/photo?clientId=${file.client.id}`} alt={say("report.photoAlt", { dog: b.dependantName })} width={448} height={320} unoptimized />
                  ) : null}
                  <div>
                    <p className="text-sm font-semibold text-fg">{say("client.report")} · {b.report.durationMinutes} min</p>
                    <p className="text-fg">{b.report.note}</p>
                  </div>
                </div>
              ) : null}
            </Card.Root>
          </li>
        ))}
      </ul>
    </div>
  );
}

const eraseForm = createKrizakaForm({ schema: z.object({ confirmEmail: z.string().trim().min(1).email() }), defaultValues: { confirmEmail: "" } });

function PrivacyCard({ file }: { file: ClientFileView }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [open, setOpen] = useState(false);
  const [erased, setErased] = useState(false);
  const form = eraseForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (v) => {
      if ((await call.run("/api/me/erase", { json: { clientId: file.client.id, confirmEmail: v.confirmEmail } })) !== null) setErased(true);
    },
  });
  if (erased) return <Alert tone="success">{say("client.erased")}</Alert>;
  return (
    <Card.Root className="p-4">
      <h3 className="font-display text-base font-bold text-fg">{say("client.privacyTitle")}</h3>
      <p className="mb-3 text-sm text-fg-secondary">{say("client.privacyIntro", { shop: file.client.shopName })}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="md" variant="secondary">
          <a href={`/api/me/export?clientId=${file.client.id}`} download>
            {say("client.export")}
          </a>
        </Button>
        <Button size="md" variant="danger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {say("client.erase", { shop: file.client.shopName })}
        </Button>
      </div>
      {open ? (
        <form.Form aria-label={say("client.eraseTitle")} className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-fg-secondary">{say("client.eraseDescription")}</p>
          <form.TextField name="confirmEmail" label={say("client.eraseEmail")} type="email" autoComplete="off" />
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          <form.Submit size="md" variant="danger" className="w-full sm:w-auto sm:self-start">
            {say("client.eraseYes")}
          </form.Submit>
        </form.Form>
      ) : null}
    </Card.Root>
  );
}
