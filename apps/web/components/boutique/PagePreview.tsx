"use client";

import { Button } from "@krizaka/ui/button";
import { cn } from "@krizaka/ui/cn";
import { useId, useState } from "react";

import { useSay } from "@/lib/i18n-client";

/**
 * The live preview of the public page beside the studio (docs/design/cahier-storefront.md § 5.1): the page itself in a frame of this origin, on a desktop;
 * behind a « View the page » button on a phone. It renders again by itself when the owner saves - the page listens to `shop.page.updated`
 * (StorefrontLive) - so nothing here reloads it.
 */
export function PagePreview({ src, published }: { src: string; published: boolean }) {
  const { say } = useSay();
  const panel = useId();
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  return (
    <aside aria-label={say("studio.preview.title")} className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4">
      <Button variant="secondary" size="md" className="xl:hidden" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)}>
        {say(open ? "studio.preview.hide" : "studio.preview.show")}
      </Button>
      <div id={panel} className={open ? "flex flex-col gap-3" : "hidden flex-col gap-3 xl:flex"}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 font-display text-base font-bold text-fg">{say("studio.preview.title")}</h2>
          <div className="flex gap-2">
            {(["phone", "desktop"] as const).map((d) => (
              <Button key={d} variant={device === d ? "primary" : "ghost"} size="sm" aria-pressed={device === d} onClick={() => setDevice(d)}>{say(`studio.preview.${d}`)}</Button>
            ))}
          </div>
        </div>
        {published ? (
          <iframe
            title={say("studio.preview.label")}
            src={src}
            loading="lazy"
            referrerPolicy="same-origin"
            className={cn("h-[40rem] max-w-full rounded-lg border border-border-default bg-surface-1", device === "phone" ? "w-[390px]" : "w-full")}
          />
        ) : (
          <p className="m-0 rounded-lg border border-border-default p-4 text-sm text-fg-secondary">{say("studio.preview.unpublished")}</p>
        )}
      </div>
    </aside>
  );
}
