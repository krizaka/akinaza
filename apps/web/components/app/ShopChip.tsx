"use client";

import { ChevronDownIcon, PlusIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { rememberShop } from "@/app/actions/remember-shop";
import { useSay } from "@/lib/i18n-client";
import { inOtherShop, type RouteLocale } from "@/lib/routes";

export interface ChipShop {
  id: string;
  name: string;
}

/**
 * The shop the frame is about, named in the header (docs/ux/2026-10-full-review.md A2, A5). A plain chip when there is nothing to
 * choose; a menu when the account works in other shops or may add one: the other shops open the same page there (the address
 * says which shop is open, the cookie only remembers it), « Ajouter une boutique » at the end.
 */
export function ShopChip({ locale, current, others, addHref }: Readonly<{ locale: RouteLocale; current: ChipShop; others: ChipShop[]; /** Where a new shop is created; null for who may not. */ addHref: string | null }>) {
  const { say } = useSay();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  if (others.length === 0 && !addHref) {
    return (
      <Badge tone="neutral" className="max-w-28 truncate sm:max-w-40" data-testid="shop-chip" title={current.name}>
        {current.name}
      </Badge>
    );
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm" className="max-w-28 gap-1 font-semibold sm:max-w-48" data-testid="shop-chip" aria-label={`${say("shell.shopSwitcher")} · ${current.name}`}>
          <span className="truncate">{current.name}</span>
          <ChevronDownIcon size={14} aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.Label>{say("shell.shops")}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={current.id}
          onValueChange={(next) => {
            if (next === current.id) return;
            void rememberShop(next);
            router.push(inOtherShop(locale, pathname, current.id, next));
          }}
        >
          {[current, ...others].map((shop) => (
            <DropdownMenu.RadioItem key={shop.id} value={shop.id}>
              {shop.name}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        {addHref ? (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item asChild>
              <Link href={addHref}>
                <PlusIcon size={16} aria-hidden /> {say("shopSetup.addShop.link")}
              </Link>
            </DropdownMenu.Item>
          </>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
