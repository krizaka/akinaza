"use client";

import type { DependantProfile } from "@akinaza/core";
import { Badge } from "@krizaka/ui/badge";

import { AccessNotes } from "@/components/app/AccessNotes";
import { useSay, useVocabulary } from "@/lib/i18n-client";

export interface DependantView {
  id: string;
  name: string;
  kind: "dog" | "cat" | "other";
  profile: DependantProfile;
}

/** A client's dogs (or whoever the business type calls their dependants): breed, size, temperament, vet and emergency contact. Nothing for a business with none. */
export function DependantsList({ dependants }: Readonly<{ dependants: DependantView[] }>) {
  const { say } = useSay();
  const vocabulary = useVocabulary();
  if (!vocabulary.dependants || dependants.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {dependants.map((d) => (
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
  );
}

/** The access notes (keys, door codes) open on demand, only where the business type keeps dependants. */
export function AccessNotesFor({ clientId, clientName, present }: { clientId: string; clientName: string; present: boolean }) {
  const vocabulary = useVocabulary();
  return vocabulary.dependants && present ? <AccessNotes clientId={clientId} clientName={clientName} /> : null;
}
