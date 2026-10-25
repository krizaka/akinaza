import type { Metadata } from "next";
import Link from "next/link";

import { passwordResetTtlMinutes } from "@/app/accounts";
import { AccountAuthPage } from "@/components/account/AccountAuthPage";
import { ForgotForm } from "@/components/account/AccountForms";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.meta.forgot, robots: { index: false, follow: false } };
}

/** "Forgot password" on @krizaka/ui's auth template: the same answer for every address. */
export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console;
  return (
    <AccountAuthPage
      locale={locale}
      title={t.account.forgot.title}
      description={t.account.forgot.description}
      footer={
        <Link className="font-semibold text-fg-accent" href={`/${locale}/sign-in`}>
          {t.account.forgot.back}
        </Link>
      }
    >
      <ForgotForm minutes={await passwordResetTtlMinutes()} />
    </AccountAuthPage>
  );
}
