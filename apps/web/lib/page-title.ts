import type { Metadata } from "next";

import { asLocale, getDictionary } from "./i18n";

type MetaKey = keyof ReturnType<typeof getDictionary>["console"]["meta"];

/** The `generateMetadata` of a page whose title is `console.meta.<section>`: the tab says where you are, in the page's language. */
export const titleOf =
  (section: MetaKey) =>
  async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => ({ title: getDictionary(asLocale((await params).locale)).console.meta[section] });
