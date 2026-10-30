"use client";

import { BillingIcon, ClockIcon, HomeIcon, ServerIcon, ShieldIcon, UserIcon, UsersIcon } from "@krizaka/icons";
import { AkinazaLogo } from "@krizaka/ui";
import { AppFrame as KrizakaAppFrame, type FrameSection } from "@krizaka/ui/app-frame";
import { SkipLink } from "@krizaka/ui/skip-link";
import Link from "next/link";

import { FrameSlot } from "@/components/app/FrameSlot";
import { useFrameAccount } from "@/components/app/use-frame-account";
import { useSay } from "@/lib/i18n-client";

const ICONS = { overview: <HomeIcon />, users: <UserIcon />, shops: <UsersIcon />, invoices: <BillingIcon />, ledger: <ShieldIcon />, operations: <ServerIcon />, audit: <ClockIcon />, organize: <ShieldIcon />, incidents: <ShieldIcon />, addresses: <ShieldIcon />, prices: <BillingIcon />, storage: <ServerIcon /> } as const;
export type AdminPlace = keyof typeof ICONS;

/**
 * The administration's signed-in frame (admin.akinaza.com): the shared `AppFrame` of @krizaka/ui in its `admin` variant, the same
 * rail, header and account menu as the shop's space (`ShopFrame`), with a chip saying where you are. The first five sections are the
 * tab bar on a phone; the others sit at the rail's foot.
 */
export function AppFrame({ locale, email, name, avatarSeed, base, items, children }: Readonly<{ locale: "en" | "fr"; email: string; name?: string | null; avatarSeed?: string | null; base: string; items: AdminPlace[]; children: React.ReactNode }>) {
  const { say } = useSay();
  const { path, account, language } = useFrameAccount({ locale, email, name, avatarSeed, profileHref: `${base}/profile` });
  const hrefOf = (key: AdminPlace) => (key === "overview" ? base : `${base}/${key}`);
  const sections: FrameSection[] = items.map((key, i) => ({ id: key, label: say(`shell.${key}`), href: hrefOf(key), icon: ICONS[key], place: i < 5 ? "main" : "foot" }));
  const isCurrent = (to: string) => path === to || (to !== base && path.startsWith(`${to}/`));
  return (
    <>
      <SkipLink>{say("shell.skip")}</SkipLink>
      <FrameSlot>
      <KrizakaAppFrame
        name="Akinaza"
        label={say("shell.admin")}
        mark={<AkinazaLogo size={28} animated={false} />}
        headerMark={<AkinazaLogo size={22} animated={false} />}
        homeHref={base}
        accent="akinaza"
        variant="admin"
        sections={sections}
        currentId={items.find((key) => isCurrent(hrefOf(key)))}
        account={account}
        language={language}
        locale={locale}
        linkAs={Link}
      >
        <main id="content" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </KrizakaAppFrame>
      </FrameSlot>
    </>
  );
}
