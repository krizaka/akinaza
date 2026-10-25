"use client";

import { type BusinessType, invoiceState } from "@akinaza/core";
import { formatDate } from "@krizaka/intl";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { AlertDialog } from "@krizaka/ui/dialog";
import { EmptyState } from "@krizaka/ui/empty-state";
import { createKrizakaForm } from "@krizaka/ui/form";
import { List } from "@krizaka/ui/list";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import { RequestsCard,type RequestsData } from "@/components/app/RequestsCard";
import { useCall } from "@/components/app/useCall";
import { formatDate as formatDay, formatMoney, INTL_LOCALE } from "@/lib/format";
import { useSay, useVocabulary, VocabularyProvider } from "@/lib/i18n-client";
import { STATE_TONE } from "@/lib/invoice-tone";
import { accountRoutes } from "@/lib/routes";

export interface ClientFileView {
  client: { id: string; fullName: string; shopName: string; shopSlug: string | null; businessType: BusinessType };
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
  /** The invoices at this shop, each with what the ledger says of it (its state is derived: `invoiceState`). */
  invoices: { id: string; number: string; issuedOn: string; dueOn: string | null; totalCents: number; paidCents: number; creditOf: string | null; superseded: boolean }[];
  /** The requests kept at this shop, and what to choose from (akinaza#210). */
  requests: RequestsData;
  /** `now` as an ISO string, taken by the server: which bookings are still ahead. */
  now: string;
  /** The shop's calendar day (`yyyy-MM-dd`), taken by the server: an invoice's derived state. */
  today: string;
  timeZone: string;
}

/**
 * The client's space (K7, D7): « Mes réservations », their bookings at every shop they deal with (cancel, read the report), their
 * invoices as rows with their state, their requests (the form folded) and, once at the end, « Mes données » (Loi 25): a row per
 * shop to download, « Effacer » in its own block away from it. The screen's one primary action is booking again at the first
 * shop; « Ouvrir une boutique » is an action of the page, never a place on the rail.
 */
export function ClientHome({ files }: { files: ClientFileView[] }) {
  const { say, locale } = useSay();
  const primaryAt = files.findIndex((f) => f.client.shopSlug !== null);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={say("client.title")}
        actions={
          <Button asChild size="md" variant="secondary" className="w-full sm:w-auto">
            <Link href={accountRoutes(locale).openShop}>{say("client.openShop")}</Link>
          </Button>
        }
      />
      {files.length === 0 ? <EmptyState icon={<Mascot bird="beaver" mood="empty" size={120} />} title={say("client.emptyTitle")} description={say("client.emptyLead")} /> : null}
      {files.map((f, at) => (
        <VocabularyProvider key={f.client.id} type={f.client.businessType}>
          <FileSection file={f} primary={at === primaryAt} />
        </VocabularyProvider>
      ))}
      {files.length ? <DataSection files={files} /> : null}
    </div>
  );
}

function FileSection({ file, primary }: { file: ClientFileView; /** Whether « Réserver chez … » is the screen's primary action (one per screen). */ primary: boolean }) {
  const { say, locale } = useSay();
  const { dependants } = useVocabulary();
  const when = (iso: string) => formatDate(iso, { locale: INTL_LOCALE[locale], style: "long", timeStyle: "short", timeZone: file.timeZone });
  const upcoming = file.bookings.filter((b) => b.status === "booked" && b.visitStatus === "booked" && b.startsAt >= file.now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = file.bookings.filter((b) => !upcoming.includes(b));
  return (
    <section className="flex flex-col gap-4" aria-label={file.client.shopName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 break-words font-display text-xl font-bold text-fg">{file.client.shopName}</h2>
        {file.client.shopSlug ? (
          <Button asChild size="md" variant={primary ? "primary" : "secondary"} className="w-full sm:w-auto">
            <Link href={`/${locale}/s/${file.client.shopSlug}/book`}>{say("client.bookAgain", { shop: file.client.shopName })}</Link>
          </Button>
        ) : null}
      </div>
      <BookingList title={say("client.upcoming")} items={upcoming} file={file} when={when} cancellable />
      <BookingList title={say("client.past")} items={past} file={file} when={when} />
      {file.invoices.length ? <InvoiceRows file={file} /> : null}
      {dependants && file.dogs.length ? (
        <p className="text-sm text-fg-secondary">
          <strong className="text-fg">{say("client.dogsTitle")}</strong> · {file.dogs.map((d) => [d.name, d.breed].filter(Boolean).join(" · ")).join(" · ")}
        </p>
      ) : null}
      <RequestsCard data={file.requests} />
    </section>
  );
}

const standing = (i: ClientFileView["invoices"][number]) => ({ totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: i.creditOf !== null, superseded: i.superseded });

/** A shop's invoices as rows (D7): the number, the day it was issued, its state in the list's words and tone, its amount. */
function InvoiceRows({ file }: { file: ClientFileView }) {
  const { say, locale } = useSay();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-display text-sm font-bold text-fg-secondary">{say("client.invoiceTitle")}</h3>
      <List
        aria-label={say("client.invoiceTitle")}
        density="compact"
        chevrons
        items={file.invoices}
        getId={(i) => i.id}
        row={(i) => {
          const state = invoiceState(standing(i), file.today);
          return {
            title: i.number,
            description: say("client.invoiceIssued", { date: formatDay(`${i.issuedOn}T12:00:00Z`, locale, "UTC") }),
            meta: (
              <span className="flex flex-wrap items-center justify-end gap-2">
                <Badge tone={STATE_TONE[state]} data-state={state}>
                  {say(`invoices.state.${state}`)}
                </Badge>
                <span className="tabular-nums text-fg">{formatMoney(i.totalCents, locale)}</span>
              </span>
            ),
            href: accountRoutes(locale).invoice(i.id),
          };
        }}
      />
    </section>
  );
}

/**
 * « Mes données » (Loi 25), once for every shop (D7): a row per shop with its download, then « Effacer un dossier » in a block of
 * its own, so the danger is never beside the copy. Each erasure speaks the shop's vocabulary.
 */
function DataSection({ files }: { files: ClientFileView[] }) {
  const { say } = useSay();
  return (
    <section aria-labelledby="client-data" className="flex flex-col gap-4 border-t border-border-default pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="client-data" className="font-display text-xl font-bold text-fg">
          {say("client.privacyTitle")}
        </h2>
        <p className="text-sm text-fg-secondary">{say("client.dataLead")}</p>
      </div>
      <List
        aria-label={say("client.privacyTitle")}
        density="compact"
        items={files}
        getId={(f) => f.client.id}
        row={(f) => ({
          title: f.client.shopName,
          actions: (
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/me/export?clientId=${f.client.id}`} download aria-label={say("client.exportFor", { shop: f.client.shopName })}>
                {say("client.exportShort")}
              </a>
            </Button>
          ),
        })}
      />
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-fg-secondary">{say("client.eraseHeading")}</h3>
          <p className="text-sm text-fg-secondary">{say("client.eraseLead")}</p>
        </div>
        {files.map((f) => (
          <VocabularyProvider key={f.client.id} type={f.client.businessType}>
            <EraseFile file={f} />
          </VocabularyProvider>
        ))}
      </div>
    </section>
  );
}

function BookingList({ title, items, file, when, cancellable = false }: { title: string; items: ClientFileView["bookings"]; file: ClientFileView; when: (iso: string) => string; cancellable?: boolean }) {
  const { say, locale } = useSay();
  const call = useCall();
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-sm font-bold text-fg-secondary">{title}</h3>
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
                  <p className="text-sm text-fg-secondary">{b.zone ? say("client.line", { service: b.service[locale], zone: b.zone }) : b.service[locale]}</p>
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

function EraseFile({ file }: { file: ClientFileView }) {
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
    <div className="flex flex-col gap-3">
      <Button size="md" variant="danger" className="h-auto min-h-11 w-full whitespace-normal sm:w-auto sm:self-start" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {say("client.erase", { shop: file.client.shopName })}
      </Button>
      {open ? (
        <Card.Root className="p-4">
          <form.Form aria-label={say("client.eraseTitle")} className="flex flex-col gap-3">
            <p className="text-sm text-fg-secondary">{say("client.eraseDescription")}</p>
            <form.TextField name="confirmEmail" label={say("client.eraseEmail")} type="email" autoComplete="off" />
            {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
            <form.Submit size="md" variant="danger" className="w-full sm:w-auto sm:self-start">
              {say("client.eraseYes")}
            </form.Submit>
          </form.Form>
        </Card.Root>
      ) : null}
    </div>
  );
}
