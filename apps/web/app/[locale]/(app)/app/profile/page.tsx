// @template: app-settings
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";

import { ProfileFrame } from "@/components/account/ProfileFrame";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { currentMember } from "@/lib/member-shop";

const LANGUAGE_NAME = { en: "English", fr: "Français" } as const;

/** The account: the e-mail, the language, the role. In a shop the role is the one held there (Owner, Manager, Staff); anyone else is a member. */
export default async function Profile({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.account.profile;
  const { account } = (await pageSession())!;
  const member = await currentMember(account.id);
  const role = account.role === "ADMIN" ? t.roleAdmin : member ? t.shopRoles[member.role] : t.roleUser;
  return (
    <ProfileFrame locale={locale} current="profile" account={account}>
      <SettingsSection variant="flat" title={t.sections.profile} description={t.description}>
        <SettingsRow label={t.email}>{account.email}</SettingsRow>
        <SettingsRow label={t.language}>{LANGUAGE_NAME[account.locale]}</SettingsRow>
        <SettingsRow label={t.role}>{role}</SettingsRow>
      </SettingsSection>
    </ProfileFrame>
  );
}
