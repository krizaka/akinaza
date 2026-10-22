import { SettingsLayout } from "@krizaka/ui/settings-layout";
import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";
import { accountRoutes } from "@/lib/routes";

/** The account's sections, each its own address. */
export const PROFILE_SECTIONS = ["profile", "security"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const HREF = (locale: Locale): Record<ProfileSection, string> => ({ profile: accountRoutes(locale).profile, security: accountRoutes(locale).security });

/** The frame of every account page: who you are on top, the sections beside the page (the account baseline's settings template). */
export function ProfileFrame({ locale, current, account, children }: { locale: Locale; current: ProfileSection; account: { id: string; email: string }; children: React.ReactNode }) {
  const t = getDictionary(locale).console.account.profile;
  return (
    <SettingsLayout
      variant="flat"
      navLabel={t.sectionsLabel}
      linkAs={Link}
      nav={PROFILE_SECTIONS.map((id) => ({ id, label: t.sections[id], href: HREF(locale)[id], current: id === current }))}
      title={t.title}
      description={account.email}
    >
      {children}
    </SettingsLayout>
  );
}
