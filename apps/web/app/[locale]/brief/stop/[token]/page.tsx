import { Page } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { StopBrief } from "@/components/brief/StopBrief";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";
// The link of an e-mail: its token is the credential. Never indexed, no referrer.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** « Ne plus recevoir le point du lundi »: one sentence, one button (a POST — opening the link changes nothing). */
export default async function StopBriefPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  const t = getDictionary(locale).console.brief.stop;
  return (
    <>
      <SiteHeader locale={locale} current="home" path={`/${locale}/brief/stop/${token}`} />
      <main id="content" className="pt-20">
        <PageHero title={t.title} lead={t.lead} linkAs={Link} />
        <Page className="pb-8">
          <StopBrief token={token} words={{ button: t.button, done: t.done, invalid: t.invalid }} />
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
