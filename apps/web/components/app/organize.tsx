"use client";

import { type Marker, MARKERS, type ViewFilters } from "@krizaka/organize/contract";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { MarkerPicker, TagChip, TagMarker } from "@krizaka/ui/chip";
import { ChipLink } from "@krizaka/ui/chip-link";
import { Dialog } from "@krizaka/ui/dialog";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import { type SavedViewItem, SavedViews, type SavedViewsLabels } from "@krizaka/ui/filter-bar";
import { createKrizakaForm } from "@krizaka/ui/form";
import { Popover } from "@krizaka/ui/popover";
import { Tabs } from "@krizaka/ui/tabs";
import { TagSelector } from "@krizaka/ui/tag-selector";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { listHref, MARKER_HUE, type OrganizeData, type TagLite } from "@/lib/organize-view";

/**
 * The shop's organisation of a list (akinaza#337, krizaka-ts ADR-003): tags with a colour marker, the binder's dividers per tag, the
 * saved views, and the selection's bulk tag and untag. This file only WIRES the pieces of @krizaka/ui (TagChip, MarkerPicker,
 * TagSelector creatable, SavedViews, the DataTable selection bar) to the shop's routes: it draws none of them. Nothing here moves an
 * invoice's state — it is derived from the ledger.
 */

const base = (organize: OrganizeData) => `/api/walker/${organize.kind === "client" ? "clients" : "invoices"}`;

/** The tags a row wears, wrapped on one line: read-only (a tag is changed from the file, the binder or the selection). */
export function TagChips({ tags }: { tags: readonly TagLite[] | undefined }) {
  if (!tags?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li key={tag.id} className="max-w-full">
          <TagChip marker={tag.marker} size="sm" disabled className="disabled:opacity-100">
            <span className="truncate">{tag.name}</span>
          </TagChip>
        </li>
      ))}
    </ul>
  );
}

const tagForm = createKrizakaForm({ schema: z.object({ name: z.string().trim().min(1).max(80) }), defaultValues: { name: "" } });

/** The names of the closed palette, translated (the swatches are named, never colour alone). */
function useMarkerNames(): Record<Marker, string> {
  const { say } = useSay();
  return useMemo(() => Object.fromEntries(MARKERS.map((m) => [m, say(`organize.markers.${m}`)])) as Record<Marker, string>, [say]);
}

function NewTagDialog({ kind, open, onOpenChange }: { kind: "client" | "invoice"; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { say, locale } = useSay();
  const call = useCall();
  const names = useMarkerNames();
  const [marker, setMarker] = useState<Marker>("blue");
  const form = tagForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async ({ name }) => {
      if (await call.run(`/api/walker/${kind === "client" ? "clients" : "invoices"}/tags`, { json: { name, marker } })) {
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
          <MarkerPicker label={say("organize.newTag.marker")} names={names} value={marker} onValueChange={setMarker} />
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
  if (organize.tags.length === 0 && !organize.canWrite) return null;
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

/** The words of `SavedViews`, from the messages (`organize.savedViews.*`). */
function useSavedViewsLabels(): Partial<SavedViewsLabels> {
  const { say } = useSay();
  return useMemo(
    () => ({
      views: say("organize.views.label"),
      groups: { system: say("organize.savedViews.system"), workspace: say("organize.savedViews.workspace"), mine: say("organize.savedViews.mine") },
      menu: (current: string) => say("organize.savedViews.menu", { current }),
      none: say("organize.savedViews.none"),
      modified: say("organize.savedViews.modified"),
      save: say("organize.views.save"),
      name: say("organize.views.name"),
      confirm: say("organize.savedViews.confirm"),
      cancel: say("organize.savedViews.cancel"),
      rename: say("organize.savedViews.rename"),
      remove: say("organize.views.remove"),
      actions: (label: string) => say("organize.savedViews.actions", { label }),
    }),
    [say],
  );
}

/**
 * The views of a list (`SavedViews`): the administrator's, the shop's shared ones and mine, each a link to the filters it holds (the
 * address is the state); « Save view » when the filters in force are not one of them; rename and delete for mine.
 */
export function ViewsBar({ organize, path, own = {} }: { organize: OrganizeData; path: string; own?: Record<string, string | undefined> }) {
  const { say, locale } = useSay();
  const call = useCall();
  const labels = useSavedViewsLabels();
  const apiBase = `${base(organize)}/views`;
  const { system, workspace, mine } = organize.views;
  const items: SavedViewItem[] = [
    ...system.map((v) => ({ id: v.key, label: v.label[locale], group: "system" as const, href: listHref(path, v.filters, v.key, own) })),
    ...workspace.map((v) => ({ id: v.id, label: v.name, group: "workspace" as const, href: listHref(path, v.filters, v.id, own), editable: false })),
    ...mine.map((v) => ({ id: v.id, label: v.name, group: "mine" as const, href: listHref(path, v.filters, v.id, own) })),
  ];
  const filtered = Object.values(organize.filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  if (items.length === 0 && !filtered) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SavedViews
        views={items}
        current={organize.view}
        modified={filtered && !items.some((v) => v.id === organize.view)}
        linkAs={Link}
        labels={labels}
        onSave={(name) => void call.run(apiBase, { json: { name, shared: false, filters: organize.filters } })}
        onRename={(id, name) => void call.run(`${apiBase}/${id}`, { method: "PATCH", json: { name } })}
        onDelete={(id) => void call.run(`${apiBase}/${id}`, { method: "DELETE" })}
      />
      {filtered ? (
        <ChipLink asChild>
          <Link href={listHref(path, {}, null, own)} scroll={false}>
            {say("organize.views.clear")}
          </Link>
        </ChipLink>
      ) : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
    </div>
  );
}

/**
 * The selection bar's bulk tag and untag (given to `DataTable bulkActions`, which draws the bar). At most 200 at a time, one call, one
 * audit line per row; there is no « mark as paid »: an invoice's state follows the ledger.
 */
export function SelectionTags({ organize, selected, onDone }: { organize: OrganizeData; selected: string[]; onDone: () => void }) {
  const { say } = useSay();
  const call = useCall();
  const apply = async (change: { add?: string[]; remove?: string[] }) => {
    if (await call.run(`${base(organize)}/tags/apply`, { json: { ids: selected, ...change } })) onDone();
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
            <TagMarker marker={tag.marker} /> {tag.name}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
  return (
    <>
      {menu(say("organize.selection.tag"), (id) => ({ add: [id] }))}
      {menu(say("organize.selection.untag"), (id) => ({ remove: [id] }))}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
    </>
  );
}

/** One client's tags, from its file: the package's `TagSelector creatable` in a popover — one call per change (the bulk call, for one id). */
export function TagsEditor({ organize, entityId, worn }: { organize: OrganizeData; entityId: string; worn: TagLite[] }) {
  const { say } = useSay();
  const call = useCall();
  const names = useMarkerNames();
  if (!organize.canWrite) return null;
  const value = worn.map((t) => t.id);
  const change = (add: string[], remove: string[]) => call.run(`${base(organize)}/tags/apply`, { json: { ids: [entityId], add, remove } });
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" disabled={call.pending}>
          {say("organize.file.edit")}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start">
        <TagSelector
          label={say("organize.file.tags")}
          options={organize.tags.map((t) => ({ value: t.id, label: t.name, marker: t.marker }))}
          value={value}
          onValueChange={(next) => void change(next.filter((id) => !value.includes(id)), value.filter((id) => !next.includes(id)))}
          creatable
          onCreate={async (name, marker) => {
            const created = await call.run<{ tag: { id: string } }>(`${base(organize)}/tags`, { json: { name, marker } }, { refresh: false });
            if (created) await change([created.tag.id], []);
          }}
          inputLabel={say("organize.file.add")}
          placeholder={say("organize.file.placeholder")}
          createLabel={(name) => say("organize.file.create", { name })}
          markerNames={names}
          markerLabel={say("organize.file.markerLabel")}
          emptyLabel={say("organize.file.empty")}
        />
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      </Popover.Content>
    </Popover.Root>
  );
}
