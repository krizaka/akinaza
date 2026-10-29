import { Page, Section, SectionHeading } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppVideoPlayer } from "@/components/download/AppVideoPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { APP_VIDEOS, videoId, videoUrl } from "@/lib/app-videos";
import { jsonLdHtml } from "@/lib/csp";
import { downloadPageOpen } from "@/lib/downloads";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "download");
}

/** The shape of a recording: the web at 16:10, a phone at its screen's 9:19.5 (the box is the same before and after the play). */
const SHAPE = { web: { width: 1280, height: 800 } } as const;
const PHONE = { width: 390, height: 845 };

/** The videos the e2e tests recorded of the apps (krizaka/.github#315); no store button while no app is offered. Parked (404) while there is no video. */
export default async function Download({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  if (!downloadPageOpen()) notFound();
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="download" />
      <main id="content">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={t.download.title} backdrop="plain" lead={t.download.lead} />
        <Page>
          {(
            <Section>
              <SectionHeading title={t.download.videos.title} lead={t.download.videos.lead} />
              <ul className="grid gap-6 sm:grid-cols-2">
                {APP_VIDEOS.map((video) => {
                  const words = t.download.videos.items[videoId(video) as keyof typeof t.download.videos.items];
                  const shape = SHAPE[video.platform as keyof typeof SHAPE] ?? PHONE;
                  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(video.capturedAt));
                  return (
                    <li key={videoId(video)} className="flex flex-col gap-3" data-video={videoId(video)}>
                      <AppVideoPlayer poster={videoUrl(video.files.poster)} webm={videoUrl(video.files.webm)} mp4={videoUrl(video.files.mp4)} {...shape} play={t.download.videos.play} label={words.name} />
                      <h3 className="text-base font-semibold">{words.name}</h3>
                      <p className="text-sm text-fg-secondary">{words.body}</p>
                      <p className="text-xs text-fg-muted">
                        {format(t.download.videos.recorded, { date })} · {format(t.download.videos.seconds, { seconds: String(Math.round(video.seconds)) })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
