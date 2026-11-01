"use client";

import { BillingIcon, BookmarkIcon, CalendarIcon, ClockIcon, HomeIcon, PlusIcon, UsersIcon } from "@krizaka/icons";
import { AkinazaLogo } from "@krizaka/ui";
import { AppFrame, type FrameSection } from "@krizaka/ui/app-frame";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { SkipLink } from "@krizaka/ui/skip-link";
import Link from "next/link";
import { useState } from "react";

import { FrameSlot } from "@/components/app/FrameSlot";
import { type ChipShop, ShopChip } from "@/components/app/ShopChip";
import { ShopSearch } from "@/components/app/ShopSearch";
import { useFrameAccount } from "@/components/app/use-frame-account";
import { type AppPlace, screenPrimary } from "@/lib/app-nav";
import { PRODUCT_NAME } from "@/lib/brand";
import { useSay } from "@/lib/i18n-client";
import type { PaletteItem } from "@/lib/palette";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const ICONS: Record<AppPlace, React.ReactNode> = { today: <ClockIcon />, clients: <UsersIcon />, invoices: <BillingIcon />, books: <BookmarkIcon />, shop: <HomeIcon />, bookings: <CalendarIcon /> };

export interface ShopFrameProps {
  locale: "en" | "fr";
  account: { id?: string; email: string; name?: string | null; avatarSeed?: string | null };
  /** The rail's destinations, in the order of the day, each with where it leads: five at most (a phone's tab bar). */
  places: readonly { key: AppPlace; href: string; /** Other addresses the place is the current one for (« Boutique » also at the team). */ also?: readonly string[] }[];
  /** The shop the frame is about and the others the account works in; none for a client. */
  shop?: { current: ChipShop; others: ChipShop[]; addHref: string | null };
  /** The lists' primary action, « Nouvelle facture », for who may issue invoices (it yields where the page holds its own). */
  newInvoiceHref?: string | null;
  /** The header's search (⌘K) over the shop's clients and invoices, for who may open one of them. */
  search?: boolean;
  /** The rail's counts: the day's appointments, the invoices still to collect (none drawn for a zero). */
  counts?: { today?: number; toCollect?: number };
  /** A deployment kept out of search engines says so in the header (from the `sm` breakpoint: a phone keeps the room for the shop). */
  dev?: boolean;
  home: string;
  profileHref: string;
  children: React.ReactNode;
}

/**
 * The signed-in frame of the shop's space: the shared `AppFrame` of @krizaka/ui (one frame, one account menu for the family) fed
 * with this product's data (docs/ux/2026-10-full-review.md § 4.1). Where you work is on the rail (five destinations, icons on a
 * desktop, the tab bar on a phone); who you are is under the avatar in the header, at every width, with the language and the theme.
 * The header names the product and the shop, carries the search (⌘K), the DEV chip and the lists' primary action, which yields
 * where the page holds its own (`screenPrimary`); the page's `h1` is in the content (`PageHeader`), never here. The administration
 * is `AppFrame.tsx`.
 */
export function ShopFrame({ locale, account, places, shop, newInvoiceHref, search = false, counts = {}, dev = false, home, profileHref, children }: Readonly<ShopFrameProps>) {
  const { say } = useSay();
  const [searchOpen, setSearchOpen] = useState(false);
  const { path, account: who, language } = useFrameAccount({ locale, id: account.id, email: account.email, name: account.name, avatarSeed: account.avatarSeed, profileHref });
  const isCurrent = (to: string) => {
    const pathname = to.split("?")[0]!;
    return path === pathname || path.startsWith(`${pathname}/`);
  };
  // A count on the day and on the invoices, said in words with the place's name; nothing for a zero.
  const badgeOf = (key: AppPlace) => {
    const counted: Partial<Record<AppPlace, number>> = { today: counts.today, invoices: counts.toCollect };
    const n = counted[key];
    return n ? { badge: n, badgeLabel: say(key === "today" ? "shell.badges.today" : "shell.badges.toCollect", { count: n }) } : {};
  };
  const sections: FrameSection[] = places.map(({ key, href }) => ({ id: key, label: say(`shell.${key}`), href, icon: ICONS[key], ...badgeOf(key) }));
  const currentId = places.find(({ href, also }) => isCurrent(href) || (also ?? []).some(isCurrent))?.key;
  const actions: PaletteItem[] = [
    ...(newInvoiceHref ? [{ id: "action:new-invoice", group: "actions" as const, label: say("shell.newInvoice"), href: newInvoiceHref }] : []),
    ...places.map(({ key, href }) => ({ id: `place:${key}`, group: "actions" as const, label: say(`shell.${key}`), href })),
  ];
  const searchable = search && shop;
  return (
    <>
      <SkipLink>{say("shell.skip")}</SkipLink>
      <FrameSlot>
      <AppFrame
        name={PRODUCT_NAME}
        mark={<AkinazaLogo size={28} animated={false} />}
        headerMark={<AkinazaLogo size={22} animated={false} />}
        homeHref={home}
        accent="akinaza"
        sections={sections}
        currentId={currentId}
        account={who}
        language={language}
        locale={locale}
        linkAs={Link}
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
        search={searchable ? { label: say("shell.search.open"), onOpen: () => setSearchOpen(true) } : undefined}
        primary={
          newInvoiceHref && screenPrimary(path) === "header" ? (
            <Button asChild variant="primary" size="sm" className="font-bold">
              <Link href={newInvoiceHref} aria-label={say("shell.newInvoice")} data-testid="primary-action" data-primary>
                <PlusIcon size={16} strokeWidth={2.5} aria-hidden />
                <span className="hidden sm:inline">{say("shell.newInvoice")}</span>
              </Link>
            </Button>
          ) : undefined
        }
      >
        <main id="content" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </AppFrame>
      </FrameSlot>
      {searchable ? <ShopSearch locale={locale} shopId={shop.current.id} actions={actions} open={searchOpen} onOpenChange={setSearchOpen} /> : null}
    </>
  );
}
