import type { Metadata } from "next";
import Link from "next/link";

import { AccountAuthPage } from "@/components/account/AccountAuthPage";
import { signupEnabled } from "@/lib/env";
import { asLocale, getDictionary } from "@/lib/i18n";
import { contactHref } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.meta.signUp, robots: { index: false, follow: false } };
}

/**
 * Registration, built and disabled by configuration: while AUTH_SIGNUP_ENABLED is not `true` the page says the sign-up is
 * closed and offers no form. The server refuses it the same way (POST /api/auth/sign-up).
 */
export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console;
  const open = signupEnabled();
  return (
    <AccountAuthPage
      locale={locale}
      title={t.account.signUp.title}
      description={open ? t.account.signUp.description : undefined}
      footer={
        open ? (
          <Link className="font-semibold text-fg-accent" href={`/${locale}/sign-in`}>
            {t.account.signUp.back}
          </Link>
        ) : (
          <>
            <strong className="block font-semibold text-fg">{t.account.signUp.closedTitle}</strong>
            <span className="block">{t.account.signUp.closed}</span>{" "}
            <a className="font-semibold text-fg-accent" href={contactHref("akinaza-sign-up")}>
              {t.account.signUp.contact}
            </a>
          </>
        )
      }
    >
      {open ? <p className="text-sm text-fg-secondary">{t.account.signUp.description}</p> : <Link className="font-semibold text-fg-accent" href={`/${locale}/sign-in`}>{t.account.signUp.back}</Link>}
    </AccountAuthPage>
  );
}
