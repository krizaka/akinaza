"use client";

import { Alert } from "@krizaka/ui/alert";
import { Select } from "@krizaka/ui/field";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

export interface SwitcherShop {
  id: string;
  name: string;
}

/** The shops the person works in, one choice: the space below follows it. Nothing for someone with a single shop. */
export function ShopSwitcher({ shops, currentId }: { shops: SwitcherShop[]; currentId: string }) {
  const { say } = useSay();
  const call = useCall();
  if (shops.length < 2) return null;
  return (
    <div className="flex flex-col gap-1">
      <label className="sr-only" htmlFor="shop-switcher">
        {say("shell.shopSwitcher")}
      </label>
      <Select id="shop-switcher" value={currentId} disabled={call.pending} onChange={(event) => void call.run("/api/me/current-shop", { json: { shopId: event.target.value } })}>
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
    </div>
  );
}
