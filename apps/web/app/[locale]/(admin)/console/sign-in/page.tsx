import { AkinazaLogo } from "@krizaka/ui";
import { AuthLayout } from "@krizaka/ui/auth-layout";
import { Badge } from "@krizaka/ui/badge";
import { Mascot } from "@krizaka/ui/mascots";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { SignInForm } from "@/components/console/SignInForm";
import { ipAllowed, pageAdmin } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { PRODUCT_NAME } from "@/lib/brand";

/** The administration's own sign-in (its cookie belongs to admin.akinaza.com), on @krizaka/ui's auth template. */
export default async function AdminSignIn({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  if (!ipAllowed(await headers())) notFound();
  if (await pageAdmin().catch(() => null)) redirect(`/${locale}`);
  const t = getDictionary(locale).console.adminSignIn;
  return (
    <AuthLayout
      brand={
        <span className="inline-flex items-center gap-2">
          <AkinazaLogo size={28} /> {PRODUCT_NAME} <Badge tone="warning">{t.dev}</Badge>
        </span>
      }
      promise={t.promise}
      aside={<Mascot bird="falcon" mood="welcome" size={72} />}
      asideFooter={t.asideFooter}
      title={t.title}
      description={t.description}
    >
      <SignInForm next={`/${locale}`} forgotPassword={false} />
    </AuthLayout>
  );
}
