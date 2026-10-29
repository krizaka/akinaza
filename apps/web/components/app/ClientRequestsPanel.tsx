"use client";

import { Card } from "@krizaka/ui/card";

import { useSay } from "@/lib/i18n-client";

export interface ShopRequestView {
  id: string;
  title: string;
  note: string | null;
  service: { fr: string; en: string };
  staffName: string | null;
  files: { id: string; url: string; kind: "image" | "pdf" }[];
}

/** What the client keeps at the shop (akinaza#210), for the team preparing the visit: read only, the files to open. */
export function ClientRequestsPanel({ requests }: Readonly<{ requests: ShopRequestView[] }>) {
  const { say, locale } = useSay();
  if (!requests.length) return null;
  return (
    <Card.Root className="p-4">
      <h3 className="mb-1 font-display text-base font-bold text-fg">{say("clients.requests.title")}</h3>
      <p className="mb-3 text-sm text-fg-secondary">{say("clients.requests.lead")}</p>
      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.id} className="rounded-md border border-border-default bg-surface-1 p-3">
            <p className="font-semibold text-fg">{r.title}</p>
            <p className="text-sm text-fg-secondary">{[r.service[locale], r.staffName].filter(Boolean).join(" · ")}</p>
            {r.note ? <p className="mt-1 text-sm text-fg">{r.note}</p> : null}
            {r.files.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {r.files.map((f, n) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex rounded-sm border border-border-default bg-surface-2 px-2 py-1 text-sm text-fg underline-offset-2 hover:underline">
                      {say(f.kind === "pdf" ? "clients.requests.pdf" : "clients.requests.photo", { n: n + 1 })}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </Card.Root>
  );
}
