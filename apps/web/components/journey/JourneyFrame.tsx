import { PageHero } from "@krizaka/ui/page-hero";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import type { Locale } from "@/lib/i18n";

/** The frame of one step of the booking journey: the bar, a back link, the title, the step, the footer. Plain, professional, no motion of its own. */
export function JourneyFrame({ locale, path, back, title, lead, children }: { locale: Locale; path: string; back: { href: string; label: string }; title: string; lead?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader locale={locale} current="home" path={path} />
      <main id="content" className="pt-20">
        <PageHero back={back} linkAs={Link} title={title} lead={lead} backdrop="plain" size="narrow" />
        <div className="mx-auto flex w-full max-w-(--kz-page-max,72rem) flex-col gap-6 px-(--kz-page-gutter,1rem) pb-16">{children}</div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

/** What a step shows while its data loads: the shape of the page, no spinner, no layout shift. */
export function JourneySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <main id="content" className="pt-24" aria-busy="true" aria-live="polite">
      <div className="mx-auto flex w-full max-w-(--kz-page-max,72rem) flex-col gap-4 px-(--kz-page-gutter,1rem)">
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
