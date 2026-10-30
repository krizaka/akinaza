"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Chip } from "@krizaka/ui/chip";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { CANADIAN_CHOICES, choiceOf, OTHER_CHOICES, type RegionChoice, residencyOfSaved, settingsOf } from "@/lib/storage-regions";

export interface SavedStorage {
  provider: string;
  endpoint: string;
  region: string;
  bucket: string;
}

/**
 * Where the files are kept (akinaza#397): the administrator picks a provider and region (Toronto first), sees at once what the residency
 * sentence will say (the package's region table, never a guess in Canada's favour), and saves it. Saved through the audited settings
 * route; the access keys never come through this screen.
 */
export function StorageRegion({ saved }: Readonly<{ saved: SavedStorage }>) {
  const { say } = useSay();
  const call = useCall();
  const [choice, setChoice] = useState<RegionChoice | null>(choiceOf(saved));
  const [bucket, setBucket] = useState(saved.bucket);
  const [done, setDone] = useState(false);
  const all = [...CANADIAN_CHOICES, ...OTHER_CHOICES];
  const label = (c: RegionChoice) => say("admin.storage.regionLabel", { provider: say(`admin.storage.provider.${c.preset}`), region: c.region });
  const shown = choice ? choice.residency.key : residencyOfSaved(saved);
  const save = async () => {
    if (!choice) return;
    setDone(false);
    const entries = Object.entries({ ...settingsOf(choice), "storage.bucket": bucket.trim() });
    for (const [key, value] of entries) {
      if ((await call.run(`/api/admin/settings/${key}`, { method: "PUT", json: { scope: "global", value } }, { refresh: false })) === null) return;
    }
    setDone(true);
  };
  const group = (id: string, title: string, choices: RegionChoice[]) => (
    // @ephemeral: a draft choice in a form, saved with the button below; the saved value is read from the database on every visit
    <Chip.Group type="single" label={title} value={choice?.id ?? ""} onValueChange={(v) => setChoice(all.find((c) => c.id === v) ?? choice)} data-group={id}>
      {choices.map((c) => (
        <Chip key={c.id} value={c.id}>
          {label(c)}
        </Chip>
      ))}
    </Chip.Group>
  );
  return (
    <section className="flex flex-col gap-4" aria-label={say("admin.storage.pick")}>
      <h2 className="font-display text-lg font-bold text-fg">{say("admin.storage.pick")}</h2>
      {group("canada", say("admin.storage.canada"), CANADIAN_CHOICES)}
      {group("elsewhere", say("admin.storage.elsewhere"), OTHER_CHOICES)}
      <label className="flex max-w-sm flex-col gap-1 text-sm text-fg">
        {say("admin.storage.bucket")}
        <input className="rounded-md border border-line bg-surface px-3 py-2 text-fg" value={bucket} onChange={(e) => setBucket(e.target.value)} maxLength={63} autoComplete="off" spellCheck={false} />
        <span className="text-fg-secondary">{say("admin.storage.bucketHint")}</span>
      </label>
      <p className="text-sm text-fg-secondary">{choice ? say("admin.storage.preview") : say("admin.storage.current")}</p>
      <p className="max-w-prose font-medium text-fg" data-residency={shown}>
        {say(`admin.storage.residency.${shown}`)}
      </p>
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {done ? <Alert tone="success">{say("admin.storage.saved")}</Alert> : null}
      <Button variant="primary" size="md" className="self-start" disabled={call.pending || !choice || bucket.trim().length === 0} onClick={save}>
        {say("admin.storage.save")}
      </Button>
    </section>
  );
}
