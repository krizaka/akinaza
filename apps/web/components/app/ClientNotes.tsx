"use client";

import type { ClientNote } from "@akinaza/db";
import { Alert } from "@krizaka/ui/alert";
import { createKrizakaForm } from "@krizaka/ui/form";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { formatDate } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

const noteForm = createKrizakaForm({ schema: z.object({ body: z.string().trim().min(1).max(2000) }), defaultValues: { body: "" } });

/**
 * The notes column of a client's file (D5): each note signed and dated on one line (who · when), newest first, and « Ajouter
 * une note » — saved for the shop under the author's name. One field, one save.
 */
export function ClientNotes({ clientId, notes, timeZone }: Readonly<{ clientId: string; notes: ClientNote[]; timeZone: string }>) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = noteForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async ({ body }) => {
      if (await call.run(`/api/walker/clients/${clientId}/notes`, { json: { body } })) form.reset({ body: "" });
    },
  });
  return (
    <section aria-labelledby="client-notes" className="flex flex-col gap-4">
      <h2 id="client-notes" className="text-lg font-semibold text-fg">
        {say("clients.file.notes")}
      </h2>
      {notes.length === 0 ? (
        <p className="text-sm text-fg-secondary">{say("clients.file.noNotes")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 border-b border-border-subtle pb-3">
              <p className="whitespace-pre-line text-sm text-fg">{n.body}</p>
              <p className="whitespace-nowrap text-xs text-fg-muted">{`${n.author} · ${formatDate(n.createdAt, locale, timeZone)}`}</p>
            </li>
          ))}
        </ol>
      )}
      <form.Form aria-label={say("clients.file.addNote")} className="flex flex-col gap-2">
        <form.TextArea name="body" label={say("clients.file.addNote")} rows={3} maxLength={2000} />
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <form.Submit size="sm" variant="secondary" className="self-start" disabled={call.pending}>
          {say("clients.file.saveNote")}
        </form.Submit>
      </form.Form>
    </section>
  );
}
