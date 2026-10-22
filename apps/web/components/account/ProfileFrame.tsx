import { SettingsLayout } from "@krizaka/ui/settings-layout";
import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";
import { ACCOUNT_SECTIONS, accountRoutes,type AccountSection } from "@/lib/routes";

export interface ProfileFrameProps {
  locale: Locale;
  current: AccountSection;
  account: { email: string; name?: string | null };
  children: React.ReactNode;
}

/** The frame of every account page: who you are on top, the sections beside the page (the account baseline on the app-settings template). */
export function ProfileFrame({ locale, current, account, children }: ProfileFrameProps) {
  const t = getDictionary(locale).console.account.profile;
  const routes = accountRoutes(locale);
  return (
    <SettingsLayout
      variant="flat"
      navLabel={t.sectionsLabel}
      linkAs={Link}
      nav={ACCOUNT_SECTIONS.map((id) => ({ id, label: t.sections[id], href: routes.section(id), current: id === current }))}
      title={account.name ?? t.title}
      description={account.email}
    >
      {children}
    </SettingsLayout>
  );
}
