import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppFrame } from "@/components/app/AppFrame";
import { ShopSwitcher } from "@/components/app/ShopSwitcher";
import { pageSession } from "@/lib/access";
import { CLIENT_PLACES, placesFor } from "@/lib/app-nav";
import { asLocale } from "@/lib/i18n";
import { VocabularyProvider } from "@/lib/i18n-client";
import { currentMember, shopsOf } from "@/lib/member-shop";

// The signed-in space is never indexed and never cached: it reads the session on every request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** No session, no page. A shop's owner sees the day, clients and the shop page; a client sees their bookings. The administration lives apart (admin.akinaza.com). */
export default async function MemberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const member = await currentMember(session.account.id);
  const shops = member ? await shopsOf(session.account.id) : [];
  return (
    <AppFrame
      locale={locale}
      email={session.account.email}
      base={`/${locale}/app`}
      items={member ? placesFor(member.role) : [...CLIENT_PLACES]}
      switcher={member ? <ShopSwitcher shops={shops} currentId={member.shop.id} /> : undefined}
    >
      {member ? <VocabularyProvider type={member.shop.businessType}>{children}</VocabularyProvider> : children}
    </AppFrame>
  );
}
