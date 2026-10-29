// @template: app-settings
import { DataPanel } from "@/components/account/DataPanel";
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { accountPage } from "@/lib/account-page";
import { asLocale } from "@/lib/i18n";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/** My data (Loi 25): the export of everything held, and the deletion of the account. */
export default async function MyData({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const { profile, sections } = await accountPage();
  return (
    <ProfileFrame locale={locale} current="data" account={profile} sections={sections}>
      <DataPanel signInHref={`/${locale}/sign-in`} />
    </ProfileFrame>
  );
}
