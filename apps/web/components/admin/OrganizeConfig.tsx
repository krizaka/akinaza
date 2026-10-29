"use client";

import { type KindConfig, kindConfigProblems, type StatusSet } from "@krizaka/organize/contract";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Chip } from "@krizaka/ui/chip";
import { StatusSetEditor, type StatusSetEditorLabels, TagSetEditor, type TagSetEditorLabels } from "@krizaka/ui/kind-config-editor";
import { useMemo, useState } from "react";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

const ROLES = ["owner", "manager", "staff"] as const;
const MARKER_KEYS = ["blue", "green", "amber", "red", "violet", "gray"] as const;
const TONES = ["neutral", "accent", "success", "warning", "danger"] as const;

export interface StoredKind {
  kind: "client" | "invoice";
  config: KindConfig;
  version: number;
}

/**
 * The administrator's configuration of a kind (akinaza#337): the package's `TagSetEditor` (who manages tags, the set offered by trade) and,
 * when the kind has a status set, its `StatusSetEditor`. Saved at the version read (409 when someone else saved first), audited.
 */
export function OrganizeConfig({ stored }: Readonly<{ stored: StoredKind }>) {
  const { say, locale } = useSay();
  const call = useCall();
  const [config, setConfig] = useState<KindConfig>(stored.config);
  const [version, setVersion] = useState(stored.version);
  const [variant, setVariant] = useState(Object.keys(stored.config.tags.presets)[0] ?? "default");
  const [saved, setSaved] = useState(false);
  const problems = useMemo(() => kindConfigProblems(config), [config]);
  const roles = ROLES.map((key) => ({ key, label: say(`admin.organize.roles.${key}`) }));
  const tagLabels = useMemo<Partial<TagSetEditorLabels>>(
    () => ({
      presets: say("admin.organize.tags.presets"),
      name: (position) => say("admin.organize.tags.name", { position }),
      marker: (name) => say("admin.organize.tags.marker", { name }),
      markerNames: Object.fromEntries(MARKER_KEYS.map((m) => [m, say(`organize.markers.${m}`)])) as TagSetEditorLabels["markerNames"],
      moveUp: (name) => say("admin.organize.tags.moveUp", { name }),
      moveDown: (name) => say("admin.organize.tags.moveDown", { name }),
      remove: (name) => say("admin.organize.tags.remove", { name }),
      drag: (name) => say("admin.organize.tags.drag", { name }),
      add: say("admin.organize.tags.add"),
      addButton: say("admin.organize.tags.addButton"),
      duplicate: say("admin.organize.tags.duplicate"),
      empty: say("admin.organize.tags.empty"),
      writers: say("admin.organize.tags.writers"),
      writersHint: say("admin.organize.tags.writersHint"),
      userTags: say("admin.organize.tags.userTags"),
      userTagsHint: say("admin.organize.tags.userTagsHint"),
      max: say("admin.organize.tags.max"),
      maxHint: say("admin.organize.tags.maxHint"),
      problems: say("admin.organize.tags.problems"),
    }),
    [say],
  );
  const statusLabels = useMemo<Partial<StatusSetEditorLabels>>(
    () => ({
      languages: { fr: say("admin.organize.status.languageFr"), en: say("admin.organize.status.languageEn") },
      stateLabel: (language, position) => say("admin.organize.status.stateLabel", { language, position }),
      tone: (position) => say("admin.organize.status.tone", { position }),
      tones: Object.fromEntries(TONES.map((t) => [t, say(`admin.organize.status.tones.${t}`)])) as StatusSetEditorLabels["tones"],
      final: (position) => say("admin.organize.status.final", { position }),
      finalHint: say("admin.organize.status.finalHint"),
      initial: (position) => say("admin.organize.status.initial", { position }),
      initialNotFinal: say("admin.organize.status.initialNotFinal"),
      states: say("admin.organize.status.states"),
      moveUp: (name) => say("admin.organize.tags.moveUp", { name }),
      moveDown: (name) => say("admin.organize.tags.moveDown", { name }),
      remove: (name) => say("admin.organize.tags.remove", { name }),
      drag: (name) => say("admin.organize.tags.drag", { name }),
      addState: say("admin.organize.status.addState"),
      newState: { fr: say("admin.organize.status.newState"), en: say("admin.organize.status.newState") },
      moves: say("admin.organize.status.moves"),
      movesHint: say("admin.organize.status.movesHint"),
      from: (name) => say("admin.organize.status.from", { name }),
      noWayOut: say("admin.organize.status.noWayOut"),
      move: (from, to, who) => say("admin.organize.status.move", { from, to, roles: who }),
      none: say("admin.organize.status.none"),
      moveDetail: (from, to) => say("admin.organize.status.moveDetail", { from, to }),
      roles: say("admin.organize.status.roles"),
      confirm: say("admin.organize.status.confirm"),
      reasons: say("admin.organize.status.reasons"),
      addReason: say("admin.organize.status.addReason"),
      reasonLabel: (language, position) => say("admin.organize.status.reasonLabel", { language, position }),
      removeReason: (position) => say("admin.organize.status.removeReason", { position }),
      derived: say("admin.organize.status.derived"),
      problems: say("admin.organize.status.problems"),
    }),
    [say],
  );
  const save = async () => {
    setSaved(false);
    const result = await call.run<{ stored: { version: number } }>(`/api/admin/organize/${stored.kind}/config`, { method: "PUT", json: { config, version } });
    if (result) {
      setVersion(result.stored.version);
      setSaved(true);
    }
  };
  const status: StatusSet | null = config.status;
  return (
    <section className="flex flex-col gap-4" aria-label={say(`admin.organize.kind.${stored.kind}`)} data-kind={stored.kind}>
      <h2 className="font-display text-lg font-bold text-fg">{say(`admin.organize.kind.${stored.kind}`)}</h2>
      <p className="text-sm text-fg-secondary">{say("admin.organize.variantHint")}</p>
      <Chip.Group type="single" label={say("admin.organize.variant")} value={variant} onValueChange={(v) => v && setVariant(v)}>
        {Object.keys(config.tags.presets).map((v) => (
          <Chip key={v} value={v}>
            {v}
          </Chip>
        ))}
      </Chip.Group>
      <TagSetEditor value={config.tags} onChange={(tags) => setConfig({ ...config, tags })} variant={variant} roles={roles} problems={problems} labels={tagLabels} />
      {status ? <StatusSetEditor value={status} onChange={(next) => setConfig({ ...config, status: next })} roles={roles} locale={locale} labels={statusLabels} /> : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {saved ? <Alert tone="success">{say("admin.organize.saved")}</Alert> : null}
      <Button variant="primary" size="md" className="self-start" disabled={call.pending || problems.length > 0} onClick={save}>
        {say("admin.organize.save")}
      </Button>
    </section>
  );
}
