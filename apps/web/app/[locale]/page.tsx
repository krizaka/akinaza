import { invoiceTotals } from "@akinaza/core";
import { ClockIcon, KeepIcon, ShieldIcon } from "@krizaka/icons";
import { AkinazaLogo } from "@krizaka/ui";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { LinkCard } from "@krizaka/ui/link-card";
import { Mascot } from "@krizaka/ui/mascots";
import { Section } from "@krizaka/ui/page";
import { ProductPage } from "@krizaka/ui/product-page";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary, type Locale, translator } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

/** The example invoice on the page, computed by Akinaza's own tax code — never typed by hand. */
const EXAMPLE = invoiceTotals(
  [
    { description: "Coupe / Haircut", quantity: 1, unitPriceCents: 4_500, category: "standard" },
    { description: "Coloration / Colour", quantity: 1, unitPriceCents: 9_500, category: "standard" },
  ],
  { registrant: true },
);
const INTL: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };

function Visual({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.visual;
  const money = (c: number) => new Intl.NumberFormat(INTL[locale], { style: "currency", currency: "CAD" }).format(c / 100);
  const rows = [
    [t.subtotal, EXAMPLE.subtotalCents],
    [t.gst, EXAMPLE.gstCents],
    [t.qst, EXAMPLE.qstCents],
  ] as const;
  return (
    <div className="flex flex-col gap-3 p-5 text-sm">
      <div className="rounded-lg border border-border-default bg-surface-1 p-4">
        <p className="font-semibold text-fg">{t.title}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {EXAMPLE.lines.map((l) => (
            <li key={l.description} className="flex justify-between gap-2 text-fg-secondary">
              <span>{l.description}</span>
              <span className="font-mono">{money(l.amountCents)}</span>
            </li>
          ))}
          {rows.map(([label, cents]) => (
            <li key={label} className="flex justify-between gap-2 font-mono text-xs text-fg">
              <span>{label}</span>
              <span>{money(cents)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-2 border-t border-border-default pt-1 font-mono font-semibold text-fg">
            <span>{t.total}</span>
            <span>{money(EXAMPLE.totalCents)}</span>
          </li>
        </ul>
      </div>
      <p className="text-xs text-fg-muted">{t.note}</p>
    </div>
  );
}

/** dev.akinaza.com: what Akinaza does and how — the product page template of @krizaka/ui, in forest green and copper. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = translator(locale);
  const d = getDictionary(locale).landing;
  const signIn = `/${locale}/sign-in`;
  const steps = [
    { id: "book", href: "#book", icon: <ClockIcon /> },
    { id: "invoice", href: "#invoice", icon: <KeepIcon /> },
    { id: "privacy", href: "#privacy", icon: <ShieldIcon /> },
  ] as const;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content" className="pt-20">
        <ProductPage
          brand="akinaza"
          linkAs={Link}
          mark={
            <>
              <AkinazaLogo size={18} animated={false} /> {d.mark}
            </>
          }
          title={d.title}
          lead={d.lead}
          facts={[{ label: d.facts.canada, tone: "ok" }, { label: d.facts.license }, { label: d.facts.closed, tone: "wip" }]}
          actions={
            <>
              <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic>
                <a href={contactHref("dev-akinaza-hero")}>{d.talk}</a>
              </Button>
              <Button asChild variant="secondary" size="lg" shape="cut">
                <Link href={signIn}>{d.signIn}</Link>
              </Button>
            </>
          }
          visualLabel={d.visualLabel}
          visual={<Visual locale={locale} />}
          reasonsHeading={{ eyebrow: d.reasonsEyebrow, title: d.reasonsTitle }}
          reasonLabels={{ trap: d.trap, more: d.more }}
          reasons={(["book", "invoice", "privacy"] as const).map((id) => ({ id, title: d.reasons[id].title, trap: d.reasons[id].trap, mark: <Mascot bird="beaver" size={40} animated={false} />, href: `#${id}` }))}
          decisions={{ eyebrow: d.decisionsEyebrow, title: d.decisionsTitle, labels: d.decisionLabels, items: (["prepare", "canada", "pos"] as const).map((id) => ({ id, ...d.decisions[id] })) }}
          promise={{ bird: "beaver", label: d.promiseLabel, text: d.promise }}
          closing={{
            title: d.closingTitle,
            body: d.closingBody,
            actions: (
              <Button asChild variant="primary" size="lg" shape="cut">
                <a href={contactHref("dev-akinaza-closing")}>{d.talk}</a>
              </Button>
            ),
          }}
        >
          <Section id="how" eyebrow={d.sections.how.eyebrow} title={d.sections.how.title} lead={d.sections.how.lead} divider>
            <CardGrid min={240}>
              {steps.map((s) => (
                <LinkCard key={s.id} layout="stack" href={s.href} icon={s.icon} title={t(`landing.sections.how.steps.${s.id}.title`)} description={t(`landing.sections.how.steps.${s.id}.text`)} cta={d.more} />
              ))}
            </CardGrid>
          </Section>
          {(["book", "invoice", "privacy"] as const).map((id) => (
            <Section key={id} id={id} eyebrow={d.sections[id].eyebrow} title={d.sections[id].title} lead={d.sections[id].lead} divider actions={<Button asChild variant="secondary" size="md" shape="cut"><Link href={signIn}>{d.signIn}</Link></Button>}>
              <ul className="grid max-w-3xl gap-2 text-fg-secondary">
                {d.sections[id].points.map((p) => (
                  <li key={p} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
                    {p}
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </ProductPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
