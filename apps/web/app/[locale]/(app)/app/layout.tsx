import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageSession } from "@/lib/access";
import { asLocale } from "@/lib/i18n";

// The signed-in space is never indexed and never cached: it reads the session on every request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** No session, no page. The frame is drawn below, where the shop (or the lack of one) is known. The administration lives apart (admin.akinaza.com). */
export default async function MemberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  if (!(await pageSession())) redirect(`/${locale}/sign-in`);
  return children;
}
