import { Stuck } from "@krizaka/ui/stuck";

import type { FlyerView } from "@/lib/community-view";

/** The bulletin board: at most three flyers, each pinned on paper with its whole text (a flyer is not cut at a card's length), the newest first. */
export function Bulletin({ flyers, label }: Readonly<{ flyers: FlyerView[]; label: string }>) {
  return (
    <ul aria-label={label} className="m-0 grid list-none gap-6 p-0 md:grid-cols-3" data-bulletin="">
      {flyers.map((f, index) => (
        <li key={f.id}>
          <Stuck as="aside" hold={index % 2 === 0 ? "pin" : "tape"} seed={f.id} className="block">
            <div className="flex min-h-40 flex-col gap-3 border border-border-default bg-surface-1 p-4 text-fg">
              <p className="m-0 text-base leading-relaxed">{f.text}</p>
              {f.until ? <p className="m-0 mt-auto text-sm text-fg-secondary">{f.until}</p> : null}
            </div>
          </Stuck>
        </li>
      ))}
    </ul>
  );
}
