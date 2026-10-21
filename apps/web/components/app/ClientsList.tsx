"use client";

import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";

import { AccessNotes } from "@/components/app/AccessNotes";
import { useSay, useVocabulary } from "@/lib/i18n-client";

export interface ClientView {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  hasNotes: boolean;
  dependants: { id: string; name: string; kind: "dog" | "cat" | "other"; profile: { breed?: string; size?: "small" | "medium" | "large"; temperament?: string; vet?: { name: string; phone: string }; emergency?: { name: string; phone: string } } }[];
}

/** The walker's clients and their dogs: breed, size, temperament, vet and emergency contact; the access notes on demand. */
export function ClientsList({ clients }: { clients: ClientView[] }) {
  const { say } = useSay();
  const { dependants } = useVocabulary();
  if (clients.length === 0) return <p className="text-fg-secondary">{say("clients.none")}</p>;
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {clients.map((c) => (
        <li key={c.id}>
          <Card.Root className="h-full p-4">
            <h2 className="font-display text-base font-bold text-fg">{c.fullName}</h2>
            <p className="text-sm text-fg-secondary">
              {c.phone ? (
                <a className="text-fg-accent underline" href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}>
                  {c.phone}
                </a>
              ) : null}
              {c.phone && c.email ? " · " : ""}
              {c.email}
            </p>
            {dependants ? (
            <ul className="mt-3 flex flex-col gap-2">
              {c.dependants.map((d) => (
                <li key={d.id} className="rounded-lg border border-border-default bg-surface-1 p-3">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                    {d.name} <Badge tone="neutral">{say(`clients.kinds.${d.kind}`)}</Badge>
                    <span className="text-sm font-normal text-fg-secondary">{[d.profile.breed, d.profile.size ? say(`clients.sizes.${d.profile.size}`) : null].filter(Boolean).join(" · ")}</span>
                  </p>
                  {d.profile.temperament ? <p className="text-sm text-fg-secondary">{d.profile.temperament}</p> : null}
                  {d.profile.vet ? <p className="text-xs text-fg-muted">{say("clients.vet", d.profile.vet)}</p> : null}
                  {d.profile.emergency ? <p className="text-xs text-fg-muted">{say("clients.emergency", d.profile.emergency)}</p> : null}
                </li>
              ))}
            </ul>
            ) : null}
            {dependants && c.hasNotes ? (
              <div className="mt-3">
                <AccessNotes clientId={c.id} clientName={c.fullName} />
              </div>
            ) : null}
          </Card.Root>
        </li>
      ))}
    </ul>
  );
}
