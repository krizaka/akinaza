"use client";

import { Select } from "@krizaka/ui/field";
import { usePathname, useRouter } from "next/navigation";

import { rememberShop } from "@/app/actions/remember-shop";
import { useSay } from "@/lib/i18n-client";
import { inOtherShop, type RouteLocale } from "@/lib/routes";

export interface SwitcherShop {
  id: string;
  name: string;
}

/** The shops the person works in, one choice: it opens the same page in the other shop (the address says which shop is open). Nothing for a single shop. */
export function ShopSwitcher({ locale, shops, currentId }: { locale: RouteLocale; shops: SwitcherShop[]; currentId: string }) {
  const { say } = useSay();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  if (shops.length < 2) return null;
  return (
    <div className="flex flex-col gap-1">
      <label className="sr-only" htmlFor="shop-switcher">
        {say("shell.shopSwitcher")}
      </label>
      <Select
        id="shop-switcher"
        value={currentId}
        onChange={(event) => {
          const next = event.target.value;
          void rememberShop(next);
          router.push(inOtherShop(locale, pathname, currentId, next));
        }}
      >
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
