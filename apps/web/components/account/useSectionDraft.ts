"use client";

import { type SettingsSection, useSaveStatus } from "@krizaka/ui/settings-layout";
import { useRouter } from "next/navigation";
import { type ComponentProps, useState } from "react";

type SectionSave = NonNullable<ComponentProps<typeof SettingsSection>["save"]>;

import { useSay } from "@/lib/i18n-client";

/**
 * One section's draft: the fields change locally, the section's own save sends them in one call (dirty enables it), the status is
 * said in words, and an undo puts the previous values back. `persist` throws to say it failed.
 */
export function useSectionDraft<T extends object>(saved: T, persist: (values: T) => Promise<void>) {
  const { say } = useSay();
  const router = useRouter();
  const [draft, setDraft] = useState(saved);
  const [kept, setKept] = useState(saved);
  const [before, setBefore] = useState(saved);
  const status = useSaveStatus();
  const run = (values: T) => status.track(async () => {
    await persist(values);
    router.refresh();
  });
  const save: SectionSave = {
    dirty: JSON.stringify(draft) !== JSON.stringify(kept),
    status: status.status,
    labels: { save: say("account.save.save"), saving: say("account.save.saving"), saved: say("account.save.saved"), error: say("account.save.error"), undo: say("account.save.undo"), discard: say("account.save.discard") },
    onDiscard: () => setDraft(kept),
    onSave: () => {
      setBefore(kept);
      setKept(draft);
      void run(draft);
    },
    onUndo: () => {
      setDraft(before);
      setKept(before);
      void run(before);
    },
  };
  return { draft, set: (patch: Partial<T>) => setDraft({ ...draft, ...patch }), save };
}
