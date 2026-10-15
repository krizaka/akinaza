import { AkinazaLogo } from "@krizaka/ui";
import { Alert } from "@krizaka/ui/alert";
import { AuthLayout } from "@krizaka/ui/auth-layout";
import { Mascot } from "@krizaka/ui/mascots";
import type { Metadata } from "next";
import Link from "next/link";

import { ResetForm } from "@/components/account/AccountForms";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.meta.reset, robots: { index: false, follow: false } };
}

/** The page of a reset link: the token comes from the e-mail (`?token=`); without it, the page says so. */
export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console;
  const { token } = await searchParams;
  const signInHref = `/${locale}/sign-in`;
  return (
    <AuthLayout
      brand={
        <Link href={`/${locale}`} className="inline-flex items-center gap-2">
          <AkinazaLogo size={28} /> Akinaza
        </Link>
      }
      promise={t.signIn.promise}
      aside={<Mascot bird="beaver" mood="welcome" size={72} />}
      asideFooter={t.signIn.asideFooter}
      title={t.account.reset.title}
      footer={
        <Link className="font-semibold text-fg-accent" href={signInHref}>
          {t.account.reset.back}
        </Link>
      }
    >
      {token ? <ResetForm token={token} signInHref={`/${locale}/forgot-password`} /> : <Alert tone="danger">{t.account.reset.missing}</Alert>}
    </AuthLayout>
  );
}
