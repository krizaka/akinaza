import { cn } from "@krizaka/ui/cn";
import { Stuck } from "@krizaka/ui/stuck";
import Link from "next/link";

import type { FlyerView } from "@/lib/community-view";

/**
 * The board never ends on an orphan (akinaza#440): two or four flyers sit two by two, otherwise three by three and a last, incomplete row
 * is left out (five show three, seven and eight show six). One, two, three and four are shown whole.
 */
export function bulletinLayout(count: number): {
  shown: number;
  columns: 2 | 3;
} {
  if (count === 2 || count === 4) return { shown: count, columns: 2 };
  return { shown: count > 3 ? count - (count % 3) : count, columns: 3 };
}

/**
 * The papers of the board: four real post-it tints, read from the page's own tokens so both themes keep their contrast
 * (the ink is the theme's text). Until `PinnedNote` of @krizaka/ui carries `paper` and `action` (krizaka-ui#828
 * ) the note is drawn here; then this file adopts it.
 */
const PAPERS = [
  "bg-warning-soft",
  "bg-danger-soft",
  "bg-success-soft",
  "bg-accent-soft",
] as const;

/** A flyer's look is read from its id, never from chance: the same flyer is the same paper, hold and lean on every render and every device. */
export function flyerLook(id: string): {
  paper: (typeof PAPERS)[number];
  hold: "pin" | "tape";
  tilt: number;
} {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return {
    paper: PAPERS[h % PAPERS.length],
    hold: (h >>> 8) % 2 === 0 ? "pin" : "tape",
    tilt: (((h >>> 12) % 41) - 20) / 10,
  };
}

/**
 * The bulletin board: at most three flyers, each a post-it stuck on the board with its whole text (a flyer is not cut at a card's length), the newest first.
 * The same component is the home's neighbourhood feed: a flyer that comes with its shop (`flyer.shop`) leads to the shop's page (`visit` says how).
 */
export function Bulletin({
  flyers,
  label,
  visit,
}: Readonly<{
  flyers: FlyerView[];
  label: string;
  visit?: (shop: string) => string;
}>) {
  const { shown, columns } = bulletinLayout(flyers.length);
  return (
    <ul
      aria-label={label}
      className={cn(
        "m-0 grid list-none gap-8 p-0",
        columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
      )}
      data-bulletin=""
    >
      {flyers.slice(0, shown).map((f) => {
        const look = flyerLook(f.id);
        return (
          <li key={f.id}>
            <Stuck
              as="aside"
              hold={look.hold}
              tilt={look.tilt}
              className="block"
            >
              <div className="text-border-default drop-shadow-[2px_3px_0_currentColor]">
                <div
                  data-postit=""
                  className={cn(
                    "flex min-h-40 flex-col gap-3 p-5 pt-6 text-fg [clip-path:polygon(0_0,calc(100%-1rem)_0,100%_1rem,100%_100%,0_100%)]",
                    look.paper,
                  )}
                >
                  <p className="m-0 text-lg leading-relaxed">{f.text}</p>
                  {f.until || f.shop ? (
                    <div className="mt-auto flex flex-col gap-1">
                      {f.until ? (
                        <p className="m-0 text-sm text-fg-secondary">
                          {f.until}
                        </p>
                      ) : null}
                      {f.shop ? (
                        <Link
                          href={f.shop.href}
                          className="rounded-sm text-sm font-semibold text-fg underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {visit ? visit(f.shop.name) : f.shop.name}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </Stuck>
          </li>
        );
      })}
    </ul>
  );
}
