// @template: app-settings
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { ProfileSettings } from "@/components/account/ProfileSettings";
import { accountPage } from "@/lib/account-page";
import { accountRoleLine } from "@/lib/account-sections";
import { formatMonth } from "@/lib/format";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/** The account: name, picture, e-mail with its verified state, since when, and the role held in the shop in use. */
export default async function Profile({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.account;
  const { session, profile, member, sections, openedAt, timeZone } = await accountPage();
  const role = accountRoleLine(t.profile, { admin: session.account.role === "ADMIN", member });
  const memberSince = openedAt ? format(t.memberSince, { month: formatMonth(openedAt, locale, timeZone) }) : null;
  return (
    <ProfileFrame locale={locale} current="profile" account={profile} sections={sections}>
      <ProfileSettings profile={{ ...profile, memberSince, role }} />
    </ProfileFrame>
  );
}
