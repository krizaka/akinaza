"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useRef, useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { serviceHref } from "@/lib/journey-paths";

export interface RequestsData {
  clientId: string;
  shopSlug: string | null;
  requests: { id: string; title: string; note: string | null; serviceId: string; serviceNameFr: string; serviceNameEn: string; staffId: string | null; staffName: string | null; zoneId: string | null; files: { id: string; url: string; kind: "image" | "pdf" }[] }[];
  /** The shop's catalogue, to choose from: only when its public page is published (the renewal opens its booking journey). */
  catalogue: { services: { id: string; nameFr: string; nameEn: string }[]; staff: { id: string; name: string }[] } | null;
}

const ANYONE = "";
const requestForm = createKrizakaForm({
  schema: z.object({ serviceId: z.string().min(1), staffId: z.string(), title: z.string().trim().min(1).max(80), note: z.string().trim().max(500) }),
  defaultValues: { serviceId: "", staffId: ANYONE, title: "", note: "" },
});

/**
 * « Mes demandes » (akinaza#210): requests kept at the shop, renewed in one tap, with a photo or a document attached. The form
 * is folded behind « Garder une demande » and opens in place (D7); renewing is a secondary — the screen keeps one primary.
 */
export function RequestsCard({ data }: { data: RequestsData }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [adding, setAdding] = useState(false);
  const name = (s: { serviceNameFr: string; serviceNameEn: string } | { nameFr: string; nameEn: string }) => ("nameFr" in s ? { fr: s.nameFr, en: s.nameEn } : { fr: s.serviceNameFr, en: s.serviceNameEn })[locale];
  const i18n = { t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale };
  const form = requestForm.useForm({
    i18n,
    defaultValues: { serviceId: data.catalogue?.services[0]?.id ?? "", staffId: ANYONE, title: "", note: "" },
    onSubmit: async (values) => {
      const saved = await call.run("/api/me/requests", { json: { clientId: data.clientId, serviceId: values.serviceId, staffId: values.staffId || null, title: values.title, note: values.note || null } });
      if (saved !== null) {
        form.reset();
        setAdding(false);
      }
    },
  });
  if (!data.catalogue && data.requests.length === 0) return null;
  return (
    <Card.Root className="p-4">
      <h3 className="mb-1 font-display text-base font-bold text-fg">{say("client.requests.title")}</h3>
      <p className="mb-3 text-sm text-fg-secondary">{say("client.requests.lead")}</p>
      {data.requests.length ? (
        <ul className="mb-4 flex flex-col gap-3">
          {data.requests.map((r) => (
            <li key={r.id} className="rounded-md border border-border-default bg-surface-1 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{r.title}</p>
                  <p className="text-sm text-fg-secondary">{[name(r), r.staffName].filter(Boolean).join(" · ")}</p>
                  {r.note ? <p className="mt-1 text-sm text-fg">{r.note}</p> : null}
                </div>
                <div className="flex gap-2">
                  {data.shopSlug && data.catalogue ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={serviceHref(locale, data.shopSlug, r.serviceId, { staffId: r.staffId, zoneId: r.zoneId })}>{say("client.requests.renew")}</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" aria-label={say("client.requests.delete", { title: r.title })} onClick={() => call.run(`/api/me/requests/${r.id}`, { method: "DELETE", json: { clientId: data.clientId } })}>
                    ×
                  </Button>
                </div>
              </div>
              <RequestFiles request={r} clientId={data.clientId} call={call} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-fg-secondary">{say("client.requests.none")}</p>
      )}
      {data.catalogue && !adding ? (
        <Button size="md" variant="secondary" className="w-full sm:w-auto sm:self-start" aria-expanded={false} onClick={() => setAdding(true)}>
          {say("client.requests.open")}
        </Button>
      ) : null}
      {data.catalogue && adding ? (
        <form.Form aria-label={say("client.requests.add")} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <form.TextField name="title" label={say("client.requests.titleField")} placeholder={say("client.requests.titlePlaceholder")} />
          <form.Select name="serviceId" label={say("client.requests.service")} options={data.catalogue.services.map((s) => ({ value: s.id, label: name(s) }))} />
          <form.Select name="staffId" label={say("client.requests.staff")} options={[{ value: ANYONE, label: say("client.requests.anyone") }, ...data.catalogue.staff.map((s) => ({ value: s.id, label: s.name }))]} />
          <form.TextField name="note" label={say("client.requests.note")} />
          <div className="flex flex-col gap-3 sm:col-span-2">
            {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
            <form.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">
              {say("client.requests.add")}
            </form.Submit>
          </div>
        </form.Form>
      ) : null}
    </Card.Root>
  );
}

function RequestFiles({ request, clientId, call }: { request: RequestsData["requests"][number]; clientId: string; call: ReturnType<typeof useCall> }) {
  const { say } = useSay();
  const input = useRef<HTMLInputElement>(null);
  const send = async (file: File) => {
    const body = new FormData();
    body.set("clientId", clientId);
    body.set("file", file);
    await call.run(`/api/me/requests/${request.id}/files`, { body });
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {request.files.map((f) => (
        <span key={f.id} className="inline-flex items-center gap-1 rounded-sm border border-border-default bg-surface-2 py-1 pl-2 pr-1 text-sm">
          <a href={f.url} target="_blank" rel="noreferrer" className="text-fg underline-offset-2 hover:underline">
            {say(f.kind === "pdf" ? "client.requests.filePdf" : "client.requests.fileImage")}
          </a>
          <Button size="sm" variant="ghost" shape="pill" aria-label={say("client.requests.fileRemove")} onClick={() => call.run(`/api/me/requests/${request.id}/files/${f.id}`, { method: "DELETE", json: { clientId } })}>
            ×
          </Button>
        </span>
      ))}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" aria-label={say("client.requests.attach")} onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <Button size="sm" variant="ghost" onClick={() => input.current?.click()}>
        {say("client.requests.attach")}
      </Button>
    </div>
  );
}
