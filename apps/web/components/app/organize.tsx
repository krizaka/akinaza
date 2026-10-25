"use client";

import { MARKERS, type ViewFilters } from "@krizaka/organize/contract";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { ChipLink } from "@krizaka/ui/chip-link";
import { Dialog } from "@krizaka/ui/dialog";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import { createKrizakaForm } from "@krizaka/ui/form";
import { Tabs } from "@krizaka/ui/tabs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { listHref, MARKER_HUE, type OrganizeData, type TagLite } from "@/lib/organize-view";

/**
 * The shop's organisation of a list (akinaza#337, krizaka-ts ADR-003): tags with a colour marker, the binder's dividers per tag, the
 * saved views, and the selection's bulk tag and untag. These are THIN wrappers over @krizaka/ui pieces until krizaka-ui#627 ships
 * the real ones (TagChip, StatusChip, saved views in FilterBar, the DataTable selection bar) and krizaka-ui#690 the owner's tag-set
 * editor: delete this file's pieces as they land. Nothing here moves an invoice's state — it is derived from the ledger.
 */

/** TODO krizaka-ui#627: TagChip. A tag: its marker (a dot of the closed palette, never the only signal) and its name. */
export function TagChip({ tag }: { tag: TagLite }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-1 px-2 py-0.5 text-xs text-fg-secondary">
      <span data-tag-marker={tag.marker} aria-hidden />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** The tags a row wears, wrapped on one line. */
export function TagChips({ tags }: { tags: readonly TagLite[] | undefined }) {
  if (!tags?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li key={tag.id} className="max-w-full">
          <TagChip tag={tag} />
        </li>
      ))}
    </ul>
  );
}

const tagForm = createKrizakaForm({ schema: z.object({ name: z.string().trim().min(1).max(80), marker: z.enum(MARKERS) }), defaultValues: { name: "", marker: "blue" as (typeof MARKERS)[number] } });

/** TODO krizaka-ui#690: the owner's tag-set editor. For now: a name and a marker, one tag at a time. */
function NewTagDialog({ kind, open, onOpenChange }: { kind: "client" | "invoice"; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = tagForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      if (await call.run(`/api/walker/${kind === "client" ? "clients" : "invoices"}/tags`, { json: values })) {
        form.reset();
        onOpenChange(false);
      }
    },
  });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content closeLabel={say("organize.close")}>
        <Dialog.Header>
          <Dialog.Title>{say("organize.newTag.title")}</Dialog.Title>
          <Dialog.Description>{say("organize.newTag.hint")}</Dialog.Description>
        </Dialog.Header>
        <form.Form aria-label={say("organize.newTag.title")} className="flex flex-col gap-3">
          <form.TextField name="name" label={say("organize.newTag.name")} maxLength={80} />
          <form.Select name="marker" label={say("organize.newTag.marker")} options={MARKERS.map((m) => ({ value: m, label: say(`organize.markers.${m}`) }))} />
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          <form.Submit size="md" disabled={call.pending}>
            {say("organize.newTag.create")}
          </form.Submit>
        </form.Form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/**
 * The binder's dividers per tag (`Tabs.Nav variant="binder"`, krizaka-ui#648): « All » and one divider per tag with its count; the
 * address is the state (`?tags=<id>`), so a divider is a link and a shared link opens the same one. « + New tag » for those who write tags.
 */
export function TagBinder({ organize, path, own = {} }: { organize: OrganizeData; path: string; own?: Record<string, string | undefined> }) {
  const { say } = useSay();
  const search = useSearchParams();
  const [adding, setAdding] = useState(false);
  const current = `${path}${search.toString() ? `?${search.toString()}` : ""}`;
  const only = (id?: string): ViewFilters => ({ ...organize.filters, tags: id ? [id] : undefined });
  const all = organize.tags.length === 0 && !organize.canWrite;
  if (all) return null;
  return (
    <>
      <Tabs.Nav label={say("organize.binder.label")} variant="binder" current={current} add={organize.canWrite ? { label: say("organize.binder.add"), onAdd: () => setAdding(true) } : undefined}>
        <Tabs.NavLink href={listHref(path, only(), null, own)} exact aria-label={say("organize.binder.all")}>
          {say("organize.binder.all")}
        </Tabs.NavLink>
        {organize.tags.map((tag) => (
          <Tabs.NavLink key={tag.id} href={listHref(path, only(tag.id), null, own)} exact hue={MARKER_HUE[tag.marker]} count={organize.counts[tag.id] ?? 0}>
            {tag.name}
          </Tabs.NavLink>
        ))}
      </Tabs.Nav>
      {organize.canWrite ? <NewTagDialog kind={organize.kind} open={adding} onOpenChange={setAdding} /> : null}
    </>
  );
}

const viewForm = createKrizakaForm({ schema: z.object({ name: z.string().trim().min(1).max(80), shared: z.boolean() }), defaultValues: { name: "", shared: false } });

function SaveViewDialog({ organize, open, onOpenChange }: { organize: OrganizeData; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = viewForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async ({ name, shared }) => {
      if (await call.run(`/api/walker/${organize.kind === "client" ? "clients" : "invoices"}/views`, { json: { name, shared, filters: organize.filters } })) {
        form.reset();
        onOpenChange(false);
      }
    },
  });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content closeLabel={say("organize.close")}>
        <Dialog.Header>
          <Dialog.Title>{say("organize.views.saveTitle")}</Dialog.Title>
          <Dialog.Description>{say("organize.views.saveHint")}</Dialog.Description>
        </Dialog.Header>
        <form.Form aria-label={say("organize.views.saveTitle")} className="flex flex-col gap-3">
          <form.TextField name="name" label={say("organize.views.name")} maxLength={80} />
          {organize.canWrite ? <form.Switch name="shared" label={say("organize.views.shared")} /> : null}
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          <form.Submit size="md" disabled={call.pending}>
            {say("organize.views.save")}
          </form.Submit>
        </form.Form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/**
 * The views of a list (TODO krizaka-ui#627: saved views in FilterBar): the administrator's, the shop's shared ones and mine, each a link
 * to the filters it holds (the address is the state), and « Save this view » when the filters in force are not one of them.
 */
export function ViewsBar({ organize, path, own = {} }: { organize: OrganizeData; path: string; own?: Record<string, string | undefined> }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [saving, setSaving] = useState(false);
  const apiBase = `/api/walker/${organize.kind === "client" ? "clients" : "invoices"}/views`;
  const { system, workspace, mine } = organize.views;
  const named: { key: string; label: string; filters: ViewFilters; own: boolean }[] = [
    ...system.map((v) => ({ key: v.key, label: v.label[locale], filters: v.filters, own: false })),
    ...workspace.map((v) => ({ key: v.id, label: v.name, filters: v.filters, own: false })),
    ...mine.map((v) => ({ key: v.id, label: v.name, filters: v.filters, own: true })),
  ];
  const active = named.find((v) => v.key === organize.view);
  const filtered = Object.values(organize.filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  if (named.length === 0 && !filtered) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {named.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={say("organize.views.label")}>
          {named.map((v) => (
            <li key={v.key}>
              <ChipLink selected={v.key === organize.view} asChild>
                <Link href={listHref(path, v.filters, v.key, own)} scroll={false}>
                  {v.label}
                </Link>
              </ChipLink>
            </li>
          ))}
        </ul>
      ) : null}
      {filtered && !active ? (
        <Button variant="ghost" size="sm" onClick={() => setSaving(true)}>
          {say("organize.views.save")}
        </Button>
      ) : null}
      {active?.own ? (
        <Button variant="ghost" size="sm" disabled={call.pending} onClick={() => call.run(`${apiBase}/${active.key}`, { method: "DELETE" })}>
          {say("organize.views.remove")}
        </Button>
      ) : null}
      {filtered ? (
        <ChipLink asChild>
          <Link href={listHref(path, {}, null, own)} scroll={false}>
            {say("organize.views.clear")}
          </Link>
        </ChipLink>
      ) : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      <SaveViewDialog organize={organize} open={saving} onOpenChange={setSaving} />
    </div>
  );
}

/**
 * The selection bar's bulk tag and untag (TODO krizaka-ui#627: the DataTable selection bar). At most 200 at a time, one call, one
 * audit line per row; there is no « mark as paid »: an invoice's state follows the ledger.
 */
export function SelectionTags({ organize, selected, onDone }: { organize: OrganizeData; selected: string[]; onDone: () => void }) {
  const { say } = useSay();
  const call = useCall();
  const apply = async (change: { add?: string[]; remove?: string[] }) => {
    const base = `/api/walker/${organize.kind === "client" ? "clients" : "invoices"}/tags/apply`;
    if (await call.run(base, { json: { ids: selected, ...change } })) onDone();
  };
  if (!organize.canWrite || organize.tags.length === 0) return null;
  const menu = (label: string, change: (id: string) => { add?: string[]; remove?: string[] }) => (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="sm" disabled={call.pending || selected.length === 0}>
          {label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {organize.tags.map((tag) => (
          <DropdownMenu.Item key={tag.id} onSelect={() => apply(change(tag.id))}>
            <span data-tag-marker={tag.marker} aria-hidden /> {tag.name}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
  return (
    <>
      {menu(say("organize.selection.tag"), (id) => ({ add: [id] }))}
      {menu(say("organize.selection.untag"), (id) => ({ remove: [id] }))}
      {selected.length > 200 ? <Alert tone="warning">{say("organize.selection.tooMany")}</Alert> : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
    </>
  );
}

/** One row's tags, toggled from the client's file: each tag a checkbox item, one call per change (the same bulk call, for one id). */
export function TagsEditor({ organize, entityId, worn }: { organize: OrganizeData; entityId: string; worn: TagLite[] }) {
  const { say } = useSay();
  const call = useCall();
  const has = new Set(worn.map((t) => t.id));
  if (!organize.canWrite || organize.tags.length === 0) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm" disabled={call.pending}>
          {say("organize.file.edit")}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {organize.tags.map((tag) => (
          <DropdownMenu.CheckboxItem
            key={tag.id}
            checked={has.has(tag.id)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(on) => call.run(`/api/walker/${organize.kind === "client" ? "clients" : "invoices"}/tags/apply`, { json: { ids: [entityId], ...(on ? { add: [tag.id] } : { remove: [tag.id] }) } })}
          >
            <span data-tag-marker={tag.marker} aria-hidden /> {tag.name}
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
