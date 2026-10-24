"use client";

import { BillingIcon, BookmarkIcon, CalendarIcon, ClockIcon, HomeIcon, PlusIcon, UsersIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { AkinazaLogo } from "@krizaka/ui";
import { AppHeader } from "@krizaka/ui/app-header";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { RailNav } from "@krizaka/ui/rail-nav";
import { SkipLink } from "@krizaka/ui/skip-link";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AkinazaAccountMenu } from "@/components/account/AkinazaAccountMenu";
import { type ChipShop, ShopChip } from "@/components/app/ShopChip";
import { type AppPlace, headerActionFits } from "@/lib/app-nav";
import { useSay } from "@/lib/i18n-client";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const ICONS: Record<AppPlace, React.ReactNode> = { today: <ClockIcon />, clients: <UsersIcon />, invoices: <BillingIcon />, books: <BookmarkIcon />, shop: <HomeIcon />, bookings: <CalendarIcon /> };

export interface ShopFrameProps {
  locale: "en" | "fr";
  account: { id?: string; email: string; name?: string | null; avatarSeed?: string | null };
  /** The rail's destinations, in the order of the day, each with where it leads: five at most (a phone's tab bar). */
  places: readonly { key: AppPlace; href: string; /** Other addresses the place is the current one for (« Boutique » also at the team). */ also?: readonly string[] }[];
  /** The shop the frame is about and the others the account works in; none for a client. */
  shop?: { current: ChipShop; others: ChipShop[]; addHref: string | null };
  /** The app's one primary action, « Nouvelle facture », for who may issue invoices. */
  newInvoiceHref?: string | null;
  /** A deployment kept out of search engines says so in the header (from the `sm` breakpoint: a phone keeps the room for the shop). */
  dev?: boolean;
  home: string;
  profileHref: string;
  children: React.ReactNode;
}

/**
 * The signed-in frame of the shop's space (docs/ux/2026-10-full-review.md § 4.1, the family's rule): where you work is on the rail
 * — five destinations, icons on a desktop, the tab bar on a phone — and who you are is under the avatar, in the header, at every
 * width. The header names the product and the shop, carries the DEV chip and the one primary action; the page's `h1` is in the
 * content (`PageHeader`), never here. The administration keeps `AppFrame` (admin.akinaza.com).
 */
export function ShopFrame({ locale, account, places, shop, newInvoiceHref, dev = false, home, profileHref, children }: ShopFrameProps) {
  const { say } = useSay();
  const router = useRouter();
  const path = usePathname() ?? "";
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => {
      router.replace(`/${locale}/sign-in`);
      router.refresh();
    },
  });
  const isCurrent = (to: string) => {
    const pathname = to.split("?")[0]!;
    return path === pathname || path.startsWith(`${pathname}/`);
  };
  const menu = (
    <AkinazaAccountMenu
      locale={locale}
      accountId={account.id}
      name={account.name}
      email={account.email}
      avatarSeed={account.avatarSeed}
      settingsHref={profileHref}
      showName={Boolean(account.name)}
      words={{ account: say("shell.account"), settings: say("shell.settings"), language: say("shell.language"), theme: say("shell.theme"), signOut: say("shell.signOut") }}
      onSignOut={() => signOut.mutate()}
    />
  );
  return (
    <RailNav.Shell>
      <SkipLink>{say("shell.skip")}</SkipLink>
      <RailNav.Root
        label="Akinaza"
        accent="akinaza"
        mark={
          <Link href={home} aria-label="Akinaza">
            <AkinazaLogo size={28} animated={false} />
          </Link>
        }
        expandable
        expandLabels={[say("shell.expand"), say("shell.collapse")]}
      >
        {places.map(({ key, href, also }) => (
          <RailNav.Item key={key} asChild icon={ICONS[key]} label={say(`shell.${key}`)} current={isCurrent(href) || (also ?? []).some(isCurrent)}>
            <Link href={href} />
          </RailNav.Item>
        ))}
      </RailNav.Root>
      <RailNav.Body>
        <AppHeader
          name="Akinaza"
          mark={<AkinazaLogo size={22} animated={false} />}
          homeLink={<Link href={home} />}
          chips={
            <>
              {shop ? <ShopChip locale={locale} current={shop.current} others={shop.others} addHref={shop.addHref} /> : null}
              {dev ? (
                <Badge tone="warning" className="hidden sm:inline-flex" data-testid="app-version" title={VERSION ? say("shell.devBuild", { version: VERSION }) : undefined}>
                  {say("shell.dev")}
                </Badge>
              ) : null}
            </>
          }
          actions={
            <>
              {newInvoiceHref && headerActionFits(path) ? (
                <Button asChild variant="primary" shape="cut" size="sm" className="font-bold">
                  <Link href={newInvoiceHref} aria-label={say("shell.newInvoice")} data-testid="primary-action">
                    <PlusIcon size={16} strokeWidth={2.5} aria-hidden />
                    <span className="hidden sm:inline">{say("shell.newInvoice")}</span>
                  </Link>
                </Button>
              ) : null}
              <div data-testid="account-menu-header">{menu}</div>
            </>
          }
        />
        <main id="content" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </RailNav.Body>
    </RailNav.Shell>
  );
}
