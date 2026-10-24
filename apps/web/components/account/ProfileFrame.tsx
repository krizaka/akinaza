import { SettingsLayout } from "@krizaka/ui/settings-layout";
import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";
import { ACCOUNT_SECTIONS, accountRoutes, type AccountSection } from "@/lib/routes";

export interface ProfileFrameProps {
  locale: Locale;
  current: AccountSection;
  /** Who the page is about: only the display name reaches the title; the address stays in the profile's identity card. */
  account: { name?: string | null };
  /** The sections this person may open (`accountSectionsFor`): all five for an owner, no subscription for a manager or staff. */
  sections?: readonly AccountSection[];
  children: React.ReactNode;
}

/**
 * The frame of every account page (the app-settings template): the person's name as the title — « Mon compte » until they
 * give one, never their e-mail — and the sections beside the page.
 */
export function ProfileFrame({ locale, current, account, sections = ACCOUNT_SECTIONS, children }: ProfileFrameProps) {
  const t = getDictionary(locale).console.account.profile;
  const routes = accountRoutes(locale);
  const name = account.name?.trim();
  return (
    <SettingsLayout
      variant="flat"
      navLabel={t.sectionsLabel}
      linkAs={Link}
      nav={sections.map((id) => ({ id, label: t.sections[id], href: routes.section(id), current: id === current }))}
      title={name || t.accountTitle}
      description={t.description}
    >
      {children}
    </SettingsLayout>
  );
}
