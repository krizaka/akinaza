import { DocsArticlePage } from "@krizaka/ui/docs-article-page";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { jsonLdHtml } from "@/lib/csp";
import { docHref, isDocId, neighbours } from "@/lib/docs";
import { asLocale, getDictionary } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { DOC_IDS, pagePath } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return DOC_IDS.flatMap((page) => ["en", "fr"].map((locale) => ({ locale, page })));
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string; page: string }> }>): Promise<Metadata> {
  const { locale, page } = await params;
  if (!isDocId(page)) return {};
  return pageMetadata(asLocale(locale), `docs/${page}`);
}

/** One page of the owner's guide: a job, in short sections, every one of them a true statement about the product today. */
export default async function DocsPage({ params }: Readonly<{ params: Promise<{ locale: string; page: string }> }>) {
  const { locale: raw, page } = await params;
  const locale = asLocale(raw);
  if (!isDocId(page)) notFound();
  const d = getDictionary(locale).docs;
  const doc = d.pages[page];
  const { previous, next } = neighbours(page);
  const link = (id: typeof previous) => (id ? { href: docHref(locale, id), title: d.pages[id].nav } : undefined);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current={`docs/${page}`} />
      <main id="content" className="pt-20">
        <DocsArticlePage
          sidebar={<DocsSidebar locale={locale} current={docHref(locale, page)} />}
          sidebarLabel={d.sidebarLabel}
          breadcrumbLabel={d.breadcrumbLabel}
          breadcrumb={[{ href: pagePath(locale, "docs"), label: d.home }]}
          title={doc.title}
          lead={doc.lead}
          linkAs={Link}
          toc={{ label: d.tocLabel, items: doc.sections.map((s) => ({ id: s.id, label: s.h })) }}
          pager={{ previous: link(previous), next: link(next), labels: { previous: d.previous, next: d.next } }}
        >
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2>{s.h}</h2>
              {s.p.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.items.length > 0 ? (
                <ol>
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              ) : null}
            </section>
          ))}
          <p>{d.updated}</p>
        </DocsArticlePage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
