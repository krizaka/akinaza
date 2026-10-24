"use client";

import { LogoutIcon, UserIcon } from "@krizaka/icons";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { languagesFor } from "@krizaka/ui/language-switch";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export interface AccountMenuWords {
  /** The trigger's accessible name. */
  account: string;
  settings: string;
  language: string;
  theme: string;
  signOut: string;
}

/**
 * The signed-in person, the same everywhere (@krizaka/ui AccountMenu, the family's standard): avatar, name and e-mail, then
 * Settings, the language, the theme and Sign out. The shell puts it at the bottom of the rail and in the phone's header;
 * the public bar puts it beside « Open the app ».
 */
export function AkinazaAccountMenu({ locale, name, email, avatarSeed, settingsHref, words, onSignOut, showName = false }: { locale: "en" | "fr"; name?: string | null; /** Omitted in the public bar: no address is printed there (krizaka/akinaza#285). */ email?: string; avatarSeed?: string | null; settingsHref: string; words: AccountMenuWords; onSignOut: () => void; showName?: boolean }) {
  const router = useRouter();
  const path = usePathname() ?? `/${locale}`;
  const languages = languagesFor(path);
  return (
    <AccountMenu
      label={words.account}
      name={name ?? undefined}
      email={email}
      avatar={{ defaultAvatar: { brand: "akinaza", seed: avatarSeed ?? email ?? name ?? "akinaza" }, alt: "", fallback: (name ?? email ?? "A").slice(0, 1).toUpperCase() }}
      showName={showName}
      linkAs={Link}
      links={[{ id: "settings", label: words.settings, href: settingsHref, icon: <UserIcon size={16} /> }]}
      language={{ label: words.language, value: locale, options: languages.map((l) => ({ value: l.code, label: l.name })), onChange: (code) => router.push(languages.find((l) => l.code === code)?.href ?? path) }}
      signOut={{ label: words.signOut, onSelect: onSignOut, icon: <LogoutIcon size={16} /> }}
    >
      <ThemeToggle label={words.theme} variant="ghost" />
    </AccountMenu>
  );
}
