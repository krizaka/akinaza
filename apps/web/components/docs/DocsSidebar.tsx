import { DocsNav } from "@krizaka/ui/docs-nav";
import Link from "next/link";

import { docHref } from "@/lib/docs";
import { getDictionary, type Locale } from "@/lib/i18n";
import { DOC_IDS } from "@/lib/site";

/** The pages of the guide, in one group; the page being read is open. */
export function DocsSidebar({ locale, current }: Readonly<{ locale: Locale; current?: string }>) {
  const d = getDictionary(locale).docs;
  return <DocsNav label={d.navLabel} linkAs={Link} current={current} groups={[{ id: "guide", title: d.collectionsTitle, items: DOC_IDS.map((id) => ({ href: docHref(locale, id), label: d.pages[id].nav })) }]} />;
}
