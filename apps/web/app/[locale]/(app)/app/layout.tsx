import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppFrame } from "@/components/app/AppFrame";
import { pageSession } from "@/lib/access";
import { asLocale } from "@/lib/i18n";

// The signed-in space is never indexed and never cached: it reads the session on every request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** No session, no page. The administration lives apart, on admin.akinaza.com (app/[locale]/(admin)). */
export default async function MemberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  return (
    <AppFrame locale={locale} email={session.account.email} base={`/${locale}/app`} items={["today", "profile"]}>
      {children}
    </AppFrame>
  );
}
