import { Stuck } from "@krizaka/ui/stuck";
import Link from "next/link";

import type { FlyerView } from "@/lib/community-view";

/**
 * The bulletin board: at most three flyers, each pinned on paper with its whole text (a flyer is not cut at a card's length), the newest first.
 * The same component is the home's neighbourhood feed: a flyer that comes with its shop (`flyer.shop`) leads to the shop's page (`visit` says how).
 */
export function Bulletin({ flyers, label, visit }: Readonly<{ flyers: FlyerView[]; label: string; visit?: (shop: string) => string }>) {
  return (
    <ul aria-label={label} className="m-0 grid list-none gap-6 p-0 md:grid-cols-3" data-bulletin="">
      {flyers.map((f, index) => (
        <li key={f.id}>
          <Stuck as="aside" hold={index % 2 === 0 ? "pin" : "tape"} seed={f.id} className="block">
            <div className="flex min-h-40 flex-col gap-3 border border-border-default bg-surface-1 p-4 text-fg">
              <p className="m-0 text-base leading-relaxed">{f.text}</p>
              {f.until || f.shop ? (
                <div className="mt-auto flex flex-col gap-1">
                  {f.until ? <p className="m-0 text-sm text-fg-secondary">{f.until}</p> : null}
                  {f.shop ? (
                    <Link href={f.shop.href} className="text-sm font-medium text-fg underline underline-offset-4">
                      {visit ? visit(f.shop.name) : f.shop.name}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Stuck>
        </li>
      ))}
    </ul>
  );
}
