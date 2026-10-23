import type { Template } from "@akinaza/core";

/** Today's page without a template, after the hero: the order the storefront has always drawn (`trust` right before the photos). */
export const PLAIN_PAGE_SECTIONS: readonly { id: string; variant: string; visible: boolean }[] = ["services", "team", "hours", "zones", "trust", "gallery"].map((id) => ({ id, variant: "default", visible: true }));

/** The small shapes that stand for a section's variant: a grid of cards, a list, photos (straight or taped), a story, a plain band. */
function Glyph({ id, variant }: { id: string; variant: string }) {
  if (id === "services" && variant === "list") {
    return (
      <span className="flex flex-col gap-[2px]">
        <span className="h-[5px] w-full rounded-[2px] bg-border-default" />
        <span className="h-[5px] w-full rounded-[2px] bg-border-default" />
      </span>
    );
  }
  if (id === "services") {
    return (
      <span className="grid grid-cols-3 gap-[3px]">
        <span className="h-[11px] rounded-[2px] bg-border-default" />
        <span className="h-[11px] rounded-[2px] bg-border-default" />
        <span className="h-[11px] rounded-[2px] bg-border-default" />
      </span>
    );
  }
  if (id === "gallery" && variant === "taped") {
    return (
      <span className="flex justify-around px-1">
        <span className="h-[10px] w-[14px] -rotate-6 rounded-[2px] bg-border-default" />
        <span className="h-[10px] w-[14px] rotate-3 rounded-[2px] bg-border-default" />
        <span className="h-[10px] w-[14px] -rotate-2 rounded-[2px] bg-border-default" />
      </span>
    );
  }
  if (id === "gallery") {
    return (
      <span className="grid grid-cols-4 gap-[3px]">
        <span className="h-[9px] rounded-[2px] bg-border-default" />
        <span className="h-[9px] rounded-[2px] bg-border-default" />
        <span className="h-[9px] rounded-[2px] bg-border-default" />
        <span className="h-[9px] rounded-[2px] bg-border-default" />
      </span>
    );
  }
  if (id === "trust" && variant === "story") {
    return (
      <span className="flex flex-col gap-[2px]">
        <span className="h-[3px] w-11/12 rounded-[2px] bg-border-default" />
        <span className="h-[3px] w-full rounded-[2px] bg-border-default" />
        <span className="h-[3px] w-2/3 rounded-[2px] bg-border-default" />
      </span>
    );
  }
  return <span className="block h-[6px] w-full rounded-[2px] bg-border-default" />;
}

/**
 * A template at a glance (#261, step 4): a tiny page in the template's hue and paper — the hero band, then its sections in its order, each with the shape of its
 * variant and its name. Decorative (the tile's name carries the meaning); `template` null draws today's plain page.
 */
export function TemplatePreview({ template, labels }: { template: Template | null; /** The sections' names, by id (`shopSetup.layout.sections.*`). */ labels: Record<string, string> }) {
  const sections = (template ? template.sections : PLAIN_PAGE_SECTIONS).filter((s) => s.visible);
  const hue = template && template.hue !== "brand-akinaza" ? template.hue : undefined;
  return (
    <div aria-hidden="true" data-hue={hue} data-paper={template?.paper ?? "plain"} className="kz-tpl-preview flex w-full flex-col gap-[5px] rounded-md border border-border-default bg-surface-1 p-2 text-[9px] leading-none text-fg-secondary">
      <div className="kz-tpl-preview-hero flex h-7 flex-col justify-end gap-[3px] rounded-sm p-[5px]">
        <span className="kz-tpl-preview-title block h-[6px] w-1/2 rounded-[2px]" />
        <span className="block h-[3px] w-1/3 rounded-[2px] bg-border-default" />
      </div>
      {sections.map((s) => (
        <div key={s.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-1.5">
          <span className="truncate">{labels[s.id] ?? s.id}</span>
          <Glyph id={s.id} variant={s.variant} />
        </div>
      ))}
    </div>
  );
}
