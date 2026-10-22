// @template: app-settings
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { ProfileSettings } from "@/components/account/ProfileSettings";
import { accountPage } from "@/lib/account-page";
import { asLocale, getDictionary } from "@/lib/i18n";
import { lastMember } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/** The account: name, picture, e-mail with its verified state, and the role held in the shop in use. */
export default async function Profile({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.account;
  const { session, profile } = await accountPage();
  const member = await lastMember(session.account.id);
  const role = session.account.role === "ADMIN" ? t.profile.roleAdmin : member ? t.profile.shopRoles[member.role] : t.profile.roleUser;
  return (
    <ProfileFrame locale={locale} current="profile" account={profile}>
      <ProfileSettings profile={{ ...profile, memberSince: role }} />
    </ProfileFrame>
  );
}
