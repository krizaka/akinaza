import { shopOfOwner } from "@akinaza/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppFrame } from "@/components/app/AppFrame";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale } from "@/lib/i18n";

// The signed-in space is never indexed and never cached: it reads the session on every request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** No session, no page. A shop's owner sees the day, clients and the shop page; a client sees their bookings. The administration lives apart (admin.akinaza.com). */
export default async function MemberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const owner = await shopOfOwner(db(), session.account.id);
  return (
    <AppFrame locale={locale} email={session.account.email} base={`/${locale}/app`} items={owner ? ["today", "clients", "invoices", "books", "shop", "connections", "profile"] : ["bookings", "shop", "profile"]}>
      {children}
    </AppFrame>
  );
}
