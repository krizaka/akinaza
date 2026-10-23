"use client";

import type { Template } from "@akinaza/core";
import { ChoiceGrid } from "@krizaka/ui/choice-grid";

import { TemplatePreview } from "@/components/app/TemplatePreview";
import { useSay } from "@/lib/i18n-client";

/** The id of the choice that is no template: today's plain page. */
export const PLAIN_PAGE = "none";

/**
 * The templates of a trade as tiles (#261): a tiny preview each, the name and the intention, the layout as an eyebrow, « Your template » or « Suggested » as a badge.
 * One radio group: the arrow keys move the choice. With `plainPage`, a first tile offers today's page without a template.
 */
export function TemplateChoiceGrid({ choices, value, onValueChange, current, outdated = false, preselected, plainPage = false, label }: { choices: readonly Template[]; value: string; onValueChange: (id: string) => void; current?: string | null; /** The applied template has a newer version out: its tile says so. */ outdated?: boolean; preselected?: string | null; plainPage?: boolean; label: string }) {
  const { say } = useSay();
  const labels = Object.fromEntries(["services", "team", "hours", "zones", "trust", "gallery", "wall", "reels", "announcements", "reviews", "follow"].map((id) => [id, say(`shopSetup.layout.sections.${id}`)]));
  const badge = (id: string) => (id === current ? say(outdated ? "shopSetup.templates.updateAvailable" : "shopSetup.templates.current") : !current && id === preselected ? say("shopSetup.templates.suggested") : undefined);
  const items = [
    ...(plainPage ? [{ id: PLAIN_PAGE, visual: <TemplatePreview template={null} labels={labels} />, name: say("shopSetup.templates.none"), title: say("shopSetup.templates.noneIntent") }] : []),
    ...choices.map((t) => ({ id: t.id, visual: <TemplatePreview template={t} labels={labels} />, name: say(`templates.${t.id}.name`), title: say(`templates.${t.id}.intent`), eyebrow: say(`shopSetup.templates.layouts.${t.layout}`), badge: badge(t.id) })),
  ];
  return <ChoiceGrid label={label} items={items} value={value} onValueChange={onValueChange} columns={Math.min(items.length, 3)} animated={false} />;
}
