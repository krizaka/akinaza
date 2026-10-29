"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

/**
 * The walker opens a client's access notes (keys, door codes) on demand: the list never carries them, each opening is
 * one request and one line of the audit log, and the text is forgotten again when hidden.
 */
export function AccessNotes({ clientId, clientName }: Readonly<{ clientId: string; clientName: string }>) {
  const { say } = useSay();
  const call = useCall();
  const [notes, setNotes] = useState<string | null | undefined>(undefined);
  if (notes === undefined) {
    return (
      <>
        <Button size="sm" variant="outline" loading={call.pending} onClick={async () => setNotes(((await call.run<{ notes: string | null }>(`/api/walker/clients/${clientId}/access-notes`, { method: "GET" }, { refresh: false }))?.notes ?? null) as string | null)}>
          {say("walker.reveal")}
        </Button>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={say("walker.notesTitle", { name: clientName })}>
      <p className="rounded-md border border-border-default bg-surface-2 px-3 py-2 font-mono text-sm text-fg">{notes ?? say("walker.noNotes")}</p>
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setNotes(undefined)}>
        {say("walker.hide")}
      </Button>
    </div>
  );
}
