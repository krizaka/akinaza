import type { Metadata } from "next";

import { ConsoleProviders } from "@/components/console/ConsoleProviders";
import { asLocale, getDictionary } from "@/lib/i18n";

// admin.akinaza.com: never indexed, never cached.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Akinaza — Administration" };

export default async function AdminRoot({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { console: messages } = getDictionary(locale);
  return (
    <ConsoleProviders locale={locale} messages={{ console: messages }}>
      {children}
    </ConsoleProviders>
  );
}
