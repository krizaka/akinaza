import "./globals.css";
import "@krizaka/ui/blocks.css";

import { ThemeScript } from "@krizaka/ui/theme";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { NotFoundPage } from "@/components/NotFoundPage";
import { asLocale, getDictionary } from "@/lib/i18n";
import { LOCALE_HEADER } from "@/lib/locale-negotiation";

/** The 404 of an address that matches no route (`/nope`, `/fr/nope`): no layout runs for it, so it carries its own document. */
async function localeOfRequest() {
  return asLocale((await headers()).get(LOCALE_HEADER) ?? "");
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await localeOfRequest()).notFound.title, robots: { index: false, follow: false } };
}

export default async function GlobalNotFound() {
  const locale = await localeOfRequest();
  return (
    <html lang={locale} data-surface="product" suppressHydrationWarning>
      <head>
        <ThemeScript defaultMode="dark" />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased">
        <NotFoundPage locale={locale} />
      </body>
    </html>
  );
}
