import { PageHero } from "@krizaka/ui/page-hero";
import { Separator } from "@krizaka/ui/separator";
import { Stamp } from "@krizaka/ui/specimen-tag";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/lib/i18n";

/** The thin paper head of a step (B45, #315): the shop's name in the display face, where the visitor stands, and the way back to change a choice. Nothing else of the notebook. */
export interface JourneyHead {
  shop: string;
  /** « Step 2 of 4 · The time ». */
  step: string;
  edit?: { href: string; label: string };
}

/** The frame of one step of the booking journey: the bar, a thin paper head, a back link, the title, the step, the footer. Plain controls, no motion of its own. */
export function JourneyFrame({ locale, path, back, title, lead, head, children }: Readonly<{ locale: Locale; path: string; back: { href: string; label: string }; title: string; lead?: string; head?: JourneyHead; children: ReactNode }>) {
  return (
    <>
      <SiteHeader locale={locale} current="home" path={path} />
      <main id="content" className="pt-20">
        {head ? (
          <header data-journey-head="" className="mx-auto flex w-full max-w-(--kz-page-max,72rem) flex-col gap-2 px-(--kz-page-gutter,1rem) pt-4">
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="m-0 font-display text-lg text-fg">{head.shop}</p>
              <p className="m-0 flex items-center gap-2 text-sm text-fg-secondary">
                <Stamp tone="ink" size="sm">{head.step}</Stamp>
                {head.edit ? <Link href={head.edit.href} className="text-fg-accent underline underline-offset-4">{head.edit.label}</Link> : null}
              </p>
            </div>
            <Separator variant="hand" shape="stroke" />
          </header>
        ) : null}
        <PageHero back={back} linkAs={Link} title={title} lead={lead} backdrop="plain" size="narrow" />
        <div className="mx-auto flex w-full max-w-(--kz-page-max,72rem) flex-col gap-6 px-(--kz-page-gutter,1rem) pb-16">{children}</div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

/** What a step shows while its data loads: the shape of the page, no spinner, no layout shift. */
export function JourneySkeleton({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <main id="content" className="pt-24" aria-busy="true" aria-live="polite">
      <div className="mx-auto flex w-full max-w-(--kz-page-max,72rem) flex-col gap-4 px-(--kz-page-gutter,1rem)">
        <span data-journey-head-skeleton="" className="kz-skeleton block h-12 w-full rounded-sm bg-surface-3" />
        <span className="kz-skeleton block h-4 w-28 rounded-sm bg-surface-3" />
        <span className="kz-skeleton block h-9 w-2/3 rounded-md bg-surface-3" />
        <span className="kz-skeleton block h-4 w-1/2 rounded-sm bg-surface-3" />
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className="kz-skeleton block h-20 w-full rounded-xl bg-surface-3" />
        ))}
      </div>
    </main>
  );
}
