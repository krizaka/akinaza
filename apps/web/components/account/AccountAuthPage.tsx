import { ProductLockup } from "@krizaka/ui";
import { AuthLayout } from "@krizaka/ui/auth-layout";
import { Mascot } from "@krizaka/ui/mascots";
import Link from "next/link";

import { endorsementIn, PRODUCT_NAME } from "@/lib/brand";
import { getDictionary, type Locale } from "@/lib/i18n";

/** The account's signed-out pages (forgotten password, reset, sign-up) on @krizaka/ui's auth template: one brand, one promise, the beaver. */
export function AccountAuthPage({ locale, title, description, footer, legal, children }: Readonly<{ locale: Locale; title: string; description?: string; footer: React.ReactNode; legal?: React.ReactNode; children: React.ReactNode }>) {
  const t = getDictionary(locale).console;
  return (
    <AuthLayout
      brand={
        <Link href={`/${locale}`} className="inline-flex items-center gap-2">
          <ProductLockup id="akinaza" name={PRODUCT_NAME} endorsement={endorsementIn(locale)} size={28} layout="inline" />
        </Link>
      }
      promise={t.signIn.promise}
      aside={<Mascot bird="beaver" mood="welcome" size={72} />}
      asideFooter={t.signIn.asideFooter}
      title={title}
      description={description}
      footer={footer}
      legal={legal}
    >
      {children}
    </AuthLayout>
  );
}
