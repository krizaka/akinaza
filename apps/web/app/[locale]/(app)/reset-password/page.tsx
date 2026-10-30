import { Alert } from "@krizaka/ui/alert";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountAuthPage } from "@/components/account/AccountAuthPage";
import { ResetForm } from "@/components/account/AccountForms";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.meta.reset, robots: { index: false, follow: false } };
}

/** The page of a reset link: the token comes from the e-mail (`?token=`); without it, the page says so. */
export default async function ResetPasswordPage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }>) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console;
  const { token } = await searchParams;
  const signInHref = `/${locale}/sign-in`;
  return (
    <AccountAuthPage
      locale={locale}
      title={t.account.reset.title}
      footer={
        <Link className="font-semibold text-fg-accent" href={signInHref}>
          {t.account.reset.back}
        </Link>
      }
    >
      {token ? <ResetForm token={token} signInHref={`/${locale}/forgot-password`} /> : <Alert tone="danger">{t.account.reset.missing}</Alert>}
    </AccountAuthPage>
  );
}
