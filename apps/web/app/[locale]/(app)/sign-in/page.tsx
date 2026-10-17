import { AkinazaLogo } from "@krizaka/ui";
import { AuthLayout } from "@krizaka/ui/auth-layout";
import { Mascot } from "@krizaka/ui/mascots";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/console/SignInForm";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { safeNext } from "@/lib/next-url";
import { contactHref } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.meta.signIn, robots: { index: false, follow: false } };
}

/** Sign-in on @krizaka/ui's auth template, Akinaza's mark and its owl. Sign-up is closed — the page says so. */
export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const locale = asLocale((await params).locale);
  // Back to where the person was going — an address of this site only, in this language (never an open redirect).
  const wanted = (await searchParams).next;
  const next = safeNext(wanted, locale);
  if (await pageSession().catch(() => null)) redirect(next);
  const t = getDictionary(locale).console.signIn;
  return (
    <AuthLayout
      brand={
        <Link href={`/${locale}`} className="inline-flex items-center gap-2">
          <AkinazaLogo size={28} /> Akinaza
        </Link>
      }
      promise={t.promise}
      aside={<Mascot bird="beaver" mood="welcome" size={72} />}
      asideFooter={t.asideFooter}
      title={t.title}
      description={t.description}
      footer={
        <>
          <strong className="block font-semibold text-fg">{t.closedTitle}</strong>
          <span className="block">{t.closed}</span>{" "}
          <a className="font-semibold text-fg-accent" href={contactHref("akinaza-sign-in")}>
            {t.contact}
          </a>
        </>
      }
      legal={
        <>
          {t.legalPrefix}
          <Link className="underline" href={`/${locale}/privacy`}>
            {t.privacy}
          </Link>
          .
        </>
      }
    >
      <SignInForm next={next} />
    </AuthLayout>
  );
}
